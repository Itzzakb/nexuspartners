import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/utils';

interface ExperienceRangeSliderProps {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  /** Fired while dragging — for live label/UI only. Does not mean “apply filter”. */
  onChange?: (range: { min: number; max: number }) => void;
  /** Fired on thumb release / clear — safe place to trigger API. */
  onCommit: (range: { min: number; max: number }) => void;
  step?: number;
  className?: string;
  label?: string;
  isAny?: boolean;
  onClear?: () => void;
}

function snap(value: number, min: number, max: number, step: number) {
  const stepped = Math.round((value - min) / step) * step + min;
  return Math.min(max, Math.max(min, stepped));
}

export function ExperienceRangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  onChange,
  onCommit,
  step = 1,
  className,
  label = 'Experience (years)',
  isAny,
  onClear,
}: ExperienceRangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const span = Math.max(max - min, 1);
  const [dragging, setDragging] = useState(false);
  const [localMin, setLocalMin] = useState(valueMin);
  const [localMax, setLocalMax] = useState(valueMax);
  const localRef = useRef({ min: valueMin, max: valueMax });

  useEffect(() => {
    if (dragging) return;
    setLocalMin(valueMin);
    setLocalMax(valueMax);
    localRef.current = { min: valueMin, max: valueMax };
  }, [valueMin, valueMax, dragging]);

  const pct = (v: number) => ((Math.min(max, Math.max(min, v)) - min) / span) * 100;

  const ticks = useMemo(() => {
    const list: number[] = [];
    for (let v = min; v <= max; v += step) list.push(v);
    if (list[list.length - 1] !== max) list.push(max);
    return list;
  }, [min, max, step]);

  const valueFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return min;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return snap(min + ratio * span, min, max, step);
  };

  const applyLocal = (nextMin: number, nextMax: number) => {
    localRef.current = { min: nextMin, max: nextMax };
    setLocalMin(nextMin);
    setLocalMax(nextMax);
    onChange?.({ min: nextMin, max: nextMax });
  };

  const startDrag = (thumb: 'min' | 'max') => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    setDragging(true);

    const move = (ev: PointerEvent) => {
      const next = valueFromClientX(ev.clientX);
      const cur = localRef.current;
      if (thumb === 'min') {
        applyLocal(Math.min(next, cur.max), cur.max);
      } else {
        applyLocal(cur.min, Math.max(next, cur.min));
      }
    };

    const up = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      setDragging(false);
      const cur = localRef.current;
      onCommit({ min: cur.min, max: cur.max });
    };

    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };

  const left = pct(localMin);
  const right = pct(localMax);
  const showAny = !dragging && (isAny || (localMin === min && localMax === max));
  const display = showAny
    ? 'Any'
    : localMin === localMax
      ? `${localMin} yr`
      : `${localMin} – ${localMax} yr${localMax >= max ? '+' : ''}`;

  return (
    <div className={cn('min-w-[200px]', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-body">{label}</label>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-heading tabular-nums">{display}</span>
          {onClear && !showAny && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={onClear}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div ref={trackRef} className="relative mx-2 h-8 touch-none select-none">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-border" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary transition-[left,width] duration-75"
          style={{ left: `${left}%`, width: `${Math.max(right - left, 0)}%` }}
        />

        {ticks.map((t) => (
          <div
            key={t}
            className={cn(
              'pointer-events-none absolute top-1/2 h-2 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full',
              t >= localMin && t <= localMax ? 'bg-primary/70' : 'bg-border'
            )}
            style={{ left: `${pct(t)}%` }}
          />
        ))}

        <button
          type="button"
          aria-label="Minimum experience"
          className="absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-white shadow-sm transition-transform hover:scale-110 active:scale-95"
          style={{ left: `${left}%` }}
          onPointerDown={startDrag('min')}
        />
        <button
          type="button"
          aria-label="Maximum experience"
          className="absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-white shadow-sm transition-transform hover:scale-110 active:scale-95"
          style={{ left: `${right}%` }}
          onPointerDown={startDrag('max')}
        />
      </div>

      <div className="relative mx-2 mt-1 h-3">
        {ticks
          .filter((t) => t === min || t === max || t % 5 === 0)
          .map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2 text-[10px] tabular-nums text-body"
              style={{ left: `${pct(t)}%` }}
            >
              {t === max ? `${t}+` : t}
            </span>
          ))}
      </div>
    </div>
  );
}
