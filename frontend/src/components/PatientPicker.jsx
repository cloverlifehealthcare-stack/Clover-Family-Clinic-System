import { useEffect, useState } from 'react';
import { listPatients } from '../api/patients';

/**
 * Shared "search for a patient first" landing used by modules that are always entered via a
 * specific patient (Animal Bite Center, Consultations) — neither has a standalone global list
 * endpoint on the backend, by design (docs/clover-architecture.md §4.2: these records only
 * make sense in the context of a patient).
 */
export function PatientPicker({ title, description, onPick }) {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listPatients(search)
      .then((data) => {
        if (!cancelled) setPatients(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search]);

  return (
    <div>
      <h1>{title}</h1>
      <p className="page-description">{description}</p>
      <input
        className="search-box"
        type="search"
        placeholder="Search for a patient by name or code…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Patient Code</th>
              <th>Name</th>
              <th>Date of Birth</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.id} className="clickable-row" onClick={() => onPick(p)}>
                <td>{p.patient_code}</td>
                <td>
                  {p.last_name}, {p.first_name} {p.middle_name}
                </td>
                <td>{p.date_of_birth}</td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td colSpan={3}>No patients found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
