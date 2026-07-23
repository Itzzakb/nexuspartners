import { useEffect, useState } from 'react';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { resumeTemplateApi } from '@/lib/api';
import { ToggleField } from '@/components/ui/Toggle';
import type { ResumeTemplate } from '@/types/phase7';
import { toast } from '@/lib/toast';

/** Sections the DOCX builder actually renders from form / student resume data. */
const SECTION_OPTIONS = [
  {
    id: 'summary',
    label: 'Professional Summary',
    mapsTo: 'Form: Professional Summary',
  },
  {
    id: 'experience',
    label: 'Experience / Projects',
    mapsTo: 'Form: Work experience, internships, or fresher projects',
  },
  {
    id: 'education',
    label: 'Education',
    mapsTo: 'Form: Masters + Bachelors',
  },
  {
    id: 'skills',
    label: 'Technical Skills',
    mapsTo: 'Form: Technical Skills + Relevant Coursework',
  },
  {
    id: 'certifications',
    label: 'Certifications',
    mapsTo: 'Form: Certifications',
  },
] as const;

const FULL_ATS_SECTIONS = SECTION_OPTIONS.map((s) => s.id);

const RECOMMENDED_TEMPLATE_CONTENT = `ATS Resume Template — Nexus Partners

Use this section order for Build & Download:
1. Header — Name, Preferred Role, Email, Phone, City/State, LinkedIn, Visa
2. Professional Summary
3. Experience (or Projects / Internships for freshers)
4. Education
5. Technical Skills (+ Relevant Coursework)
6. Certifications

Formatting rules:
- Plain text friendly (no tables, text boxes, or graphics)
- Standard section headings
- Bullet points for responsibilities and achievements
- Consistent date format (YYYY-MM-DD or Present)
- Keywords from preferred role and technical skills

Form fields covered:
- Personal: preferred name, email, phone, LinkedIn, address (street/city/state/ZIP/country)
- Experience level: experienced jobs OR fresher projects/internships
- Education: masters + bachelors
- Visa + arrival date
- Professional summary, technical skills, coursework, certifications, preferred role
`;

const DEFAULT_SECTIONS = [...FULL_ATS_SECTIONS];

export default function AtsResumes() {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState('');
  const [editing, setEditing] = useState<Partial<ResumeTemplate> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await resumeTemplateApi.list(companyId || undefined);
      setTemplates(data.templates);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const openNew = () => {
    setEditing({
      name: '',
      description: '',
      templateContent: '',
      sections: [...DEFAULT_SECTIONS],
      isDefault: false,
    });
  };

  const applyRecommendedAts = () => {
    setEditing((prev) => ({
      ...(prev || {}),
      name: prev?.name?.trim() ? prev.name : 'Full ATS Resume',
      description:
        prev?.description?.trim() ||
        'Covers all resume-form fields: summary, experience/projects, education, skills, certifications',
      sections: [...FULL_ATS_SECTIONS],
      templateContent: RECOMMENDED_TEMPLATE_CONTENT,
      isDefault: prev?.isDefault ?? true,
    }));
  };

  const toggleSection = (sectionId: string) => {
    if (!editing) return;
    const current = editing.sections || [];
    const next = current.includes(sectionId)
      ? current.filter((s) => s !== sectionId)
      : [...current, sectionId];
    // Keep a stable order matching SECTION_OPTIONS
    const ordered = FULL_ATS_SECTIONS.filter((id) => next.includes(id));
    setEditing({ ...editing, sections: ordered });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing?.name) return;
    if (!editing.sections?.length) {
      toast.error('Select at least one section');
      return;
    }
    setSaving(true);
    try {
      if (editing.id) {
        await resumeTemplateApi.update(editing.id, editing);
      } else {
        await resumeTemplateApi.create({
          ...editing,
          name: editing.name,
          companyId: companyId || undefined,
        });
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await resumeTemplateApi.delete(id);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">ATS Resumes</h1>
          <p className="mt-1 text-body">Manage resume templates for ATS-compatible output</p>
        </div>
        <button type="button" className="np-btn-primary" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </button>
      </div>

      {user?.isPlatformAdmin && (
        <select
          className="np-input max-w-xs"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        >
          <option value="">My company</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : templates.length === 0 ? (
          <p className="col-span-full py-16 text-center text-body">No templates yet</p>
        ) : (
          templates.map((t) => (
            <div key={t.id} className="np-card flex flex-col p-5 transition hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-heading">{t.name}</h3>
                  {t.isDefault && (
                    <span className="mt-1 inline-block rounded-pill bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Default
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="text-body hover:text-red-600"
                  onClick={() => handleDelete(t.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 flex-1 text-sm text-body line-clamp-2">
                {t.description || 'No description'}
              </p>
              <p className="mt-2 text-xs text-body">
                Sections: {t.sections?.join(', ') || '—'}
              </p>
              <button
                type="button"
                className="np-btn-secondary mt-4 !py-2 text-sm"
                onClick={() => setEditing(t)}
              >
                Edit
              </button>
            </div>
          ))
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSave}
            className="np-card flex max-h-[min(92vh,900px)] w-full max-w-2xl flex-col overflow-hidden"
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
              <h2 className="text-lg">{editing.id ? 'Edit Template' : 'New Template'}</h2>
              <button
                type="button"
                className="np-btn-secondary !py-2 text-sm"
                onClick={applyRecommendedAts}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Use full ATS preset
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-heading">Name</label>
                <input
                  className="np-input"
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  required
                  placeholder="Full ATS Resume"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-heading">Description</label>
                <input
                  className="np-input"
                  value={editing.description || ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Covers all resume-form fields for enriched ATS output"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-heading">Sections</label>
                <p className="mb-3 text-xs text-body">
                  Choose which sections appear in Build & Download (order is fixed for ATS readability).
                </p>
                <div className="space-y-2 rounded-lg border border-border p-3">
                  {SECTION_OPTIONS.map((opt) => {
                    const checked = (editing.sections || []).includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => toggleSection(opt.id)}
                        />
                        <span>
                          <span className="block text-sm font-medium text-heading">{opt.label}</span>
                          <span className="block text-xs text-body">{opt.mapsTo}</span>
                          <span className="mt-0.5 block font-mono text-[11px] text-body">{opt.id}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-body">
                  Selected: {(editing.sections || []).join(' → ') || 'none'}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-heading">Template content</label>
                <textarea
                  className="np-input min-h-[140px] font-mono text-xs"
                  value={editing.templateContent || ''}
                  onChange={(e) => setEditing({ ...editing, templateContent: e.target.value })}
                  placeholder="ATS formatting instructions or template body..."
                />
              </div>
              <ToggleField
                label="Set as default template"
                checked={!!editing.isDefault}
                onChange={(checked) => setEditing({ ...editing, isDefault: checked })}
              />
            </div>

            <div className="flex shrink-0 gap-3 border-t border-border bg-surface px-6 py-4">
              <button type="submit" className="np-btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" className="np-btn-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
