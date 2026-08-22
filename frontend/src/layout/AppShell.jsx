import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

// The UI shows/hides modules per role, but that's a convenience only — the server is what
// actually enforces access (docs/clover-architecture.md §1.1). Every link here is still
// backed by a real requirePermission() check on the corresponding API route.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', permission: null },
  { to: '/patients', label: 'Patients', permission: 'patients.view' },
  { to: '/animal-bite', label: 'Animal Bite Center', permission: 'patients.history.view' },
  { to: '/consultations', label: 'Consultations', permission: 'patients.history.view' },
  { to: '/appointments', label: 'Appointments', permission: 'appointments.view' },
  { to: '/billing', label: 'Billing', permission: 'billing.view' },
  { to: '/inventory', label: 'Inventory', permission: 'inventory.view' },
  { to: '/scheduling', label: 'Scheduling', permission: 'scheduling.view' },
  { to: '/reminders', label: 'Reminders', permission: 'reminders.view' },
  { to: '/reports', label: 'Daily Activity', permission: 'reports.view' },
  { to: '/reports/trends', label: 'Trends', permission: 'reports.view' },
  { to: '/financial', label: 'Financial', permission: 'financial.view' },
  { to: '/audit-log', label: 'Audit Log', permission: 'audit.view' },
  { to: '/users', label: 'Staff Accounts', permission: 'users.manage' },
];

export function AppShell() {
  const { user, logout, hasPermission } = useAuth();
  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <span className="app-title">
          <img src="/logo.jpg" alt="" className="app-logo" />
          Clover Family Care
        </span>
        <div className="app-user">
          <span>
            {user?.full_name} <span className="app-role">({user?.role})</span>
          </span>
          <button type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <div className="app-body">
        <nav className="app-nav">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/' || item.to === '/reports'}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
