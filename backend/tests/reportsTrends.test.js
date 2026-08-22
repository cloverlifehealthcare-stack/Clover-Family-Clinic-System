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

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

async function createPatient(token) {
  const res = await request(app)
    .post('/api/patients')
    .set('Authorization', `Bearer ${token}`)
    .send({ firstName: 'Trend', lastName: `Patient-${Date.now()}-${Math.random()}`, dateOfBirth: '1990-01-01' });
  return res.body.id;
}

describe('GET /api/reports/trends', () => {
  it('requires a date range', async () => {
    const mgmt = await loginAs('Management');
    const res = await request(app).get('/api/reports/trends').set('Authorization', `Bearer ${mgmt}`);
    expect(res.status).toBe(400);
  });

  it('rejects a Nurse (reports.view is not a role default for Nurse) and allows Admin', async () => {
    const nurse = await loginAs('Nurse');
    const admin = await loginAs('Admin');
    const range = { startDate: firstOfMonth(), endDate: todayDateString() };

    const nurseRes = await request(app).get('/api/reports/trends').query(range).set('Authorization', `Bearer ${nurse}`);
    expect(nurseRes.status).toBe(403);

    const adminRes = await request(app).get('/api/reports/trends').query(range).set('Authorization', `Bearer ${admin}`);
    expect(adminRes.status).toBe(200);
  });

  it('falls back to month grouping for an invalid groupBy, and honors a valid one', async () => {
    const mgmt = await loginAs('Management');
    const range = { startDate: firstOfMonth(), endDate: todayDateString() };

    const invalid = await request(app).get('/api/reports/trends').query({ ...range, groupBy: 'century' }).set('Authorization', `Bearer ${mgmt}`);
    expect(invalid.body.groupBy).toBe('month');

    const valid = await request(app).get('/api/reports/trends').query({ ...range, groupBy: 'day' }).set('Authorization', `Bearer ${mgmt}`);
    expect(valid.body.groupBy).toBe('day');
  });

  it('breaks down animal bite visits by exposure category', async () => {
    const mgmt = await loginAs('Management');
    const nurse = await loginAs('Nurse');
    const today = todayDateString();

    const patientId = await createPatient(mgmt);
    const record = await request(app)
      .post('/api/animal-bite-records')
      .set('Authorization', `Bearer ${nurse}`)
      .send({
        patientId,
        visitDate: today,
        dateOfExposure: today,
        animalType: 'Dog',
        biteLocation: 'Hand',
        woundDescription: 'Puncture',
        vitalSigns: { bp: '110/70' },
      });

    await request(app)
      .patch(`/api/animal-bite-records/${record.body.id}/diagnosis`)
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ exposureCategory: 'III', treatmentDecision: 'PEP + RIG' });

    const res = await request(app)
      .get('/api/reports/trends')
      .query({ startDate: firstOfMonth(), endDate: today })
      .set('Authorization', `Bearer ${mgmt}`);
    expect(res.status).toBe(200);
    const thisPeriod = res.body.animalBiteByCategory.find((p) => p.period <= today);
    expect(thisPeriod).toBeDefined();
    expect(thisPeriod.category_III).toBeGreaterThanOrEqual(1);
  });

  it('counts consultation volume', async () => {
    const mgmt = await loginAs('Management');
    const nurse = await loginAs('Nurse');
    const today = todayDateString();
    const patientId = await createPatient(mgmt);

    await request(app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${nurse}`)
      .send({ patientId, visitDate: today, chiefComplaint: 'Fever', vitalSigns: { bp: '110/70' } });

    const res = await request(app)
      .get('/api/reports/trends')
      .query({ startDate: firstOfMonth(), endDate: today })
      .set('Authorization', `Bearer ${mgmt}`);
    const total = res.body.consultationVolume.reduce((sum, p) => sum + p.count, 0);
    expect(total).toBeGreaterThanOrEqual(1);
  });

  it('computes a follow-up completion rate from real completed/missed/cancelled follow-ups', async () => {
    const mgmt = await loginAs('Management');
    const nurse = await loginAs('Nurse');
    const today = todayDateString();
    const patientId = await createPatient(mgmt);

    const record = await request(app)
      .post('/api/animal-bite-records')
      .set('Authorization', `Bearer ${nurse}`)
      .send({
        patientId,
        visitDate: today,
        dateOfExposure: today,
        animalType: 'Cat',
        biteLocation: 'Foot',
        woundDescription: 'Scratch',
        vitalSigns: { bp: '110/70' },
      });

    const followUp = await request(app)
      .post(`/api/animal-bite-records/${record.body.id}/follow-ups`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ scheduledDate: today, purpose: 'Dose 2' });

    await request(app)
      .patch(`/api/animal-bite-records/${record.body.id}/follow-ups/${followUp.body.followUps[0].id}`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ status: 'completed' });

    const res = await request(app)
      .get('/api/reports/trends')
      .query({ startDate: firstOfMonth(), endDate: today })
      .set('Authorization', `Bearer ${mgmt}`);
    const totalCompleted = res.body.followUpCompletion.reduce((sum, p) => sum + p.completed, 0);
    expect(totalCompleted).toBeGreaterThanOrEqual(1);
    const withRate = res.body.followUpCompletion.find((p) => p.completionRate !== null);
    expect(withRate).toBeDefined();
    expect(withRate.completionRate).toBeGreaterThan(0);
    expect(withRate.completionRate).toBeLessThanOrEqual(1);
  });

  it('computes appointment cancellation/no-show rates', async () => {
    const mgmt = await loginAs('Management');
    const today = todayDateString();
    const patientId = await createPatient(mgmt);
    const docRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ email: `dr.trend-${Date.now()}@cloverfamilycareabc.com`, password: 'DoctorPass123', fullName: 'Dr Trend', role: 'Doctor' });

    const appt = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ patientId, doctorId: docRes.body.id, serviceType: 'consultation', scheduledDate: today, scheduledTime: '13:00' });

    await request(app).post(`/api/appointments/${appt.body.id}/cancel`).set('Authorization', `Bearer ${mgmt}`);

    const res = await request(app)
      .get('/api/reports/trends')
      .query({ startDate: firstOfMonth(), endDate: today })
      .set('Authorization', `Bearer ${mgmt}`);
    const totalCancelled = res.body.appointmentOutcomes.reduce((sum, p) => sum + p.cancelled, 0);
    expect(totalCancelled).toBeGreaterThanOrEqual(1);
    const withRate = res.body.appointmentOutcomes.find((p) => p.cancellationRate !== null);
    expect(withRate.cancellationRate).toBeGreaterThan(0);
  });
});
