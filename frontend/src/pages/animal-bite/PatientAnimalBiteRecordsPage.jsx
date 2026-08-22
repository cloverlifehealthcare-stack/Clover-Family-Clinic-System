import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listForPatient } from '../../api/animalBite';
import { getPatient } from '../../api/patients';
import { useAuth } from '../../auth/AuthContext';

export function PatientAnimalBiteRecordsPage() {
  const { patientId } = useParams();
  const { hasPermission } = useAuth();
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPatient(patientId), listForPatient(patientId)])
      .then(([p, r]) => {
        setPatient(p);
        setRecords(r);
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Animal Bite Records — {patient?.last_name}, {patient?.first_name}</h1>
        {hasPermission('animalbite.assessment.create') && (
          <Link className="btn" to={`/patients/${patientId}/animal-bite-records/new`}>
            New Record
          </Link>
        )}
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Visit Date</th>
            <th>Animal</th>
            <th>Bite Location</th>
            <th>Category</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td>
                <Link to={`/animal-bite-records/${r.id}`}>{r.visit_date}</Link>
              </td>
              <td>{r.animal_type}</td>
              <td>{r.bite_location}</td>
              <td>{r.exposure_category || '—'}</td>
              <td>
                <span className={`status-badge status-${r.status}`}>{r.status}</span>
              </td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr>
              <td colSpan={5}>No animal bite records for this patient yet.</td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="back-link">
        <Link to={`/patients/${patientId}`}>← Back to patient</Link>
      </p>
    </div>
  );
}
