import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children, permission }) {
  const { status, hasPermission } = useAuth();

  if (status === 'loading') {
    return <div className="page-loading">Loading…</div>;
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }
  if (permission && !hasPermission(permission)) {
    return (
      <div className="page-error">
        <h2>Access denied</h2>
        <p>You don't have permission to view this page.</p>
      </div>
    );
  }

  return children;
}
