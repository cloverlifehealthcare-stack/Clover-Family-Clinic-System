import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as billingApi from '../../api/billing';
import * as patientsApi from '../../api/patients';
import { useAuth } from '../../auth/AuthContext';

export function BillingDetailPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const [statement, setStatement] = useState(null);
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    billingApi.getStatement(id).then(setStatement).catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (statement) {
      patientsApi.getPatient(statement.patient_id).then(setPatient).catch((err) => setError(err.message));
    }
  }, [statement]);

  if (error) return <div className="form-error">{error}</div>;
  if (!statement) return <p>Loading…</p>;

  const canPay = hasPermission('payment.process');
  const canVoid = hasPermission('payment.void');

  return (
    <div>
      <div className="no-print">
        <div className="page-header">
          <h1>Billing Statement #{statement.id}</h1>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className={`status-badge status-${statement.status}`}>{statement.status.replace('_', ' ')}</span>
            <button type="button" onClick={() => window.print()}>
              Print Statement
            </button>
          </span>
        </div>

        {error && <div className="form-error">{error}</div>}

        <table className="table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {statement.items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>₱{item.unit_price}</td>
                <td>₱{item.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="detail-grid">
          <dt>Subtotal</dt>
          <dd>₱{statement.subtotal_amount}</dd>
          <dt>Discount ({statement.discount_type !== 'none' ? statement.discount_type.toUpperCase() : 'none'})</dt>
          <dd>₱{statement.discount_amount}</dd>
          <dt>Total</dt>
          <dd>
            <strong>₱{statement.total_amount}</strong>
          </dd>
          <dt>Amount paid</dt>
          <dd>₱{statement.amountPaid}</dd>
          <dt>Balance due</dt>
          <dd>₱{statement.balanceDue}</dd>
        </dl>

        <PaymentsSection statement={statement} setStatement={setStatement} canPay={canPay} canVoid={canVoid} />

        {canVoid && statement.status !== 'void' && (
          <VoidStatementForm statementId={statement.id} setStatement={setStatement} />
        )}

        <p className="back-link">
          <Link to={`/patients/${statement.patient_id}/billing-statements`}>← Back to statements</Link>
        </p>
      </div>

      <PrintableStatement statement={statement} patient={patient} />
    </div>
  );
}

function PrintableStatement({ statement, patient }) {
  const activePayments = statement.payments.filter((p) => p.status === 'active');
  const lastOrNumber = activePayments.length ? activePayments[activePayments.length - 1].or_number : null;

  return (
    <div className="print-only">
      <div className="invoice">
        <div className="invoice-header">
          <div className="invoice-brand">
            <img src="/logo.jpg" alt="" />
            <div>
              <div className="invoice-brand-name">Clover Family Care and Animal Bite Center</div>
              <div className="invoice-brand-contact">
                +63 955 437 4779 · cloverfamilycareabc@gmail.com
              </div>
            </div>
          </div>
          <div className="invoice-heading">
            <h1>INVOICE</h1>
            <div>No. {String(statement.id).padStart(6, '0')}</div>
            <div>{new Date(statement.created_at).toLocaleDateString()}</div>
            <div className="invoice-status-stamp">{statement.status.replace('_', ' ')}</div>
          </div>
        </div>

        <div className="invoice-meta-grid">
          <section>
            <div className="invoice-meta-label">Bill To</div>
            {patient ? (
              <>
                <div className="invoice-bill-to">
                  {patient.last_name}, {patient.first_name}
                </div>
                <div>Patient Code: {patient.patient_code}</div>
                {patient.contact_number && <div>Contact: {patient.contact_number}</div>}
              </>
            ) : (
              <div>—</div>
            )}
          </section>
          <section>
            <div className="invoice-meta-label">Payment</div>
            <div>OR No.: {lastOrNumber || '—'}</div>
            <div>Discount: {statement.discount_type !== 'none' ? statement.discount_type.toUpperCase() : 'None'}</div>
          </section>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {statement.items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>₱{item.unit_price}</td>
                <td>₱{item.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-totals">
          <div>
            <span>Subtotal</span>
            <span>₱{statement.subtotal_amount}</span>
          </div>
          <div>
            <span>Discount</span>
            <span>₱{statement.discount_amount}</span>
          </div>
          <div className="invoice-grand-total">
            <span>Total</span>
            <span>₱{statement.total_amount}</span>
          </div>
          <div>
            <span>Amount Paid</span>
            <span>₱{statement.amountPaid}</span>
          </div>
          <div className="invoice-balance-due">
            <span>Balance Due</span>
            <span>₱{statement.balanceDue}</span>
          </div>
        </div>

        {statement.payments.length > 0 && (
          <>
            <div className="invoice-meta-label" style={{ marginTop: '1.5rem' }}>
              Payment History
            </div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>OR #</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {statement.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.paid_at.slice(0, 10)}</td>
                    <td>₱{p.amount_paid}</td>
                    <td>{p.payment_method}</td>
                    <td>{p.or_number}</td>
                    <td>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="invoice-footer">
          <p>Thank you for trusting Clover Family Care and Animal Bite Center with your care.</p>
          <p>This document serves as your official billing statement / receipt.</p>
          <p>Printed on {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

function PaymentsSection({ statement, setStatement, canPay, canVoid }) {
  const [form, setForm] = useState({ amountPaid: '', paymentMethod: 'cash', orNumber: '' });
  const [voidReason, setVoidReason] = useState({});
  const [error, setError] = useState(null);

  async function submitPayment(e) {
    e.preventDefault();
    setError(null);
    try {
      const updated = await billingApi.recordPayment(statement.id, {
        amountPaid: Number(form.amountPaid),
        paymentMethod: form.paymentMethod,
        orNumber: form.orNumber,
      });
      setStatement(updated);
      setForm({ amountPaid: '', paymentMethod: 'cash', orNumber: '' });
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitVoidPayment(paymentId) {
    setError(null);
    try {
      const reason = voidReason[paymentId];
      setStatement(await billingApi.voidPayment(paymentId, { reason }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="record-section">
      <h2>Payments</h2>
      {error && <div className="form-error">{error}</div>}
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Amount</th>
            <th>Method</th>
            <th>OR #</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {statement.payments.map((p) => (
            <tr key={p.id}>
              <td>{p.paid_at.slice(0, 10)}</td>
              <td>₱{p.amount_paid}</td>
              <td>{p.payment_method}</td>
              <td>{p.or_number}</td>
              <td>{p.status}</td>
              <td>
                {p.status === 'active' && canVoid && (
                  <span className="void-inline">
                    <input
                      placeholder="Void reason"
                      value={voidReason[p.id] || ''}
                      onChange={(e) => setVoidReason({ ...voidReason, [p.id]: e.target.value })}
                    />
                    <button type="button" onClick={() => submitVoidPayment(p.id)}>
                      Void
                    </button>
                  </span>
                )}
              </td>
            </tr>
          ))}
          {statement.payments.length === 0 && (
            <tr>
              <td colSpan={6}>No payments recorded yet.</td>
            </tr>
          )}
        </tbody>
      </table>

      {canPay && statement.status !== 'void' && statement.balanceDue > 0 && (
        <form onSubmit={submitPayment} className="inline-form">
          <label>
            Amount
            <input type="number" step="0.01" min="0" value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} required />
          </label>
          <label>
            Method
            <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="gcash">GCash</option>
            </select>
          </label>
          <label>
            OR #
            <input value={form.orNumber} onChange={(e) => setForm({ ...form, orNumber: e.target.value })} required />
          </label>
          <button type="submit">Record Payment</button>
        </form>
      )}
    </section>
  );
}

function VoidStatementForm({ statementId, setStatement }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      setStatement(await billingApi.voidStatement(statementId, { reason }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={submit} className="inline-form">
      {error && <div className="form-error">{error}</div>}
      <label className="field-wide">
        Void this entire statement — reason
        <input value={reason} onChange={(e) => setReason(e.target.value)} required />
      </label>
      <button type="submit">Void Statement</button>
    </form>
  );
}
