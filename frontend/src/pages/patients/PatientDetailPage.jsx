import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPatient } from '../../api/patients';
import { useAuth } from '../../auth/AuthContext';

export function PatientDetailPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getPatient(id)
      .then(setPatient)
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="form-error">{error}</div>;
  if (!patient) return <p>Loading…</p>;

  // Full record (created_at is only present in FULL_COLUMNS on the backend — see
  // patients.service.js) vs. the reduced billing-relevant shape a Cashier receives.
  const isFullRecord = patient.created_at !== undefined;

  return (
    <div>
      <div className="page-header">
        <h1>
          {patient.last_name}, {patient.first_name} {patient.middle_name}
        </h1>
        {hasPermission('patients.edit') && (
          <Link className="btn" to={`/patients/${id}/edit`}>
            Edit
          </Link>
        )}
      </div>

      <dl className="detail-grid">
        <Row label="Patient code" value={patient.patient_code} />
        <Row label="Date of birth" value={patient.date_of_birth} />
        <Row label="Sex" value={patient.sex} />
        <Row label="Contact number" value={patient.contact_number} />
        {isFullRecord && (
          <>
            <Row label="Email" value={patient.email} />
            <Row label="Address" value={patient.address} />
            <Row label="Emergency contact" value={patient.emergency_contact_name} />
            <Row label="Emergency contact number" value={patient.emergency_contact_number} />
            <Row label="Relationship" value={patient.emergency_contact_relationship} />
            {patient.guardian_name && (
              <>
                <Row label="Guardian" value={patient.guardian_name} />
                <Row label="Guardian relationship" value={patient.guardian_relationship} />
                <Row label="Guardian contact" value={patient.guardian_contact_number} />
              </>
            )}
            <Row label="Medical history" value={patient.medical_history_notes} />
          </>
        )}
      </dl>

      <p className="back-link">
        <Link to="/patients">← Back to patients</Link>
      </p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </>
  );
}
