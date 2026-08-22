const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db/knex');
const { loginAs } = require('./helpers/auth');

afterAll(async () => {
  await db.destroy();
});

async function createPatient(token) {
  const res = await request(app)
    .post('/api/patients')
    .set('Authorization', `Bearer ${token}`)
    .send({ firstName: 'Test', lastName: `Patient-${Date.now()}-${Math.random()}`, dateOfBirth: '1990-01-01' });
  return res.body.id;
}

const VITALS = { bp: '110/70', temp: '36.5', pulse: '76', respRate: '16', weight: '60' };

async function createConsultation(token, patientId, overrides = {}) {
  return request(app)
    .post('/api/consultations')
    .set('Authorization', `Bearer ${token}`)
    .send({ patientId, visitDate: '2026-08-22', chiefComplaint: 'Fever and cough', vitalSigns: VITALS, ...overrides });
}

describe('POST /api/consultations', () => {
  it('creates a consultation with status "assessed"', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const nurse = await loginAs('Nurse');

    const res = await createConsultation(nurse, patientId);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('assessed');
    expect(res.body.doctor_id).toBeNull();
  });

  it('rejects a Cashier (no consultation.assessment.create)', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const cashier = await loginAs('Cashier');

    const res = await createConsultation(cashier, patientId);
    expect(res.status).toBe(403);
  });
});

describe('diagnosis -> prescription flow', () => {
  it('requires a diagnosis before a prescription can be issued', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const nurse = await loginAs('Nurse');
    const doctor = await loginAs('Doctor');

    const created = await createConsultation(nurse, patientId);
    const consultationId = created.body.id;

    const blocked = await request(app)
      .post(`/api/consultations/${consultationId}/prescriptions`)
      .set('Authorization', `Bearer ${doctor}`)
      .send({ items: [{ medicineName: 'Paracetamol', dosage: '500mg' }] });
    expect(blocked.status).toBe(400);

    const diagnosed = await request(app)
      .patch(`/api/consultations/${consultationId}/diagnosis`)
      .set('Authorization', `Bearer ${doctor}`)
      .send({ diagnosis: 'Viral URTI', treatmentNotes: 'Symptomatic treatment' });
    expect(diagnosed.status).toBe(200);
    expect(diagnosed.body.status).toBe('diagnosed');

    const issued = await request(app)
      .post(`/api/consultations/${consultationId}/prescriptions`)
      .set('Authorization', `Bearer ${doctor}`)
      .send({
        diagnosisSummary: 'Viral URTI',
        items: [
          { medicineName: 'Paracetamol', dosage: '500mg', instructions: 'Every 4 hours as needed', quantity: '20 tabs' },
        ],
      });
    expect(issued.status).toBe(201);
    expect(issued.body.prescriptions).toHaveLength(1);
    expect(issued.body.prescriptions[0].items).toHaveLength(1);
  });

  it('validates each prescription item has medicineName and dosage', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const nurse = await loginAs('Nurse');
    const doctor = await loginAs('Doctor');

    const created = await createConsultation(nurse, patientId);
    await request(app)
      .patch(`/api/consultations/${created.body.id}/diagnosis`)
      .set('Authorization', `Bearer ${doctor}`)
      .send({ diagnosis: 'Test diagnosis' });

    const res = await request(app)
      .post(`/api/consultations/${created.body.id}/prescriptions`)
      .set('Authorization', `Bearer ${doctor}`)
      .send({ items: [{ medicineName: 'Missing dosage' }] });
    expect(res.status).toBe(400);
  });

  it('blocks a different doctor from issuing a prescription, but the diagnosing doctor and Management can', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const nurse = await loginAs('Nurse');
    const doctorA = await loginAs('Doctor');
    const doctorB = await loginAs('Doctor');

    const created = await createConsultation(nurse, patientId);
    const consultationId = created.body.id;

    await request(app)
      .patch(`/api/consultations/${consultationId}/diagnosis`)
      .set('Authorization', `Bearer ${doctorA}`)
      .send({ diagnosis: 'Allergic rhinitis' });

    const blocked = await request(app)
      .post(`/api/consultations/${consultationId}/prescriptions`)
      .set('Authorization', `Bearer ${doctorB}`)
      .send({ items: [{ medicineName: 'Cetirizine', dosage: '10mg' }] });
    expect(blocked.status).toBe(403);

    const sameDoctor = await request(app)
      .post(`/api/consultations/${consultationId}/prescriptions`)
      .set('Authorization', `Bearer ${doctorA}`)
      .send({ items: [{ medicineName: 'Cetirizine', dosage: '10mg' }] });
    expect(sameDoctor.status).toBe(201);

    const managementOverride = await request(app)
      .post(`/api/consultations/${consultationId}/prescriptions`)
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ items: [{ medicineName: 'Loratadine', dosage: '10mg' }] });
    expect(managementOverride.status).toBe(201);
  });

  it('blocks a different doctor from revising the diagnosis, but the same doctor and Management can', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const nurse = await loginAs('Nurse');
    const doctorA = await loginAs('Doctor');
    const doctorB = await loginAs('Doctor');

    const created = await createConsultation(nurse, patientId);
    const consultationId = created.body.id;

    await request(app)
      .patch(`/api/consultations/${consultationId}/diagnosis`)
      .set('Authorization', `Bearer ${doctorA}`)
      .send({ diagnosis: 'Initial diagnosis' });

    const blocked = await request(app)
      .patch(`/api/consultations/${consultationId}/diagnosis`)
      .set('Authorization', `Bearer ${doctorB}`)
      .send({ diagnosis: 'Overwritten diagnosis' });
    expect(blocked.status).toBe(403);

    const sameDoctor = await request(app)
      .patch(`/api/consultations/${consultationId}/diagnosis`)
      .set('Authorization', `Bearer ${doctorA}`)
      .send({ diagnosis: 'Revised diagnosis' });
    expect(sameDoctor.status).toBe(200);

    const managementOverride = await request(app)
      .patch(`/api/consultations/${consultationId}/diagnosis`)
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ diagnosis: 'Management correction' });
    expect(managementOverride.status).toBe(200);
  });
});

describe('education, follow-up, and completion', () => {
  it('logs education, schedules and completes a follow-up, then completes the consultation', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const nurse = await loginAs('Nurse');
    const doctor = await loginAs('Doctor');

    const created = await createConsultation(nurse, patientId);
    const consultationId = created.body.id;
    await request(app)
      .patch(`/api/consultations/${consultationId}/diagnosis`)
      .set('Authorization', `Bearer ${doctor}`)
      .send({ diagnosis: 'Test diagnosis' });

    const education = await request(app)
      .post(`/api/consultations/${consultationId}/education`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ instructionsGiven: 'Rest and hydration explained.' });
    expect(education.status).toBe(201);
    expect(education.body.educationLogs).toHaveLength(1);

    const followUp = await request(app)
      .post(`/api/consultations/${consultationId}/follow-ups`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ scheduledDate: '2026-08-29', purpose: 'Recheck' });
    expect(followUp.status).toBe(201);
    const followUpRow = followUp.body.followUps[0];

    const updated = await request(app)
      .patch(`/api/consultations/${consultationId}/follow-ups/${followUpRow.id}`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ status: 'completed' });
    expect(updated.status).toBe(200);
    expect(updated.body.followUps[0].status).toBe('completed');

    const completed = await request(app)
      .post(`/api/consultations/${consultationId}/complete`)
      .set('Authorization', `Bearer ${doctor}`);
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe('completed');
  });
});

describe('field-visibility RBAC on GET', () => {
  it('Cashier cannot view a consultation (no patients.history.view)', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const nurse = await loginAs('Nurse');
    const created = await createConsultation(nurse, patientId);

    const cashier = await loginAs('Cashier');
    const res = await request(app)
      .get(`/api/consultations/${created.body.id}`)
      .set('Authorization', `Bearer ${cashier}`);
    expect(res.status).toBe(403);
  });
});
