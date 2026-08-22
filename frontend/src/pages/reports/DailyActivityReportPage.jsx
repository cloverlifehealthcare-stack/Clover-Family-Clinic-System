import { useEffect, useState } from 'react';
import * as reportsApi from '../../api/reports';

const TODAY = new Date().toISOString().slice(0, 10);

function StatusCountTable({ title, counts }) {
  const entries = Object.entries(counts);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return (
    <section className="record-section">
      <h2>
        {title} <span className="page-description">({total} total)</span>
      </h2>
      {entries.length === 0 ? (
        <p>None recorded.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([status, count]) => (
              <tr key={status}>
                <td>
                  <span className={`status-badge status-${status}`}>{status.replace('_', ' ')}</span>
                </td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function DailyActivityReportPage() {
  const [date, setDate] = useState(TODAY);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    reportsApi
      .getDailyActivity(date)
      .then(setReport)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <div>
      <h1>Daily Activity Report</h1>
      <p className="page-description">
        Operational counts only — patients seen, appointments, and staff attendance. Revenue and profit figures
        live under Financial Management instead, which is restricted more narrowly.
      </p>

      {error && <div className="form-error">{error}</div>}

      <label className="date-filter">
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      {loading ? (
        <p>Loading…</p>
      ) : (
        report && (
          <>
            <section className="record-section">
              <h2>New Patients Registered</h2>
              <p className="summary-value">{report.newPatients}</p>
            </section>
            <StatusCountTable title="Animal Bite Visits" counts={report.animalBiteVisits} />
            <StatusCountTable title="Consultations" counts={report.consultations} />
            <StatusCountTable title="Appointments" counts={report.appointments} />
            <StatusCountTable title="Staff Attendance" counts={report.staffAttendance} />
          </>
        )
      )}
    </div>
  );
}
