const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db/knex');
const { loginAs } = require('./helpers/auth');

afterAll(async () => {
  await db.destroy();
});

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

async function createPatient() {
  const mgmt = await loginAs('Management');
  const res = await request(app)
    .post('/api/patients')
    .set('Authorization', `Bearer ${mgmt}`)
    .send({ firstName: 'Fin', lastName: `Patient-${Date.now()}-${Math.random()}`, dateOfBirth: '1990-01-01' });
  return res.body.id;
}

// Creates a statement and immediately pays it in full, so a real payment (with an OR number)
// lands in the range these tests query — the sales journal/ledger/summary all read from
// `payments`, not `billing_statements`, since a payment is the actual revenue-recognition event.
async function createPaidStatement(mgmtToken, patientId, amount, orNumber) {
  const statement = await request(app)
    .post('/api/billing/statements')
    .set('Authorization', `Bearer ${mgmtToken}`)
    .send({ patientId, sourceType: 'manual', items: [{ description: 'Financial test charge', quantity: 1, unitPrice: amount }] });

  await request(app)
    .post(`/api/billing/statements/${statement.body.id}/payments`)
    .set('Authorization', `Bearer ${mgmtToken}`)
    .send({ amountPaid: amount, paymentMethod: 'cash', orNumber });

  return statement.body.id;
}

describe('expenses', () => {
  it('Management can record and void an expense; Admin cannot (no financial.manage by default)', async () => {
    const mgmt = await loginAs('Management');
    const admin = await loginAs('Admin');

    const adminAttempt = await request(app)
      .post('/api/financial/expenses')
      .set('Authorization', `Bearer ${admin}`)
      .send({ expenseDate: todayDateString(), category: 'supplies', description: 'Gloves', amount: 500 });
    expect(adminAttempt.status).toBe(403);

    const created = await request(app)
      .post('/api/financial/expenses')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ expenseDate: todayDateString(), category: 'supplies', description: 'Gloves', amount: 500 });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('active');
    expect(created.body.amount).toBe('500.00');

    const voided = await request(app)
      .post(`/api/financial/expenses/${created.body.id}/void`)
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ reason: 'Entered twice by mistake' });
    expect(voided.status).toBe(200);
    expect(voided.body.status).toBe('voided');

    const revoid = await request(app)
      .post(`/api/financial/expenses/${created.body.id}/void`)
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ reason: 'Again' });
    expect(revoid.status).toBe(400);
  });

  it('rejects a non-positive amount and an unknown category', async () => {
    const mgmt = await loginAs('Management');

    const badAmount = await request(app)
      .post('/api/financial/expenses')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ expenseDate: todayDateString(), category: 'supplies', description: 'x', amount: 0 });
    expect(badAmount.status).toBe(400);

    const badCategory = await request(app)
      .post('/api/financial/expenses')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ expenseDate: todayDateString(), category: 'not-a-category', description: 'x', amount: 100 });
    expect(badCategory.status).toBe(400);
  });
});

describe('sales journal / ledger / summary', () => {
  it('reflects a real payment inside the queried range and excludes one outside it', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient();
    const today = todayDateString();
    const orNumber = `OR-${Date.now()}`;

    await createPaidStatement(mgmt, patientId, 750, orNumber);

    const journal = await request(app)
      .get('/api/financial/sales-journal')
      .query({ startDate: today, endDate: today })
      .set('Authorization', `Bearer ${mgmt}`);
    expect(journal.status).toBe(200);
    const row = journal.body.find((r) => r.or_number === orNumber);
    expect(row).toBeDefined();
    expect(Number(row.amount_paid)).toBe(750);
    expect(row.patient_name).toMatch(/Fin/);

    const ledger = await request(app)
      .get('/api/financial/sales-ledger')
      .query({ startDate: today, endDate: today })
      .set('Authorization', `Bearer ${mgmt}`);
    expect(ledger.status).toBe(200);
    expect(ledger.body).toHaveLength(1);
    expect(ledger.body[0].date.slice(0, 10)).toBe(today);
    expect(ledger.body[0].totalAmount).toBeGreaterThanOrEqual(750);

    const summary = await request(app)
      .get('/api/financial/summary')
      .query({ startDate: today, endDate: today })
      .set('Authorization', `Bearer ${mgmt}`);
    expect(summary.status).toBe(200);
    expect(summary.body.totalRevenue).toBeGreaterThanOrEqual(750);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);
    const outsideRange = await request(app)
      .get('/api/financial/sales-journal')
      .query({ startDate: yStr, endDate: yStr })
      .set('Authorization', `Bearer ${mgmt}`);
    expect(outsideRange.body.find((r) => r.or_number === orNumber)).toBeUndefined();
  });

  it('nets revenue against expenses in the profit summary', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient();
    const today = todayDateString();

    await createPaidStatement(mgmt, patientId, 1000, `OR-${Date.now()}-net`);
    await request(app)
      .post('/api/financial/expenses')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ expenseDate: today, category: 'utilities', description: 'Electricity', amount: 200 });

    const summary = await request(app)
      .get('/api/financial/summary')
      .query({ startDate: today, endDate: today })
      .set('Authorization', `Bearer ${mgmt}`);
    expect(summary.status).toBe(200);
    expect(summary.body.netProfit).toBe(round2(summary.body.totalRevenue - summary.body.totalExpenses));
  });
});

describe('permissions', () => {
  it('rejects a Cashier from all financial endpoints (no financial.view/financial.manage)', async () => {
    const cashier = await loginAs('Cashier');
    const today = todayDateString();

    const journal = await request(app)
      .get('/api/financial/sales-journal')
      .query({ startDate: today, endDate: today })
      .set('Authorization', `Bearer ${cashier}`);
    expect(journal.status).toBe(403);

    const expense = await request(app)
      .post('/api/financial/expenses')
      .set('Authorization', `Bearer ${cashier}`)
      .send({ expenseDate: today, category: 'other', description: 'x', amount: 10 });
    expect(expense.status).toBe(403);
  });
});
