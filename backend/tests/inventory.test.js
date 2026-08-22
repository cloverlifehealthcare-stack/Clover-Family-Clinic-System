const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db/knex');
const { loginAs } = require('./helpers/auth');

afterAll(async () => {
  await db.destroy();
});

async function createItem(token, overrides = {}) {
  return request(app)
    .post('/api/inventory')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Anti-Rabies Vaccine', category: 'vaccine', unit: 'vial', reorderThreshold: 5, ...overrides });
}

describe('POST /api/inventory', () => {
  it('creates an item (Nurse has inventory.adjust)', async () => {
    const nurse = await loginAs('Nurse');
    const res = await createItem(nurse);
    expect(res.status).toBe(201);
    expect(res.body.totalRemaining).toBe(0);
    expect(res.body.lowStock).toBe(true); // 0 <= reorderThreshold 5
  });

  it('rejects a Doctor (inventory.view only, not inventory.adjust)', async () => {
    const doctor = await loginAs('Doctor');
    const res = await createItem(doctor);
    expect(res.status).toBe(403);
  });

  it('rejects a Cashier (no inventory permission at all)', async () => {
    const cashier = await loginAs('Cashier');
    const res = await request(app).get('/api/inventory').set('Authorization', `Bearer ${cashier}`);
    expect(res.status).toBe(403);
  });

  it('rejects an invalid category', async () => {
    const nurse = await loginAs('Nurse');
    const res = await createItem(nurse, { category: 'not-a-real-category' });
    expect(res.status).toBe(400);
  });
});

describe('batch receiving and adjustments', () => {
  it('receiving a batch updates totalRemaining and clears the low-stock flag', async () => {
    const nurse = await loginAs('Nurse');
    const item = await createItem(nurse, { reorderThreshold: 3 });

    const res = await request(app)
      .post(`/api/inventory/${item.body.id}/batches`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ batchLotNumber: 'LOT-001', quantityReceived: 10, expirationDate: '2027-01-01' });

    expect(res.status).toBe(201);
    expect(res.body.totalRemaining).toBe(10);
    expect(res.body.lowStock).toBe(false);
    expect(res.body.batches).toHaveLength(1);
  });

  it('adjusting a batch (spoilage) reduces remaining stock and requires a reason', async () => {
    const nurse = await loginAs('Nurse');
    const item = await createItem(nurse);
    const received = await request(app)
      .post(`/api/inventory/${item.body.id}/batches`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ batchLotNumber: 'LOT-002', quantityReceived: 10 });
    const batchId = received.body.batches[0].id;

    const noReason = await request(app)
      .post(`/api/inventory/batches/${batchId}/adjustments`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ adjustmentType: 'spoilage', quantityDelta: -2 });
    expect(noReason.status).toBe(400);

    const res = await request(app)
      .post(`/api/inventory/batches/${batchId}/adjustments`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ adjustmentType: 'spoilage', quantityDelta: -2, reason: 'Two vials dropped and broke.' });
    expect(res.status).toBe(200);
    expect(res.body.totalRemaining).toBe(8);
  });

  it('rejects an adjustment that would push remaining stock out of bounds', async () => {
    const nurse = await loginAs('Nurse');
    const item = await createItem(nurse);
    const received = await request(app)
      .post(`/api/inventory/${item.body.id}/batches`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ batchLotNumber: 'LOT-003', quantityReceived: 5 });
    const batchId = received.body.batches[0].id;

    const res = await request(app)
      .post(`/api/inventory/batches/${batchId}/adjustments`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ adjustmentType: 'correction', quantityDelta: -10, reason: 'Would go negative.' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/inventory/alerts', () => {
  it('flags low-stock items and soon-to-expire batches', async () => {
    const nurse = await loginAs('Nurse');
    const item = await createItem(nurse, { name: `Low Stock Item ${Date.now()}`, reorderThreshold: 100 });
    await request(app)
      .post(`/api/inventory/${item.body.id}/batches`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ batchLotNumber: 'LOT-EXP', quantityReceived: 5, expirationDate: '2026-08-25' });

    const res = await request(app)
      .get('/api/inventory/alerts')
      .query({ expiringWithinDays: 30 })
      .set('Authorization', `Bearer ${nurse}`);

    expect(res.status).toBe(200);
    expect(res.body.lowStock.some((i) => i.id === item.body.id)).toBe(true);
    expect(res.body.expiringSoon.some((b) => b.batch_lot_number === 'LOT-EXP')).toBe(true);
  });
});

describe('inventory consumption via Animal Bite dose/RIG administration', () => {
  async function setUpCategoryIIIRecord() {
    const mgmt = await loginAs('Management');
    const patientRes = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ firstName: 'Inv', lastName: `Consume-${Date.now()}`, dateOfBirth: '1990-01-01' });
    const nurse = await loginAs('Nurse');
    const doctor = await loginAs('Doctor');

    const created = await request(app)
      .post('/api/animal-bite-records')
      .set('Authorization', `Bearer ${nurse}`)
      .send({
        patientId: patientRes.body.id,
        visitDate: '2026-08-22',
        dateOfExposure: '2026-08-22',
        animalType: 'Dog',
        biteLocation: 'Hand',
        woundDescription: 'Puncture wound',
        vitalSigns: { bp: '120/80', temp: '36.7', pulse: '80', respRate: '18', weight: '70' },
      });
    await request(app)
      .patch(`/api/animal-bite-records/${created.body.id}/diagnosis`)
      .set('Authorization', `Bearer ${doctor}`)
      .send({ exposureCategory: 'III', treatmentDecision: 'PEP + RIG' });

    return { recordId: created.body.id, nurse, doctor };
  }

  it('administering a dose linked to a batch decrements stock by 1', async () => {
    const nurse = await loginAs('Nurse');
    const item = await createItem(nurse, { name: `PVRV ${Date.now()}` });
    const received = await request(app)
      .post(`/api/inventory/${item.body.id}/batches`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ batchLotNumber: 'LOT-DOSE', quantityReceived: 3 });
    const batchId = received.body.batches[0].id;

    const { recordId } = await setUpCategoryIIIRecord();
    const dosed = await request(app)
      .post(`/api/animal-bite-records/${recordId}/doses`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ doseNumber: 0, vaccineName: 'PVRV', inventoryBatchId: batchId, administerNow: true });

    expect(dosed.status).toBe(201);
    expect(dosed.body.doses[0].inventory_batch_id).toBe(batchId);
    expect(dosed.body.doses[0].batch_lot_number).toBe('LOT-DOSE'); // auto-derived from the batch

    const itemAfter = await request(app).get(`/api/inventory/${item.body.id}`).set('Authorization', `Bearer ${nurse}`);
    expect(itemAfter.body.totalRemaining).toBe(2);
  });

  it('rejects administering a dose against a batch with insufficient stock', async () => {
    const nurse = await loginAs('Nurse');
    const item = await createItem(nurse, { name: `Empty Stock ${Date.now()}` });
    const received = await request(app)
      .post(`/api/inventory/${item.body.id}/batches`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ batchLotNumber: 'LOT-EMPTY', quantityReceived: 1 });
    const batchId = received.body.batches[0].id;
    // Drain the one unit first.
    await request(app)
      .post(`/api/inventory/batches/${batchId}/adjustments`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ adjustmentType: 'spoilage', quantityDelta: -1, reason: 'Draining for test.' });

    const { recordId } = await setUpCategoryIIIRecord();
    const res = await request(app)
      .post(`/api/animal-bite-records/${recordId}/doses`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ doseNumber: 0, vaccineName: 'PVRV', inventoryBatchId: batchId, administerNow: true });

    expect(res.status).toBe(400);
  });

  it('administering RIG linked to a batch decrements stock by 1', async () => {
    const nurse = await loginAs('Nurse');
    const doctor = await loginAs('Doctor');
    const item = await createItem(nurse, { name: `RIG ${Date.now()}`, category: 'rig' });
    const received = await request(app)
      .post(`/api/inventory/${item.body.id}/batches`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ batchLotNumber: 'LOT-RIG', quantityReceived: 2 });
    const batchId = received.body.batches[0].id;

    const { recordId } = await setUpCategoryIIIRecord();
    const res = await request(app)
      .post(`/api/animal-bite-records/${recordId}/rig`)
      .set('Authorization', `Bearer ${doctor}`)
      .send({ rigProductName: 'Equine RIG', patientWeightKg: 70, calculatedDose: '140 IU', inventoryBatchId: batchId });

    expect(res.status).toBe(201);
    expect(res.body.rig.inventory_batch_id).toBe(batchId);

    const itemAfter = await request(app).get(`/api/inventory/${item.body.id}`).set('Authorization', `Bearer ${nurse}`);
    expect(itemAfter.body.totalRemaining).toBe(1);
  });
});
