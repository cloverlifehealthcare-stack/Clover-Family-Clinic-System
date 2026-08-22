import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createRecord } from '../../api/animalBite';

const TODAY = new Date().toISOString().slice(0, 10);

export function AnimalBiteCreatePage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    visitDate: TODAY,
    dateOfExposure: TODAY,
    timeOfExposure: '',
    animalType: '',
    animalOwnership: '',
    animalVaccinationStatus: '',
    biteLocation: '',
    woundDescription: '',
    previousRabiesVaccination: '',
    bp: '',
    temp: '',
    pulse: '',
    respRate: '',
    weight: '',
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const record = await createRecord({
        patientId: Number(patientId),
        visitDate: values.visitDate,
        dateOfExposure: values.dateOfExposure,
        timeOfExposure: values.timeOfExposure || undefined,
        animalType: values.animalType,
        animalOwnership: values.animalOwnership || undefined,
        animalVaccinationStatus: values.animalVaccinationStatus || undefined,
        biteLocation: values.biteLocation,
        woundDescription: values.woundDescription,
        previousRabiesVaccination: values.previousRabiesVaccination || undefined,
        vitalSigns: { bp: values.bp, temp: values.temp, pulse: values.pulse, respRate: values.respRate, weight: values.weight },
      });
      navigate(`/animal-bite-records/${record.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>New Animal Bite Record — Initial Assessment</h1>
      <form className="patient-form" onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <fieldset>
          <legend>Exposure</legend>
          <div className="form-grid">
            <label>
              Visit date<span className="required">*</span>
              <input type="date" name="visitDate" value={values.visitDate} onChange={handleChange} required />
            </label>
            <label>
              Date of exposure<span className="required">*</span>
              <input type="date" name="dateOfExposure" value={values.dateOfExposure} onChange={handleChange} required />
            </label>
            <label>
              Time of exposure
              <input type="time" name="timeOfExposure" value={values.timeOfExposure} onChange={handleChange} />
            </label>
            <label>
              Animal type<span className="required">*</span>
              <input name="animalType" value={values.animalType} onChange={handleChange} placeholder="Dog, cat, …" required />
            </label>
            <label>
              Animal ownership
              <input name="animalOwnership" value={values.animalOwnership} onChange={handleChange} placeholder="owned / stray / unknown" />
            </label>
            <label>
              Animal vaccination status
              <input name="animalVaccinationStatus" value={values.animalVaccinationStatus} onChange={handleChange} />
            </label>
            <label className="field-wide">
              Bite location<span className="required">*</span>
              <input name="biteLocation" value={values.biteLocation} onChange={handleChange} required />
            </label>
            <label className="field-wide">
              Previous rabies vaccination
              <input name="previousRabiesVaccination" value={values.previousRabiesVaccination} onChange={handleChange} />
            </label>
          </div>
          <label style={{ marginTop: '0.75rem', display: 'block' }}>
            Wound description<span className="required">*</span>
            <textarea name="woundDescription" rows={2} value={values.woundDescription} onChange={handleChange} required />
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
