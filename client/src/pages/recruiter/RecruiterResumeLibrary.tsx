import { useCallback, useEffect, useState } from 'react';
import {
  Download,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AtsScoreCard, type AtsLibraryEntry } from '@/components/recruiter/AtsScoreCard';
import { recruiterResumeApi } from '@/lib/recruiterApi';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

type LibraryItem = {
  id: string;
  studentPhone: string;
  studentName: string;
  jobTitle: string;
  companyName: string;
  downloadUrl: string;
  atsScore: number | null;
  atsSummary?: string;
  atsImprovements?: string[];
  atsMeetsTarget?: boolean;
  atsTargetScore?: number;
  atsScoredAt?: string | null;
  source: string;
  createdAt: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ScoreCell({ item }: { item: LibraryItem }) {
  if (item.atsScore == null) {
    return <span className="text-sm text-body">—</span>;
  }
  const score = Number(item.atsScore);
  const meets = item.atsMeetsTarget ?? score >= (item.atsTargetScore ?? 90);
  return (
    <div className="min-w-[7rem]">
      <span className="text-sm font-semibold text-heading">{score}</span>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className={cn('h-full rounded-full', meets ? 'bg-green-500' : 'bg-amber-500')}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
    </div>
  );
}

export default function RecruiterResumeLibrary() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<LibraryItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (query = q) => {
    setLoading(true);
    try {
      const data = await recruiterResumeApi.listLibrary({ q: query || undefined, limit: 50 });
      setItems(data.resumes as LibraryItem[]);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load resume library');
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load('');
  }, []);

  const openDetail = async (item: LibraryItem) => {
    setSelected(item);
    setDetailLoading(true);
    try {
      const data = await recruiterResumeApi.getLibrary(item.id);
      const resume = data.resume as Record<string, unknown>;
      setSelected({
        ...item,
        atsScore: (resume.atsScore as number | null) ?? item.atsScore,
        atsSummary: (resume.atsSummary as string) ?? item.atsSummary,
        atsImprovements: (resume.atsImprovements as string[]) ?? item.atsImprovements,
        atsMeetsTarget: (resume.atsMeetsTarget as boolean) ?? item.atsMeetsTarget,
        atsTargetScore: (resume.atsTargetScore as number) ?? item.atsTargetScore,
        downloadUrl: (resume.downloadUrl as string) || item.downloadUrl,
      });
    } catch {
      // keep list row data
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRefresh = async (item: LibraryItem) => {
    setActingId(item.id);
    try {
      const data = await recruiterResumeApi.refreshLibrary(item.id);
      const resume = data.resume as AtsLibraryEntry & LibraryItem;
      toast.success(
        resume.atsMeetsTarget
          ? `ATS score ${resume.atsScore} — target met`
          : `Re-fixed. ATS score ${resume.atsScore ?? '—'}`
      );
      await load();
      if (selected?.id === item.id) {
        setSelected({ ...item, ...resume, id: item.id });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to re-fix resume');
    } finally {
      setActingId(null);
    }
  };

  const handleDelete = async (item: LibraryItem) => {
    if (!window.confirm(`Remove resume for ${item.studentName || item.studentPhone}?`)) return;
    setActingId(item.id);
    try {
      await recruiterResumeApi.deleteLibrary(item.id);
      toast.success('Removed from library');
      if (selected?.id === item.id) setSelected(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Resume Library</h1>
        <p className="mt-1 text-sm text-body">
          Job-tailored resumes with Gemini ATS scores. Re-fix using improvement points until 90+.
        </p>
      </div>

      <form
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          load(q);
        }}
      >
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
          <input
            className="np-input w-full !pl-9"
            placeholder="Search student, job, company…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button type="submit" className="np-btn-secondary">
          Search
        </button>
      </form>

      <div className="np-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-body">
            No resumes yet. Fix or download an ATS resume from a job to populate this library.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-body">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Job</th>
                  <th className="px-4 py-3 font-semibold">ATS</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-heading">{item.studentName || '—'}</p>
                      <p className="text-xs text-body">{item.studentPhone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-heading">{item.jobTitle || '—'}</p>
                      <p className="text-xs text-body">{item.companyName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreCell item={item} />
                    </td>
                    <td className="px-4 py-3 text-body">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="rounded-lg p-2 text-body hover:bg-muted hover:text-heading"
                          title="View"
                          onClick={() => openDetail(item)}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {item.downloadUrl && (
                          <a
                            href={item.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg p-2 text-body hover:bg-muted hover:text-heading"
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          className="rounded-lg p-2 text-body hover:bg-muted hover:text-heading"
                          title="Re-fix with improvements"
                          disabled={actingId === item.id}
                          onClick={() => handleRefresh(item)}
                        >
                          <RefreshCw
                            className={cn('h-4 w-4', actingId === item.id && 'animate-spin')}
                          />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-2 text-body hover:bg-red-50 hover:text-red-700"
                          title="Delete"
                          disabled={actingId === item.id}
                          onClick={() => handleDelete(item)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && total > 0 && (
          <p className="border-t border-border px-4 py-2 text-xs text-body">{total} resume(s)</p>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setSelected(null)}
          />
          <aside className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-heading">
                  {selected.jobTitle || 'Resume'}
                </h2>
                <p className="text-sm text-body">
                  {selected.studentName} · {selected.companyName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-1.5 text-body hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {detailLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <AtsScoreCard
                  entry={selected}
                  refreshing={actingId === selected.id}
                  onReFix={() => handleRefresh(selected)}
                />
              )}
              {selected.downloadUrl && (
                <a
                  href={selected.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="np-btn-secondary inline-flex w-full justify-center text-sm"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download file
                </a>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
