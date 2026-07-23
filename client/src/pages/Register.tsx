import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { companyApi, type Company } from '@/lib/api';
import { AppLogo } from '@/components/ui/AppLogo';
import { toast } from '@/lib/toast';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'mentor',
    companyId: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    companyApi
      .listPublic()
      .then((data) => {
        setCompanies(data.companies);
        if (data.companies.length > 0) {
          setForm((f) => ({ ...f, companyId: data.companies[0].id }));
        }
      })
      .catch((err) => {
        toast.error(
          err instanceof Error
            ? `Could not load companies: ${err.message}. Is the API running on port 4600?`
            : 'Failed to load companies'
        );
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md np-card p-8">
        <div className="mb-8 text-center">
          <AppLogo size="lg" className="mx-auto mb-4" />
          <h1 className="text-2xl">Create account</h1>
          <p className="mt-1 text-sm text-body">Join your company on Nexus Partners</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Full name</label>
            <input
              className="np-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Email</label>
            <input
              type="email"
              className="np-input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Password</label>
            <input
              type="password"
              className="np-input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Phone</label>
            <input
              className="np-input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Company</label>
            <select
              className="np-input"
              value={form.companyId}
              onChange={(e) => setForm({ ...form, companyId: e.target.value })}
              required
              disabled={companies.length === 0}
            >
              {companies.length === 0 ? (
                <option value="">No companies available — run npm run seed</option>
              ) : (
                companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Role</label>
            <select
              className="np-input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="mentor">Mentor</option>
              <option value="resume">Resume</option>
              <option value="onboarding">Onboarding</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button type="submit" className="np-btn-primary w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-body">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
