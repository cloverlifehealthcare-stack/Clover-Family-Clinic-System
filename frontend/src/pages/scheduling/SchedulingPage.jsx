import { useEffect, useState } from 'react';
import * as schedulingApi from '../../api/scheduling';
import { useAuth } from '../../auth/AuthContext';

const TODAY = new Date().toISOString().slice(0, 10);
const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'on_leave', 'half_day'];

// Formats a Date using its LOCAL calendar fields, not `.toISOString().slice(0, 10)` — that
// converts to UTC first, which silently rolls the date back a day for anyone west of UTC... no,
// actually east of UTC (e.g. the Philippines, UTC+8) at local midnight, since UTC hasn't reached
// that calendar day yet. Bit the week calendar below during initial testing (showed Sat–Fri
// instead of Mon–Sun) — every date built from a local-midnight Date must go through this, not
// toISOString.
function formatLocalDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Monday-start week containing the given 'YYYY-MM-DD' date string.
function getWeekRange(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatLocalDate(monday), end: formatLocalDate(sunday) };
}

export function SchedulingPage() {
  const { hasPermission, user } = useAuth();
  const [date, setDate] = useState(TODAY);
  const [shifts, setShifts] = useState([]);
  const [weekShifts, setWeekShifts] = useState([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [attendance, setAttendance] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const canManage = hasPermission('scheduling.manage');
  const week = getWeekRange(date);

  async function reload() {
    const [s, w, a] = await Promise.all([
      schedulingApi.listShifts(date),
      schedulingApi.listShiftsRange(week.start, week.end),
      schedulingApi.listAttendance(date),
    ]);
    setShifts(s);
    setWeekShifts(w);
    setAttendance(a);
    // Hours of Service manages its own fetch (it has its own date-range inputs, independent of
    // the page's single `date`), so it doesn't see this reload — bump a token it watches instead.
    setRefreshToken((t) => t + 1);
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      schedulingApi.listShifts(date),
      schedulingApi.listShiftsRange(week.start, week.end),
      schedulingApi.listAttendance(date),
      canManage ? schedulingApi.listStaff() : Promise.resolve([]),
    ])
      .then(([s, w, a, st]) => {
        setShifts(s);
        setWeekShifts(w);
        setAttendance(a);
        setStaff(st);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, canManage]);

  const myAttendanceToday = attendance.find((a) => a.user_id === user?.id && a.attendance_date === TODAY);

  return (
    <div>
      <h1>Staff Scheduling &amp; Attendance</h1>

      {error && <div className="form-error">{error}</div>}

      <ClockWidget myAttendanceToday={date === TODAY ? myAttendanceToday : null} onChanged={reload} showHint={date !== TODAY} />
      {canManage && <ClockForStaffWidget staff={staff} onChanged={reload} />}

      <label className="date-filter">
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          <WeekCalendar weekShifts={weekShifts} weekStart={week.start} roleFilter={roleFilter} setRoleFilter={setRoleFilter} />

          <section className="record-section">
            <h2>Shifts — {date}</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Time</th>
                  <th>Notes</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.id}>
                    <td>{s.user_name}</td>
                    <td>
                      {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                    </td>
                    <td>{s.notes || '—'}</td>
                    {canManage && (
                      <td>
                        <button
                          type="button"
                          onClick={async () => {
                            await schedulingApi.deleteShift(s.id);
                            reload();
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {shifts.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 4 : 3}>No shifts scheduled for this date.</td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && <AssignShiftForm date={date} staff={staff} onAssigned={reload} />}
          </section>

          <section className="record-section">
            <h2>Attendance — {date}</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.id}>
                    <td>{a.user_name}</td>
                    <td>{a.clock_in_at ? new Date(a.clock_in_at).toLocaleTimeString() : '—'}</td>
                    <td>{a.clock_out_at ? new Date(a.clock_out_at).toLocaleTimeString() : '—'}</td>
                    <td>
                      <span className={`status-badge status-${a.status}`}>{a.status.replace('_', ' ')}</span>
                    </td>
                  </tr>
                ))}
                {attendance.length === 0 && (
                  <tr>
                    <td colSpan={4}>No attendance records for this date.</td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && <RecordAttendanceForm date={date} staff={staff} onRecorded={reload} />}
          </section>

          <HoursSummary canManage={canManage} refreshToken={refreshToken} />
        </>
      )}
    </div>
  );
}

function ClockForStaffWidget({ staff, onChanged }) {
  const [userId, setUserId] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handle(action) {
    if (!userId) return;
    setError(null);
    setBusy(true);
    try {
      if (action === 'in') {
        await schedulingApi.clockInFor(Number(userId));
      } else {
        await schedulingApi.clockOutFor(Number(userId));
      }
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="record-section clock-widget">
      <h2>Clock In/Out for Staff</h2>
      <p className="page-description">
        For staff who don't log into the system themselves — e.g. a doctor — record their attendance on their
        behalf, timestamped now.
      </p>
      {error && <div className="form-error">{error}</div>}
      <div className="inline-form">
        <label>
          Staff
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Select…</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.role})
              </option>
            ))}
          </select>
        </label>
        <div className="button-row">
          <button type="button" disabled={!userId || busy} onClick={() => handle('in')}>
            Clock In
          </button>
          <button type="button" disabled={!userId || busy} onClick={() => handle('out')}>
            Clock Out
          </button>
        </div>
      </div>
    </section>
  );
}

function WeekCalendar({ weekShifts, weekStart, roleFilter, setRoleFilter }) {
  const days = [];
  const start = new Date(`${weekStart}T00:00:00`);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(formatLocalDate(d));
  }
  const roles = [...new Set(weekShifts.map((s) => s.role))].sort();

  return (
    <section className="record-section">
      <h2>Weekly Schedule</h2>
      <label className="date-filter">
        Filter by role
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All staff</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <div className="week-calendar">
        {days.map((day) => {
          const dayShifts = weekShifts.filter((s) => s.shift_date === day && (roleFilter === 'all' || s.role === roleFilter));
          return (
            <div key={day} className={`week-calendar-day${day === TODAY ? ' is-today' : ''}`}>
              <div className="week-calendar-day-label">
                {new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              {dayShifts.map((s) => (
                <div key={s.id} className="week-calendar-shift">
                  <strong>{s.user_name}</strong>
                  {s.role} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                </div>
              ))}
              {dayShifts.length === 0 && <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>—</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HoursSummary({ canManage, refreshToken }) {
  const defaultWeek = getWeekRange(TODAY);
  const [start, setStart] = useState(defaultWeek.start);
  const [end, setEnd] = useState(defaultWeek.end);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    schedulingApi
      .getHoursSummary(start, end)
      .then(setRows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [start, end, refreshToken]);

  return (
    <section className="record-section">
      <h2>Hours of Service</h2>
      <p className="page-description">
        Total hours actually worked (from real clock-in/clock-out times) per staff member for the selected range.
        {!canManage && ' Showing your own hours only.'}
      </p>
      <div className="filter-row">
        <label>
          From
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      {error && <div className="form-error">{error}</div>}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Role</th>
              <th>Days Recorded</th>
              <th>Total Hours</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId}>
                <td>{r.userName}</td>
                <td>{r.role}</td>
                <td>{r.daysRecorded}</td>
                <td>{r.totalHours.toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4}>No completed clock-in/clock-out records in this range.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ClockWidget({ myAttendanceToday, onChanged, showHint }) {
  const [error, setError] = useState(null);

  async function handleClockIn() {
    setError(null);
    try {
      await schedulingApi.clockIn();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleClockOut() {
    setError(null);
    try {
      await schedulingApi.clockOut();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="record-section clock-widget">
      <h2>My Attendance Today</h2>
      {error && <div className="form-error">{error}</div>}
      {showHint && <p className="page-description">Switch the date filter to today to see your live status here.</p>}
      <p>
        {myAttendanceToday?.clock_in_at ? (
          <>Clocked in at {new Date(myAttendanceToday.clock_in_at).toLocaleTimeString()}</>
        ) : (
          'Not clocked in yet.'
        )}
        {myAttendanceToday?.clock_out_at && <> — clocked out at {new Date(myAttendanceToday.clock_out_at).toLocaleTimeString()}</>}
      </p>
      <div className="button-row">
        <button type="button" onClick={handleClockIn} disabled={!!myAttendanceToday?.clock_in_at}>
          Clock In
        </button>
        <button type="button" onClick={handleClockOut} disabled={!myAttendanceToday?.clock_in_at || !!myAttendanceToday?.clock_out_at}>
          Clock Out
        </button>
      </div>
    </section>
  );
}

function AssignShiftForm({ date, staff, onAssigned }) {
  const [form, setForm] = useState({ userId: '', startTime: '08:00', endTime: '17:00', notes: '' });
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      await schedulingApi.createShift({ ...form, userId: Number(form.userId), shiftDate: date });
      setForm({ userId: '', startTime: '08:00', endTime: '17:00', notes: '' });
      onAssigned();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={submit} className="inline-form">
      {error && <div className="form-error">{error}</div>}
      <label>
        Staff
        <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
          <option value="">Select…</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name} ({s.role})
            </option>
          ))}
        </select>
      </label>
      <label>
        Start
        <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
      </label>
      <label>
        End
        <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
      </label>
      <label className="field-wide">
        Notes
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </label>
      <button type="submit">Assign Shift</button>
    </form>
  );
}

function RecordAttendanceForm({ date, staff, onRecorded }) {
  const [form, setForm] = useState({ userId: '', status: 'present', notes: '' });
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      await schedulingApi.recordAttendance({ ...form, userId: Number(form.userId), attendanceDate: date });
      setForm({ userId: '', status: 'present', notes: '' });
      onRecorded();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={submit} className="inline-form">
      {error && <div className="form-error">{error}</div>}
      <label>
        Staff
        <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
          <option value="">Select…</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name} ({s.role})
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          {ATTENDANCE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      <label className="field-wide">
        Notes
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </label>
      <button type="submit">Save Correction</button>
    </form>
  );
}
