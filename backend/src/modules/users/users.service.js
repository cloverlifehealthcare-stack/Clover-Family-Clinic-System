const bcrypt = require('bcryptjs');
const db = require('../../db/knex');
const auditLog = require('../../services/auditLog.service');
const ApiError = require('../../utils/ApiError');

const PUBLIC_COLUMNS = [
  'users.id', 'users.email', 'users.full_name', 'users.contact_number',
  'users.is_active', 'users.last_login_at', 'users.created_at',
  'roles.name as role',
];

async function listUsers() {
  return db('users').join('roles', 'roles.id', 'users.role_id').select(PUBLIC_COLUMNS).orderBy('users.full_name');
}

async function getUser(id) {
  const user = await db('users').join('roles', 'roles.id', 'users.role_id').where({ 'users.id': id }).select(PUBLIC_COLUMNS).first();
  if (!user) {
    throw new ApiError(404, 'User not found.');
  }
  return user;
}

async function createUser({ email, password, fullName, contactNumber, roleName, createdBy, ipAddress }) {
  const role = await db('roles').where({ name: roleName }).first();
  if (!role) {
    throw new ApiError(400, `Unknown role: ${roleName}`);
  }

  const existing = await db('users').where({ email }).first();
  if (existing) {
    throw new ApiError(409, 'A user with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [created] = await db('users')
    .insert({
      role_id: role.id,
      email,
      password_hash: passwordHash,
      full_name: fullName,
      contact_number: contactNumber || null,
    })
    .returning(['id']);

  await auditLog.write({
    userId: createdBy,
    action: 'user.create',
    entityType: 'user',
    entityId: created.id,
    newValue: { email, fullName, role: roleName },
    ipAddress,
  });

  return getUser(created.id);
}

async function setActive({ id, isActive, actingUserId, ipAddress }) {
  const before = await getUser(id);

  if (id === actingUserId && !isActive) {
    throw new ApiError(400, 'You cannot deactivate your own account.');
  }

  await db('users').where({ id }).update({ is_active: isActive });

  await auditLog.write({
    userId: actingUserId,
    action: isActive ? 'user.reactivate' : 'user.deactivate',
    entityType: 'user',
    entityId: id,
    oldValue: { isActive: before.is_active },
    newValue: { isActive },
    ipAddress,
  });

  return getUser(id);
}

module.exports = { listUsers, getUser, createUser, setActive };
