import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDisplay(from: string, to: string) {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (!a && !b) return 'Select date range';
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  if (a && b) {
    if (from === to) return a.toLocaleDateString(undefined, opts);
    return `${a.toLocaleDateString(undefined, opts)} – ${b.toLocaleDateString(undefined, opts)}`;
  }
  if (a) return `${a.toLocaleDateString(undefined, opts)} – …`;
  return 'Select date range';
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface DateRangeCalendarProps {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  className?: string;
  label?: string;
}

export function DateRangeCalendar({
  from,
  to,
  onChange,
  className,
  label = 'Scraped dates',
}: DateRangeCalendarProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = parseYmd(from) || parseYmd(to) || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [pickingStart, setPickingStart] = useState(true);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setDraftFrom(from);
      setDraftTo(to);
      setPickingStart(true);
    }
  }, [open, from, to]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const days = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ ymd: string; inMonth: boolean; date: number } | null> = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ ymd: toYmd(new Date(year, month, d)), inMonth: true, date: d });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [view]);

  const monthLabel = view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const hasRange = Boolean(from || to);

  const handleDayClick = (ymd: string) => {
    if (pickingStart || !draftFrom) {
      setDraftFrom(ymd);
      setDraftTo('');
      setPickingStart(false);
      return;
    }

    let nextFrom = draftFrom;
    let nextTo = ymd;
    if (ymd < draftFrom) {
      nextFrom = ymd;
      nextTo = draftFrom;
    }
    setDraftFrom(nextFrom);
    setDraftTo(nextTo);
    onChange({ from: nextFrom, to: nextTo });
    setPickingStart(true);
    setOpen(false);
  };

  const inRange = (ymd: string) => {
    const start = draftFrom || from;
    const end = draftTo || to;
    if (!start || !end) return false;
    return ymd >= start && ymd <= end;
  };

  const isEdge = (ymd: string) => {
    const start = draftFrom || from;
    const end = draftTo || to || draftFrom;
    return ymd === start || ymd === end;
  };

  return (
    <div className={cn('relative', className)} ref={rootRef}>
      {label && <label className="mb-1 block text-xs font-medium text-body">{label}</label>}
      <div className="flex gap-2">
        <button
          type="button"
          className={cn(
            'np-input flex flex-1 items-center gap-2 !py-2 text-left text-sm',
            !hasRange && 'text-body'
          )}
          onClick={() => setOpen((v) => !v)}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{formatDisplay(from, to)}</span>
        </button>
        {hasRange && (
          <button
            type="button"
            className="np-btn-secondary !px-3 !py-2"
            title="Clear dates"
            onClick={() => onChange({ from: '', to: '' })}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-[300px] rounded-xl border border-border bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="rounded-lg p-1.5 text-body hover:bg-muted"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-heading">{monthLabel}</p>
            <button
              type="button"
              className="rounded-lg p-1.5 text-body hover:bg-muted"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <p className="mb-2 text-xs text-body">
            {pickingStart || !draftFrom ? 'Select start date' : 'Select end date'}
          </p>

          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-body">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((cell, i) => {
              if (!cell) return <div key={`e-${i}`} />;
              const selected = isEdge(cell.ymd);
              const ranged = inRange(cell.ymd);
              return (
                <button
                  key={cell.ymd}
                  type="button"
                  onClick={() => handleDayClick(cell.ymd)}
                  className={cn(
                    'relative h-9 rounded-lg text-sm transition-colors',
                    ranged && !selected && 'bg-primary/10 text-heading',
                    selected && 'bg-primary font-semibold text-white',
                    !selected && !ranged && 'text-heading hover:bg-muted'
                  )}
                >
                  {cell.date}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
