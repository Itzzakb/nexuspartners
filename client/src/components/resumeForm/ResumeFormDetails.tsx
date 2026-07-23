import { CheckCircle2, FileText, Unlock } from 'lucide-react';
import type { ResumeFormData, WorkExperience } from '@/types/resumeForm';
import { formatFormAddress, normalizeResumeFormData } from '@/types/resumeForm';
import { cn } from '@/lib/utils';

function formatDuration(start: string, end: string) {
  const s = start?.trim() || '';
  let e = end?.trim() || '';
  if (/^current|present|now|ongoing$/i.test(e)) e = 'Present';
  if (!s && !e) return '—';
  return `${s || '—'} – ${e || 'Present'}`;
}

function formatEduRange(start?: string, end?: string) {
  const s = String(start || '').trim();
  let e = String(end || '').trim();
  if (/^current|present|now|ongoing$/i.test(e)) e = 'Present';
  if (!s && !e) return '';
  if (s && e) return `${s} – ${e}`;
  return s || e;
}

function Field({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-body">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-heading">{value || '—'}</p>
    </div>
  );
}

function ExperienceTable({
  title,
  rows,
}: {
  title: string;
  rows: WorkExperience[];
}) {
  const items = rows.filter(
    (r) => r.client || r.role || r.startDate || r.endDate || r.clientAddress || r.description
  );

  return (
    <div>
      <h4 className="text-sm font-semibold text-heading">{title}</h4>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Client / Company</th>
              <th className="px-3 py-2.5 font-medium">Role</th>
              <th className="px-3 py-2.5 font-medium">Duration</th>
              <th className="px-3 py-2.5 font-medium">Address</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={5} className="px-3 py-4 text-body">
                  No entries
                </td>
              </tr>
            ) : (
              items.map((row, i) => (
                <tr key={i} className="border-t border-border align-top">
                  <td className="px-3 py-2.5 text-body">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-heading">{row.client || '—'}</td>
                  <td className="px-3 py-2.5 text-heading">{row.role || '—'}</td>
                  <td className="px-3 py-2.5 text-body">{formatDuration(row.startDate, row.endDate)}</td>
                  <td className="px-3 py-2.5 whitespace-pre-wrap text-body">
                    {row.clientAddress || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ResumeFormDetails({
  formData,
  status,
  updatedAt,
  onUnlock,
  unlockDisabled,
}: {
  formData?: ResumeFormData | null;
  status: 'unfilled' | 'partial' | 'completed';
  updatedAt?: string | null;
  onUnlock?: () => void;
  unlockDisabled?: boolean;
}) {
  if (!formData) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm md:p-6">
        <SectionHeader
          status={status}
          updatedAt={updatedAt}
          onUnlock={onUnlock}
          unlockDisabled={unlockDisabled}
        />
        <p className="mt-4 text-sm text-body">Candidate has not started the form yet.</p>
      </section>
    );
  }

  const form = normalizeResumeFormData(formData);
  const address = formatFormAddress(form) || form.address || '—';

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm md:p-6">
      <SectionHeader
        status={status}
        updatedAt={updatedAt}
        onUnlock={onUnlock}
        unlockDisabled={unlockDisabled}
      />

      <div className="mt-6 space-y-8">
        <div>
          <h4 className="text-sm font-semibold text-heading">Basic Information</h4>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Preferred Name" value={form.preferredName} />
            <Field label="Date of Birth" value={form.dateOfBirth} />
            <Field label="LinkedIn Profile" value={form.linkedIn} />
            <Field label="Email for Resume" value={form.resumeEmail} />
            <Field label="Email Password" value={form.resumeEmailPassword ? '••••••••' : '—'} />
            <Field label="Personal Phone" value={form.personalPhone} />
            <Field label="Address" value={address} className="sm:col-span-2 lg:col-span-3" />
          </div>
        </div>

        <ExperienceTable title="Work Experience" rows={form.workExperience || []} />
        {(form.internships || []).some((r) => r.client || r.role) && (
          <ExperienceTable title="Internships" rows={form.internships || []} />
        )}

        <div>
          <h4 className="text-sm font-semibold text-heading">Education</h4>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-body">Masters Degree</p>
              <div className="mt-3 space-y-2">
                <Field label="University" value={form.mastersUniversity} />
                <Field label="Field" value={form.mastersField} />
                <Field
                  label="Dates"
                  value={
                    formatEduRange(form.mastersStartDate, form.mastersEndDate) ||
                    [form.mastersGraduatedMonth, form.mastersGraduatedYear].filter(Boolean).join(' ') ||
                    '—'
                  }
                />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-body">Bachelors Degree</p>
              <div className="mt-3 space-y-2">
                <Field label="University" value={form.bachelorsUniversity} />
                <Field label="Field" value={form.bachelorsField} />
                <Field
                  label="Dates"
                  value={
                    formatEduRange(form.bachelorsStartDate, form.bachelorsEndDate) ||
                    [form.bachelorsGraduatedMonth, form.bachelorsGraduatedYear]
                      .filter(Boolean)
                      .join(' ') ||
                    '—'
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-heading">Visa & Other Details</h4>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Visa Status" value={form.visaStatus} />
            <Field label="Date of Arrival in USA" value={form.dateOfArrivalUSA} />
            <Field label="Vendor call" value={form.vendorCallTime} />
            <Field label="Preferred Role" value={form.preferredRole} />
            <Field label="Certifications" value={form.certifications} className="sm:col-span-2 lg:col-span-3" />
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-heading">Technical Skills</h4>
          <div className="mt-3 space-y-2">
            {(form.skillCategories || [])
              .filter((c) => c.category || c.skills)
              .map((c, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  <span className="font-semibold text-heading">{c.category || 'Skills'}</span>
                  {c.skills ? <span className="text-body"> — {c.skills}</span> : null}
                </div>
              ))}
            {!(form.skillCategories || []).some((c) => c.category || c.skills) && form.technicalSkills && (
              <p className="whitespace-pre-wrap text-sm text-heading">{form.technicalSkills}</p>
            )}
            {!(form.skillCategories || []).some((c) => c.category || c.skills) &&
              !form.technicalSkills && <p className="text-sm text-body">—</p>}
          </div>
        </div>

        {(form.professionalSummary || form.relevantCoursework) && (
          <div>
            <h4 className="text-sm font-semibold text-heading">Additional Profile</h4>
            <div className="mt-4 grid gap-4">
              {form.professionalSummary && (
                <Field label="Professional Summary" value={form.professionalSummary} />
              )}
              {form.relevantCoursework && (
                <Field label="Relevant Coursework" value={form.relevantCoursework} />
              )}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold text-heading">Consent & Signatures</h4>
          <div className="mt-3 space-y-2">
            <ConsentRow
              checked={!!form.consentAccurate}
              label="I confirm the information provided is accurate"
            />
            <ConsentRow
              checked={!!form.consentEmailAccess}
              label="I authorize email access for resume and applications"
            />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Legal Name (Signature)" value={form.legalName} />
            <Field label="Signed Date" value={form.signedDate} />
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  status,
  updatedAt,
  onUnlock,
  unlockDisabled,
}: {
  status: 'unfilled' | 'partial' | 'completed';
  updatedAt?: string | null;
  onUnlock?: () => void;
  unlockDisabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-heading">Resume Information Form Details</h2>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium',
                status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : status === 'partial'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
              )}
            >
              {status === 'completed' ? 'Completed' : status === 'partial' ? 'Partial' : 'Unfilled'}
            </span>
          </div>
          {updatedAt && (
            <p className="mt-1 text-xs text-body">
              Last updated {new Date(updatedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
      {onUnlock && (
        <button
          type="button"
          className="np-btn-secondary !py-2 text-sm"
          onClick={onUnlock}
          disabled={unlockDisabled}
        >
          <Unlock className="mr-2 h-4 w-4" />
          Unlock for Editing
        </button>
      )}
    </div>
  );
}

function ConsentRow({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <CheckCircle2
        className={cn('mt-0.5 h-4 w-4 shrink-0', checked ? 'text-emerald-600' : 'text-body/40')}
      />
      <span className={checked ? 'text-heading' : 'text-body'}>{label}</span>
    </div>
  );
}
