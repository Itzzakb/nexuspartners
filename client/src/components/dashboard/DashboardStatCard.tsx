import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardStatCardProps {
  label: string;
  value: number | string;
  trend?: number;
  trendLabel?: string;
}

export function DashboardStatCard({ label, value, trend, trendLabel }: DashboardStatCardProps) {
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;
  const isNeutral = trend === 0;

  return (
    <div className="np-card p-5">
      <p className="text-sm text-body">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-heading">{value}</p>
      {trend !== undefined && (
        <p
          className={cn(
            'mt-2 flex items-center gap-1 text-xs font-medium',
            isPositive && 'text-green-600',
            isNegative && 'text-red-600',
            isNeutral && 'text-body'
          )}
        >
          {isPositive && <ArrowUpRight className="h-3.5 w-3.5" />}
          {isNegative && <ArrowDownRight className="h-3.5 w-3.5" />}
          {isNeutral && <ArrowRight className="h-3.5 w-3.5" />}
          <span>
            {isPositive ? '+' : ''}
            {trend}%
          </span>
          {trendLabel && <span className="font-normal text-body">{trendLabel}</span>}
        </p>
      )}
    </div>
  );
}
