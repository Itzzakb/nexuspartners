import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { StageBadge } from '@/components/tickets/StageBadge';
import type { Interview } from '@/types/phase4';
import { INTERVIEW_STAGE_LABELS } from '@/types/phase4';
import type { InterviewStats } from '@/types/phase4';
import type { Ticket } from '@/types/ticket';
import { cn } from '@/lib/utils';

type TabId = 'tickets' | 'interviews' | 'stages';

interface DashboardBottomPanelProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  tickets: Ticket[];
  ticketCount: number;
  interviews: Interview[];
  interviewCount: number;
  interviewStats: InterviewStats | null;
}

const tabs: { id: TabId; label: string; count?: number }[] = [
  { id: 'tickets', label: 'Tickets' },
  { id: 'interviews', label: 'Interviews' },
  { id: 'stages', label: 'Stages' },
];

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ticketTypeLabel(type: string) {
  return type === 'new_resume' ? 'New Resume' : 'Existing Resume';
}

export function DashboardBottomPanel({
  activeTab,
  onTabChange,
  tickets,
  ticketCount,
  interviews,
  interviewCount,
  interviewStats,
}: DashboardBottomPanelProps) {
  const tabCounts: Record<TabId, number | undefined> = {
    tickets: ticketCount,
    interviews: interviewCount,
    stages: undefined,
  };

  return (
    <div className="np-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 pt-4">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'border-b-2 pb-3 text-sm font-medium transition',
                activeTab === tab.id
                  ? 'border-primary text-heading'
                  : 'border-transparent text-body hover:text-heading'
              )}
            >
              {tab.label}
              {tabCounts[tab.id] !== undefined && (
                <span className="ml-1 text-body">({tabCounts[tab.id]})</span>
              )}
            </button>
          ))}
        </div>
        <Link
          to="/tickets?view=all"
          className="flex items-center gap-1 pb-3 text-sm font-medium text-primary hover:underline"
        >
          View All
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="p-4">
        {activeTab === 'tickets' && (
          <>
            {tickets.length === 0 ? (
              <p className="py-10 text-center text-sm text-body">No active tickets</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-body">
                      <th className="px-3 py-2 font-medium">Candidate</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Due Date</th>
                      <th className="px-3 py-2 font-medium">Assigned To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tickets.map((t) => (
                      <tr key={t.id} className="transition hover:bg-muted/40">
                        <td className="px-3 py-3">
                          <Link to={`/ticket/${t.id}`} className="font-medium text-heading hover:underline">
                            {t.candidateName}
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-pill bg-muted px-2.5 py-0.5 text-xs font-medium text-body">
                            {ticketTypeLabel(t.ticketType)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <StageBadge stage={t.currentStage} />
                        </td>
                        <td className="px-3 py-3 text-body">{formatDate(t.dueDate)}</td>
                        <td className="px-3 py-3 text-body">{t.assignedToName || 'Unallocated'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === 'interviews' && (
          <>
            {interviews.length === 0 ? (
              <p className="py-10 text-center text-sm text-body">
                No upcoming interviews in the next 7 days
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-body">
                      <th className="px-3 py-2 font-medium">Candidate</th>
                      <th className="px-3 py-2 font-medium">Company</th>
                      <th className="px-3 py-2 font-medium">Position</th>
                      <th className="px-3 py-2 font-medium">Date &amp; Time</th>
                      <th className="px-3 py-2 font-medium">Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {interviews.map((i) => (
                      <tr key={i.id} className="transition hover:bg-muted/40">
                        <td className="px-3 py-3">
                          <Link to={`/interviews/${i.id}`} className="font-medium text-heading hover:underline">
                            {i.candidateName}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-body">{i.companyName || i.companyLabel || '—'}</td>
                        <td className="px-3 py-3 text-body">{i.position || '—'}</td>
                        <td className="px-3 py-3 text-body">{formatDateTime(i.interviewDateTime)}</td>
                        <td className="px-3 py-3 text-body">
                          {INTERVIEW_STAGE_LABELS[i.currentStage]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === 'stages' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StageStatCard
              label="Total Active"
              value={Math.max(0, (interviewStats?.total ?? 0) - (interviewStats?.completed ?? 0))}
            />
            <StageStatCard label="Interview Reported" value={interviewStats?.reported ?? 0} />
            <StageStatCard label="Ready for Interview" value={interviewStats?.ready ?? 0} />
            <StageStatCard label="Interview Completed" value={interviewStats?.completed ?? 0} />
          </div>
        )}
      </div>
    </div>
  );
}

function StageStatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted px-4 py-6 text-center">
      <p className="text-3xl font-semibold text-heading">{value}</p>
      <p className="mt-1 text-sm text-body">{label}</p>
    </div>
  );
}
