import { useEffect, useState } from 'react';
import * as schedulingApi from '../../api/scheduling';
import { useAuth } from '../../auth/AuthContext';

const TODAY = new Date().toISOString().slice(0, 10);
const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'on_leave', 'half_day'];

export function SchedulingPage() {
  const { hasPermission, user } = useAuth();
  const [date, setDate] = useState(TODAY);
  const [shifts, setShifts] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canManage = hasPermission('scheduling.manage');

  async function reload() {
    const [s, a] = await Promise.all([schedulingApi.listShifts(date), schedulingApi.listAttendance(date)]);
    setShifts(s);
    setAttendance(a);
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([schedulingApi.listShifts(date), schedulingApi.listAttendance(date), canManage ? schedulingApi.listStaff() : Promise.resolve([])])
      .then(([s, a, st]) => {
        setShifts(s);
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

      <label className="date-filter">
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
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
        </>
      )}
    </div>
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
