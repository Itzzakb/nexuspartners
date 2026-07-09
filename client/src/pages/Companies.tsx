import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { companyApi, uploadFile } from '@/lib/api';

export default function Companies() {
  const { user } = useAuth();
  const { companies, loading, refreshCompanies } = useCompanies();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', appTitle: '', website: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  if (!user?.isPlatformAdmin) {
    return <p className="text-body">Platform admin access required.</p>;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await companyApi.create(form);
      setMessage('Company created');
      setForm({ name: '', slug: '', appTitle: '', website: '' });
      setShowForm(false);
      refreshCompanies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company');
    }
  };

  const handleLogoUpload = async (companyId: string, file: File) => {
    try {
      const result = await uploadFile(file, 'companies');
      await companyApi.update(companyId, { logoUrl: result.url, logoPublicId: result.publicId });
      setMessage('Logo updated');
      refreshCompanies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">Companies</h1>
          <p className="mt-1 text-body">Manage all organizations on the platform</p>
        </div>
        <button type="button" className="np-btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add company'}
        </button>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="np-card space-y-4 p-6">
          <h2 className="text-lg">New company</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              className="np-input"
              placeholder="Company name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              className="np-input"
              placeholder="Slug (optional)"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
            <input
              className="np-input"
              placeholder="App title"
              value={form.appTitle}
              onChange={(e) => setForm({ ...form, appTitle: e.target.value })}
            />
            <input
              className="np-input"
              placeholder="Website"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>
          <button type="submit" className="np-btn-primary">
            Create company
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {companies.map((c) => (
            <div key={c.id} className="np-card p-5">
              <div className="flex items-start gap-4">
                {c.logoUrl ? (
                  <img src={c.logoUrl} alt="" className="h-12 w-12 object-contain" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-white">
                    {c.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-heading">{c.name}</h3>
                  <p className="text-sm text-body">/{c.slug}</p>
                  {c.isPlatformAdmin && (
                    <span className="mt-1 inline-block rounded-pill bg-accent/10 px-2 py-0.5 text-xs text-accent">
                      Platform
                    </span>
                  )}
                  <p className="mt-2 text-sm text-body">{c.website || 'No website'}</p>
                  <label className="mt-3 inline-block cursor-pointer text-sm text-primary hover:underline">
                    Upload logo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(c.id, file);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
