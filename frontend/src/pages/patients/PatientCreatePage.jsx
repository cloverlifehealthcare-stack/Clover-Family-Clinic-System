import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPatient } from '../../api/patients';
import { PatientForm } from './PatientForm';

export function PatientCreatePage() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [duplicates, setDuplicates] = useState(null); // set on a 409, cleared once resolved
  const [pendingValues, setPendingValues] = useState(null);

  async function submit(values, confirmDuplicate = false) {
    setError(null);
    const { status, data } = await createPatient({ ...values, confirmDuplicate });

    if (status === 201) {
      navigate(`/patients/${data.id}`);
      return;
    }
    if (status === 409) {
      setDuplicates(data.possibleDuplicates);
      setPendingValues(values);
      return;
    }
    setError(data?.error || 'Could not create patient.');
    throw new Error(data?.error || 'Could not create patient.'); // lets PatientForm stop its spinner
  }

  if (duplicates) {
    return (
      <div>
        <h1>Possible duplicate patient</h1>
        <p>A patient with the same first name, last name, and date of birth already exists:</p>
        <ul>
          {duplicates.map((d) => (
            <li key={d.id}>
              {d.patient_code} — {d.last_name}, {d.first_name} {d.middle_name} (DOB {d.date_of_birth})
            </li>
          ))}
        </ul>
        <p>Is this the same person, or a different person who happens to share the same details?</p>
        <div className="button-row">
          <button type="button" onClick={() => setDuplicates(null)}>
            Same person — cancel, go back
          </button>
          <button type="button" onClick={() => submit(pendingValues, true)}>
            Different person — create anyway
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>New Patient</h1>
      <PatientForm submitLabel="Register Patient" error={error} onSubmit={(values) => submit(values, false)} />
    </div>
  );
}
