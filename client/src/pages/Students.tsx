import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { studentApi } from '@/lib/api';
import type { StudentListItem } from '@/types/phase7';

export default function Students() {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState('');
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', mobile: '', email: '', password: '' });

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (companyId) params.companyId = companyId;
      if (query.trim()) params.q = query.trim();
      const data = await studentApi.list(params);
      setStudents(data.students);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return students;
    const q = query.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [students, query]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await studentApi.create({
        ...form,
        companyId: companyId || undefined,
      });
      setMessage('Student created successfully');
      setShowCreate(false);
      setForm({ name: '', mobile: '', email: '', password: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create student');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">All Students</h1>
          <p className="mt-1 text-body">Browse and manage students from Nexus Partners</p>
        </div>
        <button type="button" className="np-btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Student
        </button>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="np-card p-4">
        <div className="flex flex-wrap gap-3">
          {user?.isPlatformAdmin && (
            <select
              className="np-input max-w-xs"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
            <input
              className="np-input pl-9"
              placeholder="Search by name, phone, or email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
          </div>
          <button type="button" className="np-btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="np-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-body">No students found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-body">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Payments</th>
                  <th className="px-4 py-3 font-medium">Subscription</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => (
                  <tr key={s.phone} className="transition hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium text-heading">{s.name}</td>
                    <td className="px-4 py-3 text-body">{s.phone}</td>
                    <td className="px-4 py-3 text-body">{s.email || '—'}</td>
                    <td className="px-4 py-3 text-body">{s.paymentCount}</td>
                    <td className="px-4 py-3">
                      {s.hasActiveSubscription ? (
                        <span className="rounded-pill bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="text-body">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/students/${encodeURIComponent(s.phone)}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleCreate} className="np-card w-full max-w-md space-y-4 p-6">
            <h2 className="text-lg">Create Student</h2>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">Name</label>
              <input
                className="np-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">Mobile</label>
              <input
                className="np-input"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
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
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="np-btn-primary" disabled={saving}>
                {saving ? 'Creating...' : 'Create'}
              </button>
              <button type="button" className="np-btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
