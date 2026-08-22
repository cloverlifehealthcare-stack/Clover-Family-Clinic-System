import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAppointments } from '../../api/appointments';
import { useAuth } from '../../auth/AuthContext';

const TODAY = new Date().toISOString().slice(0, 10);

export function AppointmentsListPage() {
  const { hasPermission } = useAuth();
  const [date, setDate] = useState(TODAY);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listAppointments({ date }).then(setAppointments).finally(() => setLoading(false));
  }, [date]);

  return (
    <div>
      <div className="page-header">
        <h1>Appointments</h1>
        {hasPermission('appointments.manage') && (
          <Link className="btn" to="/appointments/new">
            New Appointment
          </Link>
        )}
      </div>

      <label className="date-filter">
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Service</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link to={`/appointments/${a.id}`}>{a.scheduled_time.slice(0, 5)}</Link>
                </td>
                <td>
                  {a.patient_last_name}, {a.patient_first_name}
                </td>
                <td>{a.doctor_name}</td>
                <td>{a.service_type.replace('_', ' ')}</td>
                <td>
                  <span className={`status-badge status-${a.status}`}>{a.status.replace('_', ' ')}</span>
                </td>
              </tr>
            ))}
            {appointments.length === 0 && (
              <tr>
                <td colSpan={5}>No appointments for this date.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
