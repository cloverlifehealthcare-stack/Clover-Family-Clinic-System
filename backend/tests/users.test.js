const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db/knex');
const { loginAs } = require('./helpers/auth');

afterAll(async () => {
  await db.destroy();
});

describe('GET /api/users/doctors', () => {
  it('is reachable by Admin (has appointments.manage, not users.manage) and returns only id + full_name', async () => {
    const doctorToken = await loginAs('Doctor');
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${doctorToken}`);

    const admin = await loginAs('Admin');
    const res = await request(app).get('/api/users/doctors').set('Authorization', `Bearer ${admin}`);

    expect(res.status).toBe(200);
    expect(res.body.some((d) => d.id === me.body.id)).toBe(true);
    for (const doctor of res.body) {
      expect(Object.keys(doctor).sort()).toEqual(['full_name', 'id']);
    }
  });

  it('rejects a Cashier (no appointments.manage by default)', async () => {
    const cashier = await loginAs('Cashier');
    const res = await request(app).get('/api/users/doctors').set('Authorization', `Bearer ${cashier}`);
    expect(res.status).toBe(403);
  });

  it('does not expose the full user list to Admin (users.manage is still Management-only)', async () => {
    const admin = await loginAs('Admin');
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/users/staff', () => {
  it('is reachable by Admin (has scheduling.manage, not users.manage) and returns id + full_name + role for any role', async () => {
    const cashierToken = await loginAs('Cashier');
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${cashierToken}`);

    const admin = await loginAs('Admin');
    const res = await request(app).get('/api/users/staff').set('Authorization', `Bearer ${admin}`);

    expect(res.status).toBe(200);
    expect(res.body.some((s) => s.id === me.body.id && s.role === 'Cashier')).toBe(true);
    for (const staff of res.body) {
      expect(Object.keys(staff).sort()).toEqual(['full_name', 'id', 'role']);
    }
  });

  it('rejects a Nurse (no scheduling.manage by default)', async () => {
    const nurse = await loginAs('Nurse');
    const res = await request(app).get('/api/users/staff').set('Authorization', `Bearer ${nurse}`);
    expect(res.status).toBe(403);
  });
});
