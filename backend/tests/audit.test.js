const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db/knex');
const { loginAs } = require('./helpers/auth');

afterAll(async () => {
  await db.destroy();
});

async function meId(token) {
  const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  return res.body.id;
}

describe('GET /api/audit-logs', () => {
  it('Management sees every user\'s entries; Admin sees only their own', async () => {
    const mgmt = await loginAs('Management'); // writes an auth.login_succeeded row for mgmt's user
    const admin = await loginAs('Admin'); // writes one for admin's user
    const mgmtId = await meId(mgmt);
    const adminId = await meId(admin);

    const asManagement = await request(app)
      .get('/api/audit-logs')
      .query({ action: 'login_succeeded' })
      .set('Authorization', `Bearer ${mgmt}`);
    expect(asManagement.status).toBe(200);
    expect(asManagement.body.some((e) => e.user_id === mgmtId)).toBe(true);
    expect(asManagement.body.some((e) => e.user_id === adminId)).toBe(true);

    const asAdmin = await request(app)
      .get('/api/audit-logs')
      .query({ action: 'login_succeeded' })
      .set('Authorization', `Bearer ${admin}`);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.length).toBeGreaterThan(0);
    expect(asAdmin.body.every((e) => e.user_id === adminId)).toBe(true);
  });

  it('filters by entityType', async () => {
    const mgmt = await loginAs('Management');
    await request(app)
      .post('/api/financial/expenses')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ expenseDate: new Date().toISOString().slice(0, 10), category: 'other', description: 'Audit test expense', amount: 42 });

    const res = await request(app).get('/api/audit-logs').query({ entityType: 'expense' }).set('Authorization', `Bearer ${mgmt}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((e) => e.entity_type === 'expense')).toBe(true);
  });

  it('rejects Nurse and Cashier (no audit.view by default)', async () => {
    const nurse = await loginAs('Nurse');
    const cashier = await loginAs('Cashier');

    const nurseRes = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${nurse}`);
    expect(nurseRes.status).toBe(403);

    const cashierRes = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${cashier}`);
    expect(cashierRes.status).toBe(403);
  });
});

describe('GET /api/audit-logs/entity-types', () => {
  it('returns the distinct entity types visible to the caller, with no duplicates', async () => {
    const mgmt = await loginAs('Management');
    const res = await request(app).get('/api/audit-logs/entity-types').set('Authorization', `Bearer ${mgmt}`);
    expect(res.status).toBe(200);
    expect(res.body).toContain('user');
    expect(new Set(res.body).size).toBe(res.body.length);
  });
});

describe('GET /api/audit-logs/export', () => {
  it('returns a CSV with a header row and at least one data row', async () => {
    const mgmt = await loginAs('Management');
    const res = await request(app).get('/api/audit-logs/export').query({ action: 'login_succeeded' }).set('Authorization', `Bearer ${mgmt}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\n');
    expect(lines[0]).toBe('Date,User,Action,Entity Type,Entity ID,IP Address,Old Value,New Value');
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[1]).toContain('auth.login_succeeded');
  });
});
