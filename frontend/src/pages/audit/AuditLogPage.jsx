import { useEffect, useState } from 'react';
import * as auditApi from '../../api/audit';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const TODAY = new Date().toISOString().slice(0, 10);

function downloadCsv(text, filename) {
  const blob = new Blob([text], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AuditLogPage() {
  const [startDate, setStartDate] = useState(daysAgo(7));
  const [endDate, setEndDate] = useState(TODAY);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entityTypes, setEntityTypes] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const filters = { startDate, endDate, action: action || undefined, entityType: entityType || undefined };

  function reload() {
    setLoading(true);
    setError(null);
    auditApi
      .listAuditLogs(filters)
      .then(setLogs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [startDate, endDate, action, entityType]);

  useEffect(() => {
    auditApi.listEntityTypes().then(setEntityTypes).catch(() => {});
  }, []);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const csv = await auditApi.exportAuditLogsCsv(filters);
      downloadCsv(csv, `audit-log-${startDate}-to-${endDate}.csv`);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <h1>Audit Log</h1>
      <p className="page-description">
        Every login, permission denial, and create/update/void action across the system, per
        docs/clover-architecture.md §1.4. Management sees every entry; Admin sees only their own actions.
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
          Action contains
          <input placeholder="e.g. void, login_failed" value={action} onChange={(e) => setAction(e.target.value)} />
        </label>
        <label>
          Entity Type
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">All</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={handleExport} disabled={exporting || logs.length === 0}>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity Type</th>
              <th>Entity ID</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString()}</td>
                <td>{log.user_name || (log.user_id ? `User #${log.user_id}` : 'System')}</td>
                <td>{log.action}</td>
                <td>{log.entity_type.replace('_', ' ')}</td>
                <td>{log.entity_id ?? '—'}</td>
                <td>{log.ip_address || '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6}>No matching audit log entries.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
