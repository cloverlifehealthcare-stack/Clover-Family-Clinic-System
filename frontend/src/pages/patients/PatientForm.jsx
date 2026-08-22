import { useState } from 'react';
import { isMinor } from '../../utils/age';

const EMPTY_FORM = {
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  sex: '',
  address: '',
  contactNumber: '',
  email: '',
  emergencyContactName: '',
  emergencyContactNumber: '',
  emergencyContactRelationship: '',
  medicalHistoryNotes: '',
  guardianName: '',
  guardianRelationship: '',
  guardianContactNumber: '',
};

/** Maps the API's snake_case patient record back into this form's camelCase field names. */
export function patientToFormValues(patient) {
  if (!patient) return EMPTY_FORM;
  return {
    firstName: patient.first_name || '',
    middleName: patient.middle_name || '',
    lastName: patient.last_name || '',
    dateOfBirth: patient.date_of_birth || '',
    sex: patient.sex || '',
    address: patient.address || '',
    contactNumber: patient.contact_number || '',
    email: patient.email || '',
    emergencyContactName: patient.emergency_contact_name || '',
    emergencyContactNumber: patient.emergency_contact_number || '',
    emergencyContactRelationship: patient.emergency_contact_relationship || '',
    medicalHistoryNotes: patient.medical_history_notes || '',
    guardianName: patient.guardian_name || '',
    guardianRelationship: patient.guardian_relationship || '',
    guardianContactNumber: patient.guardian_contact_number || '',
  };
}

export function PatientForm({ initialValues, onSubmit, submitLabel, error }) {
  const [values, setValues] = useState({ ...EMPTY_FORM, ...initialValues });
  const [submitting, setSubmitting] = useState(false);
  const minor = isMinor(values.dateOfBirth);

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="patient-form" onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}

      <fieldset>
        <legend>Demographics</legend>
        <div className="form-grid">
          <Field label="First name" name="firstName" value={values.firstName} onChange={handleChange} required />
          <Field label="Middle name" name="middleName" value={values.middleName} onChange={handleChange} />
          <Field label="Last name" name="lastName" value={values.lastName} onChange={handleChange} required />
          <Field label="Date of birth" name="dateOfBirth" type="date" value={values.dateOfBirth} onChange={handleChange} required />
          <Field label="Sex" name="sex" value={values.sex} onChange={handleChange} />
          <Field label="Contact number" name="contactNumber" value={values.contactNumber} onChange={handleChange} />
          <Field label="Email" name="email" type="email" value={values.email} onChange={handleChange} />
          <Field label="Address" name="address" value={values.address} onChange={handleChange} wide />
        </div>
      </fieldset>

      <fieldset>
        <legend>Emergency contact</legend>
        <div className="form-grid">
          <Field label="Name" name="emergencyContactName" value={values.emergencyContactName} onChange={handleChange} />
          <Field label="Number" name="emergencyContactNumber" value={values.emergencyContactNumber} onChange={handleChange} />
          <Field label="Relationship" name="emergencyContactRelationship" value={values.emergencyContactRelationship} onChange={handleChange} />
        </div>
      </fieldset>

      {minor && (
        <fieldset>
          <legend>Guardian (required — patient is a minor)</legend>
          <div className="form-grid">
            <Field label="Guardian name" name="guardianName" value={values.guardianName} onChange={handleChange} required />
            <Field label="Relationship" name="guardianRelationship" value={values.guardianRelationship} onChange={handleChange} required />
            <Field label="Contact number" name="guardianContactNumber" value={values.guardianContactNumber} onChange={handleChange} required />
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend>Medical history</legend>
        <textarea
          name="medicalHistoryNotes"
          rows={3}
          value={values.medicalHistoryNotes}
          onChange={handleChange}
          placeholder="Known conditions, allergies, ongoing medications…"
        />
      </fieldset>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}

function Field({ label, name, value, onChange, type = 'text', required, wide }) {
  return (
    <label className={wide ? 'field-wide' : ''}>
      {label}
      {required && <span className="required">*</span>}
      <input type={type} name={name} value={value} onChange={onChange} required={required} />
    </label>
  );
}
