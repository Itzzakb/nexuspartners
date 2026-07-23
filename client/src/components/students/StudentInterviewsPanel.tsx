import { Link } from 'react-router-dom';
import { Building2, CalendarDays, Video } from 'lucide-react';
import type { StudentInterviewRef } from '@/types/phase7';

const STAGE_LABELS: Record<string, string> = {
  interview_reported: 'Interview Reported',
  ready_for_interview: 'Ready for Interview',
  interview_completed: 'Interview Completed',
};

function formatInterviewWhen(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface StudentInterviewsPanelProps {
  interviews: StudentInterviewRef[];
}

export function StudentInterviewsPanel({ interviews }: StudentInterviewsPanelProps) {
  return (
    <div className="np-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Video className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-heading">Interview History</h2>
      </div>

      {interviews.length === 0 ? (
        <div className="flex min-h-[280px] items-center justify-center px-6 py-16">
          <p className="text-sm text-body">No interviews found for this student</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {interviews.map((i) => {
            const when = formatInterviewWhen(i.interviewDateTime);
            const stage = STAGE_LABELS[i.currentStage] || i.currentStage.replace(/_/g, ' ');
            return (
              <Link
                key={i.id}
                to={`/interviews/${i.id}`}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 transition hover:bg-muted/60"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-heading">
                      {i.position || i.candidateName || 'Interview'}
                    </p>
                    {i.isCancelled && (
                      <span className="rounded-pill bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                        Cancelled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-body">{i.interviewNumber}</p>
                  {i.companyName && (
                    <p className="inline-flex items-center gap-1.5 text-sm text-body">
                      <Building2 className="h-3.5 w-3.5" />
                      {i.companyName}
                    </p>
                  )}
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium capitalize text-heading">{stage}</p>
                  {when && (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-body">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {when}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
