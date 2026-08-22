import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as inventoryApi from '../../api/inventory';
import { useAuth } from '../../auth/AuthContext';

export function InventoryDetailPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const [item, setItem] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    inventoryApi.getItem(id).then(setItem).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="form-error">{error}</div>;
  if (!item) return <p>Loading…</p>;

  const canAdjust = hasPermission('inventory.adjust');

  return (
    <div>
      <div className="page-header">
        <h1>{item.name}</h1>
        {item.lowStock && <span className="status-badge status-cancelled">low stock</span>}
      </div>

      <dl className="detail-grid">
        <dt>Category</dt>
        <dd>{item.category}</dd>
        <dt>Unit</dt>
        <dd>{item.unit}</dd>
        <dt>Total remaining</dt>
        <dd>{item.totalRemaining}</dd>
        <dt>Reorder threshold</dt>
        <dd>{item.reorder_threshold}</dd>
      </dl>

      <section className="record-section">
        <h2>Batches</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Lot #</th>
              <th>Expiration</th>
              <th>Remaining / Received</th>
              <th>Supplier</th>
            </tr>
          </thead>
          <tbody>
            {item.batches.map((b) => (
              <BatchRow key={b.id} batch={b} canAdjust={canAdjust} onAdjusted={setItem} />
            ))}
            {item.batches.length === 0 && (
              <tr>
                <td colSpan={4}>No batches received yet.</td>
              </tr>
            )}
          </tbody>
        </table>

        {canAdjust && <ReceiveBatchForm itemId={item.id} onReceived={setItem} />}
      </section>

      <p className="back-link">
        <Link to="/inventory">← Back to inventory</Link>
      </p>
    </div>
  );
}

function BatchRow({ batch, canAdjust, onAdjusted }) {
  const [adjusting, setAdjusting] = useState(false);
  const [form, setForm] = useState({ adjustmentType: 'correction', quantityDelta: '', reason: '' });
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      const updated = await inventoryApi.adjustBatch(batch.id, { ...form, quantityDelta: Number(form.quantityDelta) });
      onAdjusted(updated);
      setAdjusting(false);
      setForm({ adjustmentType: 'correction', quantityDelta: '', reason: '' });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <tr>
        <td>{batch.batch_lot_number}</td>
        <td>{batch.expiration_date || '—'}</td>
        <td>
          {batch.quantity_remaining} / {batch.quantity_received}
        </td>
        <td>{batch.supplier || '—'}</td>
      </tr>
      {canAdjust && (
        <tr>
          <td colSpan={4}>
            {!adjusting ? (
              <button type="button" onClick={() => setAdjusting(true)}>
                Adjust
              </button>
            ) : (
              <form onSubmit={submit} className="inline-form">
                {error && <div className="form-error">{error}</div>}
                <label>
                  Type
                  <select value={form.adjustmentType} onChange={(e) => setForm({ ...form, adjustmentType: e.target.value })}>
                    <option value="correction">Correction</option>
                    <option value="spoilage">Spoilage</option>
                    <option value="expired">Expired</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  Quantity change
                  <input
                    type="number"
                    placeholder="-2 or +5"
                    value={form.quantityDelta}
                    onChange={(e) => setForm({ ...form, quantityDelta: e.target.value })}
                    required
                  />
                </label>
                <label className="field-wide">
                  Reason
                  <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
                </label>
                <button type="submit">Save</button>
                <button type="button" onClick={() => setAdjusting(false)}>
                  Cancel
                </button>
              </form>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function ReceiveBatchForm({ itemId, onReceived }) {
  const [form, setForm] = useState({ batchLotNumber: '', expirationDate: '', quantityReceived: '', supplier: '', unitCost: '' });
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      const updated = await inventoryApi.receiveBatch(itemId, {
        ...form,
        quantityReceived: Number(form.quantityReceived),
        unitCost: form.unitCost ? Number(form.unitCost) : undefined,
        expirationDate: form.expirationDate || undefined,
      });
      onReceived(updated);
      setForm({ batchLotNumber: '', expirationDate: '', quantityReceived: '', supplier: '', unitCost: '' });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={submit} className="inline-form">
      {error && <div className="form-error">{error}</div>}
      <label>
        Lot #
        <input value={form.batchLotNumber} onChange={(e) => setForm({ ...form, batchLotNumber: e.target.value })} required />
      </label>
      <label>
        Expiration
        <input type="date" value={form.expirationDate} onChange={(e) => setForm({ ...form, expirationDate: e.target.value })} />
      </label>
      <label>
        Quantity
        <input type="number" min="1" value={form.quantityReceived} onChange={(e) => setForm({ ...form, quantityReceived: e.target.value })} required />
      </label>
      <label>
        Supplier
        <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
      </label>
      <button type="submit">Receive Batch</button>
    </form>
  );
}
