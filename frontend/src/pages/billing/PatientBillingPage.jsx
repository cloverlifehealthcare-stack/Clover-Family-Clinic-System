import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listForPatient } from '../../api/billing';
import { getPatient } from '../../api/patients';
import { useAuth } from '../../auth/AuthContext';

export function PatientBillingPage() {
  const { patientId } = useParams();
  const { hasPermission } = useAuth();
  const [patient, setPatient] = useState(null);
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPatient(patientId), listForPatient(patientId)])
      .then(([p, s]) => {
        setPatient(p);
        setStatements(s);
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>
          Billing — {patient?.last_name}, {patient?.first_name}
        </h1>
        {hasPermission('billing.create') && (
          <Link className="btn" to={`/patients/${patientId}/billing-statements/new`}>
            New Statement
          </Link>
        )}
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Total</th>
            <th>Discount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {statements.map((s) => (
            <tr key={s.id}>
              <td>
                <Link to={`/billing/statements/${s.id}`}>{s.created_at.slice(0, 10)}</Link>
              </td>
              <td>₱{s.total_amount}</td>
              <td>{s.discount_type !== 'none' ? s.discount_type.toUpperCase() : '—'}</td>
              <td>
                <span className={`status-badge status-${s.status}`}>{s.status.replace('_', ' ')}</span>
              </td>
            </tr>
          ))}
          {statements.length === 0 && (
            <tr>
              <td colSpan={4}>No billing statements for this patient yet.</td>
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
