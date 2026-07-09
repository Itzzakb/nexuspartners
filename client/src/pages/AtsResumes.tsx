import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { resumeTemplateApi } from '@/lib/api';
import { ToggleField } from '@/components/ui/Toggle';
import type { ResumeTemplate } from '@/types/phase7';

const DEFAULT_SECTIONS = ['summary', 'experience', 'education', 'skills'];

export default function AtsResumes() {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState('');
  const [editing, setEditing] = useState<Partial<ResumeTemplate> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing?.name) return;
    setSaving(true);
    setError('');
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
      setError(err instanceof Error ? err.message : 'Failed to save template');
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
      setError(err instanceof Error ? err.message : 'Failed to delete');
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

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <form onSubmit={handleSave} className="np-card my-8 w-full max-w-2xl space-y-4 p-6">
            <h2 className="text-lg">{editing.id ? 'Edit Template' : 'New Template'}</h2>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">Name</label>
              <input
                className="np-input"
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">Description</label>
              <input
                className="np-input"
                value={editing.description || ''}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">
                Sections (comma-separated)
              </label>
              <input
                className="np-input"
                value={(editing.sections || []).join(', ')}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    sections: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">Template content</label>
              <textarea
                className="np-input min-h-[200px] font-mono text-xs"
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
            <div className="flex gap-3">
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
