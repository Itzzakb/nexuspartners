import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { resumeFormApi } from '@/lib/resumeFormApi';
import {
  emptyResumeFormData,
  emptyWorkExperience,
  VISA_OPTIONS,
  WORK_EXPERIENCE_NOTE,
  type ResumeFormData,
} from '@/types/resumeForm';
import { Toggle } from '@/components/ui/Toggle';

export default function ResumeFormPublic() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [locked, setLocked] = useState(false);
  const [company, setCompany] = useState<{
    name: string;
    logoUrl: string;
    primaryColor: string;
    appTitle: string;
  } | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [form, setForm] = useState<ResumeFormData>(emptyResumeFormData());

  useEffect(() => {
    if (!ticketId) return;
    resumeFormApi
      .get(ticketId)
      .then((data) => {
        setCompany(data.company);
        setCandidateName(data.candidateName);
        setForm(data.formData || emptyResumeFormData());
        setLocked(data.locked);
        document.title = `Resume Form – ${data.company.appTitle || data.company.name}`;
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load form'))
      .finally(() => setLoading(false));
  }, [ticketId]);

  const update = (patch: Partial<ResumeFormData>) => setForm((f) => ({ ...f, ...patch }));

  const updateExperience = (index: number, patch: Partial<ResumeFormData['workExperience'][0]>) => {
    const next = [...form.workExperience];
    next[index] = { ...next[index], ...patch };
    update({ workExperience: next });
  };

  const addExperience = () => {
    update({ workExperience: [...form.workExperience, emptyWorkExperience()] });
  };

  const removeExperience = (index: number) => {
    if (form.workExperience.length <= 1) return;
    update({ workExperience: form.workExperience.filter((_, i) => i !== index) });
  };

  const save = async (action: 'save_exit' | 'complete' | 'reset') => {
    if (!ticketId) return;
    if (action === 'reset' && !confirm('This will clear all your answers. Continue?')) return;

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const data = await resumeFormApi.save(ticketId, form, action);
      setForm(data.formData);
      setLocked(data.locked);
      if (action === 'complete') setMessage('Form submitted successfully. Thank you!');
      else if (action === 'save_exit') setMessage('Progress saved. You can return later to complete.');
      else if (action === 'reset') setMessage('Form has been reset.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error && !company) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-4">
        <div className="np-card max-w-md p-8 text-center text-red-600">{error}</div>
      </div>
    );
  }

  const primary = company?.primaryColor || '#3e6ae1';
  const readOnly = locked;

  return (
    <div className="min-h-screen bg-muted py-8 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="np-card mb-6 p-6" style={{ borderTop: `4px solid ${primary}` }}>
          <div className="flex items-center gap-4">
            {company?.logoUrl && (
              <img src={company.logoUrl} alt="" className="h-12 object-contain" />
            )}
            <div>
              <h1 className="text-2xl">Resume Information Form</h1>
              <p className="text-body">{company?.name} · {candidateName}</p>
            </div>
          </div>
        </div>

        {message && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {locked && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            This form has been submitted. Contact your team if you need to make changes.
          </div>
        )}

        <fieldset disabled={readOnly} className="space-y-6">
          <Section title="Personal Information">
            <Field label="Preferred Name on Resume *" value={form.preferredName} onChange={(v) => update({ preferredName: v })} />
            <Field label="Date of Birth *" type="date" value={form.dateOfBirth} onChange={(v) => update({ dateOfBirth: v })} />
            <Field label="LinkedIn Profile" value={form.linkedIn} onChange={(v) => update({ linkedIn: v })} />
            <Field label="Email Address for Resume *" type="email" value={form.resumeEmail} onChange={(v) => update({ resumeEmail: v })} />
            <Field label="Resume Email Password" type="password" value={form.resumeEmailPassword} onChange={(v) => update({ resumeEmailPassword: v })} hint="Please disable 2-factor authentication on this email." />
            <Field label="Personal Phone Number *" value={form.personalPhone} onChange={(v) => update({ personalPhone: v })} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">Full Current Address *</label>
              <textarea className="np-input min-h-[80px]" value={form.address} onChange={(e) => update({ address: e.target.value })} />
            </div>
          </Section>

          <Section title="Work Experience">
            <p className="mb-4 text-xs text-body whitespace-pre-line">{WORK_EXPERIENCE_NOTE}</p>
            {form.workExperience.map((exp, i) => (
              <div key={i} className="mb-4 rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-heading">Experience {i + 1}</span>
                  {form.workExperience.length > 1 && (
                    <button type="button" onClick={() => removeExperience(i)} className="text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Client *" value={exp.client} onChange={(v) => updateExperience(i, { client: v })} />
                  <Field label="Role *" value={exp.role} onChange={(v) => updateExperience(i, { role: v })} />
                  <Field label="Start Date" value={exp.startDate} onChange={(v) => updateExperience(i, { startDate: v })} />
                  <Field label="End Date" value={exp.endDate} onChange={(v) => updateExperience(i, { endDate: v })} />
                  <div className="sm:col-span-2">
                    <Field label="Client Address" value={exp.clientAddress} onChange={(v) => updateExperience(i, { clientAddress: v })} />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={addExperience} className="np-btn-secondary text-sm">
              <Plus className="mr-1 h-4 w-4 inline" /> Add Experience
            </button>
          </Section>

          <Section title="Education Summary">
            <p className="mb-2 text-sm font-medium text-heading">Masters</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="University & Field of Study *" value={form.mastersUniversity} onChange={(v) => update({ mastersUniversity: v })} />
              <Field label="Field of Study" value={form.mastersField} onChange={(v) => update({ mastersField: v })} />
              <Field label="Graduated Month" value={form.mastersGraduatedMonth} onChange={(v) => update({ mastersGraduatedMonth: v })} />
              <Field label="Graduated Year" value={form.mastersGraduatedYear} onChange={(v) => update({ mastersGraduatedYear: v })} />
            </div>
            <p className="mb-2 mt-4 text-sm font-medium text-heading">Bachelors</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="University & Field of Study *" value={form.bachelorsUniversity} onChange={(v) => update({ bachelorsUniversity: v })} />
              <Field label="Field of Study" value={form.bachelorsField} onChange={(v) => update({ bachelorsField: v })} />
              <Field label="Graduated Month" value={form.bachelorsGraduatedMonth} onChange={(v) => update({ bachelorsGraduatedMonth: v })} />
              <Field label="Graduated Year" value={form.bachelorsGraduatedYear} onChange={(v) => update({ bachelorsGraduatedYear: v })} />
            </div>
          </Section>

          <Section title="Visa Details & Availability">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">Current Visa Status *</label>
              <select className="np-input" value={form.visaStatus} onChange={(e) => update({ visaStatus: e.target.value })}>
                <option value="">Select visa status</option>
                {VISA_OPTIONS.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <Field label="Date of Arrival in the USA" type="date" value={form.dateOfArrivalUSA} onChange={(v) => update({ dateOfArrivalUSA: v })} />
          </Section>

          <Section title="Certifications & Achievements">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">Certifications</label>
              <p className="mb-2 text-xs text-body">Mention any relevant certifications you have.</p>
              <textarea className="np-input min-h-[80px]" value={form.certifications} onChange={(e) => update({ certifications: e.target.value })} />
            </div>
            <Field label="Preferred Role for Marketing *" value={form.preferredRole} onChange={(v) => update({ preferredRole: v })} placeholder="Data Engineer" />
          </Section>

          <Section title="Consent & Signature">
            <label className="flex gap-3 text-sm text-body">
              <Toggle
                className="mt-0.5 shrink-0"
                checked={form.consentAccurate}
                onChange={(checked) => update({ consentAccurate: checked })}
                aria-label="Confirm information is accurate"
              />
              <span>I confirm that all the information I have provided is true and accurate to the best of my knowledge.</span>
            </label>
            <label className="flex gap-3 text-sm text-body">
              <Toggle
                className="mt-0.5 shrink-0"
                checked={form.consentEmailAccess}
                onChange={(checked) => update({ consentEmailAccess: checked })}
                aria-label="Authorize email access"
              />
              <span>I authorize you to access and use my email account using the credentials provided for job application purposes. I confirm my email password is correct and 2FA is disabled.</span>
            </label>
            <Field label="Your Legal Name *" value={form.legalName} onChange={(v) => update({ legalName: v })} />
            <Field label="Signed Date *" type="date" value={form.signedDate} onChange={(v) => update({ signedDate: v })} />
          </Section>
        </fieldset>

        {!readOnly && (
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className="np-btn-primary" style={{ background: primary }} disabled={saving} onClick={() => save('complete')}>
              {saving ? 'Saving...' : 'Complete'}
            </button>
            <button type="button" className="np-btn-secondary" disabled={saving} onClick={() => save('save_exit')}>
              Save & Exit
            </button>
            <button type="button" className="np-btn-secondary text-red-600" disabled={saving} onClick={() => save('reset')}>
              Start from Beginning
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="np-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-heading">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-heading">{label}</label>
      <input
        type={type}
        className="np-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="mt-1 text-xs text-body">{hint}</p>}
    </div>
  );
}
