import { useEffect, useState } from 'react';
import { listPatients } from '../api/patients';

/** Inline "type to search, click to select" patient field for forms (e.g. booking an
 * appointment) that need a patientId without leaving the page, unlike PatientPicker's
 * full-page landing. */
export function PatientSearchSelect({ selected, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!query || selected) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    listPatients(query).then((data) => {
      if (!cancelled) setResults(data);
    });
    return () => {
      cancelled = true;
    };
  }, [query, selected]);

  if (selected) {
    return (
      <div className="patient-chip">
        {selected.last_name}, {selected.first_name} ({selected.patient_code})
        <button type="button" onClick={() => onSelect(null)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="patient-search-select">
      <input
        type="search"
        placeholder="Search for a patient…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((p) => (
            <li key={p.id} onClick={() => onSelect(p)}>
              {p.last_name}, {p.first_name} ({p.patient_code})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
