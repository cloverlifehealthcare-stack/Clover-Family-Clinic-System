import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return <div className="page-loading">Loading…</div>;
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return children;
}
