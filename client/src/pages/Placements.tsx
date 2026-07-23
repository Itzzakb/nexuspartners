import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { placementApi, uploadFile } from '@/lib/api';
import { ToggleField } from '@/components/ui/Toggle';
import type { JobPlacement, PlacementDocument } from '@/types/phase4';
import { toast } from '@/lib/toast';

const DOC_TYPES = [
  { value: 'offer_letter', label: 'Offer letter' },
  { value: 'interview_screenshot', label: 'Interview screenshot' },
  { value: 'other', label: 'Other' },
] as const;

export default function Placements() {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const [placements, setPlacements] = useState<JobPlacement[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [form, setForm] = useState({
    candidateName: '',
    email: '',
    mobile: '',
    companyName: '',
    placementDate: '',
    durationMonths: 0,
    companyId: user?.companyId || '',
  });
  const [docs, setDocs] = useState<PlacementDocument[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (showDeleted) params.deleted = 'true';
      if (companyId) params.companyId = companyId;
      const data = await placementApi.list(params);
      setPlacements(data.placements);
    } catch {
      setPlacements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [showDeleted, companyId]);

  const handleDocUpload = async (file: File, type: PlacementDocument['type']) => {
    const uploaded = await uploadFile(file, 'placements');
    setDocs((prev) => [
      ...prev,
      { type, label: file.name, url: uploaded.url, publicId: uploaded.publicId },
    ]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await placementApi.create({ ...form, documents: docs });
      setShowForm(false);
      setForm({
        candidateName: '',
        email: '',
        mobile: '',
        companyName: '',
        placementDate: '',
        durationMonths: 0,
        companyId: user?.companyId || '',
      });
      setDocs([]);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await placementApi.delete(deleteId, deletePassword, deleteReason);
      setDeleteId(null);
      setDeletePassword('');
      setDeleteReason('');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">Job Placements</h1>
          <p className="mt-1 text-body">Record successful job placements and documents</p>
        </div>
        <button type="button" className="np-btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Add placement
        </button>
      </div>

      <div className="np-card flex flex-wrap gap-3 p-4">
        <ToggleField
          label="Show deleted"
          checked={showDeleted}
          onChange={setShowDeleted}
        />
        {user?.isPlatformAdmin && (
          <select className="np-input max-w-xs" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="np-card space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <input className="np-input" placeholder="Candidate name *" required value={form.candidateName}
              onChange={(e) => setForm({ ...form, candidateName: e.target.value })} />
            <input className="np-input" placeholder="Email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="np-input" placeholder="Mobile" value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            <input className="np-input" placeholder="Company placed at" value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
            <input type="date" className="np-input" value={form.placementDate}
              onChange={(e) => setForm({ ...form, placementDate: e.target.value })} />
            <input type="number" className="np-input" placeholder="Duration (months)" value={form.durationMonths}
              onChange={(e) => setForm({ ...form, durationMonths: Number(e.target.value) })} />
          </div>
          <div className="flex flex-wrap gap-2">
            {DOC_TYPES.map((t) => (
              <label key={t.value} className="np-btn-secondary cursor-pointer">
                Upload {t.label}
                <input type="file" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleDocUpload(f, t.value);
                }} />
              </label>
            ))}
          </div>
          {docs.length > 0 && (
            <ul className="text-sm text-body">
              {docs.map((d, i) => (
                <li key={i}>{d.label} ({d.type})</li>
              ))}
            </ul>
          )}
          <button type="submit" className="np-btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save placement'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-body">Loading...</p>
      ) : placements.length === 0 ? (
        <div className="np-card p-8 text-center text-body">No placements found</div>
      ) : (
        <div className="overflow-x-auto np-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-body">
                <th className="p-4">Candidate</th>
                <th className="p-4">Company</th>
                <th className="p-4">Date</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Docs</th>
                {!showDeleted && <th className="p-4" />}
              </tr>
            </thead>
            <tbody>
              {placements.map((p) => (
                <tr key={p.id} className="border-b border-border">
                  <td className="p-4">
                    <p className="font-medium text-heading">{p.candidateName}</p>
                    <p className="text-xs text-body">{p.email} · {p.mobile}</p>
                  </td>
                  <td className="p-4">{p.companyName}</td>
                  <td className="p-4">
                    {p.placementDate ? new Date(p.placementDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-4">{p.durationMonths ? `${p.durationMonths} mo` : '—'}</td>
                  <td className="p-4">
                    {p.documents?.map((d, i) => (
                      <a key={i} href={d.url} target="_blank" rel="noreferrer" className="mr-2 text-primary">
                        {d.label || d.type}
                      </a>
                    ))}
                  </td>
                  {!showDeleted && (
                    <td className="p-4">
                      <button type="button" onClick={() => setDeleteId(p.id)} className="text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="np-card w-full max-w-md space-y-4 p-6">
            <h2 className="text-lg">Delete placement</h2>
            <p className="text-sm text-body">Enter password to confirm deletion.</p>
            <input className="np-input" type="password" placeholder="Password" value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)} />
            <input className="np-input" placeholder="Reason (optional)" value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)} />
            <div className="flex gap-2">
              <button type="button" className="np-btn-primary" onClick={handleDelete}>Delete</button>
              <button type="button" className="np-btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
