import { Link } from 'react-router-dom';
import { Calendar, ExternalLink } from 'lucide-react';
import type { Interview } from '@/types/phase4';
import { INTERVIEW_STAGE_LABELS } from '@/types/phase4';
import { cn } from '@/lib/utils';
import { Toggle } from '@/components/ui/Toggle';

const stageColors: Record<string, string> = {
  interview_reported: 'bg-blue-100 text-blue-800',
  ready_for_interview: 'bg-amber-100 text-amber-800',
  interview_completed: 'bg-green-100 text-green-800',
};

interface InterviewCardProps {
  interview: Interview;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  showCheckbox?: boolean;
}

export function InterviewCard({ interview, selected, onSelect, showCheckbox }: InterviewCardProps) {
  const dt = interview.interviewDateTime
    ? new Date(interview.interviewDateTime).toLocaleString()
    : 'Not scheduled';

  return (
    <div className="np-card p-4">
      <div className="flex items-start gap-3">
        {showCheckbox && onSelect && (
          <Toggle
            size="sm"
            className="mt-0.5"
            checked={!!selected}
            onChange={(checked) => onSelect(interview.id, checked)}
            aria-label={`Select ${interview.candidateName}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/interviews/${interview.id}`} className="font-semibold text-heading hover:underline">
              {interview.candidateName}
            </Link>
            <span className="text-xs text-body">{interview.interviewNumber}</span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                stageColors[interview.currentStage] || 'bg-muted text-body'
              )}
            >
              {INTERVIEW_STAGE_LABELS[interview.currentStage]}
            </span>
            {interview.isCancelled && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Cancelled</span>
            )}
            {interview.isSelfInstruction && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">Self</span>
            )}
          </div>

          <p className="mt-1 text-sm text-body">
            {interview.position && <span>{interview.position} · </span>}
            {interview.companyName || interview.companyLabel}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-body">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {dt}
            </span>
            {interview.studentPhone && <span>📱 {interview.studentPhone}</span>}
            {interview.movedForward === true && (
              <span className="text-green-700">Moved forward</span>
            )}
            {interview.movedForward === false && (
              <span className="text-red-700">Not moved forward</span>
            )}
          </div>
        </div>

        {interview.shareLink && (
          <a
            href={interview.shareLink}
            target="_blank"
            rel="noreferrer"
            className="text-body hover:text-heading"
            title="Share link"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}
