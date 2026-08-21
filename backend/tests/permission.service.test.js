const bcrypt = require('bcryptjs');
const db = require('../src/db/knex');
const permissionService = require('../src/services/permission.service');

let managementUserId;
let adminUserId;

beforeAll(async () => {
  const managementUser = await db('users').where({ email: process.env.SEED_MANAGEMENT_EMAIL }).first();
  managementUserId = managementUser.id;

  const adminRole = await db('roles').where({ name: 'Admin' }).first();
  const [adminUser] = await db('users')
    .insert({
      role_id: adminRole.id,
      email: `admin-${Date.now()}@cloverfamilycareabc.com`,
      password_hash: await bcrypt.hash('admin-password-1', 12),
      full_name: 'Test Admin',
    })
    .returning(['id']);
  adminUserId = adminUser.id;
});

afterAll(async () => {
  await db.destroy();
});

describe('userHasPermission — role defaults', () => {
  it('Admin lacks financial.view by default (matches §3.2 matrix)', async () => {
    const allowed = await permissionService.userHasPermission(adminUserId, 'financial.view');
    expect(allowed).toBe(false);
  });

  it('Management has financial.view by default', async () => {
    const allowed = await permissionService.userHasPermission(managementUserId, 'financial.view');
    expect(allowed).toBe(true);
  });
});

describe('setUserPermissionOverride — "authorized Admin personnel"', () => {
  it('grants a permission the role does not have by default', async () => {
    await permissionService.setUserPermissionOverride({
      userId: adminUserId,
      permissionCode: 'financial.view',
      granted: true,
      grantedBy: managementUserId,
      reason: 'Authorized to cover monthly financial review while Management is on leave.',
    });

    const allowed = await permissionService.userHasPermission(adminUserId, 'financial.view');
    expect(allowed).toBe(true);
  });

  it('can later revoke that same override', async () => {
    await permissionService.setUserPermissionOverride({
      userId: adminUserId,
      permissionCode: 'financial.view',
      granted: false,
      grantedBy: managementUserId,
      reason: 'Coverage period ended.',
    });

    const allowed = await permissionService.userHasPermission(adminUserId, 'financial.view');
    expect(allowed).toBe(false);
  });

  it('can revoke a permission the role would otherwise grant by default', async () => {
    const before = await permissionService.userHasPermission(adminUserId, 'payment.void');
    expect(before).toBe(true); // Admin has payment.void by default per §0/§3.2

    await permissionService.setUserPermissionOverride({
      userId: adminUserId,
      permissionCode: 'payment.void',
      granted: false,
      grantedBy: managementUserId,
      reason: 'Temporarily restricted pending review.',
    });

    const after = await permissionService.userHasPermission(adminUserId, 'payment.void');
    expect(after).toBe(false);
  });
});

describe('getEffectivePermissions', () => {
  it('reflects role defaults with overrides applied', async () => {
    const codes = await permissionService.getEffectivePermissions(adminUserId);
    expect(codes).toEqual(expect.arrayContaining(['patients.view', 'billing.create']));
    expect(codes).not.toContain('payment.void'); // revoked above
    expect(codes).not.toContain('financial.view'); // never re-granted after the revoke test
  });
});
