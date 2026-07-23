import { useEffect, useState } from 'react';
import { Calendar, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { salaryApi, userApi } from '@/lib/api';
import type { EmployeeSalary, EmployeeLeave } from '@/types/phase6';
import type { User } from '@/lib/api';
import { toast } from '@/lib/toast';

export default function Salaries() {
  const { user, company } = useAuth();
  const { companies } = useCompanies();
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [salaries, setSalaries] = useState<EmployeeSalary[]>([]);
  const [leaves, setLeaves] = useState<EmployeeLeave[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tab, setTab] = useState<'salaries' | 'leaves'>('salaries');
  const [form, setForm] = useState({ userId: '', monthlySalary: '', notes: '' });
  const [leaveForm, setLeaveForm] = useState({ userId: '', startDate: '', endDate: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const params: Record<string, string> = {};
    if (companyId) params.companyId = companyId;
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;

    const [salaryData, leaveData, userData] = await Promise.all([
      salaryApi.list(params),
      salaryApi.listLeaves(params),
      userApi.list(companyId || undefined),
    ]);
    setSalaries(salaryData.salaries);
    setLeaves(leaveData.leaves);
    setUsers(userData.users);
  };

  useEffect(() => {
    if (unlocked) load().catch(() => {});
  }, [unlocked, companyId, dateFrom, dateTo]);

  const hasDateFilter = Boolean(dateFrom || dateTo);

  const applyDatePreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days + 1);
    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(to.toISOString().slice(0, 10));
  };

  const clearDateFilter = () => {
    setDateFrom('');
    setDateTo('');
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await salaryApi.verifyPassword(password);
      setUnlocked(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid password');
    }
  };

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await salaryApi.upsert({
        userId: form.userId,
        monthlySalary: Math.round(Number(form.monthlySalary)),
        notes: form.notes,
        currency: company?.salaryCurrency,
        companyId: companyId || undefined,
        password,
      });
      setForm({ userId: '', monthlySalary: '', notes: '' });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await salaryApi.createLeave({
        userId: leaveForm.userId,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason,
        companyId: companyId || undefined,
      });
      setLeaveForm({ userId: '', startDate: '', endDate: '', reason: '' });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create leave');
    } finally {
      setSaving(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-md space-y-6 pt-12">
        <div className="text-center">
          <Lock className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-3xl">Salaries</h1>
          <p className="mt-1 text-body">Enter the salaries password to continue</p>
        </div>
        <form onSubmit={handleUnlock} className="np-card space-y-4 p-6">
          <input className="np-input" type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" className="np-btn-primary w-full">Unlock</button>
        </form>
      </div>
    );
  }

  const formatSalary = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Salaries</h1>
        <p className="mt-1 text-body">Employee salaries and leave management</p>
      </div>

      {user?.isPlatformAdmin && (
        <select className="np-input max-w-xs" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">All companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      <div className="flex gap-2">
        <button type="button" className={tab === 'salaries' ? 'np-btn-primary' : 'np-btn-secondary'}
          onClick={() => setTab('salaries')}>Salaries</button>
        <button type="button" className={tab === 'leaves' ? 'np-btn-primary' : 'np-btn-secondary'}
          onClick={() => setTab('leaves')}>Leaves</button>
      </div>

      <div className="np-card space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-heading">
            <Calendar className="h-4 w-4 text-primary" />
            Date range
          </div>
          <div>
            <label className="mb-1 block text-xs text-body">From</label>
            <input
              type="date"
              className="np-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-body">To</label>
            <input
              type="date"
              className="np-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="np-btn-secondary text-xs" onClick={() => applyDatePreset(7)}>
              Last 7 days
            </button>
            <button type="button" className="np-btn-secondary text-xs" onClick={() => applyDatePreset(30)}>
              Last 30 days
            </button>
            {hasDateFilter && (
              <button type="button" className="np-btn-secondary text-xs" onClick={clearDateFilter}>
                Clear dates
              </button>
            )}
          </div>
        </div>
        {hasDateFilter && (
          <p className="text-sm text-body">
            {tab === 'salaries'
              ? `Showing salaries with effective from (or created date) between ${dateFrom || '…'} and ${dateTo || '…'}.`
              : `Showing leaves that overlap ${dateFrom || '…'} to ${dateTo || '…'}.`}
            {' '}
            <span className="font-medium text-heading">
              {tab === 'salaries' ? salaries.length : leaves.length} result
              {(tab === 'salaries' ? salaries.length : leaves.length) === 1 ? '' : 's'}
            </span>
          </p>
        )}
      </div>

      {tab === 'salaries' ? (
        <>
          <form onSubmit={handleSaveSalary} className="np-card grid gap-4 p-6 sm:grid-cols-2">
            <select className="np-input" required value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              <option value="">Select employee</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <input className="np-input" type="number" placeholder="Monthly salary" required
              value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })} />
            <input className="np-input sm:col-span-2" placeholder="Notes" value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <button type="submit" className="np-btn-primary" disabled={saving}>Save salary</button>
          </form>

          <div className="overflow-x-auto np-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-body">
                  <th className="p-4">Employee</th>
                  <th className="p-4">Salary</th>
                  <th className="p-4">Effective from</th>
                  <th className="p-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {salaries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-body">
                      {hasDateFilter ? 'No salaries found for this date range.' : 'No salary records yet.'}
                    </td>
                  </tr>
                ) : (
                  salaries.map((s) => (
                    <tr key={s.id} className="border-b border-border">
                      <td className="p-4">{s.userName}</td>
                      <td className="p-4">{formatSalary(s.monthlySalary, s.currency)}</td>
                      <td className="p-4">{s.effectiveFrom ? new Date(s.effectiveFrom).toLocaleDateString() : '—'}</td>
                      <td className="p-4 text-body">{s.notes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <form onSubmit={handleCreateLeave} className="np-card grid gap-4 p-6 sm:grid-cols-2">
            <select className="np-input" required value={leaveForm.userId}
              onChange={(e) => setLeaveForm({ ...leaveForm, userId: e.target.value })}>
              <option value="">Select employee</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <input type="date" className="np-input" required value={leaveForm.startDate}
              onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} />
            <input type="date" className="np-input" required value={leaveForm.endDate}
              onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} />
            <input className="np-input" placeholder="Reason" value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
            <button type="submit" className="np-btn-primary" disabled={saving}>Add leave</button>
          </form>

          <div className="overflow-x-auto np-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-body">
                  <th className="p-4">Employee</th>
                  <th className="p-4">Dates</th>
                  <th className="p-4">Days</th>
                  <th className="p-4">Status</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {leaves.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-body">
                      {hasDateFilter ? 'No leaves found for this date range.' : 'No leave records yet.'}
                    </td>
                  </tr>
                ) : (
                  leaves.map((l) => (
                    <tr key={l.id} className="border-b border-border">
                      <td className="p-4">{l.userName}</td>
                      <td className="p-4">
                        {new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()}
                      </td>
                      <td className="p-4">{l.days}</td>
                      <td className="p-4">{l.status}</td>
                      <td className="p-4">
                        {l.status === 'pending' && (
                          <button type="button" className="text-sm text-primary"
                            onClick={() => salaryApi.updateLeave(l.id, { status: 'approved' }).then(load)}>
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
