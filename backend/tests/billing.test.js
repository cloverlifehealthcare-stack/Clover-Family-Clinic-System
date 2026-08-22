const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db/knex');
const { loginAs } = require('./helpers/auth');

afterAll(async () => {
  await db.destroy();
});

// Always creates via a Management login regardless of which role the test is actually
// exercising — Cashier/Doctor/Nurse don't have patients.create, and silently using one of
// their tokens here would make patientId undefined (a real bug caught during development:
// see the "own patients" pattern in animalBite.test.js for how easy this is to miss).
async function createPatient() {
  const mgmt = await loginAs('Management');
  const res = await request(app)
    .post('/api/patients')
    .set('Authorization', `Bearer ${mgmt}`)
    .send({ firstName: 'Bill', lastName: `Patient-${Date.now()}-${Math.random()}`, dateOfBirth: '1990-01-01' });
  return res.body.id;
}

async function createStatement(token, patientId, overrides = {}) {
  return request(app)
    .post('/api/billing/statements')
    .set('Authorization', `Bearer ${token}`)
    .send({
      patientId,
      sourceType: 'manual',
      items: [{ description: 'Consultation fee', quantity: 1, unitPrice: 300 }],
      ...overrides,
    });
}

describe('POST /api/billing/statements', () => {
  it('creates a statement with no discount', async () => {
    const cashier = await loginAs('Cashier');
    const patientId = await createPatient();

    const res = await createStatement(cashier, patientId);
    expect(res.status).toBe(201);
    expect(res.body.subtotal_amount).toBe('300.00');
    expect(res.body.discount_amount).toBe('0.00');
    expect(res.body.total_amount).toBe('300.00');
    expect(res.body.status).toBe('unpaid');
    expect(res.body.balanceDue).toBe(300);
  });

  it('applies a 20% PWD/Senior discount only to discount-eligible items', async () => {
    const cashier = await loginAs('Cashier');
    const patientId = await createPatient();

    const res = await createStatement(cashier, patientId, {
      items: [
        { description: 'Professional fee', quantity: 1, unitPrice: 300, isDiscountEligible: true },
        { description: 'Medicine (not discount-eligible)', quantity: 1, unitPrice: 100, isDiscountEligible: false },
      ],
      discountType: 'pwd',
      discountIdNumber: 'PWD-12345',
      discountHolderName: 'Juan Dela Cruz',
    });

    expect(res.status).toBe(201);
    expect(res.body.subtotal_amount).toBe('400.00');
    expect(res.body.discount_amount).toBe('60.00'); // 20% of the 300 eligible portion only
    expect(res.body.total_amount).toBe('340.00');
  });

  it('requires discountIdNumber and discountHolderName when a discount is applied', async () => {
    const cashier = await loginAs('Cashier');
    const patientId = await createPatient();

    const res = await createStatement(cashier, patientId, { discountType: 'senior' });
    expect(res.status).toBe(400);
  });

  it('rejects a Doctor (no billing.create by default)', async () => {
    const patientId = await createPatient();
    const doctor = await loginAs('Doctor');

    const res = await createStatement(doctor, patientId);
    expect(res.status).toBe(403);
  });

  it('rejects a non-numeric unitPrice with a clean 400, not a database error', async () => {
    const cashier = await loginAs('Cashier');
    const patientId = await createPatient();

    const res = await createStatement(cashier, patientId, {
      items: [{ description: 'Bad item', quantity: 1, unitPrice: 'not-a-number' }],
    });
    expect(res.status).toBe(400);
  });
});

describe('payments', () => {
  it('moves status unpaid -> partially_paid -> paid as payments are recorded', async () => {
    const cashier = await loginAs('Cashier');
    const patientId = await createPatient();
    const statement = await createStatement(cashier, patientId, {
      items: [{ description: 'Consultation fee', quantity: 1, unitPrice: 500 }],
    });

    const partial = await request(app)
      .post(`/api/billing/statements/${statement.body.id}/payments`)
      .set('Authorization', `Bearer ${cashier}`)
      .send({ amountPaid: 200, paymentMethod: 'cash', orNumber: 'OR-0001' });
    expect(partial.status).toBe(201);
    expect(partial.body.status).toBe('partially_paid');
    expect(partial.body.balanceDue).toBe(300);

    const full = await request(app)
      .post(`/api/billing/statements/${statement.body.id}/payments`)
      .set('Authorization', `Bearer ${cashier}`)
      .send({ amountPaid: 300, paymentMethod: 'cash', orNumber: 'OR-0002' });
    expect(full.status).toBe(201);
    expect(full.body.status).toBe('paid');
    expect(full.body.balanceDue).toBe(0);
  });

  it('rejects a payment that exceeds the remaining balance', async () => {
    const cashier = await loginAs('Cashier');
    const patientId = await createPatient();
    const statement = await createStatement(cashier, patientId);

    const res = await request(app)
      .post(`/api/billing/statements/${statement.body.id}/payments`)
      .set('Authorization', `Bearer ${cashier}`)
      .send({ amountPaid: 1000, paymentMethod: 'cash', orNumber: 'OR-0003' });
    expect(res.status).toBe(400);
  });

  it('requires an OR number', async () => {
    const cashier = await loginAs('Cashier');
    const patientId = await createPatient();
    const statement = await createStatement(cashier, patientId);

    const res = await request(app)
      .post(`/api/billing/statements/${statement.body.id}/payments`)
      .set('Authorization', `Bearer ${cashier}`)
      .send({ amountPaid: 300, paymentMethod: 'cash' });
    expect(res.status).toBe(400);
  });

  it('reaches "paid" even when amountPaid arrives as a JSON string, not a number', async () => {
    // Regression test for a real bug: `statement.amountPaid + amountPaid` uses `+`, which is
    // string concatenation (not addition) if either side is a string, silently producing NaN
    // and leaving status stuck at "partially_paid" even for a full payment. Caught via a live
    // smoke test, not this suite, because JSON number literals never exercised the string
    // path — so this test sends the amount as a string on purpose.
    const cashier = await loginAs('Cashier');
    const patientId = await createPatient();
    const statement = await createStatement(cashier, patientId, {
      items: [{ description: 'Consultation fee', quantity: 1, unitPrice: 390 }],
    });

    const res = await request(app)
      .post(`/api/billing/statements/${statement.body.id}/payments`)
      .set('Authorization', `Bearer ${cashier}`)
      .send({ amountPaid: '390', paymentMethod: 'cash', orNumber: 'OR-STRING-TEST' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('paid');
    expect(res.body.balanceDue).toBe(0);
  });
});

describe('void authorization', () => {
  it('rejects a Cashier voiding a payment (payment.void is Management/Admin only)', async () => {
    const cashier = await loginAs('Cashier');
    const patientId = await createPatient();
    const statement = await createStatement(cashier, patientId);
    const payment = await request(app)
      .post(`/api/billing/statements/${statement.body.id}/payments`)
      .set('Authorization', `Bearer ${cashier}`)
      .send({ amountPaid: 300, paymentMethod: 'cash', orNumber: 'OR-0004' });
    const paymentId = payment.body.payments[0].id;

    const res = await request(app)
      .post(`/api/billing/payments/${paymentId}/void`)
      .set('Authorization', `Bearer ${cashier}`)
      .send({ reason: 'test' });
    expect(res.status).toBe(403);
  });

  it('allows Admin to void a payment, reverting the statement to unpaid', async () => {
    const cashier = await loginAs('Cashier');
    const admin = await loginAs('Admin');
    const patientId = await createPatient();
    const statement = await createStatement(cashier, patientId);
    const payment = await request(app)
      .post(`/api/billing/statements/${statement.body.id}/payments`)
      .set('Authorization', `Bearer ${cashier}`)
      .send({ amountPaid: 300, paymentMethod: 'cash', orNumber: 'OR-0005' });
    const paymentId = payment.body.payments[0].id;

    const voided = await request(app)
      .post(`/api/billing/payments/${paymentId}/void`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ reason: 'Overcharged, reversing.' });
    expect(voided.status).toBe(200);
    expect(voided.body.status).toBe('unpaid');
    expect(voided.body.balanceDue).toBe(300);
  });

  it('blocks voiding a statement with an active payment, but allows it once the payment is voided', async () => {
    const cashier = await loginAs('Cashier');
    const mgmt = await loginAs('Management');
    const patientId = await createPatient();
    const statement = await createStatement(cashier, patientId);
    const payment = await request(app)
      .post(`/api/billing/statements/${statement.body.id}/payments`)
      .set('Authorization', `Bearer ${cashier}`)
      .send({ amountPaid: 300, paymentMethod: 'cash', orNumber: 'OR-0006' });
    const paymentId = payment.body.payments[0].id;

    const blocked = await request(app)
      .post(`/api/billing/statements/${statement.body.id}/void`)
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ reason: 'Patient dispute' });
    expect(blocked.status).toBe(400);

    await request(app)
      .post(`/api/billing/payments/${paymentId}/void`)
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ reason: 'Reversing before void' });

    const voided = await request(app)
      .post(`/api/billing/statements/${statement.body.id}/void`)
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ reason: 'Patient dispute' });
    expect(voided.status).toBe(200);
    expect(voided.body.status).toBe('void');

    const rejectedPayment = await request(app)
      .post(`/api/billing/statements/${statement.body.id}/payments`)
      .set('Authorization', `Bearer ${cashier}`)
      .send({ amountPaid: 300, paymentMethod: 'cash', orNumber: 'OR-0007' });
    expect(rejectedPayment.status).toBe(400);
  });
});

describe('GET /api/services', () => {
  it('lists the seeded services catalog', async () => {
    const cashier = await loginAs('Cashier');
    const res = await request(app).get('/api/services').set('Authorization', `Bearer ${cashier}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('rejects a Doctor from creating a service (no billing.create)', async () => {
    const doctor = await loginAs('Doctor');
    const res = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${doctor}`)
      .send({ name: 'Test Service', category: 'other', defaultPrice: 100 });
    expect(res.status).toBe(403);
  });
});
