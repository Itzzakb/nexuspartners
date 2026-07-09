export const TICKET_STAGES = [
  'ticket_created',
  'group_created',
  'waiting_for_approval',
  'sent_to_onboarding',
  'onboarded_successfully',
];

export const STAGE_LABELS = {
  ticket_created: 'Ticket Created',
  group_created: 'Group Created & Instructions Completed',
  waiting_for_approval: 'Waiting for Client Approval',
  sent_to_onboarding: 'Sent to Onboarding',
  onboarded_successfully: 'Onboarded Successfully',
};

export const TICKET_TYPES = ['new_resume', 'existing_resume'];

export function getNextStages(currentStage) {
  const idx = TICKET_STAGES.indexOf(currentStage);
  if (idx === -1) return [];
  const next = [];
  if (idx < TICKET_STAGES.length - 1) next.push(TICKET_STAGES[idx + 1]);
  if (idx > 0) next.push(TICKET_STAGES[idx - 1]);
  return next;
}
