import { useEffect, useState } from 'react';
import * as financialApi from '../../api/financial';
import { useAuth } from '../../auth/AuthContext';

const EXPENSE_CATEGORIES = ['supplies', 'utilities', 'rent', 'salaries', 'equipment', 'maintenance', 'other'];

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
  const [ledger, setLedger] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [voidReason, setVoidReason] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canManage = hasPermission('financial.manage');

  function reload() {
    setLoading(true);
    setError(null);
    Promise.all([
      financialApi.getSummary({ startDate, endDate }),
      financialApi.getSalesJournal({ startDate, endDate }),
      financialApi.getSalesLedger({ startDate, endDate }),
      financialApi.listExpenses({ startDate, endDate }),
    ])
      .then(([s, j, l, e]) => {
        setSummary(s);
        setJournal(j);
        setLedger(l);
        setExpenses(e);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [startDate, endDate]);

  return (
    <div>
      <h1>Financial Management</h1>
      <p className="page-description">
        Sales Journal and Sales Ledger follow the BIR Manual Books of Accounts columnar format for a
        Non-VAT (Percentage Tax) service business, generated from actual recorded payments and expenses.
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
                <div className="summary-card">
                  <span className="summary-label">Total Expenses</span>
                  <span className="summary-value">₱{summary.totalExpenses.toFixed(2)}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Net Profit</span>
                  <span className="summary-value">₱{summary.netProfit.toFixed(2)}</span>
                </div>
              </div>
            )}
          </section>

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
            <h2>Sales Ledger</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Transactions</th>
                  <th>Total Sales</th>
                  <th>Running Total</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row) => (
                  <tr key={row.date}>
                    <td>{new Date(row.date).toLocaleDateString()}</td>
                    <td>{row.transactionCount}</td>
                    <td>₱{row.totalAmount.toFixed(2)}</td>
                    <td>₱{row.runningTotal.toFixed(2)}</td>
                  </tr>
                ))}
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={4}>No sales recorded in this range.</td>
                  </tr>
                )}
              </tbody>
            </table>
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
        </>
      )}
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
