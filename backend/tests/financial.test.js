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

describe('cash disbursements', () => {
  it('Management can record and void a cash disbursement; Admin cannot (no financial.manage by default)', async () => {
    const mgmt = await loginAs('Management');
    const admin = await loginAs('Admin');

    const adminAttempt = await request(app)
      .post('/api/financial/cash-disbursements')
      .set('Authorization', `Bearer ${admin}`)
      .send({ disbursementDate: todayDateString(), particulars: 'Petty cash for supplies run', amount: 500, givenTo: 'Juan Dela Cruz' });
    expect(adminAttempt.status).toBe(403);

    const created = await request(app)
      .post('/api/financial/cash-disbursements')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ disbursementDate: todayDateString(), particulars: 'Petty cash for supplies run', amount: 500, givenTo: 'Juan Dela Cruz' });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('active');
    expect(created.body.amount).toBe('500.00');
    expect(created.body.given_to).toBe('Juan Dela Cruz');

    const listed = await request(app)
      .get('/api/financial/cash-disbursements')
      .query({ startDate: todayDateString(), endDate: todayDateString() })
      .set('Authorization', `Bearer ${mgmt}`);
    expect(listed.status).toBe(200);
    expect(listed.body.find((d) => d.id === created.body.id)).toBeDefined();

    const voided = await request(app)
      .post(`/api/financial/cash-disbursements/${created.body.id}/void`)
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ reason: 'Entered twice by mistake' });
    expect(voided.status).toBe(200);
    expect(voided.body.status).toBe('voided');

    const revoid = await request(app)
      .post(`/api/financial/cash-disbursements/${created.body.id}/void`)
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ reason: 'Again' });
    expect(revoid.status).toBe(400);
  });

  it('rejects a non-positive amount and missing required fields', async () => {
    const mgmt = await loginAs('Management');

    const badAmount = await request(app)
      .post('/api/financial/cash-disbursements')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ disbursementDate: todayDateString(), particulars: 'x', amount: 0, givenTo: 'Someone' });
    expect(badAmount.status).toBe(400);

    const missingGivenTo = await request(app)
      .post('/api/financial/cash-disbursements')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ disbursementDate: todayDateString(), particulars: 'x', amount: 100 });
    expect(missingGivenTo.status).toBe(400);
  });

  it('is included in the Summary and subtracted from net profit alongside expenses', async () => {
    const mgmt = await loginAs('Management');
    const today = todayDateString();

    await request(app)
      .post('/api/financial/cash-disbursements')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ disbursementDate: today, particulars: 'Cash advance for wound-dressing supplies', amount: 150, givenTo: 'Nurse Santos' });

    const summary = await request(app)
      .get('/api/financial/summary')
      .query({ startDate: today, endDate: today })
      .set('Authorization', `Bearer ${mgmt}`);
    expect(summary.status).toBe(200);
    expect(summary.body.totalCashDisbursements).toBeGreaterThanOrEqual(150);
    expect(summary.body.netProfit).toBe(
      round2(summary.body.totalRevenue - summary.body.totalExpenses - summary.body.totalCashDisbursements)
    );
  });
});

describe('sales journal / summary', () => {
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
    expect(summary.body.netProfit).toBe(
      round2(summary.body.totalRevenue - summary.body.totalExpenses - summary.body.totalCashDisbursements)
    );
  });
});

// Creates a Category III animal-bite record, receives an inventory batch with a known unit
// cost, and administers one dose against that tracked batch — the fixture getPurchases's cost-
// of-goods lookup (getAnimalBiteCostOfGoods) is meant to pick up.
async function createAnimalBiteRecordWithCostedDose(unitCost) {
  const mgmt = await loginAs('Management');
  const nurse = await loginAs('Nurse');
  const doctor = await loginAs('Doctor');

  const patientRes = await request(app)
    .post('/api/patients')
    .set('Authorization', `Bearer ${mgmt}`)
    .send({ firstName: 'Purch', lastName: `Test-${Date.now()}-${Math.random()}`, dateOfBirth: '1990-01-01' });

  const item = await request(app)
    .post('/api/inventory')
    .set('Authorization', `Bearer ${nurse}`)
    .send({ name: `PVRV-${Date.now()}`, category: 'vaccine', unit: 'vial', reorderThreshold: 5 });
  const batch = await request(app)
    .post(`/api/inventory/${item.body.id}/batches`)
    .set('Authorization', `Bearer ${nurse}`)
    .send({ batchLotNumber: `LOT-${Date.now()}`, quantityReceived: 5, unitCost });
  const batchId = batch.body.batches[0].id;

  const record = await request(app)
    .post('/api/animal-bite-records')
    .set('Authorization', `Bearer ${nurse}`)
    .send({
      patientId: patientRes.body.id,
      visitDate: todayDateString(),
      dateOfExposure: todayDateString(),
      animalType: 'Dog',
      biteLocation: 'Hand',
      woundDescription: 'Puncture wound',
      vitalSigns: { bp: '120/80', temp: '36.7', pulse: '80', respRate: '18', weight: '70' },
    });
  await request(app)
    .patch(`/api/animal-bite-records/${record.body.id}/diagnosis`)
    .set('Authorization', `Bearer ${doctor}`)
    .send({ exposureCategory: 'III', treatmentDecision: 'PEP + RIG' });
  await request(app)
    .post(`/api/animal-bite-records/${record.body.id}/doses`)
    .set('Authorization', `Bearer ${nurse}`)
    .send({ doseNumber: 0, vaccineName: 'PVRV', inventoryBatchId: batchId, administerNow: true });

  return { mgmt, patientId: patientRes.body.id, recordId: record.body.id };
}

describe('Purchases report and service fees', () => {
  it('nets sales against cost-of-goods (from an inventory-tracked dose) and the configured doctor fee', async () => {
    const { mgmt, patientId, recordId } = await createAnimalBiteRecordWithCostedDose(150);
    const today = todayDateString();

    const statement = await request(app)
      .post('/api/billing/statements')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({
        patientId,
        sourceType: 'animal_bite',
        sourceId: recordId,
        items: [{ description: 'Animal bite treatment', quantity: 1, unitPrice: 1000 }],
      });
    await request(app)
      .post(`/api/billing/statements/${statement.body.id}/payments`)
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ amountPaid: 1000, paymentMethod: 'cash', orNumber: `OR-${Date.now()}-ab` });

    const feeUpdate = await request(app)
      .put('/api/financial/service-fees/animal_bite')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ doctorFee: 300 });
    expect(feeUpdate.status).toBe(200);
    expect(Number(feeUpdate.body.doctor_fee)).toBe(300);

    const purchases = await request(app)
      .get('/api/financial/purchases')
      .query({ startDate: today, endDate: today })
      .set('Authorization', `Bearer ${mgmt}`);
    expect(purchases.status).toBe(200);
    const row = purchases.body.find((r) => r.statementId === statement.body.id);
    expect(row).toBeDefined();
    expect(row.patientName).toMatch(/Purch/);
    expect(row.salesAmount).toBe(1000);
    expect(row.costOfGoods).toBe(150);
    expect(row.doctorFee).toBe(300);
    expect(row.netAmount).toBe(550);
  });

  it('defaults cost of goods to 0 for a manual charge (no inventory consumption to attribute)', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient();
    const today = todayDateString();

    const statementId = await createPaidStatement(mgmt, patientId, 500, `OR-${Date.now()}-manual`);

    const purchases = await request(app)
      .get('/api/financial/purchases')
      .query({ startDate: today, endDate: today })
      .set('Authorization', `Bearer ${mgmt}`);
    const row = purchases.body.find((r) => r.statementId === statementId);
    expect(row).toBeDefined();
    expect(row.sourceType).toBe('manual');
    expect(row.costOfGoods).toBe(0);
    expect(row.netAmount).toBe(row.salesAmount - row.doctorFee);
  });

  it('lists the three seeded service fee rows', async () => {
    const mgmt = await loginAs('Management');
    const res = await request(app).get('/api/financial/service-fees').set('Authorization', `Bearer ${mgmt}`);
    expect(res.status).toBe(200);
    expect(res.body.map((r) => r.source_type)).toEqual(['animal_bite', 'consultation', 'manual']);
  });

  it('Management can update a service fee; Admin cannot (no financial.manage by default)', async () => {
    const admin = await loginAs('Admin');
    const rejected = await request(app)
      .put('/api/financial/service-fees/consultation')
      .set('Authorization', `Bearer ${admin}`)
      .send({ doctorFee: 250 });
    expect(rejected.status).toBe(403);

    const mgmt = await loginAs('Management');
    const accepted = await request(app)
      .put('/api/financial/service-fees/consultation')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ doctorFee: 250 });
    expect(accepted.status).toBe(200);
    expect(Number(accepted.body.doctor_fee)).toBe(250);
  });

  it('rejects an unknown sourceType and a negative doctorFee', async () => {
    const mgmt = await loginAs('Management');

    const badType = await request(app)
      .put('/api/financial/service-fees/not-a-type')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ doctorFee: 100 });
    expect(badType.status).toBe(400);

    const badFee = await request(app)
      .put('/api/financial/service-fees/consultation')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ doctorFee: -50 });
    expect(badFee.status).toBe(400);
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

    const disbursementView = await request(app)
      .get('/api/financial/cash-disbursements')
      .query({ startDate: today, endDate: today })
      .set('Authorization', `Bearer ${cashier}`);
    expect(disbursementView.status).toBe(403);

    const disbursementCreate = await request(app)
      .post('/api/financial/cash-disbursements')
      .set('Authorization', `Bearer ${cashier}`)
      .send({ disbursementDate: today, particulars: 'x', amount: 10, givenTo: 'Someone' });
    expect(disbursementCreate.status).toBe(403);
  });
});
