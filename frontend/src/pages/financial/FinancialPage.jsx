import { useEffect, useState } from 'react';
import * as financialApi from '../../api/financial';
import { useAuth } from '../../auth/AuthContext';

const EXPENSE_CATEGORIES = ['supplies', 'utilities', 'rent', 'salaries', 'equipment', 'maintenance', 'other'];
const CASH_DISBURSEMENT_CATEGORY_LABELS = { doctors_fee: "Doctor's Daily Fee", other: 'Other' };

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function FinancialPage() {
  const { hasPermission } = useAuth();
  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(todayDateString());
  const [summary, setSummary] = useState(null);
  const [journal, setJournal] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [vaccineCosts, setVaccineCosts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [cashDisbursements, setCashDisbursements] = useState([]);
  const [voidReason, setVoidReason] = useState({});
  const [disbursementVoidReason, setDisbursementVoidReason] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canManage = hasPermission('financial.manage');

  function reload() {
    setLoading(true);
    setError(null);
    Promise.all([
      financialApi.getSummary({ startDate, endDate }),
      financialApi.getSalesJournal({ startDate, endDate }),
      financialApi.getPurchases({ startDate, endDate }),
      financialApi.listExpenses({ startDate, endDate }),
      financialApi.listVaccineCosts(),
      financialApi.listCashDisbursements({ startDate, endDate }),
    ])
      .then(([s, j, p, e, vc, c]) => {
        setSummary(s);
        setJournal(j);
        setPurchases(p);
        setExpenses(e);
        setVaccineCosts(vc);
        setCashDisbursements(c);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [startDate, endDate]);

  return (
    <div>
      <h1>Financial Management</h1>
      <p className="page-description">
        Sales Journal follows the BIR Manual Books of Accounts columnar format for a Non-VAT (Percentage Tax)
        service business, generated from actual recorded payments and expenses.
        <strong> Pending your accountant/bookkeeper's sign-off before these are treated as your official books.</strong>
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
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          <section className="record-section">
            <h2>Summary</h2>
            {summary && (
              <div className="summary-cards">
                <div className="summary-card">
                  <span className="summary-label">Total Revenue</span>
                  <span className="summary-value">₱{summary.totalRevenue.toFixed(2)}</span>
                </div>
                <span className="summary-operator" aria-hidden="true">−</span>
                <div className="summary-card">
                  <span className="summary-label">Total Expenses</span>
                  <span className="summary-value">₱{summary.totalExpenses.toFixed(2)}</span>
                </div>
                <span className="summary-operator" aria-hidden="true">−</span>
                <div className="summary-card">
                  <span className="summary-label">Total Cash Disbursement</span>
                  <span className="summary-value">₱{summary.totalCashDisbursements.toFixed(2)}</span>
                </div>
                <span className="summary-operator" aria-hidden="true">=</span>
                <div className="summary-card summary-card--result">
                  <span className="summary-label">Net Profit</span>
                  <span className="summary-value">₱{summary.netProfit.toFixed(2)}</span>
                </div>
              </div>
            )}
          </section>

          <ExportReportsSection startDate={startDate} endDate={endDate} />

          <section className="record-section">
            <h2>Sales Journal</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>OR No.</th>
                  <th>Payor</th>
                  <th>Particulars</th>
                  <th>Discount</th>
                  <th>Method</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {journal.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.paid_at).toLocaleDateString()}</td>
                    <td>{row.or_number}</td>
                    <td>{row.patient_name}</td>
                    <td>{row.source_type.replace('_', ' ')}</td>
                    <td>{row.discount_type === 'none' ? '—' : row.discount_type.toUpperCase()}</td>
                    <td>{row.payment_method}</td>
                    <td>₱{Number(row.amount_paid).toFixed(2)}</td>
                  </tr>
                ))}
                {journal.length === 0 && (
                  <tr>
                    <td colSpan={7}>No sales recorded in this range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="record-section">
            <h2>Purchases</h2>
            <p className="page-description">
              Sales per patient, less the cost of goods (vaccines/RIG actually consumed, priced at each vaccine's
              current cost — set below under Vaccine Cost Options). Doctor's fees aren't shown per visit here —
              doctors are paid a variable daily amount based on hours worked or patients seen, not a fixed rate per
              visit, so those payments are recorded under Cash Disbursement instead.
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Service</th>
                  <th>Sales</th>
                  <th>Cost of Goods</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((row) => (
                  <tr key={row.statementId}>
                    <td>{new Date(row.date).toLocaleDateString()}</td>
                    <td>{row.patientName}</td>
                    <td>{row.sourceType.replace('_', ' ')}</td>
                    <td>₱{row.salesAmount.toFixed(2)}</td>
                    <td>₱{row.costOfGoods.toFixed(2)}</td>
                    <td>₱{row.netAmount.toFixed(2)}</td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr>
                    <td colSpan={6}>No sales recorded in this range.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <VaccineCostOptions items={vaccineCosts} canManage={canManage} onUpdated={reload} />
          </section>

          <section className="record-section">
            <h2>Expenses</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Paid To</th>
                  <th>Amount</th>
                  <th>Status</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td>{exp.expense_date}</td>
                    <td>{exp.category}</td>
                    <td>{exp.description}</td>
                    <td>{exp.paid_to || '—'}</td>
                    <td>₱{Number(exp.amount).toFixed(2)}</td>
                    <td>
                      <span className={`status-badge status-${exp.status}`}>{exp.status}</span>
                    </td>
                    {canManage && (
                      <td>
                        {exp.status === 'active' && (
                          <span className="void-inline">
                            <input
                              placeholder="Void reason"
                              value={voidReason[exp.id] || ''}
                              onChange={(e) => setVoidReason({ ...voidReason, [exp.id]: e.target.value })}
                            />
                            <button
                              type="button"
                              disabled={!voidReason[exp.id]}
                              onClick={async () => {
                                await financialApi.voidExpense(exp.id, voidReason[exp.id]);
                                reload();
                              }}
                            >
                              Void
                            </button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 7 : 6}>No expenses recorded in this range.</td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && <RecordExpenseForm onRecorded={reload} />}
          </section>

          <section className="record-section">
            <h2>Cash Disbursement</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Particulars</th>
                  <th>Reason</th>
                  <th>Amount</th>
                  <th>Given To</th>
                  <th>Status</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {cashDisbursements.map((d) => (
                  <tr key={d.id}>
                    <td>{d.disbursement_date}</td>
                    <td>{CASH_DISBURSEMENT_CATEGORY_LABELS[d.category] || d.category}</td>
                    <td>{d.particulars}</td>
                    <td>₱{Number(d.amount).toFixed(2)}</td>
                    <td>{d.given_to}</td>
                    <td>
                      <span className={`status-badge status-${d.status}`}>{d.status}</span>
                    </td>
                    {canManage && (
                      <td>
                        {d.status === 'active' && (
                          <span className="void-inline">
                            <input
                              placeholder="Void reason"
                              value={disbursementVoidReason[d.id] || ''}
                              onChange={(e) =>
                                setDisbursementVoidReason({ ...disbursementVoidReason, [d.id]: e.target.value })
                              }
                            />
                            <button
                              type="button"
                              disabled={!disbursementVoidReason[d.id]}
                              onClick={async () => {
                                await financialApi.voidCashDisbursement(d.id, disbursementVoidReason[d.id]);
                                reload();
                              }}
                            >
                              Void
                            </button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {cashDisbursements.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 7 : 6}>No cash disbursements recorded in this range.</td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && <RecordCashDisbursementForm onRecorded={reload} />}
          </section>
        </>
      )}
    </div>
  );
}

function downloadCsv(text, filename) {
  const blob = new Blob([text], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const EXPORT_REPORTS = [
  { key: 'salesJournal', label: 'Sales Journal', fetchCsv: financialApi.exportSalesJournalCsv, fileSlug: 'sales-journal' },
  { key: 'purchases', label: 'Purchases', fetchCsv: financialApi.exportPurchasesCsv, fileSlug: 'purchases' },
  { key: 'expenses', label: 'Expenses', fetchCsv: financialApi.exportExpensesCsv, fileSlug: 'expenses' },
  { key: 'cashDisbursement', label: 'Cash Disbursement', fetchCsv: financialApi.exportCashDisbursementsCsv, fileSlug: 'cash-disbursement' },
  { key: 'fullReport', label: 'Full Report (Net Profit)', fetchCsv: financialApi.exportFullReportCsv, fileSlug: 'full-report' },
];

function ExportReportsSection({ startDate, endDate }) {
  const [exportingKey, setExportingKey] = useState(null);
  const [error, setError] = useState(null);

  async function handleExport(report) {
    setError(null);
    setExportingKey(report.key);
    try {
      const csv = await report.fetchCsv({ startDate, endDate });
      downloadCsv(csv, `${report.fileSlug}-${startDate}-to-${endDate}.csv`);
    } catch (err) {
      setError(err.message);
    } finally {
      setExportingKey(null);
    }
  }

  return (
    <section className="record-section">
      <h2>Export Reports</h2>
      <p className="page-description">
        Download each report as a CSV file (opens in Excel or Google Sheets) for the date range selected above.
        "Full Report" is the bottom-line formula: Total Revenue − Total Expenses − Total Cash Disbursement = Net
        Profit.
      </p>
      {error && <div className="form-error">{error}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        {EXPORT_REPORTS.map((report) => (
          <button key={report.key} type="button" disabled={exportingKey === report.key} onClick={() => handleExport(report)}>
            {exportingKey === report.key ? 'Exporting…' : `Export ${report.label}`}
          </button>
        ))}
      </div>
    </section>
  );
}

function VaccineCostOptions({ items, canManage, onUpdated }) {
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);

  function draftFor(item) {
    return drafts[item.id] ?? String(Number(item.current_cost || 0));
  }

  async function save(itemId) {
    setError(null);
    setSavingId(itemId);
    try {
      await financialApi.updateVaccineCost(itemId, Number(drafts[itemId]));
      setDrafts((d) => {
        const next = { ...d };
        delete next[itemId];
        return next;
      });
      onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="record-section" style={{ marginTop: '1.5rem' }}>
      <h3>Vaccine Cost Options</h3>
      <p className="page-description">
        The current cost of goods for each vaccine/RIG item — used in the Purchases report above whenever that
        item is administered against a tracked Inventory batch. Update this whenever your purchase cost changes;
        it applies immediately, without needing to re-enter it each time stock is received.
      </p>
      {error && <div className="form-error">{error}</div>}
      <table className="table">
        <thead>
          <tr>
            <th>Vaccine / RIG</th>
            <th>Current Cost</th>
            {canManage && <th />}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>
                {canManage ? (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draftFor(item)}
                    onChange={(e) => setDrafts({ ...drafts, [item.id]: e.target.value })}
                    style={{ width: '8rem' }}
                  />
                ) : (
                  `₱${Number(item.current_cost || 0).toFixed(2)}`
                )}
              </td>
              {canManage && (
                <td>
                  <button type="button" disabled={savingId === item.id} onClick={() => save(item.id)}>
                    Save
                  </button>
                </td>
              )}
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={canManage ? 3 : 2}>No vaccine/RIG items in Inventory yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RecordExpenseForm({ onRecorded }) {
  const [form, setForm] = useState({
    expenseDate: todayDateString(),
    category: 'supplies',
    description: '',
    amount: '',
    paidTo: '',
  });
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      await financialApi.createExpense({ ...form, amount: Number(form.amount) });
      setForm({ expenseDate: todayDateString(), category: 'supplies', description: '', amount: '', paidTo: '' });
      onRecorded();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={submit} className="inline-form">
      {error && <div className="form-error">{error}</div>}
      <label>
        Date
        <input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} required />
      </label>
      <label>
        Category
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="field-wide">
        Description
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
      </label>
      <label>
        Paid To
        <input value={form.paidTo} onChange={(e) => setForm({ ...form, paidTo: e.target.value })} />
      </label>
      <label>
        Amount
        <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
      </label>
      <button type="submit">Record Expense</button>
    </form>
  );
}

function RecordCashDisbursementForm({ onRecorded }) {
  const [form, setForm] = useState({
    disbursementDate: todayDateString(),
    category: 'doctors_fee',
    particulars: '',
    amount: '',
    givenTo: '',
  });
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      await financialApi.createCashDisbursement({ ...form, amount: Number(form.amount) });
      setForm({ disbursementDate: todayDateString(), category: 'doctors_fee', particulars: '', amount: '', givenTo: '' });
      onRecorded();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={submit} className="inline-form">
      {error && <div className="form-error">{error}</div>}
      <label>
        Date
        <input
          type="date"
          value={form.disbursementDate}
          onChange={(e) => setForm({ ...form, disbursementDate: e.target.value })}
          required
        />
      </label>
      <label>
        Particulars
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {Object.entries(CASH_DISBURSEMENT_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field-wide">
        Reason
        <input value={form.particulars} onChange={(e) => setForm({ ...form, particulars: e.target.value })} required />
      </label>
      <label>
        Amount
        <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
      </label>
      <label>
        Given To
        <input value={form.givenTo} onChange={(e) => setForm({ ...form, givenTo: e.target.value })} required />
      </label>
      <button type="submit">Record Disbursement</button>
    </form>
  );
}
