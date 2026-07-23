import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { studentApi } from '@/lib/api';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { StudentListItem, StudentListStats } from '@/types/phase7';

type StatusFilter = 'all' | 'active' | 'inactive' | 'suspended';

const emptyStats: StudentListStats = { all: 0, active: 0, inactive: 0, suspended: 0 };

export default function Students() {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [stats, setStats] = useState<StudentListStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState('');
  const [daysFilter, setDaysFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', mobile: '', email: '', password: '' });

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (companyId) params.companyId = companyId;
      const data = await studentApi.list(params);
      setStudents(data.students);
      setStats(
        data.stats || {
          all: data.students.length,
          active: data.students.filter((s) => (s.status || 'active') === 'active').length,
          inactive: data.students.filter((s) => s.status === 'inactive').length,
          suspended: data.students.filter((s) => s.status === 'suspended').length,
        }
      );
    } catch {
      setStudents([]);
      setStats(emptyStats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const roles = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      const role = (s.role || '').trim();
      if (role) set.add(role);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const dayOptions = useMemo(() => {
    const set = new Set<number>();
    students.forEach((s) => {
      const days = Number(s.subscriptionDays || 0);
      if (days > 0) set.add(days);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [students]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      const status = (s.status || 'active').toLowerCase();
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (roleFilter && (s.role || '') !== roleFilter) return false;
      if (daysFilter && String(s.subscriptionDays || 0) !== daysFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.recruiter || '').toLowerCase().includes(q) ||
        (s.role || '').toLowerCase().includes(q)
      );
    });
  }, [students, query, statusFilter, roleFilter, daysFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await studentApi.create({
        ...form,
        companyId: companyId || undefined,
      });
      toast.success('Student created successfully');
      setShowCreate(false);
      setForm({ name: '', mobile: '', email: '', password: '' });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create student');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold text-heading">All Students</h1>
        <button type="button" className="np-btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Student
        </button>
      </div>

      {/* Status summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="All Students"
          value={stats.all}
          active={statusFilter === 'all'}
          tone="primary"
          onClick={() => setStatusFilter('all')}
        />
        <StatCard
          label="Active"
          value={stats.active}
          active={statusFilter === 'active'}
          onClick={() => setStatusFilter('active')}
        />
        <StatCard
          label="Inactive"
          value={stats.inactive}
          active={statusFilter === 'inactive'}
          onClick={() => setStatusFilter('inactive')}
        />
        <StatCard
          label="Suspended"
          value={stats.suspended}
          active={statusFilter === 'suspended'}
          onClick={() => setStatusFilter('suspended')}
        />
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        {user?.isPlatformAdmin && (
          <select
            className="np-input max-w-[200px] bg-muted/40"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
          <input
            className="np-input bg-muted/40 pl-9"
            placeholder="Search name, email, phone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="np-input max-w-[180px] bg-muted/40"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All Roles</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <select
          className="np-input max-w-[140px] bg-muted/40"
          value={daysFilter}
          onChange={(e) => setDaysFilter(e.target.value)}
        >
          <option value="">All Days</option>
          {dayOptions.map((days) => (
            <option key={days} value={String(days)}>
              {days} Days
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="np-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-body">No students found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border text-xs font-medium uppercase tracking-wide text-body">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Resume</th>
                  <th className="px-4 py-3 font-medium">Recruiter</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => {
                  const status = (s.status || 'active').toLowerCase();
                  return (
                    <tr key={`${s.companyId}-${s.phone}`} className="transition hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <Link
                          to={`/students/${encodeURIComponent(s.phone)}`}
                          className="font-medium text-heading hover:text-primary"
                        >
                          {s.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-body">{s.email || '—'}</td>
                      <td className="px-4 py-3 text-body">{s.phone}</td>
                      <td className="px-4 py-3">
                        {s.role ? (
                          <span className="inline-flex rounded-pill bg-muted px-2.5 py-0.5 text-xs font-medium text-heading">
                            {s.role}
                          </span>
                        ) : (
                          <span className="text-body">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.hasResume ? (
                          <Link
                            to={`/students/${encodeURIComponent(s.phone)}`}
                            state={{ tab: 'resume' }}
                            className="inline-flex text-primary hover:text-primary-hover"
                            title="Open resume"
                          >
                            <FileText className="h-4 w-4" />
                          </Link>
                        ) : (
                          <span className="text-body">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-body">{s.recruiter || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={status} />
                      </td>
                    </tr>
                  );
                })}
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

function StatCard({
  label,
  value,
  active,
  tone = 'default',
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  tone?: 'primary' | 'default';
  onClick: () => void;
}) {
  const isPrimary = tone === 'primary' || active;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-card border px-4 py-4 text-left transition',
        isPrimary
          ? 'border-primary bg-primary text-white shadow-card'
          : 'border-border bg-surface text-heading hover:bg-muted/50'
      )}
    >
      <p
        className={cn(
          'text-xs font-semibold uppercase tracking-wide',
          isPrimary ? 'text-white/80' : 'text-body'
        )}
      >
        {label}
      </p>
      <p className={cn('mt-1 text-3xl font-semibold', isPrimary ? 'text-white' : 'text-heading')}>
        {value}
      </p>
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="inline-flex rounded-pill bg-primary px-2.5 py-0.5 text-xs font-medium capitalize text-white">
        Active
      </span>
    );
  }
  if (status === 'suspended') {
    return (
      <span className="inline-flex rounded-pill bg-amber-500 px-2.5 py-0.5 text-xs font-medium capitalize text-white">
        Suspended
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-pill bg-red-500 px-2.5 py-0.5 text-xs font-medium capitalize text-white">
      Inactive
    </span>
  );
}
