const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db/knex');
const { loginAs } = require('./helpers/auth');

afterAll(async () => {
  await db.destroy();
});

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

describe('GET /api/dashboard', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
  });

  it('Management (all permissions) gets every section populated, dated today', async () => {
    const mgmt = await loginAs('Management');
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${mgmt}`);

    expect(res.status).toBe(200);
    expect(res.body.date).toBe(todayDateString());
    expect(res.body.dailyActivity).not.toBeNull();
    expect(res.body.dailyActivity.date).toBe(todayDateString());
    expect(res.body.inventoryAlerts).not.toBeNull();
    expect(res.body.inventoryAlerts).toEqual(
      expect.objectContaining({ lowStockCount: expect.any(Number), expiringSoonCount: expect.any(Number) })
    );
    expect(res.body.followUps).toEqual({ dueToday: expect.any(Number), overdue: expect.any(Number) });
    expect(res.body.appointmentsToday).toEqual(expect.objectContaining({ count: expect.any(Number) }));
    expect(res.body.shiftsToday).toEqual(expect.objectContaining({ count: expect.any(Number) }));
    expect(res.body.financialSummary).toEqual(expect.objectContaining({ netProfit: expect.any(Number) }));
  });

  it('a Cashier (no reports/inventory/financial view) gets those sections null, but appointments/scheduling populated', async () => {
    const cashier = await loginAs('Cashier');
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${cashier}`);

    expect(res.status).toBe(200);
    expect(res.body.dailyActivity).toBeNull();
    expect(res.body.inventoryAlerts).toBeNull();
    expect(res.body.followUps).toBeNull();
    expect(res.body.financialSummary).toBeNull();
    expect(res.body.appointmentsToday).not.toBeNull();
    expect(res.body.shiftsToday).not.toBeNull();
  });

  it("a Doctor's appointmentsToday is row-scoped to their own schedule (same rule as GET /api/appointments)", async () => {
    const doctor = await loginAs('Doctor');
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${doctor}`);

    expect(res.status).toBe(200);
    expect(res.body.appointmentsToday).not.toBeNull();
    // Nothing was scheduled for this brand-new test doctor today, so the row-scoped list is empty
    // — the meaningful assertion is that the request succeeds and returns a scoped (not global) count.
    expect(res.body.appointmentsToday.count).toBe(0);
  });
});
