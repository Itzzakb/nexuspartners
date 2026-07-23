import type { ScrapedJob } from '@/types/jobScrap';

export interface RecruiterAccount {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  companyId: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface RecruiterCompany {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  appTitle?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface RecruiterStudent {
  phone: string;
  name: string;
  email: string;
  role: string;
  targetRole?: string;
  location: string;
  city?: string;
  state?: string;
  isActive: boolean;
  resumeStatus?: 'ready' | 'pending' | 'draft';
  subscriptionStatus?: string;
  subscriptionStatusLabel?: string;
  applicationCount?: number;
  nextDueDate?: string | null;
  companyId: string;
}

export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'offer_received'
  | 'hired'
  | 'rejected'
  | 'dropped';

export interface StudentJobAction {
  id?: string;
  status: ApplicationStatus;
  statusLabel?: string;
  appliedAt: string | null;
  droppedAt: string | null;
  statusUpdatedAt?: string | null;
  resumeFixedAt?: string | null;
  atsResumeUrl?: string;
  notes?: string;
}

export interface RecruiterApplication {
  id: string;
  status: ApplicationStatus;
  statusLabel: string;
  studentPhone: string;
  studentName: string;
  companyName: string;
  jobTitle: string;
  jobId: string;
  source: string;
  sourceRaw: string;
  location: string;
  remote: boolean;
  hybrid: boolean;
  salaryRange: string;
  appliedAt: string | null;
  droppedAt: string | null;
  statusUpdatedAt: string | null;
  resumeFixedAt: string | null;
  atsResumeUrl: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  job?: ScrapedJob | null;
}

export interface ApplicationStatusOption {
  value: ApplicationStatus;
  label: string;
}

export interface RecruiterResumeTemplate {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
}

export interface RecruiterScrapedJob extends ScrapedJob {
  verified?: boolean;
  sourceLabel?: string;
  salaryRange?: string;
  postedAge?: string;
  workType?: string;
  visaSponsorship?: boolean;
  isSponsored?: boolean;
  isApplied?: boolean;
  tags?: string[];
  metaLine?: string;
  studentAction?: StudentJobAction | null;
}

export interface StudentActivity {
  today: number;
  week: number;
  month: number;
}

export interface RecruiterStudentDetail {
  phone: string;
  name?: string;
  email?: string;
  role?: string;
  location?: string;
  isActive?: boolean;
  details: Record<string, unknown>;
  notes: string;
  companyId: string;
  companyLabel: string;
  subscription: Record<string, unknown> | null;
  payments: Array<Record<string, unknown>>;
  tickets: Array<{
    id: string;
    ticketNumber: string;
    candidateName: string;
    currentStage: string;
    createdAt: string;
  }>;
  activity: StudentActivity;
}

export interface RecruiterJobApplicant {
  phone: string;
  details: Record<string, unknown>;
  notes: string;
  companyId: string;
  companyLabel: string;
  subscription: Record<string, unknown> | null;
  payments: Array<Record<string, unknown>>;
  tickets: Array<{
    id: string;
    ticketNumber: string;
    candidateName: string;
    currentStage: string;
    createdAt: string;
  }>;
  activity: StudentActivity;
}
