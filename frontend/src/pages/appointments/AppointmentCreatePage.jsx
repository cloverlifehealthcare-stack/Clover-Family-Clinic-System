import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAppointment, listDoctors } from '../../api/appointments';
import { PatientSearchSelect } from '../../components/PatientSearchSelect';

const TODAY = new Date().toISOString().slice(0, 10);
const SERVICE_TYPES = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'animal_bite', label: 'Animal Bite' },
  { value: 'follow_up_vaccine', label: 'Follow-up / Vaccine' },
];

// 15-minute slots, 08:00–17:00 — matches the fixed slot length confirmed in docs §0.
const TIME_SLOTS = Array.from({ length: 36 }, (_, i) => {
  const totalMinutes = 8 * 60 + i * 15;
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const m = String(totalMinutes % 60).padStart(2, '0');
  return `${h}:${m}`;
});

export function AppointmentCreatePage() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    doctorId: '',
    serviceType: 'consultation',
    scheduledDate: TODAY,
    scheduledTime: TIME_SLOTS[0],
    notes: '',
  });

  useEffect(() => {
    listDoctors().then(setDoctors);
  }, []);

  function handleChange(e) {
    setValues((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!patient) {
      setError('Select a patient first.');
      return;
    }
    setSubmitting(true);
    try {
      const appointment = await createAppointment({
        patientId: patient.id,
        doctorId: Number(values.doctorId),
        serviceType: values.serviceType,
        scheduledDate: values.scheduledDate,
        scheduledTime: values.scheduledTime,
        notes: values.notes || undefined,
      });
      navigate(`/appointments/${appointment.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>New Appointment</h1>
      <form className="patient-form" onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <fieldset>
          <legend>Patient</legend>
          <PatientSearchSelect selected={patient} onSelect={setPatient} />
        </fieldset>

        <fieldset>
          <legend>Appointment details</legend>
          <div className="form-grid">
            <label>
              Doctor<span className="required">*</span>
              <select name="doctorId" value={values.doctorId} onChange={handleChange} required>
                <option value="">Select a doctor…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Service type<span className="required">*</span>
              <select name="serviceType" value={values.serviceType} onChange={handleChange}>
                {SERVICE_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date<span className="required">*</span>
              <input type="date" name="scheduledDate" value={values.scheduledDate} onChange={handleChange} required />
            </label>
            <label>
              Time (15-min slots)<span className="required">*</span>
              <select name="scheduledTime" value={values.scheduledTime} onChange={handleChange}>
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-wide">
              Notes
              <input name="notes" value={values.notes} onChange={handleChange} />
            </label>
          </div>
        </fieldset>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Booking…' : 'Book Appointment'}
        </button>
      </form>
    </div>
  );
}
