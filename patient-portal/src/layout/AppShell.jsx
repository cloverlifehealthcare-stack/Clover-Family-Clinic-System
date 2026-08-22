import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'My Appointments' },
  { to: '/book', label: 'Book Appointment' },
  { to: '/profile', label: 'My Profile' },
];

export function AppShell() {
  const { profile, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <span className="app-title">Clover Family Care — Patient Portal</span>
        <div className="app-user">
          <span>
            {profile?.first_name} {profile?.last_name}
          </span>
          <button type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <div className="app-body">
        <nav className="app-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
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
