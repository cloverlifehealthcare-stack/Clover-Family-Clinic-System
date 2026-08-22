import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as appointmentsApi from '../../api/appointments';
import { useAuth } from '../../auth/AuthContext';

export function AppointmentDetailPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const [appointment, setAppointment] = useState(null);
  const [error, setError] = useState(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    appointmentsApi.getAppointment(id).then((a) => {
      setAppointment(a);
      setForm({ scheduledDate: a.scheduled_date, scheduledTime: a.scheduled_time.slice(0, 5) });
    }).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="form-error">{error}</div>;
  if (!appointment) return <p>Loading…</p>;

  const canManage = hasPermission('appointments.manage');

  async function runAction(fn) {
    setError(null);
    try {
      setAppointment(await fn(id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitReschedule(e) {
    e.preventDefault();
    setError(null);
    try {
      const updated = await appointmentsApi.updateAppointment(id, form);
      setAppointment(updated);
      setRescheduling(false);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>
          {appointment.patient_last_name}, {appointment.patient_first_name} — {appointment.scheduled_date} {appointment.scheduled_time.slice(0, 5)}
        </h1>
        <span className={`status-badge status-${appointment.status}`}>{appointment.status.replace('_', ' ')}</span>
      </div>

      {error && <div className="form-error">{error}</div>}

      <dl className="detail-grid">
        <dt>Doctor</dt>
        <dd>{appointment.doctor_name}</dd>
        <dt>Service type</dt>
        <dd>{appointment.service_type.replace('_', ' ')}</dd>
        <dt>Notes</dt>
        <dd>{appointment.notes || '—'}</dd>
      </dl>

      {canManage && (
        <div className="button-row">
          {appointment.status === 'scheduled' && (
            <>
              <button type="button" onClick={() => runAction(appointmentsApi.checkIn)}>
                Check In
              </button>
              <button type="button" onClick={() => runAction(appointmentsApi.cancel)}>
                Cancel
              </button>
              <button type="button" onClick={() => runAction(appointmentsApi.markNoShow)}>
                No-Show
              </button>
              <button type="button" onClick={() => setRescheduling((v) => !v)}>
                {rescheduling ? 'Close' : 'Reschedule'}
              </button>
            </>
          )}
          {appointment.status === 'checked_in' && (
            <>
              <button type="button" onClick={() => runAction(appointmentsApi.complete)}>
                Complete
              </button>
              <button type="button" onClick={() => runAction(appointmentsApi.markNoShow)}>
                No-Show
              </button>
            </>
          )}
        </div>
      )}

      {rescheduling && (
        <form onSubmit={submitReschedule} className="inline-form">
          <label>
            Date
            <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} />
          </label>
          <label>
            Time
            <input type="time" step="900" value={form.scheduledTime} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} />
          </label>
          <button type="submit">Save New Time</button>
        </form>
      )}

      <p className="back-link">
        <Link to="/appointments">← Back to appointments</Link>
      </p>
    </div>
  );
}
