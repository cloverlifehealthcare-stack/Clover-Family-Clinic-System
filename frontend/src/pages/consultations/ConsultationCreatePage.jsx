import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createConsultation } from '../../api/consultations';

const TODAY = new Date().toISOString().slice(0, 10);

export function ConsultationCreatePage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    visitDate: TODAY,
    chiefComplaint: '',
    assessmentNotes: '',
    bp: '',
    temp: '',
    pulse: '',
    respRate: '',
    weight: '',
  });

  function handleChange(e) {
    setValues((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const consultation = await createConsultation({
        patientId: Number(patientId),
        visitDate: values.visitDate,
        chiefComplaint: values.chiefComplaint,
        assessmentNotes: values.assessmentNotes || undefined,
        vitalSigns: { bp: values.bp, temp: values.temp, pulse: values.pulse, respRate: values.respRate, weight: values.weight },
      });
      navigate(`/consultations/${consultation.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>New Consultation — Initial Assessment</h1>
      <form className="patient-form" onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <fieldset>
          <legend>Visit</legend>
          <div className="form-grid">
            <label>
              Visit date<span className="required">*</span>
              <input type="date" name="visitDate" value={values.visitDate} onChange={handleChange} required />
            </label>
            <label className="field-wide">
              Chief complaint<span className="required">*</span>
              <input name="chiefComplaint" value={values.chiefComplaint} onChange={handleChange} required />
            </label>
          </div>
          <label style={{ marginTop: '0.75rem', display: 'block' }}>
            Assessment notes
            <textarea name="assessmentNotes" rows={2} value={values.assessmentNotes} onChange={handleChange} />
          </label>
        </fieldset>

        <fieldset>
          <legend>Vital signs</legend>
          <div className="form-grid">
            <label>
              BP
              <input name="bp" value={values.bp} onChange={handleChange} placeholder="120/80" />
            </label>
            <label>
              Temp
              <input name="temp" value={values.temp} onChange={handleChange} placeholder="36.7" />
            </label>
            <label>
              Pulse
              <input name="pulse" value={values.pulse} onChange={handleChange} />
            </label>
            <label>
              Resp. rate
              <input name="respRate" value={values.respRate} onChange={handleChange} />
            </label>
            <label>
              Weight
              <input name="weight" value={values.weight} onChange={handleChange} />
            </label>
          </div>
        </fieldset>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save Initial Assessment'}
        </button>
      </form>
    </div>
  );
}
