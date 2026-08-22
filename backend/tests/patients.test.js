const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db/knex');

async function loginAs(roleName) {
  const role = await db('roles').where({ name: roleName }).first();
  const email = `${roleName.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}@cloverfamilycareabc.com`;
  const password = 'test-password-1';
  await db('users').insert({
    role_id: role.id,
    email,
    password_hash: await bcrypt.hash(password, 4), // low cost factor: tests only
    full_name: `Test ${roleName}`,
  });
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.accessToken;
}

afterAll(async () => {
  await db.destroy();
});

describe('POST /api/patients', () => {
  it('creates a patient and generates an MMYY-NNNN patient_code', async () => {
    const token = await loginAs('Management');
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Juan', lastName: 'Dela Cruz', dateOfBirth: '1990-05-15' });

    expect(res.status).toBe(201);
    expect(res.body.patient_code).toMatch(/^\d{4}-\d{4}$/);
  });

  it('allocates sequential codes within the same month', async () => {
    const token = await loginAs('Management');
    const res1 = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Ana', lastName: `Reyes-${Date.now()}`, dateOfBirth: '1985-01-01' });
    const res2 = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Ben', lastName: `Santos-${Date.now()}`, dateOfBirth: '1988-02-02' });

    const [, n1] = res1.body.patient_code.split('-');
    const [, n2] = res2.body.patient_code.split('-');
    expect(Number(n2)).toBe(Number(n1) + 1);
  });

  it('flags a likely duplicate (same name + DOB) instead of creating it outright', async () => {
    const token = await loginAs('Management');
    const lastName = `Garcia-${Date.now()}`;
    const patient = { firstName: 'Maria', lastName, dateOfBirth: '1995-03-20' };

    const first = await request(app).post('/api/patients').set('Authorization', `Bearer ${token}`).send(patient);
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/patients').set('Authorization', `Bearer ${token}`).send(patient);
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('possible_duplicate');
    expect(second.body.possibleDuplicates).toHaveLength(1);

    const confirmed = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...patient, confirmDuplicate: true });
    expect(confirmed.status).toBe(201);
  });

  it('requires guardian info for a minor', async () => {
    const token = await loginAs('Management');
    const lastName = `Minor-${Date.now()}`;
    const withoutGuardian = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Kid', lastName, dateOfBirth: '2015-01-01' });
    expect(withoutGuardian.status).toBe(400);

    const withGuardian = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Kid', lastName, dateOfBirth: '2015-01-01',
        guardianName: 'Parent Name', guardianRelationship: 'Mother', guardianContactNumber: '09171234567',
      });
    expect(withGuardian.status).toBe(201);
  });

  it('rejects a Doctor from creating a patient (no patients.create by default)', async () => {
    const token = await loginAs('Doctor');
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'X', lastName: 'Y', dateOfBirth: '2000-01-01' });
    expect(res.status).toBe(403);
  });

  it('allows a Nurse to create a patient (patients.create default)', async () => {
    const token = await loginAs('Nurse');
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Nurse', lastName: `Created-${Date.now()}`, dateOfBirth: '2000-01-01' });
    expect(res.status).toBe(201);
  });
});

describe('field-level restriction by patients.history.view', () => {
  let patientId;

  beforeAll(async () => {
    const token = await loginAs('Management');
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Field', lastName: `Test-${Date.now()}`, dateOfBirth: '1970-01-01',
        medicalHistoryNotes: 'Sensitive clinical detail',
      });
    patientId = res.body.id;
  });

  it('Cashier (no patients.history.view) does not receive medical_history_notes', async () => {
    const token = await loginAs('Cashier');
    const res = await request(app).get(`/api/patients/${patientId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.medical_history_notes).toBeUndefined();
    expect(res.body.patient_code).toBeDefined();
  });

  it('Doctor (has patients.history.view) receives the full record', async () => {
    const token = await loginAs('Doctor');
    const res = await request(app).get(`/api/patients/${patientId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.medical_history_notes).toBe('Sensitive clinical detail');
  });
});

describe('PATCH /api/patients/:id', () => {
  it('rejects a Nurse (no patients.edit by default)', async () => {
    const managementToken = await loginAs('Management');
    const created = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${managementToken}`)
      .send({ firstName: 'Edit', lastName: `Target-${Date.now()}`, dateOfBirth: '1980-01-01' });

    const nurseToken = await loginAs('Nurse');
    const res = await request(app)
      .patch(`/api/patients/${created.body.id}`)
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ contactNumber: '09170000000' });
    expect(res.status).toBe(403);
  });

  it('allows Management to edit demographics', async () => {
    const token = await loginAs('Management');
    const created = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Edit', lastName: `Target2-${Date.now()}`, dateOfBirth: '1980-01-01' });

    const res = await request(app)
      .patch(`/api/patients/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ contactNumber: '09170000000' });
    expect(res.status).toBe(200);
    expect(res.body.contact_number).toBe('09170000000');
  });
});
