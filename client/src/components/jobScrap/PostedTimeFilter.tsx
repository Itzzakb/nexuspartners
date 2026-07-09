import { cn } from '@/lib/utils';
import type { PostedFilterMode } from '@/types/jobScrap';

const HOUR_PRESETS = [12, 24, 36, 48, 72];

interface PostedTimeFilterProps {
  mode: PostedFilterMode;
  onModeChange: (mode: PostedFilterMode) => void;
  hours: number;
  onHoursChange: (hours: number) => void;
  days: number;
  onDaysChange: (days: number) => void;
  postedGte: string;
  postedLte: string;
  onPostedGteChange: (value: string) => void;
  onPostedLteChange: (value: string) => void;
}

export function PostedTimeFilter({
  mode,
  onModeChange,
  hours,
  onHoursChange,
  days,
  onDaysChange,
  postedGte,
  postedLte,
  onPostedGteChange,
  onPostedLteChange,
}: PostedTimeFilterProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-alt/40 p-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-heading">Posted date filter</label>
        <div className="flex flex-wrap gap-2">
          {([
            ['hours', 'Last N hours'],
            ['days', 'Last N days'],
            ['range', 'Calendar range'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onModeChange(id)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                mode === id
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-surface text-body hover:border-primary/40'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'hours' && (
        <div className="space-y-3">
          <p className="text-xs text-body">
            Sub-day precision uses TheirStack discovery time for accurate hour-based filtering.
          </p>
          <div className="flex flex-wrap gap-2">
            {HOUR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onHoursChange(preset)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm',
                  hours === preset
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'border-border text-body hover:border-primary/40'
                )}
              >
                {preset}h
              </button>
            ))}
          </div>
          <div className="max-w-xs">
            <label className="mb-1 block text-sm text-heading">Custom hours</label>
            <input
              type="number"
              min={1}
              max={168}
              className="np-input w-full"
              value={hours}
              onChange={(e) => onHoursChange(parseInt(e.target.value, 10) || 24)}
            />
          </div>
        </div>
      )}

      {mode === 'days' && (
        <div className="max-w-xs">
          <label className="mb-1 block text-sm text-heading">Posted within last N days</label>
          <input
            type="number"
            min={0}
            max={90}
            className="np-input w-full"
            value={days}
            onChange={(e) => onDaysChange(parseInt(e.target.value, 10) || 7)}
          />
          <p className="mt-1 text-xs text-body">0 = today only, 1 = today and yesterday, etc.</p>
        </div>
      )}

      {mode === 'range' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-heading">Posted from</label>
            <input
              type="date"
              className="np-input w-full"
              value={postedGte}
              onChange={(e) => onPostedGteChange(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-heading">Posted to</label>
            <input
              type="date"
              className="np-input w-full"
              value={postedLte}
              onChange={(e) => onPostedLteChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
