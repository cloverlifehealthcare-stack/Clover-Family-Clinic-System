const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db/knex');

const MANAGEMENT_EMAIL = process.env.SEED_MANAGEMENT_EMAIL;
const MANAGEMENT_PASSWORD = process.env.SEED_MANAGEMENT_PASSWORD;

afterAll(async () => {
  await db.destroy();
});

describe('POST /api/auth/login', () => {
  it('logs in the seeded Management user and returns tokens + role', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: MANAGEMENT_EMAIL, password: MANAGEMENT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.user.role).toBe('Management');
  });

  it('rejects a wrong password without revealing whether the email exists', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: MANAGEMENT_EMAIL, password: 'definitely-wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  it('rejects an unknown email with the same generic message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@cloverfamilycareabc.com', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  it('locks the account after LOGIN_MAX_ATTEMPTS consecutive failures', async () => {
    // LOGIN_MAX_ATTEMPTS is set to 3 in tests/env.setup.js. This test's own failures plus
    // the "wrong password" case above share the same counter, so drive it to the limit
    // deliberately with a dedicated user to avoid depending on prior test ordering.
    const email = `lockout-${Date.now()}@cloverfamilycareabc.com`;
    const role = await db('roles').where({ name: 'Cashier' }).first();
    const bcrypt = require('bcryptjs');
    await db('users').insert({
      role_id: role.id,
      email,
      password_hash: await bcrypt.hash('correct-horse-battery-staple', 12),
      full_name: 'Lockout Test User',
    });

    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await request(app).post('/api/auth/login').send({ email, password: 'wrong' });
    }

    const res = await request(app).post('/api/auth/login').send({ email, password: 'wrong' });
    expect(res.status).toBe(423);
  });
});

describe('GET /api/auth/me', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user and their effective permissions', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: MANAGEMENT_EMAIL, password: MANAGEMENT_PASSWORD });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('Management');
    expect(res.body.permissions).toEqual(expect.arrayContaining(['users.manage', 'financial.view']));
  });
});

describe('RBAC enforcement on a protected route', () => {
  it('GET /api/users rejects a role without users.manage', async () => {
    const bcrypt = require('bcryptjs');
    const role = await db('roles').where({ name: 'Nurse' }).first();
    const email = `nurse-${Date.now()}@cloverfamilycareabc.com`;
    await db('users').insert({
      role_id: role.id,
      email,
      password_hash: await bcrypt.hash('nurse-password-1', 12),
      full_name: 'Test Nurse',
    });

    const login = await request(app).post('/api/auth/login').send({ email, password: 'nurse-password-1' });
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(403);

    const denied = await db('audit_logs').where({ action: 'access.denied' }).orderBy('id', 'desc').first();
    expect(denied).toBeDefined();
    expect(denied.entity_id).toBe('users.manage');
  });

  it('GET /api/users succeeds for Management', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: MANAGEMENT_EMAIL, password: MANAGEMENT_PASSWORD });

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
