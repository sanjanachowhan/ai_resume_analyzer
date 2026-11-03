import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import Spinner from '../ui/Spinner.jsx';

// Only logged-in users may enter; others are sent to /login and returned afterwards.
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner fullPage />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

// Login / register pages are pointless for someone already logged in.
export function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) return <Spinner fullPage />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
