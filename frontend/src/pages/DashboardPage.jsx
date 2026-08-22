import { useAuth } from '../auth/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1>Welcome, {user?.full_name}</h1>
      <p>
        Signed in as <strong>{user?.role}</strong>. Use the navigation on the left to get started.
      </p>
    </div>
  );
}
