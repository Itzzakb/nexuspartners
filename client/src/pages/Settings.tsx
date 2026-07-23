import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { companyApi, uploadFile, type Company } from '@/lib/api';
import { toast } from '@/lib/toast';
import { AppLogo } from '@/components/ui/AppLogo';
import { PAYMENT_CURRENCIES } from '@/types/payment';

export default function Settings() {
  const { user, company, setCompany } = useAuth();
  const [form, setForm] = useState<Partial<Company>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    companyApi
      .getMy()
      .then((data) => {
        setForm(data.company);
        setLoading(false);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load settings');
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await companyApi.updateMy(form);
      setForm(data.company);
      setCompany(data.company);
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadFile(file, `companies/${company?.slug || 'default'}`);
      if (field === 'logo') {
        setForm((f) => ({ ...f, logoUrl: result.url, logoPublicId: result.publicId }));
      } else {
        setForm((f) => ({ ...f, faviconUrl: result.url, faviconPublicId: result.publicId }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (loadError) {
    return <p className="text-body">{loadError}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl">Settings</h1>
        <p className="mt-1 text-body">Manage your company branding and preferences</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="np-card p-6 space-y-4">
          <h2 className="text-lg">Branding</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">App title</label>
              <input
                className="np-input"
                value={form.appTitle || ''}
                onChange={(e) => setForm({ ...form, appTitle: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">Website</label>
              <input
                className="np-input"
                value={form.website || ''}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">Primary color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.primaryColor || '#3e6ae1'}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                  className="h-10 w-14 cursor-pointer rounded border border-border"
                />
                <input
                  className="np-input"
                  value={form.primaryColor || '#3e6ae1'}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">Secondary color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.secondaryColor || '#7c3aed'}
                  onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                  className="h-10 w-14 cursor-pointer rounded border border-border"
                />
                <input
                  className="np-input"
                  value={form.secondaryColor || '#7c3aed'}
                  onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">Logo</label>
              {form.logoUrl && (
                <img src={form.logoUrl} alt="Logo" className="mb-2 h-12 object-contain" />
              )}
              <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">Favicon</label>
              {form.faviconUrl && (
                <img src={form.faviconUrl} alt="Favicon" className="mb-2 h-8 w-8 object-contain" />
              )}
              <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'favicon')} />
            </div>
          </div>
        </div>

        {(user?.isCompanyAdmin || user?.isPlatformAdmin) && (
          <div className="np-card space-y-4 p-6">
            <h2 className="text-lg">Students & resume</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-heading">
                  Create student password
                </label>
                <input
                  type="password"
                  className="np-input"
                  value={form.createStudentPassword || ''}
                  onChange={(e) => setForm({ ...form, createStudentPassword: e.target.value })}
                  placeholder="Required to create students via API"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-heading">
                  Visa types (comma-separated)
                </label>
                <input
                  className="np-input"
                  value={(form.visaTypes || []).join(', ')}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      visaTypes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="F1, H1B, H4 EAD"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-heading">
                  Additional detail fields (comma-separated)
                </label>
                <input
                  className="np-input"
                  value={(form.additionalDetailFields || []).join(', ')}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      additionalDetailFields: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="LinkedIn, GitHub, Portfolio"
                />
              </div>
            </div>
          </div>
        )}

        {(user?.isCompanyAdmin || user?.isPlatformAdmin) && (
          <div className="np-card space-y-4 p-6">
            <h2 className="text-lg">Billing</h2>
            <p className="text-sm text-body">
              Default currency for student billing, manual payments, payment links, and subscriptions.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-heading">Bill rate per day</label>
                <input
                  type="number"
                  step="0.01"
                  className="np-input"
                  value={form.billRatePerDay ?? 4}
                  onChange={(e) => setForm({ ...form, billRatePerDay: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-heading">Billing currency</label>
                <select
                  className="np-input w-full"
                  value={form.billingCurrency || 'INR'}
                  onChange={(e) => setForm({ ...form, billingCurrency: e.target.value })}
                >
                  {PAYMENT_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-heading">
                  Skip billing names (comma-separated)
                </label>
                <input
                  className="np-input"
                  value={(form.skipBillingNames || []).join(', ')}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      skipBillingNames: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="Demo, Test User"
                />
              </div>
            </div>
          </div>
        )}

        {(user?.isCompanyAdmin || user?.isPlatformAdmin) && (
          <div className="np-card space-y-4 p-6">
            <h2 className="text-lg">Salaries</h2>
            <p className="text-sm text-body">Default currency for employee salary records.</p>
            <div className="max-w-md">
              <label className="mb-1.5 block text-sm font-medium text-heading">Salary currency</label>
              <select
                className="np-input w-full"
                value={form.salaryCurrency || 'INR'}
                onChange={(e) => setForm({ ...form, salaryCurrency: e.target.value })}
              >
                {PAYMENT_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="np-card p-6">
          <h2 className="mb-4 text-lg">Preview</h2>
          <div
            className="rounded-card border border-border p-4"
            style={{
              borderTop: `4px solid ${form.primaryColor || '#3e6ae1'}`,
            }}
          >
            <div className="flex items-center gap-3">
              <AppLogo src={form.logoUrl} alt={form.appTitle || company?.name} />
              <div>
                <p className="font-semibold text-heading">{form.appTitle}</p>
                <p className="text-sm text-body">{company?.name}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="rounded-pill px-4 py-2 text-sm text-white"
                style={{ background: form.primaryColor }}
              >
                Primary
              </button>
              <button
                type="button"
                className="rounded-pill px-4 py-2 text-sm text-white"
                style={{ background: form.secondaryColor }}
              >
                Accent
              </button>
            </div>
          </div>
        </div>

        <button type="submit" className="np-btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </form>
    </div>
  );
}
