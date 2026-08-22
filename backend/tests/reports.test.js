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

async function createPatient(token) {
  const res = await request(app)
    .post('/api/patients')
    .set('Authorization', `Bearer ${token}`)
    .send({ firstName: 'Report', lastName: `Patient-${Date.now()}-${Math.random()}`, dateOfBirth: '1990-01-01' });
  return res.body.id;
}

describe('GET /api/reports/daily-activity', () => {
  it('counts today\'s activity across modules, and is 0 for a date with nothing recorded', async () => {
    const mgmt = await loginAs('Management');
    const nurse = await loginAs('Nurse');
    const today = todayDateString();

    const patientId = await createPatient(mgmt);

    await request(app)
      .post('/api/animal-bite-records')
      .set('Authorization', `Bearer ${nurse}`)
      .send({
        patientId,
        visitDate: today,
        dateOfExposure: today,
        animalType: 'Dog',
        biteLocation: 'Leg',
        woundDescription: 'Scratch',
        vitalSigns: { bp: '110/70' },
      });

    await request(app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${nurse}`)
      .send({ patientId, visitDate: today, chiefComplaint: 'Cough', vitalSigns: { bp: '110/70' } });

    const docRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ email: `dr.report-${Date.now()}@cloverfamilycareabc.com`, password: 'DoctorPass123', fullName: 'Dr Report', role: 'Doctor' });

    await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ patientId, doctorId: docRes.body.id, serviceType: 'consultation', scheduledDate: today, scheduledTime: '14:00' });

    await request(app).post('/api/scheduling/attendance/clock-in').set('Authorization', `Bearer ${mgmt}`);

    const res = await request(app).get('/api/reports/daily-activity').query({ date: today }).set('Authorization', `Bearer ${mgmt}`);
    expect(res.status).toBe(200);
    expect(res.body.newPatients).toBeGreaterThanOrEqual(1);
    expect(res.body.animalBiteVisits.assessed).toBeGreaterThanOrEqual(1);
    expect(res.body.consultations.assessed).toBeGreaterThanOrEqual(1);
    expect(res.body.appointments.scheduled).toBeGreaterThanOrEqual(1);
    expect(res.body.staffAttendance.present).toBeGreaterThanOrEqual(1);
    // No financial figures anywhere in the response — this report is operational-only by design.
    expect(res.body.totalRevenue).toBeUndefined();
    expect(res.body.revenue).toBeUndefined();

    const farPast = await request(app).get('/api/reports/daily-activity').query({ date: '2000-01-01' }).set('Authorization', `Bearer ${mgmt}`);
    expect(farPast.status).toBe(200);
    expect(farPast.body.newPatients).toBe(0);
    expect(farPast.body.animalBiteVisits).toEqual({});
  });

  it('requires a date', async () => {
    const mgmt = await loginAs('Management');
    const res = await request(app).get('/api/reports/daily-activity').set('Authorization', `Bearer ${mgmt}`);
    expect(res.status).toBe(400);
  });
});

describe('permissions', () => {
  it('allows Admin (reports.view is a role default) and rejects Nurse (it is not)', async () => {
    const admin = await loginAs('Admin');
    const nurse = await loginAs('Nurse');
    const today = todayDateString();

    const adminRes = await request(app).get('/api/reports/daily-activity').query({ date: today }).set('Authorization', `Bearer ${admin}`);
    expect(adminRes.status).toBe(200);

    const nurseRes = await request(app).get('/api/reports/daily-activity').query({ date: today }).set('Authorization', `Bearer ${nurse}`);
    expect(nurseRes.status).toBe(403);
  });
});
