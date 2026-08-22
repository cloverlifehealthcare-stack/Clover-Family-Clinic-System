import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listItems, getAlerts } from '../../api/inventory';
import { useAuth } from '../../auth/AuthContext';

export function InventoryListPage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listItems(), getAlerts()])
      .then(([i, a]) => {
        setItems(i);
        setAlerts(a);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Inventory</h1>
        {hasPermission('inventory.adjust') && (
          <Link className="btn" to="/inventory/new">
            New Item
          </Link>
        )}
      </div>

      {alerts && (alerts.lowStock.length > 0 || alerts.expiringSoon.length > 0) && (
        <div className="alert-banner">
          {alerts.lowStock.length > 0 && (
            <span>
              ⚠ {alerts.lowStock.length} item{alerts.lowStock.length === 1 ? '' : 's'} at or below reorder threshold
            </span>
          )}
          {alerts.expiringSoon.length > 0 && (
            <span>
              ⏳ {alerts.expiringSoon.length} batch{alerts.expiringSoon.length === 1 ? '' : 'es'} expiring within 30 days
            </span>
          )}
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Unit</th>
            <th>In Stock</th>
            <th>Reorder At</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <Link to={`/inventory/${item.id}`}>{item.name}</Link>
              </td>
              <td>{item.category}</td>
              <td>{item.unit}</td>
              <td>
                {item.totalRemaining}
                {item.lowStock && <span className="status-badge status-cancelled"> low</span>}
              </td>
              <td>{item.reorder_threshold}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5}>No inventory items yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
