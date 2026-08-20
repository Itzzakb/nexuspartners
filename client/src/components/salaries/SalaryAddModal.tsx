import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { salaryApi } from '@/lib/api';
import { toast } from '@/lib/toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import type { SalaryEmployee } from '@/types/phase6';

type SalaryAddModalProps = {
  open: boolean;
  onClose: () => void;
  employees: SalaryEmployee[];
  companyId?: string;
  currency?: string;
  password: string;
  onSaved: () => void;
};

export function SalaryAddModal({
  open,
  onClose,
  employees,
  companyId,
  currency,
  password,
  onSaved,
}: SalaryAddModalProps) {
  const [form, setForm] = useState({
    employeeKey: '',
    monthlySalary: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    allowedLeaves: '0',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        employeeKey: '',
        monthlySalary: '',
        effectiveFrom: new Date().toISOString().slice(0, 10),
        allowedLeaves: '0',
        notes: '',
      });
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeKey) {
      toast.error('Select an employee');
      return;
    }
    setSaving(true);
    try {
      await salaryApi.upsert({
        employeeKey: form.employeeKey,
        monthlySalary: Math.round(Number(form.monthlySalary)),
        effectiveFrom: form.effectiveFrom,
        allowedLeaves: Math.max(0, Number(form.allowedLeaves) || 0),
        notes: form.notes,
        currency,
        companyId,
        password,
      });
      toast.success('Salary saved');
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
        className="np-card w-full max-w-lg space-y-4 p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg text-heading">Add salary</h2>
            <p className="text-sm text-body">Set monthly salary and allowed leaves for an employee</p>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-body">Employee</label>
            <SearchableSelect
              options={employees.map((emp) => ({ value: emp.key, label: emp.label }))}
              value={form.employeeKey}
              onChange={(employeeKey) => setForm({ ...form, employeeKey })}
              placeholder="Select employee"
              emptyLabel="Select employee"
              searchPlaceholder="Search employees…"
            />
          </div>
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
          <div>
            <label className="mb-1 block text-sm text-body">Allowed leaves (per month)</label>
            <input
              className="np-input"
              type="number"
              min={0}
              value={form.allowedLeaves}
              onChange={(e) => setForm({ ...form, allowedLeaves: e.target.value })}
            />
            <p className="mt-1 text-xs text-body">
              Extra leave days beyond this count will reduce the expected salary for that month.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm text-body">Notes (optional)</label>
            <input
              className="np-input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="np-btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="np-btn-primary" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save salary'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
