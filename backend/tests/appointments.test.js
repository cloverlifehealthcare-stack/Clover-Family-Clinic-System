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
    .send({ firstName: 'Appt', lastName: `Patient-${Date.now()}-${Math.random()}`, dateOfBirth: '1990-01-01' });
  return res.body.id;
}

async function loginAsDoctorWithId() {
  const token = await loginAs('Doctor');
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  return { token, id: me.body.id };
}

describe('POST /api/appointments', () => {
  it('creates an appointment with a 15-minute slot', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const doctor = await loginAsDoctorWithId();

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ patientId, doctorId: doctor.id, serviceType: 'consultation', scheduledDate: '2026-09-01', scheduledTime: '09:00' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('scheduled');
    expect(res.body.slot_minutes).toBe(15);
    // Joined display fields (docs: every other module returns human-readable data, not bare FKs).
    expect(res.body.patient_first_name).toBe('Appt');
    expect(typeof res.body.doctor_name).toBe('string');
    expect(res.body.doctor_name.length).toBeGreaterThan(0);
  });

  it('rejects a Nurse (no appointments.manage by default)', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const doctor = await loginAsDoctorWithId();
    const nurse = await loginAs('Nurse');

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${nurse}`)
      .send({ patientId, doctorId: doctor.id, serviceType: 'consultation', scheduledDate: '2026-09-01', scheduledTime: '09:15' });
    expect(res.status).toBe(403);
  });

  it('rejects a time not on a 15-minute boundary', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const doctor = await loginAsDoctorWithId();

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ patientId, doctorId: doctor.id, serviceType: 'consultation', scheduledDate: '2026-09-01', scheduledTime: '09:05' });
    expect(res.status).toBe(400);
  });

  it('rejects a doctorId that does not belong to a Doctor-role user', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const nurseToken = await loginAs('Nurse');
    const nurseMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${nurseToken}`);

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ patientId, doctorId: nurseMe.body.id, serviceType: 'consultation', scheduledDate: '2026-09-01', scheduledTime: '09:30' });
    expect(res.status).toBe(400);
  });

  it('blocks double-booking the same doctor/date/time, but allows rebooking after cancellation', async () => {
    const mgmt = await loginAs('Management');
    const patientId1 = await createPatient(mgmt);
    const patientId2 = await createPatient(mgmt);
    const doctor = await loginAsDoctorWithId();

    const first = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ patientId: patientId1, doctorId: doctor.id, serviceType: 'consultation', scheduledDate: '2026-09-02', scheduledTime: '10:00' });
    expect(first.status).toBe(201);

    const conflict = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ patientId: patientId2, doctorId: doctor.id, serviceType: 'consultation', scheduledDate: '2026-09-02', scheduledTime: '10:00' });
    expect(conflict.status).toBe(409);

    const cancel = await request(app)
      .post(`/api/appointments/${first.body.id}/cancel`)
      .set('Authorization', `Bearer ${mgmt}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('cancelled');

    const rebooked = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ patientId: patientId2, doctorId: doctor.id, serviceType: 'consultation', scheduledDate: '2026-09-02', scheduledTime: '10:00' });
    expect(rebooked.status).toBe(201);
  });
});

describe('status transitions', () => {
  it('allows scheduled -> checked_in -> completed', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const doctor = await loginAsDoctorWithId();

    const created = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ patientId, doctorId: doctor.id, serviceType: 'consultation', scheduledDate: '2026-09-03', scheduledTime: '11:00' });

    const checkedIn = await request(app).post(`/api/appointments/${created.body.id}/check-in`).set('Authorization', `Bearer ${mgmt}`);
    expect(checkedIn.status).toBe(200);
    expect(checkedIn.body.status).toBe('checked_in');

    const completed = await request(app).post(`/api/appointments/${created.body.id}/complete`).set('Authorization', `Bearer ${mgmt}`);
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe('completed');
  });

  it('rejects an invalid transition (scheduled directly to completed)', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const doctor = await loginAsDoctorWithId();

    const created = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ patientId, doctorId: doctor.id, serviceType: 'consultation', scheduledDate: '2026-09-04', scheduledTime: '11:15' });

    const res = await request(app).post(`/api/appointments/${created.body.id}/complete`).set('Authorization', `Bearer ${mgmt}`);
    expect(res.status).toBe(400);
  });

  it('rejects rescheduling an appointment that is no longer "scheduled"', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const doctor = await loginAsDoctorWithId();

    const created = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ patientId, doctorId: doctor.id, serviceType: 'consultation', scheduledDate: '2026-09-05', scheduledTime: '13:00' });
    await request(app).post(`/api/appointments/${created.body.id}/check-in`).set('Authorization', `Bearer ${mgmt}`);

    const res = await request(app)
      .patch(`/api/appointments/${created.body.id}`)
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ scheduledTime: '14:00' });
    expect(res.status).toBe(400);
  });
});

describe('Doctor row-level scoping ("own schedule only")', () => {
  it('a Doctor cannot view another doctor\'s appointment', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const doctorA = await loginAsDoctorWithId();
    const doctorB = await loginAsDoctorWithId();

    const created = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ patientId, doctorId: doctorA.id, serviceType: 'consultation', scheduledDate: '2026-09-06', scheduledTime: '09:00' });

    const res = await request(app)
      .get(`/api/appointments/${created.body.id}`)
      .set('Authorization', `Bearer ${doctorB.token}`);
    expect(res.status).toBe(404);

    const ownView = await request(app)
      .get(`/api/appointments/${created.body.id}`)
      .set('Authorization', `Bearer ${doctorA.token}`);
    expect(ownView.status).toBe(200);
  });

  it('a Doctor\'s list only includes their own appointments', async () => {
    const mgmt = await loginAs('Management');
    const patientId = await createPatient(mgmt);
    const doctorA = await loginAsDoctorWithId();
    const doctorB = await loginAsDoctorWithId();

    await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ patientId, doctorId: doctorA.id, serviceType: 'consultation', scheduledDate: '2026-09-07', scheduledTime: '09:00' });
    await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ patientId, doctorId: doctorB.id, serviceType: 'consultation', scheduledDate: '2026-09-07', scheduledTime: '09:00' });

    const res = await request(app)
      .get('/api/appointments')
      .query({ date: '2026-09-07' })
      .set('Authorization', `Bearer ${doctorA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.every((a) => a.doctor_id === doctorA.id)).toBe(true);
  });
});
