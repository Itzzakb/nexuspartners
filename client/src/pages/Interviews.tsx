import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { interviewApi } from '@/lib/api';
import { InterviewCard } from '@/components/interviews/InterviewCard';
import type { Interview } from '@/types/phase4';

const VIEWS = [
  { value: 'all', label: 'Active Interviews' },
  { value: 'completed', label: 'Interview Completed' },
];

export default function Interviews() {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') || 'all';
  const companyId = searchParams.get('companyId') || '';

  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkReason, setBulkReason] = useState('');
  const [bulkMoved, setBulkMoved] = useState<'yes' | 'no' | ''>('');

  const queryParams = useMemo(() => {
    const p: Record<string, string> = { view };
    if (companyId) p.companyId = companyId;
    return p;
  }, [view, companyId]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await interviewApi.list(queryParams);
      setInterviews(data.interviews);
    } catch {
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [queryParams]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBulkComplete = async () => {
    if (!selected.size) return;
    await interviewApi.bulk({
      ids: [...selected],
      action: 'complete',
      movedForward: bulkMoved === 'yes' ? true : bulkMoved === 'no' ? false : undefined,
      movedForwardReason: bulkReason || undefined,
    });
    setSelected(new Set());
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">Interviews</h1>
          <p className="mt-1 text-body">Track candidate interviews through each stage</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="np-btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
          <Link to="/interviews/new" className="np-btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            Report Interview
          </Link>
        </div>
      </div>

      <div className="np-card flex flex-wrap gap-3 p-4">
        <select
          className="np-input max-w-xs"
          value={view}
          onChange={(e) => setFilter('view', e.target.value)}
        >
          {VIEWS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>

        {user?.isPlatformAdmin && (
          <select
            className="np-input max-w-xs"
            value={companyId}
            onChange={(e) => setFilter('companyId', e.target.value)}
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {view === 'completed' && selected.size > 0 && (
        <div className="np-card flex flex-wrap items-end gap-3 p-4">
          <p className="text-sm text-body">{selected.size} selected</p>
          <select
            className="np-input max-w-xs"
            value={bulkMoved}
            onChange={(e) => setBulkMoved(e.target.value as 'yes' | 'no' | '')}
          >
            <option value="">Moved forward?</option>
            <option value="yes">Yes — moved forward</option>
            <option value="no">No — not moved forward</option>
          </select>
          <input
            className="np-input max-w-sm"
            placeholder="Reason (optional)"
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
          />
          <button type="button" className="np-btn-primary" onClick={handleBulkComplete}>
            Mark completed
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-body">Loading interviews...</p>
      ) : interviews.length === 0 ? (
        <div className="np-card p-8 text-center text-body">No interviews found</div>
      ) : (
        <div className="space-y-3">
          {interviews.map((interview) => (
            <InterviewCard
              key={interview.id}
              interview={interview}
              showCheckbox={view === 'completed'}
              selected={selected.has(interview.id)}
              onSelect={toggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
