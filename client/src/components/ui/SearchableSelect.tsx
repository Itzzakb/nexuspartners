import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Loader2, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SearchableSelectOption = {
  value: string;
  label: string;
};

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  allowClear?: boolean;
  allowCreate?: boolean;
  createHint?: string;
  size?: 'md' | 'sm';
  loading?: boolean;
  loadingMessage?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Type to search…',
  emptyMessage = 'No options found',
  emptyLabel,
  disabled = false,
  className,
  triggerClassName,
  allowClear = false,
  allowCreate = false,
  createHint = 'Use this value',
  size = 'md',
  loading = false,
  loadingMessage = 'Loading…',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 224 });
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const optionMap = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const selected = value ? optionMap.get(value) : undefined;
  const selectedLabel = selected?.label || (value ? value : emptyLabel || placeholder);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = options.filter((o) => {
      if (!q) return true;
      return o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q);
    });
    if (emptyLabel) {
      const emptyMatches = !q || emptyLabel.toLowerCase().includes(q);
      return emptyMatches ? [{ value: '', label: emptyLabel }, ...rows] : rows;
    }
    return rows;
  }, [options, query, emptyLabel]);

  const createValue = useMemo(() => {
    if (!allowCreate) return '';
    const raw = query.trim();
    if (!raw) return '';
    const exists =
      options.some((o) => o.value.toLowerCase() === raw.toLowerCase() || o.label.toLowerCase() === raw.toLowerCase()) ||
      raw.toLowerCase() === (emptyLabel || '').toLowerCase();
    return exists ? '' : raw;
  }, [allowCreate, query, options, emptyLabel]);

  const actionable = useMemo(() => {
    const rows = [...filtered];
    if (createValue) rows.unshift({ value: `__create__:${createValue}`, label: createValue });
    return rows;
  }, [filtered, createValue]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom - 12;
      const spaceAbove = r.top - 12;
      const maxHeight = Math.min(224, Math.max(spaceBelow, spaceAbove, 120));
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      setMenuPos({
        top: openUp ? Math.max(8, r.top - maxHeight - 4) : r.bottom + 4,
        left: r.left,
        width: r.width,
        maxHeight,
      });
    };
    updatePos();
    setHighlight(0);
    requestAnimationFrame(() => searchRef.current?.focus());
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  const selectValue = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, Math.max(actionable.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const row = actionable[highlight];
      if (!row) return;
      if (row.value.startsWith('__create__:')) selectValue(createValue);
      else selectValue(row.value);
    }
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        className={cn(
          'np-input flex w-full items-center gap-2 text-left',
          size === 'sm' ? '!py-2' : '',
          disabled && 'cursor-not-allowed opacity-60',
          triggerClassName
        )}
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            value ? 'text-heading' : 'text-body'
          )}
        >
          {selectedLabel}
        </span>
        {loading && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-label="Loading options" />
        )}
        {allowClear && value && !disabled && !loading && (
          <span
            role="button"
            tabIndex={-1}
            className="rounded p-0.5 text-body hover:bg-muted hover:text-heading"
            onClick={(e) => {
              e.stopPropagation();
              selectValue('');
            }}
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-body transition-transform', open && 'rotate-180')} />
      </button>

      {open &&
        !disabled &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[80] overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
          >
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
                <input
                  ref={searchRef}
                  className="np-input w-full !py-2 pl-9"
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                />
              </div>
            </div>
            <div className="overflow-y-auto p-1" style={{ maxHeight: menuPos.maxHeight }} role="listbox">
              {loading ? (
                <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-body">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  {loadingMessage}
                </div>
              ) : (
                <>
                  {createValue && (
                    <button
                      type="button"
                      className={cn(
                        'mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-primary hover:bg-primary/10',
                        highlight === 0 && 'bg-primary/10'
                      )}
                      onClick={() => selectValue(createValue)}
                      onMouseEnter={() => setHighlight(0)}
                    >
                      <Plus className="h-4 w-4 shrink-0" />
                      <span>
                        {createHint}: <span className="font-medium">{createValue}</span>
                      </span>
                    </button>
                  )}
                  {filtered.length === 0 && !createValue ? (
                    <p className="px-3 py-6 text-center text-sm text-body">{emptyMessage}</p>
                  ) : (
                    filtered.map((opt, i) => {
                      const idx = i + (createValue ? 1 : 0);
                      const checked = opt.value === value;
                      return (
                        <button
                          key={opt.value || '__empty__'}
                          type="button"
                          role="option"
                          aria-selected={checked}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                            checked || highlight === idx
                              ? 'bg-primary/10 text-heading'
                              : 'text-body hover:bg-muted'
                          )}
                          onClick={() => selectValue(opt.value)}
                          onMouseEnter={() => setHighlight(idx)}
                        >
                          <span
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                              checked ? 'border-primary bg-primary text-white' : 'border-border bg-surface'
                            )}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          <span className="min-w-0 truncate font-medium text-heading">{opt.label}</span>
                        </button>
                      );
                    })
                  )}
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
