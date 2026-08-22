import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createItem } from '../../api/inventory';

const CATEGORIES = ['vaccine', 'rig', 'medicine', 'supply', 'other'];

export function InventoryCreatePage() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', category: 'vaccine', unit: '', reorderThreshold: 0 });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const item = await createItem({ ...values, reorderThreshold: Number(values.reorderThreshold) });
      navigate(`/inventory/${item.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>New Inventory Item</h1>
      <form className="patient-form" onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}
        <fieldset>
          <legend>Item</legend>
          <div className="form-grid">
            <label>
              Name<span className="required">*</span>
              <input name="name" value={values.name} onChange={handleChange} required />
            </label>
            <label>
              Category<span className="required">*</span>
              <select name="category" value={values.category} onChange={handleChange}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Unit<span className="required">*</span>
              <input name="unit" value={values.unit} onChange={handleChange} placeholder="vial, dose, box…" required />
            </label>
            <label>
              Reorder threshold
              <input type="number" min="0" name="reorderThreshold" value={values.reorderThreshold} onChange={handleChange} />
            </label>
          </div>
        </fieldset>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Item'}
        </button>
      </form>
    </div>
  );
}
