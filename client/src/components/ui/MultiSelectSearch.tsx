import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MultiSelectOption = {
  value: string;
  label: string;
};

interface MultiSelectSearchProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiSelectSearch({
  options,
  value,
  onChange,
  placeholder = 'Search and select…',
  emptyMessage = 'No options found',
  disabled = false,
  className,
}: MultiSelectSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const optionMap = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => {
      if (!q) return true;
      return o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const toggle = (val: string) => {
    if (selectedSet.has(val)) onChange(value.filter((v) => v !== val));
    else onChange([...value, val]);
  };

  const remove = (val: string) => onChange(value.filter((v) => v !== val));

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div
        className={cn(
          'np-input flex min-h-[42px] flex-wrap items-center gap-1.5 px-2 py-1.5',
          disabled && 'cursor-not-allowed opacity-60'
        )}
        onClick={() => !disabled && setOpen(true)}
      >
        {value.length === 0 && !open && (
          <span className="px-1 text-sm text-body">{placeholder}</span>
        )}
        {value.map((val) => {
          const opt = optionMap.get(val);
          return (
            <span
              key={val}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              {opt?.label || val}
              {!disabled && (
                <button
                  type="button"
                  className="rounded-full hover:bg-primary/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(val);
                  }}
                  aria-label={`Remove ${opt?.label || val}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          );
        })}
        <div className="ml-auto flex items-center gap-1">
          {value.length > 0 && (
            <span className="text-xs text-body">{value.length} selected</span>
          )}
          <ChevronDown className={cn('h-4 w-4 text-body transition-transform', open && 'rotate-180')} />
        </div>
      </div>

      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
              <input
                autoFocus
                className="np-input w-full pl-9"
                placeholder="Type to search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-body">{emptyMessage}</p>
            ) : (
              filtered.map((opt) => {
                const checked = selectedSet.has(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      checked ? 'bg-primary/10 text-heading' : 'hover:bg-muted text-body'
                    )}
                    onClick={() => toggle(opt.value)}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        checked ? 'border-primary bg-primary text-white' : 'border-border bg-surface'
                      )}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-heading">{opt.label}</span>
                      {opt.label !== opt.value && (
                        <span className="block truncate text-xs text-body">{opt.value}</span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
