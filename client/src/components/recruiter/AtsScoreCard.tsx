import { CheckCircle2, RefreshCw, Target, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AtsLibraryEntry {
  id?: string;
  atsScore?: number | null;
  atsSummary?: string;
  atsImprovements?: string[];
  atsMeetsTarget?: boolean;
  atsTargetScore?: number;
}

interface AtsScoreCardProps {
  entry: AtsLibraryEntry | null;
  refreshing?: boolean;
  onReFix?: () => void;
  className?: string;
}

export function AtsScoreCard({ entry, refreshing, onReFix, className }: AtsScoreCardProps) {
  if (!entry || entry.atsScore == null) return null;

  const score = Number(entry.atsScore);
  const target = entry.atsTargetScore ?? 90;
  const meets = entry.atsMeetsTarget ?? score >= target;
  const improvements = (entry.atsImprovements || []).filter(Boolean);
  const pct = Math.max(0, Math.min(100, score));

  return (
    <div className={cn('rounded-xl border border-border bg-muted/40 p-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-body">ATS Score</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-heading">{score}</span>
            <span className="text-sm text-body">/ 100</span>
          </div>
          <p className="mt-1 text-xs text-body">Target: {target}+</p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
            meets ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          )}
        >
          {meets ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {meets ? 'Meets target' : `Needs ${target}+`}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
        <div
          className={cn('h-full rounded-full transition-all', meets ? 'bg-green-500' : 'bg-amber-500')}
          style={{ width: `${pct}%` }}
        />
      </div>

      {entry.atsSummary && (
        <p className="mt-3 text-sm text-body">{entry.atsSummary}</p>
      )}

      {!meets && improvements.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-heading">
            <Target className="h-4 w-4 text-primary" />
            What to improve
          </p>
          <ul className="space-y-2">
            {improvements.map((item, i) => (
              <li
                key={`${i}-${item.slice(0, 24)}`}
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-heading"
              >
                {item}
              </li>
            ))}
          </ul>
          {onReFix && (
            <button
              type="button"
              className="np-btn-primary mt-4 !py-2 text-sm"
              disabled={refreshing}
              onClick={onReFix}
            >
              <RefreshCw className={`mr-2 inline h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Re-fixing…' : 'Re-fix with improvements'}
            </button>
          )}
        </div>
      )}

      {meets && improvements.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-body">Optional polish</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-body">
            {improvements.map((item, i) => (
              <li key={`${i}-${item.slice(0, 24)}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
