import { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { externalApi } from '@/lib/api';
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
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await externalApi.recruiters(companyId || undefined);
      setRecruiters(data.clerks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recruiters');
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
    setError('');
    try {
      await externalApi.createRecruiter(form);
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
      setError(err instanceof Error ? err.message : 'Failed to create recruiter');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">Recruiters</h1>
          <p className="mt-1 text-body">View and create recruiters via Nexus Partners API</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="np-btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
          {(user?.isCompanyAdmin || user?.isPlatformAdmin) && (
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
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="np-card space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <input className="np-input" placeholder="Name *" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="np-input" placeholder="Email *" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="np-input" placeholder="Mobile" value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            <input className="np-input" placeholder="Username *" required value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <input className="np-input" type="password" placeholder="Password *" required value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
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
              <tr className="border-b border-border text-left text-body">
                <th className="p-4">Name</th>
                <th className="p-4">Username</th>
                <th className="p-4">Email</th>
                <th className="p-4">Mobile</th>
              </tr>
            </thead>
            <tbody>
              {recruiters.map((r, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="p-4 font-medium text-heading">{(r.name as string) || '—'}</td>
                  <td className="p-4">{(r.username as string) || '—'}</td>
                  <td className="p-4">{(r.email as string) || '—'}</td>
                  <td className="p-4">{(r.mobile as string) || (r.phone as string) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
