import { useEffect, useState } from 'react';
import * as reportsApi from '../../api/reports';

const CATEGORY_ORDER = ['category_I', 'category_II', 'category_III', 'category_unclassified'];
const CATEGORY_LABELS = { category_I: 'Cat. I', category_II: 'Cat. II', category_III: 'Cat. III', category_unclassified: 'Unclassified' };

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function pct(rate) {
  return rate === null || rate === undefined ? '—' : `${Math.round(rate * 100)}%`;
}

export function TrendsReportPage() {
  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(todayDateString());
  const [groupBy, setGroupBy] = useState('month');
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    reportsApi
      .getClinicalTrends({ startDate, endDate, groupBy })
      .then(setTrends)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [startDate, endDate, groupBy]);

  const categoryColumns = trends
    ? CATEGORY_ORDER.filter((key) => trends.animalBiteByCategory.some((row) => row[key] !== undefined))
    : [];

  return (
    <div>
      <h1>Clinical &amp; Operational Trends</h1>
      <p className="page-description">
        Operational counts only, grouped over a date range instead of a single day — no revenue or profit figures.
        See Financial Management for those.
      </p>

      {error && <div className="form-error">{error}</div>}

      <div className="filter-row">
        <label>
          From
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <label>
          Group by
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        trends && (
          <>
            <section className="record-section">
              <h2>Animal Bite Visits by Exposure Category</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Period</th>
                    {categoryColumns.map((key) => (
                      <th key={key}>{CATEGORY_LABELS[key]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trends.animalBiteByCategory.map((row) => (
                    <tr key={row.period}>
                      <td>{row.period}</td>
                      {categoryColumns.map((key) => (
                        <td key={key}>{row[key] || 0}</td>
                      ))}
                    </tr>
                  ))}
                  {trends.animalBiteByCategory.length === 0 && (
                    <tr>
                      <td colSpan={categoryColumns.length + 1}>No animal bite visits in this range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="record-section">
              <h2>Consultation Volume</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Consultations</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.consultationVolume.map((row) => (
                    <tr key={row.period}>
                      <td>{row.period}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                  {trends.consultationVolume.length === 0 && (
                    <tr>
                      <td colSpan={2}>No consultations in this range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="record-section">
              <h2>Follow-up Completion</h2>
              <p className="page-description">
                Completion rate excludes follow-ups still marked &ldquo;upcoming&rdquo; — those haven&rsquo;t happened yet.
              </p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Completed</th>
                    <th>Missed</th>
                    <th>Cancelled</th>
                    <th>Upcoming</th>
                    <th>Completion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.followUpCompletion.map((row) => (
                    <tr key={row.period}>
                      <td>{row.period}</td>
                      <td>{row.completed}</td>
                      <td>{row.missed}</td>
                      <td>{row.cancelled}</td>
                      <td>{row.upcoming}</td>
                      <td>{pct(row.completionRate)}</td>
                    </tr>
                  ))}
                  {trends.followUpCompletion.length === 0 && (
                    <tr>
                      <td colSpan={6}>No follow-ups in this range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="record-section">
              <h2>Appointment Outcomes</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Scheduled</th>
                    <th>Checked In</th>
                    <th>Completed</th>
                    <th>Cancelled</th>
                    <th>No-show</th>
                    <th>No-show Rate</th>
                    <th>Cancellation Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.appointmentOutcomes.map((row) => (
                    <tr key={row.period}>
                      <td>{row.period}</td>
                      <td>{row.scheduled}</td>
                      <td>{row.checkedIn}</td>
                      <td>{row.completed}</td>
                      <td>{row.cancelled}</td>
                      <td>{row.noShow}</td>
                      <td>{pct(row.noShowRate)}</td>
                      <td>{pct(row.cancellationRate)}</td>
                    </tr>
                  ))}
                  {trends.appointmentOutcomes.length === 0 && (
                    <tr>
                      <td colSpan={8}>No appointments in this range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </>
        )
      )}
    </div>
  );
}
