import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AtSign, Eye, KeyRound, Mail, Pencil, Phone, Plus, RefreshCw, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { externalApi } from '@/lib/api';
import { canAccessModule } from '@/lib/permissions';
import { toast } from '@/lib/toast';
import type { ExternalRecruiter } from '@/types/phase4';

export default function Recruiters() {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const [recruiters, setRecruiters] = useState<ExternalRecruiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    username: '',
    password: '',
    companyId: user?.companyId || '',
  });
  const [saving, setSaving] = useState(false);
  const canManage = canAccessModule(user, 'recruiters');

  const load = async () => {
    setLoading(true);
    try {
      const data = await externalApi.recruiters(companyId || undefined);
      setRecruiters(data.clerks || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load recruiters');
      setRecruiters([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await externalApi.createRecruiter(form);
      toast.success('Recruiter created');
      setShowForm(false);
      setForm({
        name: '',
        email: '',
        mobile: '',
        username: '',
        password: '',
        companyId: user?.companyId || '',
      });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create recruiter');
    } finally {
      setSaving(false);
    }
  };

  const detailQuery = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">Recruiters</h1>
          <p className="mt-1 text-body">View recruiter details{canManage ? ' and edit when needed' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="np-btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
          {canManage && (
            <button type="button" className="np-btn-primary" onClick={() => setShowForm(!showForm)}>
              <Plus className="mr-2 h-4 w-4" />
              Create recruiter
            </button>
          )}
        </div>
      </div>

      {user?.isPlatformAdmin && (
        <div className="np-card p-4">
          <select className="np-input max-w-xs" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Current company context</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {showForm && canManage && (
        <form onSubmit={handleCreate} className="np-card space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              className="np-input"
              placeholder="Name *"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="np-input"
              placeholder="Email *"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              className="np-input"
              placeholder="Mobile"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            />
            <input
              className="np-input"
              placeholder="Username *"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <input
              className="np-input"
              type="password"
              placeholder="Password * (min 6)"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button type="submit" className="np-btn-primary" disabled={saving}>
            {saving ? 'Creating...' : 'Create via API'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-body">Loading recruiters...</p>
      ) : recruiters.length === 0 ? (
        <div className="np-card p-8 text-center text-body">No recruiters found</div>
      ) : (
        <div className="overflow-x-auto np-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-body">
                <th className="p-4">Name</th>
                <th className="p-4">Username</th>
                <th className="p-4">Email</th>
                <th className="p-4">Mobile</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recruiters.map((r, i) => {
                const username = String(r.username || '');
                return (
                  <tr key={username || i} className="border-b border-border">
                    <td className="p-4 font-medium text-heading">{String(r.name || '—')}</td>
                    <td className="p-4">{username || '—'}</td>
                    <td className="p-4">{String(r.email || '—')}</td>
                    <td className="p-4">{String(r.mobile || r.phone || '—')}</td>
                    <td className="p-4">
                      {username ? (
                        <Link
                          to={`/recruiters/${encodeURIComponent(username)}${detailQuery}`}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Link>
                      ) : (
                        <span className="text-body">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function RecruiterDetailPage() {
  const { username: rawUsername } = useParams<{ username: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const username = rawUsername ? decodeURIComponent(rawUsername) : '';
  const companyId = searchParams.get('companyId') || '';
  const canManage = canAccessModule(user, 'recruiters');

  const [recruiter, setRecruiter] = useState<ExternalRecruiter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    externalApi
      .getRecruiter(username, companyId || undefined)
      .then((data) => setRecruiter(data.clerk))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to load recruiter');
        setRecruiter(null);
      })
      .finally(() => setLoading(false));
  }, [username, companyId]);

  const listPath = companyId ? `/recruiters?companyId=${encodeURIComponent(companyId)}` : '/recruiters';
  const editPath = `/recruiters/${encodeURIComponent(username)}/edit${
    companyId ? `?companyId=${encodeURIComponent(companyId)}` : ''
  }`;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!recruiter) {
    return (
      <div className="space-y-4">
        <Link to={listPath} className="inline-flex items-center gap-2 text-sm text-body hover:text-heading">
          <ArrowLeft className="h-4 w-4" />
          Back to Recruiters
        </Link>
        <p className="text-body">Recruiter not found</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm text-body hover:text-heading"
          onClick={() => navigate(listPath)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Recruiters
        </button>
        {canManage && (
          <Link to={editPath} className="np-btn-primary !py-2 text-sm">
            <Pencil className="mr-2 h-4 w-4" />
            Edit Recruiter
          </Link>
        )}
      </div>

      <div className="np-card p-6 md:p-8">
        <div className="mb-6 flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-heading">Recruiter Information</h1>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <InfoRow icon={User} label="Full Name" value={String(recruiter.name || '—')} />
          <InfoRow icon={Mail} label="Email" value={String(recruiter.email || '—')} />
          <InfoRow icon={AtSign} label="Username" value={String(recruiter.username || '—')} />
          <InfoRow
            icon={Phone}
            label="Mobile"
            value={String(recruiter.mobile || recruiter.phone || '—')}
          />
        </div>
      </div>
    </div>
  );
}

export function RecruiterEditPage() {
  const { username: rawUsername } = useParams<{ username: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const username = rawUsername ? decodeURIComponent(rawUsername) : '';
  const companyId = searchParams.get('companyId') || '';
  const canManage = canAccessModule(user, 'recruiters');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', mobile: '' });
  const [newPassword, setNewPassword] = useState('');

  const detailPath = `/recruiters/${encodeURIComponent(username)}${
    companyId ? `?companyId=${encodeURIComponent(companyId)}` : ''
  }`;

  useEffect(() => {
    if (!canManage) {
      toast.error('You do not have permission to edit recruiters');
      navigate(detailPath, { replace: true });
      return;
    }
    if (!username) return;

    setLoading(true);
    externalApi
      .getRecruiter(username, companyId || undefined)
      .then((data) => {
        setForm({
          name: String(data.clerk.name || ''),
          email: String(data.clerk.email || ''),
          mobile: String(data.clerk.mobile || data.clerk.phone || ''),
        });
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to load recruiter');
        navigate('/recruiters', { replace: true });
      })
      .finally(() => setLoading(false));
  }, [username, companyId, canManage]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await externalApi.updateRecruiter({
        username,
        companyId: companyId || undefined,
        data: {
          name: form.name.trim(),
          email: form.email.trim(),
          mobile: form.mobile.trim(),
        },
      });
      toast.success('Recruiter updated');
      navigate(detailPath);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update recruiter');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setChangingPassword(true);
    try {
      await externalApi.updateRecruiter({
        username,
        companyId: companyId || undefined,
        data: { password: newPassword },
      });
      toast.success('Password updated');
      setNewPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to={detailPath} className="inline-flex items-center gap-2 text-sm text-body hover:text-heading">
        <ArrowLeft className="h-4 w-4" />
        Back to Details
      </Link>

      <form onSubmit={handleSaveProfile} className="np-card space-y-5 p-6 md:p-8">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-heading">Edit Recruiter Information</h1>
        </div>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-heading">Full Name</span>
          <input
            className="np-input"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-heading">Email</span>
          <input
            className="np-input"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-heading">Mobile</span>
          <input
            className="np-input"
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-heading">Username</span>
          <input className="np-input bg-muted" value={username} disabled readOnly />
          <span className="mt-1 block text-xs text-body">Username cannot be changed.</span>
        </label>

        <button type="submit" className="np-btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>

      <form onSubmit={handleChangePassword} className="np-card space-y-4 p-6 md:p-8">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-heading">Change Password</h2>
        </div>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-heading">New Password</span>
          <input
            className="np-input"
            type="password"
            placeholder="Enter new password"
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <span className="mt-1 block text-xs text-body">Password must be at least 6 characters.</span>
        </label>
        <button
          type="submit"
          className="np-btn-secondary"
          disabled={changingPassword || newPassword.length < 6}
        >
          {changingPassword ? 'Updating…' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-body">{label}</p>
        <p className="mt-0.5 break-all text-sm font-medium text-heading">{value}</p>
      </div>
    </div>
  );
}
