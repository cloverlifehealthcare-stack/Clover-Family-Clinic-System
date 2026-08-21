const { ROLE_DEFAULTS } = require('../../config/roleDefaults');

exports.seed = async function seed(knex) {
  const roles = await knex('roles').select('id', 'name');
  const permissions = await knex('permissions').select('id', 'code');

  const roleIdByName = Object.fromEntries(roles.map((r) => [r.name, r.id]));
  const permissionIdByCode = Object.fromEntries(permissions.map((p) => [p.code, p.id]));

  const rows = [];
  for (const [roleName, codes] of Object.entries(ROLE_DEFAULTS)) {
    const roleId = roleIdByName[roleName];
    if (!roleId) {
      throw new Error(`Seed error: role "${roleName}" not found — check 001_roles.js`);
    }
    for (const code of codes) {
      const permissionId = permissionIdByCode[code];
      if (!permissionId) {
        throw new Error(`Seed error: permission "${code}" not found — check src/config/permissions.js`);
      }
      rows.push({ role_id: roleId, permission_id: permissionId });
    }
  }

  await knex('role_permissions').insert(rows);
};
