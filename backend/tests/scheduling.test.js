const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db/knex');
const { loginAs } = require('./helpers/auth');

afterAll(async () => {
  await db.destroy();
});

async function loginAsWithId(roleName) {
  const token = await loginAs(roleName);
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  return { token, id: me.body.id };
}

describe('POST /api/scheduling/shifts', () => {
  it('creates a shift (Admin has scheduling.manage)', async () => {
    const admin = await loginAs('Admin');
    const nurse = await loginAsWithId('Nurse');

    const res = await request(app)
      .post('/api/scheduling/shifts')
      .set('Authorization', `Bearer ${admin}`)
      .send({ userId: nurse.id, shiftDate: '2026-09-01', startTime: '08:00', endTime: '16:00' });

    expect(res.status).toBe(201);
    expect(res.body.user_id).toBe(nurse.id);
  });

  it('rejects a Nurse (scheduling.view only, not scheduling.manage)', async () => {
    const nurse = await loginAsWithId('Nurse');
    const res = await request(app)
      .post('/api/scheduling/shifts')
      .set('Authorization', `Bearer ${nurse.token}`)
      .send({ userId: nurse.id, shiftDate: '2026-09-01', startTime: '08:00', endTime: '16:00' });
    expect(res.status).toBe(403);
  });

  it('rejects endTime at or before startTime', async () => {
    const admin = await loginAs('Admin');
    const nurse = await loginAsWithId('Nurse');
    const res = await request(app)
      .post('/api/scheduling/shifts')
      .set('Authorization', `Bearer ${admin}`)
      .send({ userId: nurse.id, shiftDate: '2026-09-01', startTime: '16:00', endTime: '08:00' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/scheduling/shifts row-scoping', () => {
  it('a non-manager only sees their own shifts even if querying another userId', async () => {
    const admin = await loginAs('Admin');
    const doctorA = await loginAsWithId('Doctor');
    const doctorB = await loginAsWithId('Doctor');

    await request(app)
      .post('/api/scheduling/shifts')
      .set('Authorization', `Bearer ${admin}`)
      .send({ userId: doctorA.id, shiftDate: '2026-09-02', startTime: '08:00', endTime: '12:00' });
    await request(app)
      .post('/api/scheduling/shifts')
      .set('Authorization', `Bearer ${admin}`)
      .send({ userId: doctorB.id, shiftDate: '2026-09-02', startTime: '13:00', endTime: '17:00' });

    const res = await request(app)
      .get('/api/scheduling/shifts')
      .query({ date: '2026-09-02', userId: doctorB.id }) // attempting to view someone else's
      .set('Authorization', `Bearer ${doctorA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.every((s) => s.user_id === doctorA.id)).toBe(true);
  });

  it('a manager (Admin) sees everyone, filterable by userId', async () => {
    const admin = await loginAs('Admin');
    const res = await request(app)
      .get('/api/scheduling/shifts')
      .query({ date: '2026-09-02' })
      .set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });
});

describe('DELETE /api/scheduling/shifts/:id', () => {
  it('rejects a Nurse and allows Management', async () => {
    const mgmt = await loginAs('Management');
    const nurse = await loginAsWithId('Nurse');
    const created = await request(app)
      .post('/api/scheduling/shifts')
      .set('Authorization', `Bearer ${mgmt}`)
      .send({ userId: nurse.id, shiftDate: '2026-09-03', startTime: '08:00', endTime: '12:00' });

    const blocked = await request(app)
      .delete(`/api/scheduling/shifts/${created.body.id}`)
      .set('Authorization', `Bearer ${nurse.token}`);
    expect(blocked.status).toBe(403);

    const allowed = await request(app)
      .delete(`/api/scheduling/shifts/${created.body.id}`)
      .set('Authorization', `Bearer ${mgmt}`);
    expect(allowed.status).toBe(204);
  });
});

describe('attendance self-service clock-in/out', () => {
  it('clocks in, rejects a duplicate clock-in, then clocks out, then rejects a duplicate clock-out', async () => {
    const nurse = await loginAs('Nurse');

    const in1 = await request(app).post('/api/scheduling/attendance/clock-in').set('Authorization', `Bearer ${nurse}`);
    expect(in1.status).toBe(201);
    expect(in1.body.clock_in_at).not.toBeNull();
    expect(in1.body.status).toBe('present');

    const in2 = await request(app).post('/api/scheduling/attendance/clock-in').set('Authorization', `Bearer ${nurse}`);
    expect(in2.status).toBe(400);

    const out1 = await request(app).post('/api/scheduling/attendance/clock-out').set('Authorization', `Bearer ${nurse}`);
    expect(out1.status).toBe(200);
    expect(out1.body.clock_out_at).not.toBeNull();

    const out2 = await request(app).post('/api/scheduling/attendance/clock-out').set('Authorization', `Bearer ${nurse}`);
    expect(out2.status).toBe(400);
  });

  it('rejects clocking out before clocking in', async () => {
    const doctor = await loginAs('Doctor');
    const res = await request(app).post('/api/scheduling/attendance/clock-out').set('Authorization', `Bearer ${doctor}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/scheduling/attendance row-scoping', () => {
  it('a non-manager only sees their own attendance', async () => {
    const doctorA = await loginAsWithId('Doctor');
    const doctorB = await loginAsWithId('Doctor');

    await request(app).post('/api/scheduling/attendance/clock-in').set('Authorization', `Bearer ${doctorA.token}`);
    await request(app).post('/api/scheduling/attendance/clock-in').set('Authorization', `Bearer ${doctorB.token}`);

    const res = await request(app)
      .get('/api/scheduling/attendance')
      .query({ userId: doctorB.id })
      .set('Authorization', `Bearer ${doctorA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.every((a) => a.user_id === doctorA.id)).toBe(true);
  });
});

describe('POST /api/scheduling/attendance (manual correction)', () => {
  it('rejects a Nurse and allows Admin to mark someone on_leave', async () => {
    const admin = await loginAs('Admin');
    const nurseActor = await loginAs('Nurse');
    const target = await loginAsWithId('Cashier');

    const blocked = await request(app)
      .post('/api/scheduling/attendance')
      .set('Authorization', `Bearer ${nurseActor}`)
      .send({ userId: target.id, attendanceDate: '2026-09-04', status: 'on_leave' });
    expect(blocked.status).toBe(403);

    const res = await request(app)
      .post('/api/scheduling/attendance')
      .set('Authorization', `Bearer ${admin}`)
      .send({ userId: target.id, attendanceDate: '2026-09-04', status: 'on_leave', notes: 'Approved leave' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('on_leave');
  });

  it('rejects an invalid status', async () => {
    const admin = await loginAs('Admin');
    const target = await loginAsWithId('Cashier');
    const res = await request(app)
      .post('/api/scheduling/attendance')
      .set('Authorization', `Bearer ${admin}`)
      .send({ userId: target.id, attendanceDate: '2026-09-05', status: 'not-a-real-status' });
    expect(res.status).toBe(400);
  });
});

describe('clocking in/out a different staff member (POST .../clock-in-for/:userId, clock-out-for)', () => {
  it('Admin can clock a doctor in and out; Nurse cannot', async () => {
    const admin = await loginAs('Admin');
    const nurseActor = await loginAs('Nurse');
    const doctor = await loginAsWithId('Doctor');

    const blocked = await request(app)
      .post(`/api/scheduling/attendance/clock-in-for/${doctor.id}`)
      .set('Authorization', `Bearer ${nurseActor}`);
    expect(blocked.status).toBe(403);

    const in1 = await request(app)
      .post(`/api/scheduling/attendance/clock-in-for/${doctor.id}`)
      .set('Authorization', `Bearer ${admin}`);
    expect(in1.status).toBe(201);
    expect(in1.body.user_id).toBe(doctor.id);
    expect(in1.body.clock_in_at).not.toBeNull();

    const dup = await request(app)
      .post(`/api/scheduling/attendance/clock-in-for/${doctor.id}`)
      .set('Authorization', `Bearer ${admin}`);
    expect(dup.status).toBe(400);

    const out1 = await request(app)
      .post(`/api/scheduling/attendance/clock-out-for/${doctor.id}`)
      .set('Authorization', `Bearer ${admin}`);
    expect(out1.status).toBe(200);
    expect(out1.body.clock_out_at).not.toBeNull();
  });

  it('rejects clocking out a staff member who has not clocked in, and clocking in a nonexistent user', async () => {
    const admin = await loginAs('Admin');
    const doctor = await loginAsWithId('Doctor');

    const notClockedIn = await request(app)
      .post(`/api/scheduling/attendance/clock-out-for/${doctor.id}`)
      .set('Authorization', `Bearer ${admin}`);
    expect(notClockedIn.status).toBe(400);

    const nonexistent = await request(app)
      .post('/api/scheduling/attendance/clock-in-for/999999')
      .set('Authorization', `Bearer ${admin}`);
    expect(nonexistent.status).toBe(404);
  });
});

describe('GET /api/scheduling/hours-summary', () => {
  it('sums real clock_in/clock_out durations for a staff member over a date range', async () => {
    const admin = await loginAs('Admin');
    const doctor = await loginAsWithId('Doctor');

    await request(app)
      .post('/api/scheduling/attendance')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        userId: doctor.id,
        attendanceDate: '2026-09-10',
        clockInAt: '2026-09-10T08:00:00.000Z',
        clockOutAt: '2026-09-10T16:00:00.000Z',
      });

    const res = await request(app)
      .get('/api/scheduling/hours-summary')
      .query({ startDate: '2026-09-10', endDate: '2026-09-10', userId: doctor.id })
      .set('Authorization', `Bearer ${admin}`);

    expect(res.status).toBe(200);
    const row = res.body.find((r) => r.userId === doctor.id);
    expect(row).toBeDefined();
    expect(row.totalHours).toBe(8);
    expect(row.daysRecorded).toBe(1);
  });

  it('rejects a request missing startDate/endDate', async () => {
    const admin = await loginAs('Admin');
    const res = await request(app).get('/api/scheduling/hours-summary').set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(400);
  });

  it('a non-manager only sees their own hours', async () => {
    const admin = await loginAs('Admin');
    const doctorA = await loginAsWithId('Doctor');
    const doctorB = await loginAsWithId('Doctor');

    await request(app)
      .post('/api/scheduling/attendance')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        userId: doctorB.id,
        attendanceDate: '2026-09-11',
        clockInAt: '2026-09-11T08:00:00.000Z',
        clockOutAt: '2026-09-11T12:00:00.000Z',
      });

    const res = await request(app)
      .get('/api/scheduling/hours-summary')
      .query({ startDate: '2026-09-11', endDate: '2026-09-11', userId: doctorB.id })
      .set('Authorization', `Bearer ${doctorA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.every((r) => r.userId === doctorA.id)).toBe(true);
  });
});

describe('GET /api/scheduling/shifts date range (weekly calendar)', () => {
  it('returns shifts within startDate/endDate, including the role field', async () => {
    const admin = await loginAs('Admin');
    const doctor = await loginAsWithId('Doctor');

    await request(app)
      .post('/api/scheduling/shifts')
      .set('Authorization', `Bearer ${admin}`)
      .send({ userId: doctor.id, shiftDate: '2026-09-15', startTime: '08:00', endTime: '12:00' });

    const res = await request(app)
      .get('/api/scheduling/shifts')
      .query({ startDate: '2026-09-14', endDate: '2026-09-20' })
      .set('Authorization', `Bearer ${admin}`);

    expect(res.status).toBe(200);
    const row = res.body.find((s) => s.user_id === doctor.id && s.shift_date === '2026-09-15');
    expect(row).toBeDefined();
    expect(row.role).toBe('Doctor');
  });
});
