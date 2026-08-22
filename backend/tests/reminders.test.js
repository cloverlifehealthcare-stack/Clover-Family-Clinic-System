const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db/knex');
const { loginAs } = require('./helpers/auth');

afterAll(async () => {
  await db.destroy();
});

function offsetDateString(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const TOMORROW = offsetDateString(1);

async function createPatient(token, overrides = {}) {
  const res = await request(app)
    .post('/api/patients')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Remind',
      lastName: `Test-${Date.now()}-${Math.random()}`,
      dateOfBirth: '1990-01-01',
      contactNumber: '09171234567',
      email: 'patient@example.com',
      ...overrides,
    });
  return res.body.id;
}

describe('POST /api/reminders/run — appointment reminders', () => {
  it('sends SMS + email for an appointment scheduled tomorrow, and is idempotent on a second run', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const docRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ email: `dr.remind-${Date.now()}@cloverfamilycareabc.com`, password: 'DoctorPass123', fullName: 'Dr Remind', role: 'Doctor' });

    await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ patientId, doctorId: docRes.body.id, serviceType: 'consultation', scheduledDate: TOMORROW, scheduledTime: '09:00' });

    const first = await request(app).post('/api/reminders/run').set('Authorization', `Bearer ${mgmt}`).send({ daysBefore: 1 });
    expect(first.status).toBe(200);
    expect(first.body.sent).toBeGreaterThanOrEqual(2); // SMS + email for this one appointment (plus any from other tests)
    expect(first.body.failed).toBe(0);

    const second = await request(app).post('/api/reminders/run').set('Authorization', `Bearer ${mgmt}`).send({ daysBefore: 1 });
    expect(second.status).toBe(200);
    expect(second.body.sent).toBe(0); // already sent — this run only sees the skips
    expect(second.body.skipped).toBeGreaterThanOrEqual(2);
  });

  it('does not remind for an appointment that is not tomorrow', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const docRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ email: `dr.remind2-${Date.now()}@cloverfamilycareabc.com`, password: 'DoctorPass123', fullName: 'Dr Remind Two', role: 'Doctor' });

    const farFuture = offsetDateString(10);
    await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ patientId, doctorId: docRes.body.id, serviceType: 'consultation', scheduledDate: farFuture, scheduledTime: '10:00' });

    await request(app).post('/api/reminders/run').set('Authorization', `Bearer ${mgmt}`).send({ daysBefore: 1 });

    const logs = await request(app)
      .get('/api/reminders')
      .query({ patientId, sourceType: 'appointment' })
      .set('Authorization', `Bearer ${mgmt}`);
    expect(logs.body).toHaveLength(0);
  });

  it('skips a channel the patient has no contact info for', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt, { contactNumber: undefined, email: 'onlyemail@example.com' });
    const docRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ email: `dr.remind3-${Date.now()}@cloverfamilycareabc.com`, password: 'DoctorPass123', fullName: 'Dr Remind Three', role: 'Doctor' });

    await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ patientId, doctorId: docRes.body.id, serviceType: 'consultation', scheduledDate: TOMORROW, scheduledTime: '11:00' });

    await request(app).post('/api/reminders/run').set('Authorization', `Bearer ${mgmt}`).send({ daysBefore: 1 });

    const logs = await request(app)
      .get('/api/reminders')
      .query({ patientId })
      .set('Authorization', `Bearer ${mgmt}`);
    expect(logs.body).toHaveLength(1);
    expect(logs.body[0].channel).toBe('email');
  });
});

describe('POST /api/reminders/run — follow-up reminders', () => {
  it('sends a reminder for an animal-bite follow-up scheduled tomorrow', async () => {
    const mgmt = await loginAs('Management');
    const nurse = await loginAs('Nurse');
    const patientId = await createPatient(mgmt);

    const record = await request(app)
      .post('/api/animal-bite-records')
      .set('Authorization', `Bearer ${nurse}`)
      .send({
        patientId,
        visitDate: offsetDateString(0),
        dateOfExposure: offsetDateString(0),
        animalType: 'Dog',
        biteLocation: 'Hand',
        woundDescription: 'Puncture',
        vitalSigns: { bp: '120/80' },
      });

    await request(app)
      .post(`/api/animal-bite-records/${record.body.id}/follow-ups`)
      .set('Authorization', `Bearer ${nurse}`)
      .send({ scheduledDate: TOMORROW, purpose: 'Dose 3' });

    const res = await request(app).post('/api/reminders/run').set('Authorization', `Bearer ${mgmt}`).send({ daysBefore: 1 });
    expect(res.status).toBe(200);

    const logs = await request(app)
      .get('/api/reminders')
      .query({ patientId, sourceType: 'follow_up' })
      .set('Authorization', `Bearer ${mgmt}`);
    expect(logs.body.length).toBe(2); // sms + email
    expect(logs.body.every((l) => l.message.includes('Dose 3'))).toBe(true);
  });
});

describe('permissions', () => {
  it('rejects a Nurse from running the job or viewing the log (no reminders.manage/view)', async () => {
    const nurse = await loginAs('Nurse');
    const runRes = await request(app).post('/api/reminders/run').set('Authorization', `Bearer ${nurse}`).send({});
    expect(runRes.status).toBe(403);

    const listRes = await request(app).get('/api/reminders').set('Authorization', `Bearer ${nurse}`);
    expect(listRes.status).toBe(403);
  });

  it('allows Admin to run and view', async () => {
    const admin = await loginAs('Admin');
    const runRes = await request(app).post('/api/reminders/run').set('Authorization', `Bearer ${admin}`).send({});
    expect(runRes.status).toBe(200);

    const listRes = await request(app).get('/api/reminders').set('Authorization', `Bearer ${admin}`);
    expect(listRes.status).toBe(200);
  });
});

describe('GET /api/reminders/cron', () => {
  it('runs the job with a valid cron secret, and rejects a missing/wrong one — no staff login involved either way', async () => {
    const noAuth = await request(app).get('/api/reminders/cron');
    expect(noAuth.status).toBe(401);

    const wrongSecret = await request(app).get('/api/reminders/cron').set('Authorization', 'Bearer not-the-real-secret');
    expect(wrongSecret.status).toBe(401);

    const correct = await request(app).get('/api/reminders/cron').set('Authorization', `Bearer ${process.env.CRON_SECRET}`);
    expect(correct.status).toBe(200);
    expect(correct.body).toHaveProperty('sent');
    expect(correct.body).toHaveProperty('skipped');
    expect(correct.body).toHaveProperty('failed');
  });

  it('rejects a staff login token — the cron route only accepts the cron secret', async () => {
    const mgmt = await loginAs('Management');
    const res = await request(app).get('/api/reminders/cron').set('Authorization', `Bearer ${mgmt}`);
    expect(res.status).toBe(401);
  });
});
