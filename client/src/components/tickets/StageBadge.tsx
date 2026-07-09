import { STAGE_LABELS, type TicketStage } from '@/types/ticket';
import { cn } from '@/lib/utils';

const stageColors: Record<TicketStage, string> = {
  ticket_created: 'bg-blue-100 text-blue-700',
  group_created: 'bg-purple-100 text-purple-700',
  waiting_for_approval: 'bg-amber-100 text-amber-700',
  sent_to_onboarding: 'bg-indigo-100 text-indigo-700',
  onboarded_successfully: 'bg-green-100 text-green-700',
};

export function StageBadge({ stage, className }: { stage: TicketStage; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-pill px-2.5 py-0.5 text-xs font-medium',
        stageColors[stage],
        className
      )}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}
