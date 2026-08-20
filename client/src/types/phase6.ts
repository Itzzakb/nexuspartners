export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type BillingStatus = 'draft' | 'finalized' | 'invoiced';

export interface SalaryEmployee {
  key: string;
  type: 'user' | 'recruiter';
  id: string;
  name: string;
  email: string;
  label: string;
  role?: string;
  username?: string;
}

export type SalaryRowCategory = 'with_salary' | 'no_salary' | 'discontinued';

export interface SalaryDashboardRow {
  employeeKey: string;
  employeeType: 'user' | 'recruiter';
  employeeId: string;
  name: string;
  email: string;
  category: SalaryRowCategory;
  salaryId: string | null;
  startDate: string | null;
  monthlySalary: number;
  currency: string;
  allowedLeaves: number;
  status: 'active' | 'discontinued';
  notes: string;
  leaveDays: number;
  deductibleDays: number;
  leaveDates: string[];
  expected: number;
  actual: number;
  monthlyLeaveId: string | null;
}

export interface SalaryDashboardStats {
  totalEmployees: number;
  noSalarySet: number;
  withSalary: number;
  discontinued: number;
  expectedTotal: number;
  actualTotal: number;
}

export interface EmployeeSalary {
  id: string;
  employeeType?: 'user' | 'recruiter';
  userId: string;
  recruiterId?: string;
  userName: string;
  userEmail: string;
  companyId: string;
  monthlySalary: number;
  currency: string;
  effectiveFrom: string | null;
  allowedLeaves?: number;
  status?: 'active' | 'discontinued';
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeLeave {
  id: string;
  employeeType?: 'user' | 'recruiter';
  userId: string;
  recruiterId?: string;
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
