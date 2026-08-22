const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db/knex');
const { loginAs } = require('./helpers/auth');

afterAll(async () => {
  await db.destroy();
});

async function createPatient(token, overrides = {}) {
  const res = await request(app)
    .post('/api/patients')
    .set('Authorization', `Bearer ${token}`)
    .send({ firstName: 'Test', lastName: `Patient-${Date.now()}-${Math.random()}`, dateOfBirth: '1990-01-01', ...overrides });
  return res.body.id;
}

const VITALS = { bp: '120/80', temp: '36.7', pulse: '80', respRate: '18', weight: '70' };

async function createBiteRecord(nurseToken, patientId, overrides = {}) {
  const res = await request(app)
    .post('/api/animal-bite-records')
    .set('Authorization', `Bearer ${nurseToken}`)
    .send({
      patientId,
      visitDate: '2026-08-22',
      dateOfExposure: '2026-08-22',
      animalType: 'Dog',
      biteLocation: 'Left leg',
      woundDescription: 'Single puncture wound',
      vitalSigns: VITALS,
      ...overrides,
    });
  return res;
}

describe('POST /api/animal-bite-records', () => {
  it('creates a record with status "assessed"', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const nurse = await loginAs('Nurse');

    const res = await createBiteRecord(nurse, patientId);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('assessed');
    expect(res.body.doses).toEqual([]);
    expect(res.body.rig).toBeNull();
  });

  it('rejects a Cashier (no animalbite.assessment.create)', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const cashier = await loginAs('Cashier');

    const res = await createBiteRecord(cashier, patientId);
    expect(res.status).toBe(403);
  });
});

describe('diagnosis -> treatment flow', () => {
  let patientId;
  let recordId;
  let doctorToken;
  let nurseToken;

  beforeAll(async () => {
    const mgmt = await loginAs('Management');
    patientId = await createPatient(mgmt);
    nurseToken = await loginAs('Nurse');
    doctorToken = await loginAs('Doctor');
    const created = await createBiteRecord(nurseToken, patientId);
    recordId = created.body.id;
  });

  it('blocks adding a dose before the doctor has diagnosed', async () => {
    const res = await request(app)
      .post(`/api/animal-bite-records/${recordId}/doses`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ doseNumber: 0, vaccineName: 'PVRV' });
    expect(res.status).toBe(400);
  });

  it('records the Category III diagnosis', async () => {
    const res = await request(app)
      .patch(`/api/animal-bite-records/${recordId}/diagnosis`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ exposureCategory: 'III', treatmentDecision: 'PEP + RIG' });
    expect(res.status).toBe(200);
    expect(res.body.exposure_category).toBe('III');
  });

  it('administers dose 0 immediately and transitions to in_treatment', async () => {
    const res = await request(app)
      .post(`/api/animal-bite-records/${recordId}/doses`)
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ doseNumber: 0, vaccineName: 'PVRV', anatomicalSite: 'Deltoid', administerNow: true });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('in_treatment');
    expect(res.body.doses).toHaveLength(1);
    expect(res.body.doses[0].status).toBe('administered');
  });

  it('rejects a duplicate dose_number for the same record', async () => {
    const res = await request(app)
      .post(`/api/animal-bite-records/${recordId}/doses`)
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ doseNumber: 0, vaccineName: 'PVRV' });
    expect(res.status).toBe(409);
  });

  it('schedules dose 3 for a future date, then administers it later', async () => {
    const scheduled = await request(app)
      .post(`/api/animal-bite-records/${recordId}/doses`)
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ doseNumber: 3, vaccineName: 'PVRV', scheduledDate: '2026-08-25' });
    expect(scheduled.status).toBe(201);
    const doseRow = scheduled.body.doses.find((d) => d.dose_number === 3);
    expect(doseRow.status).toBe('scheduled');

    const administered = await request(app)
      .patch(`/api/animal-bite-records/${recordId}/doses/${doseRow.id}/administer`)
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ anatomicalSite: 'Deltoid' });
    expect(administered.status).toBe(200);
    const updatedDose = administered.body.doses.find((d) => d.dose_number === 3);
    expect(updatedDose.status).toBe('administered');
  });

  it('administers RIG for the Category III record', async () => {
    const res = await request(app)
      .post(`/api/animal-bite-records/${recordId}/rig`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        rigProductName: 'Equine RIG', patientWeightKg: 70, calculatedDose: '140 IU',
        siteInfiltratedAmount: '100 IU', imInjectedAmount: '40 IU',
      });
    expect(res.status).toBe(201);
    expect(res.body.rig.rig_product_name).toBe('Equine RIG');
  });

  it('rejects a second RIG administration for the same record', async () => {
    const res = await request(app)
      .post(`/api/animal-bite-records/${recordId}/rig`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ rigProductName: 'Equine RIG', patientWeightKg: 70, calculatedDose: '140 IU' });
    expect(res.status).toBe(409);
  });

  it('logs patient education and schedules a follow-up', async () => {
    const education = await request(app)
      .post(`/api/animal-bite-records/${recordId}/education`)
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ instructionsGiven: 'Wound care and return schedule explained.' });
    expect(education.status).toBe(201);
    expect(education.body.educationLogs).toHaveLength(1);

    const followUp = await request(app)
      .post(`/api/animal-bite-records/${recordId}/follow-ups`)
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ scheduledDate: '2026-08-29', purpose: 'Dose 7', doseNumber: 7 });
    expect(followUp.status).toBe(201);
    const followUpRow = followUp.body.followUps[0];
    expect(followUpRow.status).toBe('upcoming');

    const updated = await request(app)
      .patch(`/api/animal-bite-records/${recordId}/follow-ups/${followUpRow.id}`)
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ status: 'completed' });
    expect(updated.status).toBe(200);
    expect(updated.body.followUps[0].status).toBe('completed');
  });

  it('marks the record complete', async () => {
    const res = await request(app)
      .post(`/api/animal-bite-records/${recordId}/complete`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });
});

describe('WHO Category I — no vaccination indicated', () => {
  it('rejects adding a dose to a Category I record', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const nurse = await loginAs('Nurse');
    const doctor = await loginAs('Doctor');

    const created = await createBiteRecord(nurse, patientId);
    const recordId = created.body.id;

    await request(app)
      .patch(`/api/animal-bite-records/${recordId}/diagnosis`)
      .set('Authorization', `Bearer ${doctor}`)
      .send({ exposureCategory: 'I', treatmentDecision: 'Wound care only' });

    const res = await request(app)
      .post(`/api/animal-bite-records/${recordId}/doses`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ doseNumber: 0, vaccineName: 'PVRV' });
    expect(res.status).toBe(400);
  });
});

describe('field-visibility RBAC on GET', () => {
  it('Cashier cannot view a record (no patients.history.view)', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const nurse = await loginAs('Nurse');
    const created = await createBiteRecord(nurse, patientId);

    const cashier = await loginAs('Cashier');
    const res = await request(app)
      .get(`/api/animal-bite-records/${created.body.id}`)
      .set('Authorization', `Bearer ${cashier}`);
    expect(res.status).toBe(403);
  });
});
