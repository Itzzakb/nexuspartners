import { useEffect, useState } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { subscribeToasts, toast, type ToastItem } from '@/lib/toast';
import { cn } from '@/lib/utils';

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  if (items.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed left-1/2 top-4 z-[9999] flex w-[min(100vw-2rem,24rem)] -translate-x-1/2 flex-col gap-2"
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((item) => {
        const isError = item.type === 'error';
        return (
          <div
            key={item.id}
            role={isError ? 'alert' : 'status'}
            className={cn(
              'np-toast pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm',
              isError
                ? 'border-red-200 bg-red-50/95 text-red-800'
                : 'border-green-200 bg-green-50/95 text-green-800'
            )}
          >
            {isError ? (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            )}
            <p className="min-w-0 flex-1 text-sm font-medium leading-5">{item.message}</p>
            <button
              type="button"
              className={cn(
                'shrink-0 rounded-md p-0.5 transition hover:bg-black/5',
                isError ? 'text-red-600' : 'text-green-700'
              )}
              aria-label="Dismiss"
              onClick={() => toast.dismiss(item.id)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
