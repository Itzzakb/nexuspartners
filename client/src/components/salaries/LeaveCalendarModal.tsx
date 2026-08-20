import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { salaryApi } from '@/lib/api';
import { calculateMonthlyPayout, daysInMonth, getPayableDaysInMonth } from '@/lib/salaryCalculation';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { SalaryDashboardRow } from '@/types/phase6';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonthLocal(year: number, month: number) {
  return daysInMonth(year, month);
}

function padDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

type LeaveCalendarModalProps = {
  open: boolean;
  row: SalaryDashboardRow | null;
  year: number;
  month: number;
  companyId?: string;
  onClose: () => void;
  onSaved: () => void;
};

export function LeaveCalendarModal({
  open,
  row,
  year,
  month,
  companyId,
  onClose,
  onSaved,
}: LeaveCalendarModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    setLoading(true);
    salaryApi
      .getMonthlyLeave({ employeeKey: row.employeeKey, year, month, companyId })
      .then((data) => setSelected(data.monthlyLeave.leaveDates || []))
      .catch(() => setSelected(row.leaveDates || []))
      .finally(() => setLoading(false));
  }, [open, row, year, month, companyId]);

  const period = useMemo(
    () => getPayableDaysInMonth({ effectiveFrom: row?.startDate, year, month }),
    [row?.startDate, year, month]
  );

  const calendarCells = useMemo(() => {
    const total = daysInMonthLocal(year, month);
    const firstDow = new Date(year, month - 1, 1).getDay();
    const cells: Array<{ day: number | null; iso: string | null; disabled?: boolean }> = [];
    for (let i = 0; i < firstDow; i++) cells.push({ day: null, iso: null });
    for (let d = 1; d <= total; d++) {
      const disabled =
        period.notStarted ||
        (period.startDay != null && period.isPartialMonth && d < period.startDay);
      cells.push({ day: d, iso: padDate(year, month, d), disabled });
    }
    return cells;
  }, [year, month, period]);

  const preview = useMemo(() => {
    if (!row || !row.monthlySalary) return null;
    const calc = calculateMonthlyPayout({
      monthlySalary: row.monthlySalary,
      allowedLeaves: row.allowedLeaves,
      leaveDates: selected,
      effectiveFrom: row.startDate,
      year,
      month,
    });
    return calc;
  }, [row, selected, year, month]);

  if (!open || !row) return null;

  const toggleDay = (iso: string, disabled?: boolean) => {
    if (disabled) return;
    setSelected((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort()
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await salaryApi.saveMonthlyLeave({
        employeeKey: row.employeeKey,
        year,
        month,
        leaveDates: selected,
        companyId,
      });
      toast.success('Leave days updated');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save leave days');
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
        className="np-card w-full max-w-md space-y-4 p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg text-heading">{row.name}</h2>
            <p className="text-sm text-body">
              {MONTH_NAMES[month - 1]} {year} · Allowed leaves: {row.allowedLeaves}
              {period.isPartialMonth && period.startDay != null && (
                <> · Payable from day {period.startDay}</>
              )}
            </p>
          </div>
          <button type="button" className="rounded p-1 hover:bg-muted" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-body">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((cell, idx) =>
                cell.day == null ? (
                  <div key={`empty-${idx}`} />
                ) : (
                  <button
                    key={cell.iso!}
                    type="button"
                    disabled={cell.disabled}
                    onClick={() => toggleDay(cell.iso!, cell.disabled)}
                    className={cn(
                      'aspect-square rounded-lg text-sm transition',
                      cell.disabled && 'cursor-not-allowed opacity-40',
                      !cell.disabled && selected.includes(cell.iso!)
                        ? 'bg-primary font-medium text-white'
                        : !cell.disabled && 'bg-muted text-heading hover:bg-muted/80'
                    )}
                  >
                    {cell.day}
                  </button>
                )
              )}
            </div>

            {preview && (
              <div className="rounded-lg bg-muted/60 p-3 text-sm text-body">
                {preview.isPartialMonth && (
                  <p className="mb-1">
                    Base ({preview.payableDays} payable days):{' '}
                    <strong className="text-heading">
                      {new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: row.currency || 'INR',
                        maximumFractionDigits: 0,
                      }).format(preview.baseSalary)}
                    </strong>
                  </p>
                )}
                <p>
                  Selected: <strong className="text-heading">{preview.leaveDays} days</strong>
                  {preview.deductibleDays > 0 && (
                    <>
                      {' '}
                      · Deductible:{' '}
                      <strong className="text-red-600">{preview.deductibleDays} days</strong>
                    </>
                  )}
                </p>
                <p className="mt-1">
                  Expected this month:{' '}
                  <strong className="text-emerald-700">
                    {new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: row.currency || 'INR',
                      maximumFractionDigits: 0,
                    }).format(preview.expected)}
                  </strong>
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" className="np-btn-secondary" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="np-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save leave days'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export { MONTH_NAMES };
