export interface StudentListItem {
  phone: string;
  name: string;
  email: string;
  companyId: string;
  companyLabel: string;
  paymentCount: number;
  hasActiveSubscription: boolean;
  role?: string;
  status?: 'active' | 'inactive' | 'suspended' | string;
  recruiter?: string;
  subscriptionDays?: number;
  hasResume?: boolean;
  raw?: Record<string, unknown>;
}

export interface StudentListStats {
  all: number;
  active: number;
  inactive: number;
  suspended: number;
}

export interface StudentDetail {
  phone: string;
  details: Record<string, unknown>;
  notes: string;
  companyId: string;
  companyLabel: string;
}

export interface StudentTicketRef {
  id: string;
  ticketNumber: string;
  candidateName: string;
  currentStage: string;
}

export interface StudentInterviewRef {
  id: string;
  interviewNumber: string;
  candidateName: string;
  currentStage: string;
  position?: string;
  companyName?: string;
  interviewDateTime?: string | null;
  isCancelled?: boolean;
}

export interface ResumeTemplate {
  id: string;
  name: string;
  description: string;
  templateContent: string;
  sections: string[];
  isDefault: boolean;
  companyId: string;
  companyLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppPrompt {
  _id: string;
  key: string;
  label: string;
  content: string;
  updatedAt?: string;
}
