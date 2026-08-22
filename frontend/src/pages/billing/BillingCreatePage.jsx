import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createStatement, listServices } from '../../api/billing';

const EMPTY_ITEM = { serviceId: '', description: '', quantity: 1, unitPrice: '', isDiscountEligible: true };
const SOURCE_TYPES = [
  { value: 'manual', label: 'Manual / walk-in charge' },
  { value: 'animal_bite', label: 'Animal Bite Center visit' },
  { value: 'consultation', label: 'Consultation' },
];

export function BillingCreatePage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [sourceType, setSourceType] = useState('manual');
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [discountType, setDiscountType] = useState('none');
  const [discountIdNumber, setDiscountIdNumber] = useState('');
  const [discountHolderName, setDiscountHolderName] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listServices().then(setServices);
  }, []);

  function updateItem(idx, field, value) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: value };
        if (field === 'serviceId' && value) {
          const service = services.find((s) => String(s.id) === value);
          if (service) {
            updated.description = service.name;
            updated.unitPrice = service.default_price;
          }
        }
        return updated;
      })
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const statement = await createStatement({
        patientId: Number(patientId),
        sourceType,
        items: items.map((item) => ({
          serviceId: item.serviceId ? Number(item.serviceId) : undefined,
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          isDiscountEligible: item.isDiscountEligible,
        })),
        discountType,
        discountIdNumber: discountType !== 'none' ? discountIdNumber : undefined,
        discountHolderName: discountType !== 'none' ? discountHolderName : undefined,
      });
      navigate(`/billing/statements/${statement.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>New Billing Statement</h1>
      <form className="patient-form" onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <fieldset>
          <legend>Source</legend>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
            {SOURCE_TYPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset>
          <legend>Charges</legend>
          {items.map((item, idx) => (
            <div key={idx} className="billing-item-row">
              <select value={item.serviceId} onChange={(e) => updateItem(idx, 'serviceId', e.target.value)}>
                <option value="">Manual line item…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (₱{s.default_price})
                  </option>
                ))}
              </select>
              <input placeholder="Description" value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} required />
              <input
                type="number"
                min="1"
                placeholder="Qty"
                value={item.quantity}
                onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                required
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Unit price"
                value={item.unitPrice}
                onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                required
              />
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={item.isDiscountEligible}
                  onChange={(e) => updateItem(idx, 'isDiscountEligible', e.target.checked)}
                />
                Discount-eligible
              </label>
            </div>
          ))}
          <button type="button" onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}>
            + Add another charge
          </button>
        </fieldset>

        <fieldset>
          <legend>PWD / Senior Citizen discount</legend>
          <div className="form-grid">
            <label>
              Discount type
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                <option value="none">None</option>
                <option value="pwd">PWD (20%)</option>
                <option value="senior">Senior Citizen (20%)</option>
              </select>
            </label>
            {discountType !== 'none' && (
              <>
                <label>
                  ID number
                  <input value={discountIdNumber} onChange={(e) => setDiscountIdNumber(e.target.value)} required />
                </label>
                <label>
                  Holder name
                  <input value={discountHolderName} onChange={(e) => setDiscountHolderName(e.target.value)} required />
                </label>
              </>
            )}
          </div>
        </fieldset>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Statement'}
        </button>
      </form>
    </div>
  );
}
