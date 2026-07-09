import { Navigate, useLocation } from 'react-router-dom';
import { useRecruiterAuth } from '@/context/RecruiterAuthContext';

export function RecruiterProtectedRoute({ children }: { children: React.ReactNode }) {
  const { recruiter, loading } = useRecruiterAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!recruiter) {
    return <Navigate to="/recruiter-portal/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
