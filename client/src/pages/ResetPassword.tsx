import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/lib/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="np-card max-w-md p-8 text-center">
          <p className="text-body">Invalid reset link.</p>
          <Link to="/login" className="mt-4 inline-block text-primary hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md np-card p-8">
        <h1 className="mb-2 text-2xl">Reset password</h1>
        <p className="mb-6 text-sm text-body">Enter your new password below.</p>

        {success ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Password updated. Redirecting to login...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">New password</label>
              <input
                type="password"
                className="np-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">Confirm password</label>
              <input
                type="password"
                className="np-input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <button type="submit" className="np-btn-primary w-full" disabled={loading}>
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
