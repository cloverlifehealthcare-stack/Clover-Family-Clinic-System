import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import * as dashboardApi from '../api/dashboard';

// Daily Activity's counts are grouped by status (e.g. { open: 3, closed: 1 }) — a dashboard
// tile just needs the total for the day, the breakdown lives on the full Daily Activity page.
function sumCounts(byStatus) {
  return byStatus ? Object.values(byStatus).reduce((sum, n) => sum + n, 0) : 0;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    dashboardApi.getDashboard().then(setData).catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1>Welcome, {user?.full_name}</h1>
      <p className="page-description">
        Signed in as <strong>{user?.role}</strong>. Today's snapshot, {data ? new Date(data.date).toLocaleDateString() : '…'}.
      </p>

      {error && <div className="form-error">{error}</div>}
      {!data && !error && <p>Loading…</p>}

      {data && (
        <>
          <div className="summary-cards">
            {data.dailyActivity && (
              <>
                <StatCard label="New Patients Today" value={data.dailyActivity.newPatients} />
                <StatCard label="Animal Bite Visits" value={sumCounts(data.dailyActivity.animalBiteVisits)} />
                <StatCard label="Consultations" value={sumCounts(data.dailyActivity.consultations)} />
              </>
            )}
            {data.appointmentsToday && <StatCard label="Appointments Today" value={data.appointmentsToday.count} />}
            {data.followUps && (
              <>
                <StatCard label="Follow-ups Due Today" value={data.followUps.dueToday} />
                <StatCard label="Follow-ups Overdue" value={data.followUps.overdue} highlight={data.followUps.overdue > 0} />
              </>
            )}
            {data.inventoryAlerts && (
              <>
                <StatCard
                  label="Low Stock Items"
                  value={data.inventoryAlerts.lowStockCount}
                  highlight={data.inventoryAlerts.lowStockCount > 0}
                />
                <StatCard
                  label="Expiring Soon (30 days)"
                  value={data.inventoryAlerts.expiringSoonCount}
                  highlight={data.inventoryAlerts.expiringSoonCount > 0}
                />
              </>
            )}
          </div>

          {data.financialSummary && (
            <section className="record-section">
              <h2>Today's Financial Summary</h2>
              <div className="summary-cards">
                <div className="summary-card">
                  <span className="summary-label">Total Revenue</span>
                  <span className="summary-value">₱{data.financialSummary.totalRevenue.toFixed(2)}</span>
                </div>
                <span className="summary-operator" aria-hidden="true">−</span>
                <div className="summary-card">
                  <span className="summary-label">Total Expenses</span>
                  <span className="summary-value">₱{data.financialSummary.totalExpenses.toFixed(2)}</span>
                </div>
                <span className="summary-operator" aria-hidden="true">−</span>
                <div className="summary-card">
                  <span className="summary-label">Total Cash Disbursement</span>
                  <span className="summary-value">₱{data.financialSummary.totalCashDisbursements.toFixed(2)}</span>
                </div>
                <span className="summary-operator" aria-hidden="true">=</span>
                <div className="summary-card summary-card--result">
                  <span className="summary-label">Net Profit</span>
                  <span className="summary-value">₱{data.financialSummary.netProfit.toFixed(2)}</span>
                </div>
              </div>
              <p className="back-link">
                <Link to="/financial">View full Financial page →</Link>
              </p>
            </section>
          )}

          {data.appointmentsToday && (
            <section className="record-section">
              <h2>Today's Appointments</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.appointmentsToday.items.map((a) => (
                    <tr key={a.id}>
                      <td>{a.scheduled_time}</td>
                      <td>
                        {a.patient_last_name}, {a.patient_first_name}
                      </td>
                      <td>{a.doctor_name || '—'}</td>
                      <td>
                        <span className={`status-badge status-${a.status}`}>{a.status.replace('_', ' ')}</span>
                      </td>
                    </tr>
                  ))}
                  {data.appointmentsToday.items.length === 0 && (
                    <tr>
                      <td colSpan={4}>No appointments today.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {data.appointmentsToday.count > data.appointmentsToday.items.length && (
                <p className="back-link">
                  <Link to="/appointments">View all {data.appointmentsToday.count} →</Link>
                </p>
              )}
            </section>
          )}

          {data.shiftsToday && (
            <section className="record-section">
              <h2>On Shift Today</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Start</th>
                    <th>End</th>
                  </tr>
                </thead>
                <tbody>
                  {data.shiftsToday.items.map((s) => (
                    <tr key={s.id}>
                      <td>{s.user_name}</td>
                      <td>{s.start_time}</td>
                      <td>{s.end_time}</td>
                    </tr>
                  ))}
                  {data.shiftsToday.items.length === 0 && (
                    <tr>
                      <td colSpan={3}>No shift scheduled for today.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          {data.inventoryAlerts && (data.inventoryAlerts.lowStockCount > 0 || data.inventoryAlerts.expiringSoonCount > 0) && (
            <section className="record-section">
              <h2>Inventory Alerts</h2>
              {data.inventoryAlerts.lowStockCount > 0 && (
                <>
                  <h3>Low Stock</h3>
                  <ul className="plain-list">
                    {data.inventoryAlerts.lowStock.map((item) => (
                      <li key={item.id}>
                        {item.name} — {item.totalRemaining} remaining (reorder at {item.reorder_threshold})
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {data.inventoryAlerts.expiringSoonCount > 0 && (
                <>
                  <h3>Expiring Soon</h3>
                  <ul className="plain-list">
                    {data.inventoryAlerts.expiringSoon.map((batch) => (
                      <li key={batch.id}>
                        {batch.item_name} (lot {batch.batch_lot_number}) — expires {batch.expiration_date}, {batch.quantity_remaining}{' '}
                        remaining
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="back-link">
                <Link to="/inventory">View Inventory →</Link>
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div className={`summary-card${highlight ? ' summary-card--result' : ''}`}>
      <span className="summary-label">{label}</span>
      <span className="summary-value">{value}</span>
    </div>
  );
}
