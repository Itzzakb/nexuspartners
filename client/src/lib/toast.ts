export type ToastType = 'success' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  createdAt: number;
}

type Listener = (toasts: ToastItem[]) => void;

const DEFAULT_DURATION_MS = 4200;
const MAX_TOASTS = 5;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  const snapshot = [...toasts];
  listeners.forEach((listener) => listener(snapshot));
}

function removeToast(id: string) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

function pushToast(type: ToastType, message: string, durationMs = DEFAULT_DURATION_MS) {
  const text = String(message || '').trim();
  if (!text) return;

  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  toasts = [{ id, type, message: text, createdAt: Date.now() }, ...toasts].slice(0, MAX_TOASTS);
  emit();

  if (durationMs > 0) {
    timers.set(
      id,
      setTimeout(() => removeToast(id), durationMs)
    );
  }
}

export const toast = {
  success: (message: string, durationMs?: number) => pushToast('success', message, durationMs),
  error: (message: string, durationMs?: number) => pushToast('error', message, durationMs),
  dismiss: (id: string) => removeToast(id),
  clear: () => {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    toasts = [];
    emit();
  },
};

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  listener([...toasts]);
  return () => {
    listeners.delete(listener);
  };
}
