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
  location: string;
  isActive: boolean;
  companyId: string;
}

export interface StudentJobAction {
  status: 'saved' | 'applied' | 'dropped';
  appliedAt: string | null;
  droppedAt: string | null;
  resumeFixedAt?: string | null;
  atsResumeUrl?: string;
}

export interface RecruiterResumeTemplate {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
}

export interface RecruiterScrapedJob extends ScrapedJob {
  verified?: boolean;
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
