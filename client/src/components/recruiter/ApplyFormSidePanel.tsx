import { Copy, Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/lib/toast';

export interface StudentApplyForm {
  hasForm: boolean;
  studentPhone: string;
  studentName: string;
  studentEmail: string;
  ticket: Record<string, unknown> | null;
  rows: Array<{ label: string; value: string }>;
  fields: Array<{ key: string; label: string; value: string }>;
  formData: Record<string, unknown> | null;
  message?: string;
}

interface ApplyFormSidePanelProps {
  open: boolean;
  onClose: () => void;
  form: StudentApplyForm | null;
  applyUrl?: string | null;
  jobTitle?: string;
  companyName?: string;
}

export function ApplyFormSidePanel({
  open,
  onClose,
  form,
  applyUrl,
  jobTitle,
  companyName,
}: ApplyFormSidePanelProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!open) return null;

  const fields =
    form?.fields?.length
      ? form.fields
      : (form?.rows || []).map((r, i) => ({
          key: `row-${i}`,
          label: r.label,
          value: r.value,
        }));

  const copyValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value || '');
      setCopiedKey(key);
      toast.success('Copied');
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-heading">Apply form</h2>
            <p className="mt-0.5 text-sm text-body">
              {[jobTitle, companyName].filter(Boolean).join(' · ') || 'Copy fields into the job site'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-body hover:bg-muted hover:text-heading"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {applyUrl && (
            <a
              href={applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="np-btn-primary inline-flex w-full justify-center text-sm"
            >
              Open application page
            </a>
          )}

          {form?.studentName && (
            <p className="text-sm text-body">
              Student: <span className="font-medium text-heading">{form.studentName}</span>
              {form.studentPhone ? ` · ${form.studentPhone}` : ''}
            </p>
          )}

          {!form?.hasForm && form?.message && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{form.message}</p>
          )}

          {fields.length === 0 ? (
            <p className="text-sm text-body">No form fields available for this student yet.</p>
          ) : (
            <ul className="space-y-3">
              {fields.map((field) => (
                <li key={field.key} className="rounded-lg border border-border p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-body">
                      {field.label}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:bg-muted"
                      onClick={() => copyValue(field.key, field.value)}
                    >
                      {copiedKey === field.key ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Copy
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-heading">
                    {field.value || '—'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
