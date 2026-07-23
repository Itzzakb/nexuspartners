import { useEffect, useState } from 'react';
import { Building2, CalendarDays, ListChecks, Pencil } from 'lucide-react';
import { externalApi, studentApi } from '@/lib/api';
import { formatMoney } from '@/lib/studentResume';
import type { ExternalRecruiter } from '@/types/phase4';
import type { StudentDetail } from '@/types/phase7';

interface StudentSubscriptionEditorProps {
  student: StudentDetail;
  onSaved: (student: StudentDetail) => void;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}

function toDateInput(value: unknown): string {
  if (!value) return '';
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function isoDate(value: string) {
  return value || '—';
}

export function StudentSubscriptionEditor({
  student,
  onSaved,
  onError,
  onMessage,
}: StudentSubscriptionEditorProps) {
  const details = student.details as Record<string, unknown>;
  const [status, setStatus] = useState(String(details.status || 'active'));
  const [joinDate, setJoinDate] = useState(toDateInput(details.joindate));
  const [subscriptionDate, setSubscriptionDate] = useState(toDateInput(details.subscription_date));
  const [amount, setAmount] = useState(String(details.subscription_amount || ''));
  const [days, setDays] = useState(String(details.subscription_days || ''));
  const [recruiter, setRecruiter] = useState(String(details.recruiterId || ''));
  const [recruiters, setRecruiters] = useState<ExternalRecruiter[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = student.details as Record<string, unknown>;
    setStatus(String(d.status || 'active'));
    setJoinDate(toDateInput(d.joindate));
    setSubscriptionDate(toDateInput(d.subscription_date));
    setAmount(
      d.subscription_amount != null && d.subscription_amount !== ''
        ? String(d.subscription_amount)
        : ''
    );
    setDays(
      d.subscription_days != null && d.subscription_days !== '' ? String(d.subscription_days) : ''
    );
    setRecruiter(String(d.recruiterId || ''));
  }, [student.phone, student.details]);

  useEffect(() => {
    externalApi
      .recruiters(student.companyId)
      .then((d) => setRecruiters(d.clerks || []))
      .catch(() => setRecruiters([]));
  }, [student.companyId]);

  const recruiterLabel =
    recruiters.find((r) => r.username === recruiter)?.name ||
    recruiters.find((r) => r.username === recruiter)?.username ||
    recruiter ||
    '—';

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await studentApi.update(student.phone, {
        companyId: student.companyId,
        status,
        joinDate,
        subscriptionDate: subscriptionDate || null,
        subscriptionAmount: amount === '' ? 0 : Number(amount),
        subscriptionDays: days === '' ? 0 : Number(days),
        recruiterUsername: recruiter,
      });
      onSaved(data.student);
      onMessage('Subscription saved');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save subscription');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="np-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Pencil className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-heading">Subscription Editor</h2>
        </div>
        <button
          type="button"
          className="np-btn-primary !py-2 text-sm"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div className="divide-y divide-border">
        <section className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-heading">Status</h3>
          </div>
          <label className="block max-w-sm text-sm">
            <span className="mb-1.5 block font-medium text-heading">Account Status</span>
            <select className="np-input bg-muted/40" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
        </section>

        <section className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-heading">Subscription Details</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-heading">Join Date</span>
              <input
                type="date"
                className="np-input bg-muted/40"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-heading">Subscription Date</span>
              <input
                type="date"
                className="np-input bg-muted/40"
                value={subscriptionDate}
                onChange={(e) => setSubscriptionDate(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-heading">Subscription Amount ($)</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-body">
                  $
                </span>
                <input
                  className="np-input bg-muted/40 pl-7"
                  type="number"
                  min={0}
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="300"
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-heading">Subscription Days</span>
              <input
                className="np-input bg-muted/40"
                type="number"
                min={0}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="30"
              />
            </label>
          </div>
        </section>

        <section className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-heading">Company & Recruiter</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-heading">Company Name</span>
              <input className="np-input bg-muted" value={student.companyLabel} readOnly />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-heading">Recruiter</span>
              <select
                className="np-input bg-muted/40"
                value={recruiter}
                onChange={(e) => setRecruiter(e.target.value)}
              >
                <option value="">— No recruiter —</option>
                {recruiters.map((r) => (
                  <option key={String(r.username || r.email || r.name)} value={r.username || ''}>
                    {r.name || r.username}
                  </option>
                ))}
                {recruiter && !recruiters.some((r) => r.username === recruiter) && (
                  <option value={recruiter}>{recruiter}</option>
                )}
              </select>
            </label>
          </div>
        </section>

        <section className="bg-muted/40 px-5 py-5">
          <h3 className="mb-3 text-sm font-semibold text-heading">Summary</h3>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <SummaryRow label="Status" value={status} />
            <SummaryRow label="Join Date" value={isoDate(joinDate)} />
            <SummaryRow label="Subscription Date" value={isoDate(subscriptionDate)} />
            <SummaryRow
              label="Amount"
              value={formatMoney(amount) || (amount ? `$${amount}` : '—')}
            />
            <SummaryRow label="Days" value={days ? `${days} Days` : '—'} />
            <SummaryRow label="Company" value={student.companyLabel} />
            <SummaryRow label="Recruiter" value={recruiterLabel} />
          </dl>
        </section>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <dt className="text-body">{label}</dt>
      <dd className="font-medium capitalize text-heading">{value}</dd>
    </div>
  );
}
