import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPatient, updatePatient } from '../../api/patients';
import { PatientForm, patientToFormValues } from './PatientForm';

export function PatientEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getPatient(id)
      .then(setPatient)
      .catch((err) => setError(err.message));
  }, [id]);

  async function handleSubmit(values) {
    setError(null);
    try {
      await updatePatient(id, values);
      navigate(`/patients/${id}`);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  if (error && !patient) return <div className="form-error">{error}</div>;
  if (!patient) return <p>Loading…</p>;

  return (
    <div>
      <h1>
        Edit {patient.last_name}, {patient.first_name}
      </h1>
      <PatientForm initialValues={patientToFormValues(patient)} submitLabel="Save Changes" error={error} onSubmit={handleSubmit} />
    </div>
  );
}
