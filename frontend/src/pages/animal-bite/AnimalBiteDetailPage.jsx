import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as animalBiteApi from '../../api/animalBite';
import { useAuth } from '../../auth/AuthContext';

const CATEGORIES = ['I', 'II', 'III'];

export function AnimalBiteDetailPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    animalBiteApi.getRecord(id).then(setRecord).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="form-error">{error}</div>;
  if (!record) return <p>Loading…</p>;

  const canDiagnose = hasPermission('animalbite.diagnosis.record');
  const canTreat = hasPermission('animalbite.treatment.administer');
  const canEducate = hasPermission('education.record');

  return (
    <div>
      <div className="page-header">
        <h1>
          Animal Bite Record — {record.animal_type}, {record.bite_location}
        </h1>
        <span className={`status-badge status-${record.status}`}>{record.status}</span>
      </div>

      <dl className="detail-grid">
        <dt>Visit date</dt>
        <dd>{record.visit_date}</dd>
        <dt>Date of exposure</dt>
        <dd>{record.date_of_exposure}</dd>
        <dt>Wound</dt>
        <dd>{record.wound_description}</dd>
        <dt>Vital signs</dt>
        <dd>
          BP {record.vital_signs?.bp || '—'} · Temp {record.vital_signs?.temp || '—'} · Pulse {record.vital_signs?.pulse || '—'} ·
          Resp {record.vital_signs?.respRate || '—'} · Weight {record.vital_signs?.weight || '—'}
        </dd>
      </dl>

      <DiagnosisSection record={record} setRecord={setRecord} canDiagnose={canDiagnose} />

      {record.exposure_category && record.exposure_category !== 'I' && (
        <DosesSection record={record} setRecord={setRecord} canTreat={canTreat} />
      )}
      {record.exposure_category === 'III' && <RigSection record={record} setRecord={setRecord} canTreat={canTreat} />}

      <EducationSection record={record} setRecord={setRecord} canEducate={canEducate} />
      <FollowUpsSection record={record} setRecord={setRecord} canManage={canTreat} />

      {record.status !== 'completed' && canDiagnose && (
        <button
          type="button"
          onClick={async () => setRecord(await animalBiteApi.completeRecord(id))}
        >
          Mark Record Complete
        </button>
      )}

      <p className="back-link">
        <Link to={`/patients/${record.patient_id}/animal-bite-records`}>← Back to records</Link>
      </p>
    </div>
  );
}

function DiagnosisSection({ record, setRecord, canDiagnose }) {
  const [editing, setEditing] = useState(!record.exposure_category);
  const [form, setForm] = useState({
    exposureCategory: record.exposure_category || '',
    treatmentDecision: record.treatment_decision || '',
    doctorNotes: record.doctor_notes || '',
  });
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      const updated = await animalBiteApi.recordDiagnosis(record.id, form);
      setRecord(updated);
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
            <dt>Exposure category</dt>
            <dd>WHO Category {record.exposure_category}</dd>
            <dt>Treatment decision</dt>
            <dd>{record.treatment_decision || '—'}</dd>
          </dl>
          {canDiagnose && (
            <button type="button" onClick={() => setEditing(true)}>
              Revise Diagnosis
            </button>
          )}
        </>
      ) : canDiagnose ? (
        <form onSubmit={submit} className="inline-form">
          <label>
            Exposure category
            <select value={form.exposureCategory} onChange={(e) => setForm({ ...form, exposureCategory: e.target.value })} required>
              <option value="">Select…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  Category {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Treatment decision
            <input value={form.treatmentDecision} onChange={(e) => setForm({ ...form, treatmentDecision: e.target.value })} />
          </label>
          <label className="field-wide">
            Doctor notes
            <input value={form.doctorNotes} onChange={(e) => setForm({ ...form, doctorNotes: e.target.value })} />
          </label>
          <button type="submit">Save Diagnosis</button>
        </form>
      ) : (
        <p>No diagnosis recorded yet.</p>
      )}
    </section>
  );
}

function DosesSection({ record, setRecord, canTreat }) {
  const [form, setForm] = useState({ doseNumber: '', vaccineName: '', anatomicalSite: '', scheduledDate: '', administerNow: true });
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      const updated = await animalBiteApi.addDose(record.id, {
        ...form,
        doseNumber: Number(form.doseNumber),
        scheduledDate: form.administerNow ? undefined : form.scheduledDate,
      });
      setRecord(updated);
      setForm({ doseNumber: '', vaccineName: '', anatomicalSite: '', scheduledDate: '', administerNow: true });
    } catch (err) {
      setError(err.message);
    }
  }

  async function administer(doseId) {
    setRecord(await animalBiteApi.administerDose(record.id, doseId, {}));
  }

  return (
    <section className="record-section">
      <h2>Vaccine Doses</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Dose</th>
            <th>Vaccine</th>
            <th>Site</th>
            <th>Status</th>
            <th>Date</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {record.doses.map((d) => (
            <tr key={d.id}>
              <td>{d.dose_number}</td>
              <td>{d.vaccine_name}</td>
              <td>{d.anatomical_site || '—'}</td>
              <td>{d.status}</td>
              <td>{d.administered_at ? d.administered_at.slice(0, 10) : d.scheduled_date || '—'}</td>
              <td>
                {d.status === 'scheduled' && canTreat && (
                  <button type="button" onClick={() => administer(d.id)}>
                    Administer
                  </button>
                )}
              </td>
            </tr>
          ))}
          {record.doses.length === 0 && (
            <tr>
              <td colSpan={6}>No doses recorded yet.</td>
            </tr>
          )}
        </tbody>
      </table>

      {canTreat && (
        <form onSubmit={submit} className="inline-form">
          {error && <div className="form-error">{error}</div>}
          <label>
            Dose #<input type="number" min="0" value={form.doseNumber} onChange={(e) => setForm({ ...form, doseNumber: e.target.value })} required />
          </label>
          <label>
            Vaccine
            <input value={form.vaccineName} onChange={(e) => setForm({ ...form, vaccineName: e.target.value })} required />
          </label>
          <label>
            Site
            <input value={form.anatomicalSite} onChange={(e) => setForm({ ...form, anatomicalSite: e.target.value })} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={form.administerNow} onChange={(e) => setForm({ ...form, administerNow: e.target.checked })} />
            Administer now
          </label>
          {!form.administerNow && (
            <label>
              Scheduled date
              <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} required />
            </label>
          )}
          <button type="submit">Add Dose</button>
        </form>
      )}
    </section>
  );
}

function RigSection({ record, setRecord, canTreat }) {
  const [form, setForm] = useState({ rigProductName: '', patientWeightKg: '', calculatedDose: '', siteInfiltratedAmount: '', imInjectedAmount: '' });
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      setRecord(await animalBiteApi.addRig(record.id, { ...form, patientWeightKg: Number(form.patientWeightKg) }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="record-section">
      <h2>Rabies Immunoglobulin (RIG)</h2>
      {record.rig ? (
        <dl className="detail-grid">
          <dt>Product</dt>
          <dd>{record.rig.rig_product_name}</dd>
          <dt>Weight</dt>
          <dd>{record.rig.patient_weight_kg} kg</dd>
          <dt>Dose</dt>
          <dd>{record.rig.calculated_dose}</dd>
        </dl>
      ) : canTreat ? (
        <form onSubmit={submit} className="inline-form">
          {error && <div className="form-error">{error}</div>}
          <label>
            Product
            <input value={form.rigProductName} onChange={(e) => setForm({ ...form, rigProductName: e.target.value })} required />
          </label>
          <label>
            Weight (kg)
            <input type="number" step="0.1" value={form.patientWeightKg} onChange={(e) => setForm({ ...form, patientWeightKg: e.target.value })} required />
          </label>
          <label>
            Calculated dose
            <input value={form.calculatedDose} onChange={(e) => setForm({ ...form, calculatedDose: e.target.value })} required />
          </label>
          <label>
            Site infiltrated
            <input value={form.siteInfiltratedAmount} onChange={(e) => setForm({ ...form, siteInfiltratedAmount: e.target.value })} />
          </label>
          <label>
            IM injected
            <input value={form.imInjectedAmount} onChange={(e) => setForm({ ...form, imInjectedAmount: e.target.value })} />
          </label>
          <button type="submit">Record RIG Administration</button>
        </form>
      ) : (
        <p>Not yet administered.</p>
      )}
    </section>
  );
}

function EducationSection({ record, setRecord, canEducate }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      setRecord(await animalBiteApi.addEducation(record.id, { instructionsGiven: text }));
      setText('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="record-section">
      <h2>Patient Education</h2>
      <ul className="plain-list">
        {record.educationLogs.map((log) => (
          <li key={log.id}>
            {log.given_at.slice(0, 10)} — {log.instructions_given}
          </li>
        ))}
        {record.educationLogs.length === 0 && <li>No education logged yet.</li>}
      </ul>
      {canEducate && (
        <form onSubmit={submit} className="inline-form">
          {error && <div className="form-error">{error}</div>}
          <input
            className="field-wide"
            placeholder="Instructions given…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
          <button type="submit">Log Education</button>
        </form>
      )}
    </section>
  );
}

function FollowUpsSection({ record, setRecord, canManage }) {
  const [form, setForm] = useState({ scheduledDate: '', purpose: '', doseNumber: '' });
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      setRecord(
        await animalBiteApi.addFollowUp(record.id, {
          scheduledDate: form.scheduledDate,
          purpose: form.purpose,
          doseNumber: form.doseNumber ? Number(form.doseNumber) : undefined,
        })
      );
      setForm({ scheduledDate: '', purpose: '', doseNumber: '' });
    } catch (err) {
      setError(err.message);
    }
  }

  async function setStatus(followUpId, status) {
    setRecord(await animalBiteApi.updateFollowUpStatus(record.id, followUpId, { status }));
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
          {record.followUps.map((f) => (
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
          {record.followUps.length === 0 && (
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
          <label>
            Dose # (optional)
            <input type="number" min="0" value={form.doseNumber} onChange={(e) => setForm({ ...form, doseNumber: e.target.value })} />
          </label>
          <button type="submit">Schedule Follow-Up</button>
        </form>
      )}
    </section>
  );
}
