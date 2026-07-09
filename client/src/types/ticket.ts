export type TicketStage =
  | 'ticket_created'
  | 'group_created'
  | 'waiting_for_approval'
  | 'sent_to_onboarding'
  | 'onboarded_successfully';

export type TicketType = 'new_resume' | 'existing_resume';

export type TicketView =
  | 'all'
  | 'new_resumes'
  | 'existing_resume'
  | 'my_tickets'
  | 'waiting_for_approval'
  | 'group_created'
  | 'sent_to_onboarding'
  | 'onboarded'
  | 'deleted';

export interface Ticket {
  id: string;
  ticketNumber: string;
  ticketType: TicketType;
  candidateName: string;
  phone: string;
  email: string;
  dueDate: string | null;
  notes: string;
  chatLink: string;
  studentPhone: string;
  studentProfileLink: string;
  currentStage: TicketStage;
  companyId: string;
  companyName: string;
  createdBy: string | null;
  createdByName: string;
  createdByLabel: string;
  assignedTo: string | null;
  assignedToName: string;
  resumeFiles: Array<{ name: string; url: string; type: string; uploadedAt: string }>;
  workNotes: Array<{ id: string; text: string; authorName: string; createdAt: string }>;
  onboardingNotes: Array<{ id: string; text: string; authorName: string; createdAt: string }>;
  onboardingSuccessful: boolean | null;
  sendBackReason: string;
  resumeFormToken: string;
  resumeFormStatus: 'unfilled' | 'partial' | 'completed';
  resumeFormEditEnabled?: boolean;
  resumeFormData?: import('@/types/resumeForm').ResumeFormData | null;
  resumeFormRows?: [string, string][];
  resumeFormViewLink?: string;
  resumeFormLink: string;
  isDeleted: boolean;
  deleteReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketHistoryEntry {
  id: string;
  fromStage: TicketStage | null;
  toStage: TicketStage;
  note: string;
  changedByName: string;
  createdAt: string;
}

export const STAGE_LABELS: Record<TicketStage, string> = {
  ticket_created: 'Ticket Created',
  group_created: 'Group Created & Instructions Completed',
  waiting_for_approval: 'Waiting for Client Approval',
  sent_to_onboarding: 'Sent to Onboarding',
  onboarded_successfully: 'Onboarded Successfully',
};

export const STAGE_ORDER: TicketStage[] = [
  'ticket_created',
  'group_created',
  'waiting_for_approval',
  'sent_to_onboarding',
  'onboarded_successfully',
];

export interface TicketStats {
  total: number;
  pending: number;
  waitingForApproval: number;
  completed: number;
  sentToOnboarding: number;
}

export interface TicketDashboardTrend {
  value: number;
  label: string;
}

export interface TicketDashboardData {
  stats: TicketStats;
  trends: {
    total: TicketDashboardTrend;
    pending: TicketDashboardTrend;
    waiting: TicketDashboardTrend;
    completed: TicketDashboardTrend;
  };
  activity: Array<{ date: string; count: number }>;
  recentTickets: Ticket[];
  activeTicketCount: number;
}
