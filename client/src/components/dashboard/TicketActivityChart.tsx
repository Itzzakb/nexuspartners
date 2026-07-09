import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

type ChartRange = '7d' | '30d' | '3m';

interface TicketActivityChartProps {
  points: Array<{ date: string; count: number }>;
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  loading?: boolean;
}

const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: '3m', label: '3M' },
  { value: '30d', label: '30D' },
  { value: '7d', label: '7D' },
];

const CHART_COLOR = '#3e6ae1';

function formatAxisDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTooltipDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { date: string; count: number } }>;
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-heading">{formatTooltipDate(point.date)}</p>
      <p className="text-body">Created: {point.count} tickets</p>
    </div>
  );
}

export function TicketActivityChart({
  points,
  range,
  onRangeChange,
  loading,
}: TicketActivityChartProps) {
  const data = useMemo(
    () => points.map((p) => ({ ...p, label: formatAxisDate(p.date) })),
    [points]
  );

  const tickInterval = useMemo(() => {
    if (data.length <= 7) return 0;
    if (data.length <= 31) return Math.floor(data.length / 6);
    return Math.floor(data.length / 5);
  }, [data.length]);

  return (
    <div className="np-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-heading">Ticket Activity</h2>
          <p className="text-sm text-body">Tickets created per day</p>
        </div>
        <div className="flex rounded-lg border border-border bg-muted p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onRangeChange(opt.value)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition',
                range === opt.value
                  ? 'bg-surface text-heading shadow-sm'
                  : 'text-body hover:text-heading'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-6 h-[260px] w-full">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/60">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {!loading && !data.length ? (
          <div className="flex h-full items-center justify-center text-sm text-body">
            No ticket activity for this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="ticketActivityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLOR} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={CHART_COLOR} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border, #e5e7eb)" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={tickInterval}
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART_COLOR, strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="count"
                stroke={CHART_COLOR}
                strokeWidth={2.5}
                fill="url(#ticketActivityFill)"
                dot={false}
                activeDot={{ r: 5, fill: CHART_COLOR, stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
