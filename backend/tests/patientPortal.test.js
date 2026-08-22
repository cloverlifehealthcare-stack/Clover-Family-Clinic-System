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

function uniqueEmail(tag) {
  return `${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

const ADULT_DOB = '1990-05-15';
const MINOR_DOB = offsetDateString(-365 * 10); // ~10 years old

function registerPayload(overrides = {}) {
  return {
    firstName: 'Portal',
    lastName: `Patient-${Date.now()}-${Math.random()}`,
    dateOfBirth: ADULT_DOB,
    contactNumber: '09171234567',
    email: uniqueEmail('portal'),
    password: 'PortalPass123',
    ...overrides,
  };
}

describe('POST /api/patient-auth/register', () => {
  it('registers an adult patient and returns usable tokens', async () => {
    const res = await request(app).post('/api/patient-auth/register').send(registerPayload());
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.patient.patientCode).toMatch(/^\d{4}-\d{4}$/);

    const me = await request(app).get('/api/patient-auth/me').set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.portalEmail).toBeDefined();
  });

  it('rejects a minor (under 18)', async () => {
    const res = await request(app).post('/api/patient-auth/register').send(registerPayload({ dateOfBirth: MINOR_DOB }));
    expect(res.status).toBe(400);
  });

  it('rejects a short password', async () => {
    const res = await request(app).post('/api/patient-auth/register').send(registerPayload({ password: 'short' }));
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate portal email', async () => {
    const payload = registerPayload();
    const first = await request(app).post('/api/patient-auth/register').send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/patient-auth/register').send(registerPayload({ email: payload.email }));
    expect(second.status).toBe(409);
  });

  it('flags a likely duplicate by name+DOB, and never auto-links to the existing record', async () => {
    const sharedName = `Dup-${Date.now()}`;
    const first = await request(app).post('/api/patient-auth/register').send(registerPayload({ lastName: sharedName }));
    expect(first.status).toBe(201);

    const flagged = await request(app).post('/api/patient-auth/register').send(registerPayload({ lastName: sharedName, email: uniqueEmail('dup2') }));
    expect(flagged.status).toBe(409);
    expect(flagged.body.error).toBe('possible_duplicate');
    expect(flagged.body.possibleDuplicates.length).toBeGreaterThan(0);

    const confirmed = await request(app)
      .post('/api/patient-auth/register')
      .send(registerPayload({ lastName: sharedName, email: uniqueEmail('dup3'), confirmDuplicate: true }));
    expect(confirmed.status).toBe(201);
    // A genuinely separate patient record, not linked to the first — see patientAuth.service.js
    // for why auto-linking on name+DOB alone would be a PHI exposure.
    expect(confirmed.body.patient.id).not.toBe(first.body.patient.id);
  });
});

describe('POST /api/patient-auth/login', () => {
  it('logs in with correct credentials and rejects wrong ones', async () => {
    const payload = registerPayload();
    await request(app).post('/api/patient-auth/register').send(payload);

    const good = await request(app).post('/api/patient-auth/login').send({ email: payload.email, password: payload.password });
    expect(good.status).toBe(200);
    expect(good.body.accessToken).toBeDefined();

    const bad = await request(app).post('/api/patient-auth/login').send({ email: payload.email, password: 'WrongPassword1' });
    expect(bad.status).toBe(401);
  });
});

describe('token domain separation', () => {
  it('rejects a staff token on a patient route, and a patient token on a staff route', async () => {
    const staffToken = await loginAs('Management');
    const portalRes = await request(app).post('/api/patient-auth/register').send(registerPayload());
    const patientToken = portalRes.body.accessToken;

    const staffOnPatientRoute = await request(app).get('/api/patient-auth/me').set('Authorization', `Bearer ${staffToken}`);
    expect(staffOnPatientRoute.status).toBe(401);

    const patientOnStaffRoute = await request(app).get('/api/patients').set('Authorization', `Bearer ${patientToken}`);
    expect(patientOnStaffRoute.status).toBe(401);
  });
});

describe('PATCH /api/patient-auth/me', () => {
  it('updates contactNumber/address only', async () => {
    const payload = registerPayload();
    const reg = await request(app).post('/api/patient-auth/register').send(payload);
    const token = reg.body.accessToken;

    const res = await request(app)
      .patch('/api/patient-auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ contactNumber: '09179998888', address: 'Updated address' });
    expect(res.status).toBe(200);
    expect(res.body.contact_number).toBe('09179998888');
    expect(res.body.address).toBe('Updated address');
  });
});

describe('patient booking', () => {
  async function createDoctor() {
    const mgmt = await loginAs('Management');
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ email: `dr.portal-${Date.now()}@cloverfamilycareabc.com`, password: 'DoctorPass123', fullName: 'Dr Portal', role: 'Doctor' });
    return res.body.id;
  }

  it('lists active doctors, books an appointment, and lists only the caller\'s own appointments', async () => {
    const doctorId = await createDoctor();
    const patientA = await request(app).post('/api/patient-auth/register').send(registerPayload());
    const patientB = await request(app).post('/api/patient-auth/register').send(registerPayload());

    const doctors = await request(app).get('/api/patient/doctors').set('Authorization', `Bearer ${patientA.body.accessToken}`);
    expect(doctors.status).toBe(200);
    expect(doctors.body.some((d) => d.id === doctorId)).toBe(true);

    const tomorrow = offsetDateString(1);
    const booked = await request(app)
      .post('/api/patient/appointments')
      .set('Authorization', `Bearer ${patientA.body.accessToken}`)
      .send({ doctorId, serviceType: 'consultation', scheduledDate: tomorrow, scheduledTime: '10:00' });
    expect(booked.status).toBe(201);
    expect(booked.body.patient_id).toBe(patientA.body.patient.id);

    const aList = await request(app).get('/api/patient/appointments').set('Authorization', `Bearer ${patientA.body.accessToken}`);
    expect(aList.body.some((a) => a.id === booked.body.id)).toBe(true);

    const bList = await request(app).get('/api/patient/appointments').set('Authorization', `Bearer ${patientB.body.accessToken}`);
    expect(bList.body.some((a) => a.id === booked.body.id)).toBe(false);
  });

  it('lets a patient cancel their own appointment, and blocks cancelling someone else\'s', async () => {
    const doctorId = await createDoctor();
    const patientA = await request(app).post('/api/patient-auth/register').send(registerPayload());
    const patientB = await request(app).post('/api/patient-auth/register').send(registerPayload());

    const tomorrow = offsetDateString(1);
    const booked = await request(app)
      .post('/api/patient/appointments')
      .set('Authorization', `Bearer ${patientA.body.accessToken}`)
      .send({ doctorId, serviceType: 'consultation', scheduledDate: tomorrow, scheduledTime: '11:00' });

    const otherTriesToCancel = await request(app)
      .post(`/api/patient/appointments/${booked.body.id}/cancel`)
      .set('Authorization', `Bearer ${patientB.body.accessToken}`);
    expect(otherTriesToCancel.status).toBe(404);

    const ownCancel = await request(app)
      .post(`/api/patient/appointments/${booked.body.id}/cancel`)
      .set('Authorization', `Bearer ${patientA.body.accessToken}`);
    expect(ownCancel.status).toBe(200);
    expect(ownCancel.body.status).toBe('cancelled');
  });
});
