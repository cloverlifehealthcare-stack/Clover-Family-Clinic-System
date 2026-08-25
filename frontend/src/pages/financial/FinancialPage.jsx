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
  const [purchases, setPurchases] = useState([]);
  const [serviceFees, setServiceFees] = useState([]);
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
      financialApi.listServiceFees(),
      financialApi.listCashDisbursements({ startDate, endDate }),
    ])
      .then(([s, j, p, e, f, c]) => {
        setSummary(s);
        setJournal(j);
        setPurchases(p);
        setExpenses(e);
        setServiceFees(f);
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
              Sales per patient, less the cost of goods (vaccines/RIG actually consumed, from Inventory) and the
              doctor's fee for that service type. Doctor's fee is a fixed amount per service type, not per doctor —
              set it below under Service Fee Options.
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Service</th>
                  <th>Sales</th>
                  <th>Cost of Goods</th>
                  <th>Doctor's Fee</th>
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
                    <td>₱{row.doctorFee.toFixed(2)}</td>
                    <td>₱{row.netAmount.toFixed(2)}</td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr>
                    <td colSpan={7}>No sales recorded in this range.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <ServiceFeeOptions fees={serviceFees} canManage={canManage} onUpdated={reload} />
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
                    <td colSpan={canManage ? 6 : 5}>No cash disbursements recorded in this range.</td>
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

const SOURCE_TYPE_LABELS = {
  animal_bite: 'Animal Bite',
  consultation: 'Consultation',
  manual: 'Manual Charge',
};

function ServiceFeeOptions({ fees, canManage, onUpdated }) {
  const [drafts, setDrafts] = useState({});
  const [savingType, setSavingType] = useState(null);
  const [error, setError] = useState(null);

  function draftFor(sourceType, doctorFee) {
    return drafts[sourceType] ?? String(Number(doctorFee));
  }

  async function save(sourceType) {
    setError(null);
    setSavingType(sourceType);
    try {
      await financialApi.updateServiceFee(sourceType, Number(drafts[sourceType]));
      setDrafts((d) => {
        const next = { ...d };
        delete next[sourceType];
        return next;
      });
      onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingType(null);
    }
  }

  return (
    <div className="record-section" style={{ marginTop: '1.5rem' }}>
      <h3>Service Fee Options</h3>
      <p className="page-description">
        Doctor's fee per service type, applied to the Purchases report above regardless of which doctor performed
        the service. Cost of Goods is not set here — it's computed automatically from the vaccine/RIG batches
        actually used, via Inventory.
      </p>
      {error && <div className="form-error">{error}</div>}
      <table className="table">
        <thead>
          <tr>
            <th>Service Type</th>
            <th>Doctor's Fee</th>
            {canManage && <th />}
          </tr>
        </thead>
        <tbody>
          {fees.map((fee) => (
            <tr key={fee.source_type}>
              <td>{SOURCE_TYPE_LABELS[fee.source_type] || fee.source_type}</td>
              <td>
                {canManage ? (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draftFor(fee.source_type, fee.doctor_fee)}
                    onChange={(e) => setDrafts({ ...drafts, [fee.source_type]: e.target.value })}
                    style={{ width: '8rem' }}
                  />
                ) : (
                  `₱${Number(fee.doctor_fee).toFixed(2)}`
                )}
              </td>
              {canManage && (
                <td>
                  <button
                    type="button"
                    disabled={savingType === fee.source_type}
                    onClick={() => save(fee.source_type)}
                  >
                    Save
                  </button>
                </td>
              )}
            </tr>
          ))}
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
      setForm({ disbursementDate: todayDateString(), particulars: '', amount: '', givenTo: '' });
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
      <label className="field-wide">
        Particulars
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
