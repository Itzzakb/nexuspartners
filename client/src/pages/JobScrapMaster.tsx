import { useCallback, useEffect, useState } from 'react';
import { Database, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { jobScrapMasterApi } from '@/lib/api';
import { toast } from '@/lib/toast';
import { canAccessModule } from '@/lib/permissions';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Toggle } from '@/components/ui/Toggle';
import type { JobScrapMasterItem, MasterDataCategory } from '@/types/jobScrap';

/** Admin UI only manages these; other categories stay seed/DB-managed. */
type EditableCategory = 'job_title' | 'domain';

const CATEGORY_TABS: Array<{ key: EditableCategory; label: string; placeholder: string }> = [
  { key: 'job_title', label: 'Job titles / Roles', placeholder: 'e.g. Data Analyst' },
  { key: 'domain', label: 'Domains', placeholder: 'e.g. linkedin.com' },
];

function emptyForm(category: EditableCategory) {
  return {
    category,
    value: '',
    label: '',
    isActive: true,
  };
}

export default function JobScrapMaster() {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const [companyId, setCompanyId] = useState('');
  const [items, setItems] = useState<JobScrapMasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<EditableCategory>('job_title');
  const [form, setForm] = useState(() => emptyForm('job_title'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JobScrapMasterItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const allowed = canAccessModule(user, 'job_scrap_master');
  const effectiveCompanyId = user?.isPlatformAdmin
    ? companyId || undefined
    : undefined;

  const activeTab = CATEGORY_TABS.find((t) => t.key === categoryFilter) || CATEGORY_TABS[0];

  const selectTab = (key: EditableCategory) => {
    setCategoryFilter(key);
    setEditingId(null);
    setForm(emptyForm(key));
  };

  const load = useCallback(async () => {
    if (!allowed) return;
    if (user?.isPlatformAdmin && !companyId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await jobScrapMasterApi.list({
        companyId: effectiveCompanyId,
        category: categoryFilter,
      });
      setItems(data.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load master data');
    } finally {
      setLoading(false);
    }
  }, [allowed, user?.isPlatformAdmin, companyId, effectiveCompanyId, categoryFilter]);

  useEffect(() => {
    if (user?.isPlatformAdmin && !companyId && companies.length) {
      setCompanyId(companies[0].id);
    }
  }, [user?.isPlatformAdmin, companyId, companies]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(emptyForm(categoryFilter));
    setEditingId(null);
  };

  const startEdit = (item: JobScrapMasterItem) => {
    const category = (item.category === 'domain' ? 'domain' : 'job_title') as EditableCategory;
    setEditingId(item.id);
    setForm({
      category,
      value: item.value,
      label: item.label || item.value,
      isActive: item.isActive !== false,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.value.trim()) {
      toast.error('Value is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        category: form.category as MasterDataCategory,
        value: form.value.trim(),
        label: (form.label || form.value).trim(),
        isActive: form.isActive,
        companyId: effectiveCompanyId,
      };
      if (editingId) {
        await jobScrapMasterApi.update(editingId, payload);
        toast.success('Updated');
      } else {
        await jobScrapMasterApi.create(payload);
        toast.success('Added');
      }
      resetForm();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await jobScrapMasterApi.remove(deleteTarget.id);
      toast.success('Deleted');
      if (editingId === deleteTarget.id) resetForm();
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (item: JobScrapMasterItem) => {
    try {
      await jobScrapMasterApi.update(item.id, { isActive: !item.isActive });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  if (!allowed) {
    return <p className="text-body">You do not have access to Job Scrap Master Data.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">Job Scrap Master Data</h1>
          <p className="mt-1 text-body">
            Add job titles (student roles) and domains. Other master values are managed in the database.
          </p>
        </div>
        {user?.isPlatformAdmin && (
          <select
            className="np-input max-w-xs"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">Select company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={
              categoryFilter === tab.key
                ? 'np-btn-primary !py-1.5 text-sm'
                : 'np-btn-secondary !py-1.5 text-sm'
            }
            onClick={() => selectTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="np-card space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg">
          {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {editingId ? 'Edit item' : `Add ${categoryFilter === 'domain' ? 'domain' : 'job title'}`}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-body">Category</label>
            <select
              className="np-input"
              value={form.category}
              onChange={(e) => {
                const next = e.target.value as EditableCategory;
                setCategoryFilter(next);
                setForm({ ...form, category: next });
              }}
              disabled={!!editingId}
            >
              {CATEGORY_TABS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-body">
              {categoryFilter === 'domain' ? 'Domain' : 'Job title'}
            </label>
            <input
              className="np-input"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder={activeTab.placeholder}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-body">Display label (optional)</label>
            <input
              className="np-input"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Defaults to the value above"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Toggle checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} />
            Active
          </label>
          <button type="submit" className="np-btn-primary" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editingId ? 'Update' : 'Add'}
          </button>
          {editingId && (
            <button type="button" className="np-btn-secondary" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="overflow-x-auto np-card">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : user?.isPlatformAdmin && !companyId ? (
          <p className="p-6 text-body">Select a company to manage master data.</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-body">
            <Database className="h-8 w-8 opacity-40" />
            <p>
              No {categoryFilter === 'domain' ? 'domains' : 'job titles'} yet. Add one above.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-body">
                <th className="p-3">Value</th>
                <th className="p-3">Label</th>
                <th className="p-3">Active</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="p-3 font-medium">{item.value}</td>
                  <td className="p-3">{item.label}</td>
                  <td className="p-3">
                    <Toggle
                      size="sm"
                      checked={item.isActive !== false}
                      onChange={() => toggleActive(item)}
                      aria-label={`Active ${item.value}`}
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="rounded p-2 text-body hover:bg-muted hover:text-heading"
                        onClick={() => startEdit(item)}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-2 text-body hover:bg-muted hover:text-red-600"
                        onClick={() => setDeleteTarget(item)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete item"
        message={
          deleteTarget
            ? `Delete “${deleteTarget.label || deleteTarget.value}”? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
