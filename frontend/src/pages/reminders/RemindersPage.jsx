import { useEffect, useState } from 'react';
import * as remindersApi from '../../api/reminders';
import { useAuth } from '../../auth/AuthContext';

const STATUS_OPTIONS = ['', 'sent', 'failed'];
const SOURCE_OPTIONS = ['', 'follow_up', 'appointment'];

export function RemindersPage() {
  const { hasPermission } = useAuth();
  const [status, setStatus] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  const canManage = hasPermission('reminders.manage');

  function reload() {
    setLoading(true);
    setError(null);
    remindersApi
      .listReminders({ status: status || undefined, sourceType: sourceType || undefined })
      .then(setLogs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [status, sourceType]);

  async function handleRun() {
    setRunning(true);
    setError(null);
    setRunResult(null);
    try {
      const result = await remindersApi.runReminders(1);
      setRunResult(result);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <h1>Follow-up Reminders</h1>
      <p className="page-description">
        SMS and email reminders for tomorrow's appointments and animal-bite follow-ups. Currently backed by a stub
        provider that logs instead of sending — see backend/README.md.
      </p>

      {error && <div className="form-error">{error}</div>}

      {canManage && (
        <section className="record-section">
          <h2>Run Reminder Job</h2>
          <p>Sends reminders for anything scheduled tomorrow. Safe to re-run — already-sent reminders are skipped.</p>
          <button type="button" onClick={handleRun} disabled={running}>
            {running ? 'Running…' : 'Run Reminders Now'}
          </button>
          {runResult && (
            <p>
              Sent {runResult.sent}, skipped {runResult.skipped}, failed {runResult.failed}.
            </p>
          )}
        </section>
      )}

      <section className="record-section">
        <h2>Reminder Log</h2>
        <div className="filter-row">
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s || 'All'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              {SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === 'follow_up' ? 'Follow-up' : s === 'appointment' ? 'Appointment' : 'All'}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <p>Loading…</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Sent At</th>
                <th>Type</th>
                <th>Channel</th>
                <th>Recipient</th>
                <th>Message</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{l.sent_at ? new Date(l.sent_at).toLocaleString() : '—'}</td>
                  <td>{l.source_type === 'follow_up' ? 'Follow-up' : 'Appointment'}</td>
                  <td>{l.channel.toUpperCase()}</td>
                  <td>{l.recipient}</td>
                  <td>{l.message}</td>
                  <td>
                    <span className={`status-badge status-${l.status}`}>{l.status}</span>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6}>No reminders logged yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
