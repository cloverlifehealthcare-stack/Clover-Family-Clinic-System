const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db/knex');

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

module.exports = { loginAs };
