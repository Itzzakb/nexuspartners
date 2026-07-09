import { cn } from '@/lib/utils';

type ToggleSize = 'sm' | 'md';

const sizeStyles: Record<
  ToggleSize,
  { track: string; thumb: string; on: string }
> = {
  sm: {
    track: 'h-5 w-9',
    thumb: 'h-3.5 w-3.5',
    on: 'translate-x-4',
  },
  md: {
    track: 'h-6 w-11',
    thumb: 'h-5 w-5',
    on: 'translate-x-5',
  },
};

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: ToggleSize;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className,
  id,
  'aria-label': ariaLabel,
}: ToggleProps) {
  const s = sizeStyles[size];

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        s.track,
        checked ? 'bg-primary' : 'bg-border',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          'block rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out',
          s.thumb,
          checked ? s.on : 'translate-x-0'
        )}
      />
    </button>
  );
}

export interface ToggleFieldProps extends Omit<ToggleProps, 'aria-label'> {
  label: string;
  description?: string;
  labelClassName?: string;
}

export function ToggleField({
  label,
  description,
  labelClassName,
  ...toggleProps
}: ToggleFieldProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3',
        toggleProps.disabled && 'cursor-not-allowed opacity-60',
        labelClassName
      )}
    >
      <Toggle aria-label={label} {...toggleProps} />
      <span className="text-sm text-heading">
        {label}
        {description && <span className="mt-0.5 block text-xs text-body">{description}</span>}
      </span>
    </label>
  );
}
