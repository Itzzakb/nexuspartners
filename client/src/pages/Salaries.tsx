import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Plus,
  Search,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { salaryApi } from '@/lib/api';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { SalaryAddModal } from '@/components/salaries/SalaryAddModal';
import { SalaryDetailModal } from '@/components/salaries/SalaryDetailModal';
import { LeaveCalendarModal, MONTH_NAMES } from '@/components/salaries/LeaveCalendarModal';
import type {
  SalaryDashboardRow,
  SalaryDashboardStats,
  SalaryEmployee,
  SalaryRowCategory,
} from '@/types/phase6';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatStartDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Salaries() {
  const { user, company } = useAuth();
  const { companies } = useCompanies();
  const now = new Date();

  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SalaryRowCategory>('with_salary');
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState('INR');
  const [stats, setStats] = useState<SalaryDashboardStats | null>(null);
  const [rows, setRows] = useState<SalaryDashboardRow[]>([]);
  const [employees, setEmployees] = useState<SalaryEmployee[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [detailRow, setDetailRow] = useState<SalaryDashboardRow | null>(null);
  const [leaveRow, setLeaveRow] = useState<SalaryDashboardRow | null>(null);

  const effectiveCompanyId = user?.isPlatformAdmin ? companyId || undefined : undefined;

  const load = useCallback(async () => {
    if (!unlocked) return;
    setLoading(true);
    try {
      const [dashboard, employeeData] = await Promise.all([
        salaryApi.dashboard({ year, month, companyId: effectiveCompanyId }),
        salaryApi.listEmployees(effectiveCompanyId),
      ]);
      setStats(dashboard.stats);
      setRows(dashboard.rows);
      setCurrency(dashboard.currency);
      setEmployees(employeeData.employees);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load salaries');
    } finally {
      setLoading(false);
    }
  }, [unlocked, year, month, effectiveCompanyId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.category !== tab) return false;
      if (!q) return true;
      return `${row.name} ${row.email}`.toLowerCase().includes(q);
    });
  }, [rows, tab, query]);

  const tabCounts = useMemo(
    () => ({
      with_salary: rows.filter((r) => r.category === 'with_salary').length,
      no_salary: rows.filter((r) => r.category === 'no_salary').length,
      discontinued: rows.filter((r) => r.category === 'discontinued').length,
    }),
    [rows]
  );

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    setMonth(m);
    setYear(y);
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

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-md space-y-6 pt-12">
        <div className="text-center">
          <Lock className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-3xl">Salaries</h1>
          <p className="mt-1 text-body">Employee salary management</p>
        </div>
        <form onSubmit={handleUnlock} className="np-card space-y-4 p-6">
          <input
            className="np-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="np-btn-primary w-full">
            Unlock
          </button>
        </form>
      </div>
    );
  }

  const monthLabel = MONTH_SHORT[month - 1];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl text-heading">Salaries</h1>
          <p className="mt-1 text-body">Employee salary management</p>
        </div>
        <button type="button" className="np-btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Salary
        </button>
      </div>

      {user?.isPlatformAdmin && (
        <select
          className="np-input max-w-xs"
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

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Employees', value: stats?.totalEmployees ?? 0 },
          { label: 'No Salary Set', value: stats?.noSalarySet ?? 0 },
          { label: `Expected (${monthLabel})`, value: formatMoney(stats?.expectedTotal ?? 0, currency) },
          { label: `Actual (${monthLabel})`, value: formatMoney(stats?.actualTotal ?? 0, currency) },
        ].map((card) => (
          <div key={card.label} className="np-card p-5">
            <p className="text-sm text-body">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-heading">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Search + month controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
          <input
            className="np-input pl-9"
            placeholder="Search by name or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="np-btn-secondary !px-2" onClick={() => shiftMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <select
            className="np-input"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
          <select className="np-input w-24" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button type="button" className="np-btn-secondary !px-2" onClick={() => shiftMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-1">
        {(
          [
            ['with_salary', `With Salary (${tabCounts.with_salary})`],
            ['no_salary', `No Salary Set (${tabCounts.no_salary})`],
            ['discontinued', `Discontinued (${tabCounts.discontinued})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={cn(
              'rounded-t-lg px-4 py-2 text-sm font-medium transition',
              tab === key
                ? 'border border-b-0 border-border bg-surface text-heading'
                : 'text-body hover:text-heading'
            )}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto np-card">
        {loading ? (
          <p className="p-10 text-center text-body">Loading…</p>
        ) : filteredRows.length === 0 ? (
          <p className="p-10 text-center text-body">No employees in this tab.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-body">
                <th className="p-4 font-medium">Employee</th>
                {tab === 'with_salary' && (
                  <>
                    <th className="p-4 font-medium">Start Date</th>
                    <th className="p-4 font-medium">Monthly Salary</th>
                    <th className="p-4 font-medium">Leaves</th>
                    <th className="p-4 font-medium">Expected</th>
                    <th className="p-4 font-medium">Actual</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.employeeKey} className="border-b border-border last:border-0">
                  <td className="p-4">
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => setDetailRow(row)}
                    >
                      <p className="font-medium text-heading transition hover:text-primary hover:underline">
                        {row.name}
                      </p>
                      <p className="text-xs text-body">{row.email || '—'}</p>
                    </button>
                  </td>
                  {tab === 'with_salary' && (
                    <>
                      <td className="p-4 text-body">{formatStartDate(row.startDate)}</td>
                      <td className="p-4">{formatMoney(row.monthlySalary, row.currency)}</td>
                      <td className="p-4">
                        <button
                          type="button"
                          className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-heading transition hover:bg-primary/10 hover:text-primary"
                          onClick={() => setLeaveRow(row)}
                        >
                          {row.leaveDays} {row.leaveDays === 1 ? 'day' : 'days'}
                        </button>
                      </td>
                      <td className="p-4 font-medium text-emerald-700">
                        {formatMoney(row.expected, row.currency)}
                      </td>
                      <td className="p-4 font-medium text-primary">
                        {formatMoney(row.actual, row.currency)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SalaryAddModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        employees={employees}
        companyId={effectiveCompanyId}
        currency={company?.salaryCurrency || currency}
        password={password}
        onSaved={load}
      />

      <SalaryDetailModal
        open={!!detailRow}
        row={detailRow}
        year={year}
        month={month}
        companyId={effectiveCompanyId}
        currency={company?.salaryCurrency || currency}
        password={password}
        onClose={() => setDetailRow(null)}
        onSaved={load}
      />

      <LeaveCalendarModal
        open={!!leaveRow}
        row={leaveRow}
        year={year}
        month={month}
        companyId={effectiveCompanyId}
        onClose={() => setLeaveRow(null)}
        onSaved={load}
      />
    </div>
  );
}
