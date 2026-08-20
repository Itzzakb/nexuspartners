import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { salaryApi } from '@/lib/api';
import { toast } from '@/lib/toast';
import type { SalaryDashboardRow } from '@/types/phase6';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

function toDateInput(value: string | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value.slice(0, 10);
}

type SalaryDetailModalProps = {
  open: boolean;
  row: SalaryDashboardRow | null;
  year: number;
  month: number;
  companyId?: string;
  currency?: string;
  password: string;
  onClose: () => void;
  onSaved: () => void;
};

export function SalaryDetailModal({
  open,
  row,
  year,
  month,
  companyId,
  currency,
  password,
  onClose,
  onSaved,
}: SalaryDetailModalProps) {
  const [form, setForm] = useState({
    monthlySalary: '',
    effectiveFrom: '',
    allowedLeaves: '0',
    status: 'active' as 'active' | 'discontinued',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const hasRecord = !!row?.salaryId;

  useEffect(() => {
    if (!open || !row) return;
    setForm({
      monthlySalary: row.salaryId ? String(row.monthlySalary) : '',
      effectiveFrom: toDateInput(row.startDate),
      allowedLeaves: String(row.allowedLeaves ?? 0),
      status: row.status === 'discontinued' ? 'discontinued' : 'active',
      notes: row.notes || '',
    });
  }, [open, row]);

  if (!open || !row) return null;

  const monthLabel = MONTH_SHORT[month - 1];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await salaryApi.upsert({
        employeeKey: row.employeeKey,
        monthlySalary: Math.round(Number(form.monthlySalary)),
        effectiveFrom: form.effectiveFrom,
        allowedLeaves: Math.max(0, Number(form.allowedLeaves) || 0),
        status: form.status,
        notes: form.notes,
        currency: row.currency || currency,
        companyId,
        password,
      });
      toast.success(hasRecord ? 'Salary updated' : 'Salary saved');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save salary');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        className="np-card max-h-[90vh] w-full max-w-lg overflow-y-auto space-y-4 p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg text-heading">{row.name}</h2>
            <p className="text-sm text-body">{row.email || '—'}</p>
          </div>
          <button
            type="button"
            className="rounded p-1 text-body hover:bg-muted"
            onClick={onClose}
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {hasRecord && row.category === 'with_salary' && (
          <div className="grid gap-3 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-body">Leaves ({monthLabel})</p>
              <p className="font-medium text-heading">{row.leaveDays} days</p>
            </div>
            <div>
              <p className="text-body">Expected</p>
              <p className="font-medium text-emerald-700">{formatMoney(row.expected, row.currency)}</p>
            </div>
            <div>
              <p className="text-body">Actual</p>
              <p className="font-medium text-primary">{formatMoney(row.actual, row.currency)}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-body">Monthly salary</label>
              <input
                className="np-input"
                type="number"
                min={0}
                required
                value={form.monthlySalary}
                onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-body">Start date</label>
              <input
                className="np-input"
                type="date"
                required
                value={form.effectiveFrom}
                onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-body">Allowed leaves (per month)</label>
              <input
                className="np-input"
                type="number"
                min={0}
                value={form.allowedLeaves}
                onChange={(e) => setForm({ ...form, allowedLeaves: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-body">Status</label>
              <select
                className="np-input"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as 'active' | 'discontinued' })
                }
              >
                <option value="active">Active</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-body">Notes (optional)</label>
            <textarea
              className="np-input min-h-[72px] resize-y"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="np-btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="np-btn-primary" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : hasRecord ? (
                'Update salary'
              ) : (
                'Save salary'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
