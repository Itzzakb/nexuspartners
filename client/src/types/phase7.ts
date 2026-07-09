export interface StudentListItem {
  phone: string;
  name: string;
  email: string;
  companyId: string;
  companyLabel: string;
  paymentCount: number;
  hasActiveSubscription: boolean;
  raw?: Record<string, unknown>;
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
