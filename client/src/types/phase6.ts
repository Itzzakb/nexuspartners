export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type BillingStatus = 'draft' | 'finalized' | 'invoiced';

export interface EmployeeSalary {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  companyId: string;
  monthlySalary: number;
  currency: string;
  effectiveFrom: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeLeave {
  id: string;
  userId: string;
  userName: string;
  companyId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveStatus;
  reason: string;
  createdAt: string;
}

export interface BillingLine {
  studentName: string;
  studentPhone: string;
  studentId: string;
  activeDays: number;
  billRatePerDay: number;
  totalAmount: number;
  currency: string;
  excluded: boolean;
  excludedReason: string;
}

export interface BillingSummary {
  billingMonth: string;
  periodStart: string;
  periodEnd: string;
  companyId: string;
  companyName: string;
  billRatePerDay: number;
  currency: string;
  totalStudents: number;
  billableStudents: number;
  excludedStudents: number;
  totalAmount: number;
}

export interface BillingRecord {
  id: string;
  billingNumber: string;
  companyId: string;
  companyLabel: string;
  billingMonth: string;
  studentName: string;
  studentPhone: string;
  activeDays: number;
  billRatePerDay: number;
  totalAmount: number;
  currency: string;
  status: BillingStatus;
  excluded: boolean;
  excludedReason: string;
  batchId: string;
  createdAt: string;
}

export interface PermissionTemplate {
  id: string;
  name: string;
  companyId: string;
  modulePermissions: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface ChatParticipant {
  id: string;
  name: string;
  email: string;
}

export interface Conversation {
  id: string;
  companyId: string;
  type: 'direct' | 'group';
  title: string;
  participants: ChatParticipant[];
  lastMessageAt: string | null;
  lastMessagePreview: string;
  isCrossCompany: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  imageUrl: string;
  readBy: string[];
  createdAt: string;
}
