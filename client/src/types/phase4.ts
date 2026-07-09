export type InterviewStage = 'interview_reported' | 'ready_for_interview' | 'interview_completed';

export interface Interview {
  id: string;
  interviewNumber: string;
  candidateName: string;
  phone: string;
  studentPhone: string;
  position: string;
  companyName: string;
  interviewDateTime: string | null;
  timezone: string;
  jobDescription: string;
  screenshotUrl: string;
  resumeFileUrl: string;
  currentStage: InterviewStage;
  isCancelled: boolean;
  isSelfInstruction: boolean;
  movedForward: boolean | null;
  movedForwardReason: string;
  companyId: string;
  companyLabel: string;
  shareToken: string;
  shareLink: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewStats {
  total: number;
  reported: number;
  ready: number;
  completed: number;
  upcoming: number;
}

export interface PlacementDocument {
  _id?: string;
  type: 'offer_letter' | 'interview_screenshot' | 'other';
  label: string;
  url: string;
  publicId?: string;
}

export interface JobPlacement {
  id: string;
  candidateName: string;
  email: string;
  mobile: string;
  companyName: string;
  placementDate: string | null;
  durationMonths: number;
  documents: PlacementDocument[];
  companyId: string;
  companyLabel: string;
  isDeleted: boolean;
  deleteReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  _id?: string;
  username: string;
  name: string;
  email: string;
  mobile: string;
}

export interface Team {
  id: string;
  teamName: string;
  teamLeadName: string;
  teamLeadPhone: string;
  teamLeadEmail: string;
  teamLeadUserId?: string;
  members: TeamMember[];
  companyId: string;
  companyLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalStudent {
  name?: string;
  studentname?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  username?: string;
  [key: string]: unknown;
}

export interface ExternalRecruiter {
  name?: string;
  username?: string;
  email?: string;
  mobile?: string;
  phone?: string;
  [key: string]: unknown;
}

export const INTERVIEW_STAGE_LABELS: Record<InterviewStage, string> = {
  interview_reported: 'Interview Reported',
  ready_for_interview: 'Ready for Interview',
  interview_completed: 'Interview Completed',
};
