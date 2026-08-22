import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listForPatient } from '../../api/consultations';
import { getPatient } from '../../api/patients';
import { useAuth } from '../../auth/AuthContext';

export function PatientConsultationsPage() {
  const { patientId } = useParams();
  const { hasPermission } = useAuth();
  const [patient, setPatient] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPatient(patientId), listForPatient(patientId)])
      .then(([p, c]) => {
        setPatient(p);
        setConsultations(c);
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>
          Consultations — {patient?.last_name}, {patient?.first_name}
        </h1>
        {hasPermission('consultation.assessment.create') && (
          <Link className="btn" to={`/patients/${patientId}/consultations/new`}>
            New Consultation
          </Link>
        )}
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Visit Date</th>
            <th>Chief Complaint</th>
            <th>Diagnosis</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {consultations.map((c) => (
            <tr key={c.id}>
              <td>
                <Link to={`/consultations/${c.id}`}>{c.visit_date}</Link>
              </td>
              <td>{c.chief_complaint}</td>
              <td>{c.diagnosis || '—'}</td>
              <td>
                <span className={`status-badge status-${c.status}`}>{c.status}</span>
              </td>
            </tr>
          ))}
          {consultations.length === 0 && (
            <tr>
              <td colSpan={4}>No consultations for this patient yet.</td>
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
