import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as consultationsApi from '../../api/consultations';
import { useAuth } from '../../auth/AuthContext';

export function ConsultationDetailPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const [consultation, setConsultation] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    consultationsApi.getConsultation(id).then(setConsultation).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="form-error">{error}</div>;
  if (!consultation) return <p>Loading…</p>;

  const canDiagnose = hasPermission('consultation.diagnosis.record');
  const canPrescribe = hasPermission('prescription.issue');
  const canEducate = hasPermission('education.record');

  return (
    <div>
      <div className="page-header">
        <h1>Consultation — {consultation.chief_complaint}</h1>
        <span className={`status-badge status-${consultation.status}`}>{consultation.status}</span>
      </div>

      <dl className="detail-grid">
        <dt>Visit date</dt>
        <dd>{consultation.visit_date}</dd>
        <dt>Vital signs</dt>
        <dd>
          BP {consultation.vital_signs?.bp || '—'} · Temp {consultation.vital_signs?.temp || '—'} · Pulse{' '}
          {consultation.vital_signs?.pulse || '—'} · Resp {consultation.vital_signs?.respRate || '—'} · Weight{' '}
          {consultation.vital_signs?.weight || '—'}
        </dd>
      </dl>

      <DiagnosisSection consultation={consultation} setConsultation={setConsultation} canDiagnose={canDiagnose} />
      <PrescriptionsSection consultation={consultation} setConsultation={setConsultation} canPrescribe={canPrescribe} />
      <EducationSection consultation={consultation} setConsultation={setConsultation} canEducate={canEducate} />
      <FollowUpsSection consultation={consultation} setConsultation={setConsultation} canManage={canEducate} />

      {consultation.status !== 'completed' && canDiagnose && (
        <button type="button" onClick={async () => setConsultation(await consultationsApi.completeConsultation(id))}>
          Mark Consultation Complete
        </button>
      )}

      <p className="back-link">
        <Link to={`/patients/${consultation.patient_id}/consultations`}>← Back to consultations</Link>
      </p>
    </div>
  );
}

function DiagnosisSection({ consultation, setConsultation, canDiagnose }) {
  const [editing, setEditing] = useState(!consultation.diagnosis);
  const [form, setForm] = useState({
    diagnosis: consultation.diagnosis || '',
    treatmentNotes: consultation.treatment_notes || '',
    remarks: consultation.remarks || '',
    followUpDate: consultation.follow_up_date || '',
  });
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      const updated = await consultationsApi.recordDiagnosis(consultation.id, form);
      setConsultation(updated);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="record-section">
      <h2>Diagnosis</h2>
      {error && <div className="form-error">{error}</div>}
      {!editing ? (
        <>
          <dl className="detail-grid">
            <dt>Diagnosis</dt>
            <dd>{consultation.diagnosis}</dd>
            <dt>Treatment notes</dt>
            <dd>{consultation.treatment_notes || '—'}</dd>
            <dt>Remarks / referral</dt>
            <dd>{consultation.remarks || '—'}</dd>
          </dl>
          {canDiagnose && (
            <button type="button" onClick={() => setEditing(true)}>
              Revise Diagnosis
            </button>
          )}
        </>
      ) : canDiagnose ? (
        <form onSubmit={submit} className="inline-form">
          <label className="field-wide">
            Diagnosis
            <input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} required />
          </label>
          <label className="field-wide">
            Treatment notes
            <input value={form.treatmentNotes} onChange={(e) => setForm({ ...form, treatmentNotes: e.target.value })} />
          </label>
          <label className="field-wide">
            Remarks / referral
            <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </label>
          <label>
            Follow-up date
            <input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} />
          </label>
          <button type="submit">Save Diagnosis</button>
        </form>
      ) : (
        <p>No diagnosis recorded yet.</p>
      )}
    </section>
  );
}

const EMPTY_ITEM = { medicineName: '', dosage: '', instructions: '', quantity: '' };

function PrescriptionsSection({ consultation, setConsultation, canPrescribe }) {
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [error, setError] = useState(null);

  function updateItem(idx, field, value) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      const updated = await consultationsApi.issuePrescription(consultation.id, { items });
      setConsultation(updated);
      setItems([{ ...EMPTY_ITEM }]);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="record-section">
      <h2>Prescriptions</h2>
      {consultation.prescriptions.map((rx) => (
        <div key={rx.id} className="prescription-card">
          <strong>Issued {rx.date_issued}</strong>
          <ul className="plain-list">
            {rx.items.map((item) => (
              <li key={item.id}>
                {item.medicine_name} — {item.dosage} {item.quantity ? `(${item.quantity})` : ''} {item.instructions ? `· ${item.instructions}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {consultation.prescriptions.length === 0 && <p>No prescriptions issued yet.</p>}

      {canPrescribe && consultation.diagnosis && (
        <form onSubmit={submit} className="inline-form">
          {error && <div className="form-error">{error}</div>}
          <div className="field-wide">
            {items.map((item, idx) => (
              <div key={idx} className="rx-item-row">
                <input placeholder="Medicine" value={item.medicineName} onChange={(e) => updateItem(idx, 'medicineName', e.target.value)} required />
                <input placeholder="Dosage" value={item.dosage} onChange={(e) => updateItem(idx, 'dosage', e.target.value)} required />
                <input placeholder="Instructions" value={item.instructions} onChange={(e) => updateItem(idx, 'instructions', e.target.value)} />
                <input placeholder="Quantity" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
              </div>
            ))}
            <button type="button" onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}>
              + Add another medicine
            </button>
          </div>
          <button type="submit">Issue Prescription</button>
        </form>
      )}
      {canPrescribe && !consultation.diagnosis && <p>Record a diagnosis before issuing a prescription.</p>}
    </section>
  );
}

function EducationSection({ consultation, setConsultation, canEducate }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      setConsultation(await consultationsApi.addEducation(consultation.id, { instructionsGiven: text }));
      setText('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="record-section">
      <h2>Patient Education</h2>
      <ul className="plain-list">
        {consultation.educationLogs.map((log) => (
          <li key={log.id}>
            {log.given_at.slice(0, 10)} — {log.instructions_given}
          </li>
        ))}
        {consultation.educationLogs.length === 0 && <li>No education logged yet.</li>}
      </ul>
      {canEducate && (
        <form onSubmit={submit} className="inline-form">
          {error && <div className="form-error">{error}</div>}
          <input className="field-wide" placeholder="Instructions given…" value={text} onChange={(e) => setText(e.target.value)} required />
          <button type="submit">Log Education</button>
        </form>
      )}
    </section>
  );
}

function FollowUpsSection({ consultation, setConsultation, canManage }) {
  const [form, setForm] = useState({ scheduledDate: '', purpose: '' });
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      setConsultation(await consultationsApi.addFollowUp(consultation.id, form));
      setForm({ scheduledDate: '', purpose: '' });
    } catch (err) {
      setError(err.message);
    }
  }

  async function setStatus(followUpId, status) {
    setConsultation(await consultationsApi.updateFollowUpStatus(consultation.id, followUpId, { status }));
  }

  return (
    <section className="record-section">
      <h2>Follow-Ups</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Purpose</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {consultation.followUps.map((f) => (
            <tr key={f.id}>
              <td>{f.scheduled_date}</td>
              <td>{f.purpose}</td>
              <td>{f.status}</td>
              <td>
                {f.status === 'upcoming' && canManage && (
                  <>
                    <button type="button" onClick={() => setStatus(f.id, 'completed')}>
                      Complete
                    </button>{' '}
                    <button type="button" onClick={() => setStatus(f.id, 'missed')}>
                      Missed
                    </button>{' '}
                    <button type="button" onClick={() => setStatus(f.id, 'cancelled')}>
                      Cancel
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {consultation.followUps.length === 0 && (
            <tr>
              <td colSpan={4}>No follow-ups scheduled.</td>
            </tr>
          )}
        </tbody>
      </table>

      {canManage && (
        <form onSubmit={submit} className="inline-form">
          {error && <div className="form-error">{error}</div>}
          <label>
            Date
            <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} required />
          </label>
          <label>
            Purpose
            <input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} required />
          </label>
          <button type="submit">Schedule Follow-Up</button>
        </form>
      )}
    </section>
  );
}
