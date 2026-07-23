import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { resumeFormApi } from '@/lib/resumeFormApi';
import { toast } from '@/lib/toast';
import {
  emptyResumeFormData,
  emptyWorkExperience,
  emptyProject,
  emptySkillCategory,
  normalizeResumeFormData,
  skillCategoriesToText,
  VISA_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  WORK_EXPERIENCE_NOTE,
  PROFESSIONAL_SUMMARY_HINT,
  EXPERIENCE_BULLETS_HINT,
  SKILLS_CATEGORY_HINT,
  type ResumeFormData,
} from '@/types/resumeForm';
import { Toggle } from '@/components/ui/Toggle';

export default function ResumeFormPublic() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [locked, setLocked] = useState(false);
  const [showReopenBanner, setShowReopenBanner] = useState(false);
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
        setForm(normalizeResumeFormData(data.formData));
        setLocked(data.locked);
        setShowReopenBanner(
          !data.locked && data.resumeFormEditEnabled && data.resumeFormStatus === 'completed'
        );
        document.title = `Resume Form – ${data.company.appTitle || data.company.name}`;
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load form'))
      .finally(() => setLoading(false));
  }, [ticketId]);

  const update = (patch: Partial<ResumeFormData>) =>
    setForm((f) => {
      const next = normalizeResumeFormData({ ...f, ...patch });
      if (patch.skillCategories) {
        next.technicalSkills = skillCategoriesToText(next.skillCategories);
      }
      return next;
    });

  const updateExperience = (index: number, patch: Partial<ResumeFormData['workExperience'][0]>) => {
    const next = [...form.workExperience];
    next[index] = { ...next[index], ...patch };
    update({ workExperience: next });
  };

  const updateInternship = (index: number, patch: Partial<ResumeFormData['internships'][0]>) => {
    const next = [...form.internships];
    next[index] = { ...next[index], ...patch };
    update({ internships: next });
  };

  const updateProject = (index: number, patch: Partial<ResumeFormData['projects'][0]>) => {
    const next = [...form.projects];
    next[index] = { ...next[index], ...patch };
    update({ projects: next });
  };

  const updateSkillCategory = (index: number, patch: Partial<ResumeFormData['skillCategories'][0]>) => {
    const next = [...(form.skillCategories || [])];
    next[index] = { ...next[index], ...patch };
    update({ skillCategories: next });
  };

  const addSkillCategory = () =>
    update({ skillCategories: [...(form.skillCategories || []), emptySkillCategory()] });

  const removeSkillCategory = (index: number) => {
    const next = (form.skillCategories || []).filter((_, i) => i !== index);
    update({ skillCategories: next.length ? next : [emptySkillCategory()] });
  };

  const addExperience = () => update({ workExperience: [...form.workExperience, emptyWorkExperience()] });
  const removeExperience = (index: number) => {
    if (form.workExperience.length <= 1) return;
    update({ workExperience: form.workExperience.filter((_, i) => i !== index) });
  };

  const addInternship = () => update({ internships: [...form.internships, emptyWorkExperience()] });
  const removeInternship = (index: number) => {
    if (form.internships.length <= 1) return;
    update({ internships: form.internships.filter((_, i) => i !== index) });
  };

  const addProject = () => update({ projects: [...form.projects, emptyProject()] });
  const removeProject = (index: number) => {
    if (form.projects.length <= 1) return;
    update({ projects: form.projects.filter((_, i) => i !== index) });
  };

  const save = async (action: 'save_exit' | 'complete' | 'reset') => {
    if (!ticketId) return;
    if (action === 'reset' && !confirm('This will clear all your answers. Continue?')) return;

    setSaving(true);
    try {
      const payload = normalizeResumeFormData(form);
      const data = await resumeFormApi.save(ticketId, payload, action);
      setForm(normalizeResumeFormData(data.formData));
      setLocked(data.locked);
      if (action === 'complete') {
        setShowReopenBanner(false);
        toast.success('Form submitted successfully. Thank you!');
      } else if (action === 'save_exit') toast.success('Progress saved. You can return later to complete.');
      else if (action === 'reset') {
        setShowReopenBanner(false);
        toast.success('Form has been reset.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
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

  if (loadError && !company) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-4">
        <div className="np-card max-w-md p-8 text-center text-red-600">{loadError}</div>
      </div>
    );
  }

  const primary = company?.primaryColor || '#3e6ae1';
  const readOnly = locked;
  const isExperienced = form.experienceLevel === 'experienced';
  const isFresher = form.experienceLevel === 'fresher';

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

        {locked && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            This form has been submitted. Contact your team if you need to make changes.
          </div>
        )}
        {!locked && showReopenBanner && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your form was re-opened for edits. Update any fields you want and click Complete when done.
          </div>
        )}

        <fieldset disabled={readOnly} className="space-y-6">
          <Section title="Personal Information">
            <Field label="Preferred Name on Resume" value={form.preferredName} onChange={(v) => update({ preferredName: v })} />
            <Field label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(v) => update({ dateOfBirth: v })} />
            <Field label="LinkedIn Profile" value={form.linkedIn} onChange={(v) => update({ linkedIn: v })} />
            <Field label="Email Address for Resume" type="email" value={form.resumeEmail} onChange={(v) => update({ resumeEmail: v })} />
            <Field label="Resume Email Password" type="password" value={form.resumeEmailPassword} onChange={(v) => update({ resumeEmailPassword: v })} hint="Please disable 2-factor authentication on this email." />
            <Field label="Personal Phone Number" value={form.personalPhone} onChange={(v) => update({ personalPhone: v })} />
          </Section>

          <Section title="Current Address">
            <Field label="Street Address" value={form.addressLine1} onChange={(v) => update({ addressLine1: v })} />
            <Field label="Apt / Suite / Unit" value={form.addressLine2} onChange={(v) => update({ addressLine2: v })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="City" value={form.city} onChange={(v) => update({ city: v })} />
              <Field label="State / Province" value={form.state} onChange={(v) => update({ state: v })} />
              <Field label="ZIP / Postal Code" value={form.zipCode} onChange={(v) => update({ zipCode: v })} />
              <Field label="Country" value={form.country} onChange={(v) => update({ country: v })} />
            </div>
          </Section>

          <Section title="Experience Level">
            <p className="text-sm text-body">Tell us whether you have professional work experience or are applying as a fresher.</p>
            <div className="space-y-2">
              {EXPERIENCE_LEVEL_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-4 py-3 text-sm">
                  <input
                    type="radio"
                    name="experienceLevel"
                    className="mt-1"
                    checked={form.experienceLevel === opt.value}
                    onChange={() => update({ experienceLevel: opt.value })}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </Section>

          {isExperienced && (
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
                    <Field label="Client / Company" value={exp.client} onChange={(v) => updateExperience(i, { client: v })} />
                    <Field label="Role" value={exp.role} onChange={(v) => updateExperience(i, { role: v })} />
                    <DateRangeFields
                      startDate={exp.startDate}
                      endDate={exp.endDate}
                      onStartChange={(v) => updateExperience(i, { startDate: v })}
                      onEndChange={(v) => updateExperience(i, { endDate: v })}
                    />
                    <div className="sm:col-span-2">
                      <Field label="Work Location" value={exp.clientAddress} onChange={(v) => updateExperience(i, { clientAddress: v })} />
                    </div>
                    <div className="sm:col-span-2">
                      <TextArea
                        label="Responsibilities & achievements"
                        value={exp.description}
                        onChange={(v) => updateExperience(i, { description: v })}
                        hint={EXPERIENCE_BULLETS_HINT}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addExperience} className="np-btn-secondary text-sm">
                <Plus className="mr-1 h-4 w-4 inline" /> Add Experience
              </button>
            </Section>
          )}

          {isFresher && (
            <>
              <Section title="Projects (optional)">
                <p className="text-sm text-body">
                  Add academic or personal projects that show your skills — optional, but recommended.
                </p>
                {form.projects.map((project, i) => (
                  <div key={i} className="mb-4 rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-heading">Project {i + 1}</span>
                      {form.projects.length > 1 && (
                        <button type="button" onClick={() => removeProject(i)} className="text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Project Name" value={project.name} onChange={(v) => updateProject(i, { name: v })} />
                      <Field label="Tech Stack" value={project.techStack} onChange={(v) => updateProject(i, { techStack: v })} placeholder="React, Node.js, MongoDB" />
                      <DateRangeFields
                        startDate={project.startDate}
                        endDate={project.endDate}
                        onStartChange={(v) => updateProject(i, { startDate: v })}
                        onEndChange={(v) => updateProject(i, { endDate: v })}
                      />
                      <div className="sm:col-span-2">
                        <TextArea
                          label="Project Description"
                          value={project.description}
                          onChange={(v) => updateProject(i, { description: v })}
                          hint="What you built, your role, and key outcomes (6–10 bullets, one per line, with metrics if possible)."
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addProject} className="np-btn-secondary text-sm">
                  <Plus className="mr-1 h-4 w-4 inline" /> Add Project
                </button>
              </Section>

              <Section title="Internships (optional)">
                <p className="text-sm text-body">Add any internships if you have them.</p>
                {form.internships.map((exp, i) => (
                  <div key={i} className="mb-4 rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-heading">Internship {i + 1}</span>
                      {form.internships.length > 1 && (
                        <button type="button" onClick={() => removeInternship(i)} className="text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Organization" value={exp.client} onChange={(v) => updateInternship(i, { client: v })} />
                      <Field label="Role" value={exp.role} onChange={(v) => updateInternship(i, { role: v })} />
                      <DateRangeFields
                        startDate={exp.startDate}
                        endDate={exp.endDate}
                        onStartChange={(v) => updateInternship(i, { startDate: v })}
                        onEndChange={(v) => updateInternship(i, { endDate: v })}
                      />
                      <div className="sm:col-span-2">
                        <TextArea
                          label="What you did"
                          value={exp.description}
                          onChange={(v) => updateInternship(i, { description: v })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addInternship} className="np-btn-secondary text-sm">
                  <Plus className="mr-1 h-4 w-4 inline" /> Add Internship
                </button>
              </Section>
            </>
          )}

          <Section title="Education Summary">
            <p className="mb-2 text-sm font-medium text-heading">Masters</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="University & Field of Study" value={form.mastersUniversity} onChange={(v) => update({ mastersUniversity: v })} />
              <Field label="Field of Study" value={form.mastersField} onChange={(v) => update({ mastersField: v })} />
              <DateRangeFields
                startDate={form.mastersStartDate}
                endDate={form.mastersEndDate}
                onStartChange={(v) => update({ mastersStartDate: v })}
                onEndChange={(v) => update({ mastersEndDate: v })}
              />
            </div>
            <p className="mb-2 mt-4 text-sm font-medium text-heading">Bachelors</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="University & Field of Study" value={form.bachelorsUniversity} onChange={(v) => update({ bachelorsUniversity: v })} />
              <Field label="Field of Study" value={form.bachelorsField} onChange={(v) => update({ bachelorsField: v })} />
              <DateRangeFields
                startDate={form.bachelorsStartDate}
                endDate={form.bachelorsEndDate}
                onStartChange={(v) => update({ bachelorsStartDate: v })}
                onEndChange={(v) => update({ bachelorsEndDate: v })}
              />
            </div>
          </Section>

          <Section title="Visa Details & Availability">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">Current Visa Status</label>
              <select className="np-input" value={form.visaStatus} onChange={(e) => update({ visaStatus: e.target.value })}>
                <option value="">Select visa status</option>
                {VISA_OPTIONS.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <Field label="Date of Arrival in the USA" type="date" value={form.dateOfArrivalUSA} onChange={(v) => update({ dateOfArrivalUSA: v })} />
            <VendorCallTimeField
              value={form.vendorCallTime}
              onChange={(v) => update({ vendorCallTime: v })}
            />
          </Section>

          <Section title="Resume Content">
            <Field
              label="Preferred Role for Marketing"
              value={form.preferredRole}
              onChange={(v) => update({ preferredRole: v })}
              placeholder="Data Engineer"
            />
            <TextArea
              label="Professional Summary"
              value={form.professionalSummary}
              onChange={(v) => update({ professionalSummary: v })}
              hint={PROFESSIONAL_SUMMARY_HINT}
            />

            <div>
              <p className="mb-1.5 text-sm font-medium text-heading">Technical Skills</p>
              <p className="mb-3 text-xs text-body">{SKILLS_CATEGORY_HINT}</p>
              {(form.skillCategories || []).map((row, i) => (
                <div key={i} className="mb-3 grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_auto]">
                  <Field
                    label="Category"
                    value={row.category}
                    onChange={(v) => updateSkillCategory(i, { category: v })}
                    placeholder="Programming Languages"
                  />
                  <Field
                    label="Skills"
                    value={row.skills}
                    onChange={(v) => updateSkillCategory(i, { skills: v })}
                    placeholder="Python, SQL, REST APIs"
                  />
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="np-btn-secondary !px-3 text-red-600"
                      onClick={() => removeSkillCategory(i)}
                      disabled={(form.skillCategories || []).length <= 1}
                      title="Remove category"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addSkillCategory} className="np-btn-secondary text-sm">
                <Plus className="mr-1 inline h-4 w-4" /> Add Skill Category
              </button>
            </div>

            <TextArea
              label="Relevant Coursework"
              value={form.relevantCoursework}
              onChange={(v) => update({ relevantCoursework: v })}
              hint="Optional — helpful for freshers."
            />
            <TextArea
              label="Certifications"
              value={form.certifications}
              onChange={(v) => update({ certifications: v })}
              hint="Mention any relevant certifications you have."
            />
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
            <Field label="Your Legal Name" value={form.legalName} onChange={(v) => update({ legalName: v })} />
            <Field label="Signed Date" type="date" value={form.signedDate} onChange={(v) => update({ signedDate: v })} />
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
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-heading">{label}</label>
      <input
        type={type}
        className="np-input"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="mt-1 text-xs text-body">{hint}</p>}
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-heading">{label}</label>
      <textarea className="np-input min-h-[100px]" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-1 text-xs text-body">{hint}</p>}
    </div>
  );
}

/** Coerce common stored date strings to YYYY-MM-DD for <input type="date">. */
function toDateInputValue(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^current|present|now|ongoing$/i.test(raw)) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    const year = dmy[3];
    const dayFirst = a > 12;
    const day = dayFirst ? a : b;
    const month = dayFirst ? b : a;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const my = raw.match(/^(\d{1,2})[\/\-.](\d{4})$/);
  if (my) {
    const month = Number(my[1]);
    if (month >= 1 && month <= 12) {
      return `${my[2]}-${String(month).padStart(2, '0')}-01`;
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

function isPresentEndDate(value: string): boolean {
  return /^current|present|now|ongoing$/i.test(String(value || '').trim());
}

const VENDOR_CALL_ANY_TIME = 'Any time';

function VendorCallTimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const anyTime = /^any\s*time$/i.test(String(value || '').trim());

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-heading">
        Preferred vendor call time
      </label>
      <p className="mb-2 text-xs text-body">
        When can vendors call you? Check “Any time” or enter a window (e.g. weekdays 10 AM–6 PM EST).
      </p>
      <label className="mb-3 flex items-center gap-2 text-sm text-heading">
        <input
          type="checkbox"
          checked={anyTime}
          onChange={(e) => onChange(e.target.checked ? VENDOR_CALL_ANY_TIME : '')}
        />
        Any time
      </label>
      {!anyTime && (
        <input
          className="np-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Weekdays 10:00 AM – 6:00 PM EST"
        />
      )}
    </div>
  );
}

function DateRangeFields({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}) {
  const present = isPresentEndDate(endDate);

  return (
    <>
      <Field
        label="Start Date"
        type="date"
        value={toDateInputValue(startDate)}
        onChange={onStartChange}
      />
      <div>
        <Field
          label="End Date"
          type="date"
          value={present ? '' : toDateInputValue(endDate)}
          onChange={onEndChange}
          disabled={present}
        />
        <label className="mt-2 flex items-center gap-2 text-sm text-body">
          <input
            type="checkbox"
            checked={present}
            onChange={(e) => onEndChange(e.target.checked ? 'current' : '')}
          />
          Present / currently ongoing
        </label>
      </div>
    </>
  );
}
