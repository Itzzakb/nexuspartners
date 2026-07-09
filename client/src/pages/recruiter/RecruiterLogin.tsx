import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useRecruiterAuth } from '@/context/RecruiterAuthContext';
import { AppLogo } from '@/components/ui/AppLogo';

export default function RecruiterLogin() {
  const { login, recruiter, loading } = useRecruiterAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/recruiter-portal/applications';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && recruiter) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md np-card p-8">
        <div className="mb-8 text-center">
          <AppLogo size="lg" className="mx-auto mb-4" />
          <h1 className="text-2xl">Recruiter Portal</h1>
          <p className="mt-1 text-sm text-body">Sign in to manage student applications</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Username</label>
            <input
              type="text"
              className="np-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Password</label>
            <input
              type="password"
              className="np-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="np-btn-primary w-full" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
