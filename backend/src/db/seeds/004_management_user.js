const bcrypt = require('bcryptjs');

// Seeds exactly one Management account so someone can log in and create every other
// staff account through the app from there. Values come from .env — change the password
// immediately after first login (there's no "first run wizard"; this is it).
exports.seed = async function seed(knex) {
  const email = process.env.SEED_MANAGEMENT_EMAIL;
  const password = process.env.SEED_MANAGEMENT_PASSWORD;
  const fullName = process.env.SEED_MANAGEMENT_FULL_NAME || 'Clinic Management';

  if (!email || !password) {
    throw new Error(
      'SEED_MANAGEMENT_EMAIL and SEED_MANAGEMENT_PASSWORD must be set in .env before seeding.'
    );
  }

  const managementRole = await knex('roles').where({ name: 'Management' }).first();
  if (!managementRole) {
    throw new Error('Seed error: Management role not found — check 001_roles.js');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await knex('users').insert({
    role_id: managementRole.id,
    email,
    password_hash: passwordHash,
    full_name: fullName,
    is_active: true,
  });
};
