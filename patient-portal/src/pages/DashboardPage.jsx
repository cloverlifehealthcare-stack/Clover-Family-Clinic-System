import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as appointmentsApi from '../api/appointments';

export function DashboardPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function reload() {
    setLoading(true);
    setError(null);
    appointmentsApi
      .listMyAppointments()
      .then(setAppointments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  async function handleCancel(id) {
    setError(null);
    try {
      await appointmentsApi.cancelAppointment(id);
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>My Appointments</h1>
      <p className="page-description">
        <Link to="/book">Book a new appointment</Link> — 15-minute slots, subject to the doctor's availability.
      </p>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Doctor</th>
              <th>Type</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.id}>
                <td>{a.scheduled_date}</td>
                <td>{a.scheduled_time.slice(0, 5)}</td>
                <td>{a.doctor_name}</td>
                <td>{a.service_type.replace('_', ' ')}</td>
                <td>
                  <span className={`status-badge status-${a.status}`}>{a.status.replace('_', ' ')}</span>
                </td>
                <td>
                  {a.status === 'scheduled' && (
                    <button type="button" onClick={() => handleCancel(a.id)}>
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {appointments.length === 0 && (
              <tr>
                <td colSpan={6}>No appointments yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
