import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPatients } from '../../api/patients';
import { useAuth } from '../../auth/AuthContext';

export function PatientsListPage() {
  const { hasPermission } = useAuth();
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listPatients(search)
      .then((data) => {
        if (!cancelled) setPatients(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search]);

  return (
    <div>
      <div className="page-header">
        <h1>Patients</h1>
        {hasPermission('patients.create') && (
          <Link className="btn" to="/patients/new">
            New Patient
          </Link>
        )}
      </div>

      <input
        className="search-box"
        type="search"
        placeholder="Search by name or patient code…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <div className="form-error">{error}</div>}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Patient Code</th>
              <th>Name</th>
              <th>Date of Birth</th>
              <th>Sex</th>
              <th>Contact</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/patients/${p.id}`}>{p.patient_code}</Link>
                </td>
                <td>
                  {p.last_name}, {p.first_name} {p.middle_name}
                </td>
                <td>{p.date_of_birth}</td>
                <td>{p.sex}</td>
                <td>{p.contact_number}</td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td colSpan={5}>No patients found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
