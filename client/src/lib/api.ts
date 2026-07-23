import type { Ticket, TicketHistoryEntry, TicketStats, TicketView, TicketDashboardData } from '@/types/ticket';
import type {
  Interview,
  InterviewStats,
  JobPlacement,
  Team,
  ExternalStudent,
  ExternalRecruiter,
} from '@/types/phase4';
import type {
  PaymentRecord,
  PaymentLink,
  PaymentStats,
  SubscriptionSchedule,
} from '@/types/payment';
import type {
  EmployeeSalary,
  EmployeeLeave,
  BillingRecord,
  BillingSummary,
  BillingLine,
  PermissionTemplate,
  Conversation,
  ChatMessage,
} from '@/types/phase6';
import type {
  StudentListItem,
  StudentListStats,
  StudentDetail,
  StudentTicketRef,
  StudentInterviewRef,
  ResumeTemplate,
  AppPrompt,
} from '@/types/phase7';
import type {
  JobSearchProfile,
  ScrapedJob,
  JobScrapRun,
  JobScrapStats,
  JobSearchFilters,
  JobScrapMasterItem,
  MasterDataCategory,
} from '@/types/jobScrap';
import { DEFAULT_APP_TITLE, DEFAULT_LOGO } from '@/lib/branding';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  logoPublicId?: string;
  faviconUrl?: string;
  faviconPublicId?: string;
  appTitle?: string;
  primaryColor?: string;
  secondaryColor?: string;
  isPlatformAdmin?: boolean;
  website?: string;
  owners?: Array<{ _id?: string; name: string; email: string; phone: string }>;
  documents?: Array<{ _id?: string; label: string; type: string; url: string }>;
  razorpay?: { enabled: boolean; keyId?: string; keySecret?: string };
  zohoEnabled?: boolean;
  skipBillingNames?: string[];
  demoProfileIds?: string[];
  paymentTypes?: string[];
  billRatePerDay?: number;
  billingCurrency?: string;
  salaryCurrency?: string;
  createStudentPassword?: string;
  visaTypes?: string[];
  additionalDetailFields?: string[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'admin' | 'mentor' | 'resume' | 'onboarding';
  companyId: string;
  isActive: boolean;
  isCompanyAdmin: boolean;
  isPlatformAdmin: boolean;
  modulePermissions?: Record<string, boolean>;
  permissionTemplateId?: string;
  companyName?: string;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken() {
  return localStorage.getItem('accessToken');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || 'Request failed', res.status);
  }

  return data as T;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ user: User; company: Company; accessToken: string; refreshToken: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
  register: (payload: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    role?: string;
    companyId: string;
  }) =>
    api<{ user: User; company: Company; accessToken: string; refreshToken: string }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(payload) }
    ),
  me: () => api<{ user: User; company: Company }>('/auth/me'),
  logout: (refreshToken: string) =>
    api('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  forgotPassword: (email: string) =>
    api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
};

export const companyApi = {
  listPublic: () => api<{ companies: Company[] }>('/companies/public'),
  listAll: () => api<{ companies: Company[] }>('/companies'),
  create: (payload: Partial<Company>) =>
    api<{ company: Company }>('/companies', { method: 'POST', body: JSON.stringify(payload) }),
  getMy: () => api<{ company: Company }>('/companies/me'),
  updateMy: (payload: Partial<Company>) =>
    api<{ company: Company }>('/companies/me', { method: 'PATCH', body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<Company>) =>
    api<{ company: Company }>(`/companies/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
};

export const userApi = {
  list: (companyId?: string) =>
    api<{ users: User[] }>(`/users${companyId ? `?companyId=${companyId}` : ''}`),
  create: (payload: Partial<User> & { email: string; password: string; name: string }) =>
    api<{ user: User }>('/users', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<User>) =>
    api<{ user: User }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  sendReset: (id: string) =>
    api(`/users/${id}/send-reset`, { method: 'POST', body: JSON.stringify({}) }),
};

export const ticketApi = {
  list: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api<{ tickets: Ticket[] }>(`/tickets${qs ? `?${qs}` : ''}`);
  },
  stats: () => api<{ stats: TicketStats }>('/tickets/stats'),
  dashboard: (range: '7d' | '30d' | '3m' = '30d') =>
    api<TicketDashboardData>(`/tickets/dashboard?range=${range}`),
  get: (id: string) =>
    api<{ ticket: Ticket; history: TicketHistoryEntry[] }>(`/tickets/${id}`),
  create: (payload: Partial<Ticket> & { candidateName: string; ticketType: string }) =>
    api<{ ticket: Ticket }>('/tickets', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<Ticket>) =>
    api<{ ticket: Ticket }>(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  changeStage: (id: string, stage: string, note?: string) =>
    api<{ ticket: Ticket }>(`/tickets/${id}/stage`, {
      method: 'POST',
      body: JSON.stringify({ stage, note }),
    }),
  assign: (id: string, assignedTo: string | null) =>
    api<{ ticket: Ticket }>(`/tickets/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assignedTo }),
    }),
  assignRecruiter: (id: string, recruiterUsername: string | null) =>
    api<{ ticket: Ticket }>(`/tickets/${id}/assign-recruiter`, {
      method: 'POST',
      body: JSON.stringify({ recruiterUsername }),
    }),
  addNote: (id: string, text: string, type: 'work' | 'onboarding' = 'work') =>
    api<{ ticket: Ticket }>(`/tickets/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ text, type }),
    }),
  addFile: (id: string, payload: { name: string; url: string; type?: string }) =>
    api<{ ticket: Ticket }>(`/tickets/${id}/files`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  delete: (id: string, reason: string) =>
    api<{ success: boolean }>(`/tickets/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),
  restore: (id: string) =>
    api<{ success: boolean; ticket: Ticket }>(`/tickets/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  resumeTeam: (companyId?: string) =>
    api<{ members: Array<{ id: string; name: string; email: string }> }>(
      `/tickets/resume-team${companyId ? `?companyId=${companyId}` : ''}`
    ),
  enableFormEdit: (id: string) =>
    api<{ ticket: Ticket }>(`/tickets/${id}/enable-form-edit`, { method: 'POST', body: '{}' }),
  syncStudentResume: (id: string) =>
    api<{ success: boolean; message: string; student: { id: string; phone: string; name: string } }>(
      `/tickets/${id}/sync-student-resume`,
      { method: 'POST', body: '{}' }
    ),
  getFormShareLink: (id: string) =>
    api<{ resumeFormViewLink: string; resumeFormViewToken: string }>(
      `/tickets/${id}/form-share-link`,
      { method: 'POST', body: '{}' }
    ),
};

export const resumeParseApi = {
  parse: (text: string) =>
    api<{ success: boolean; parsed: unknown; source: string }>('/resume/parse', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  buildDownload: (payload: { phone: string; templateId?: string; companyId?: string }) =>
    api<{
      success: boolean;
      result: { downloadUrl?: string; filename?: string; mock?: boolean; message?: string };
    }>('/resume/build-download', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateStudent: (payload: { phone: string; resumeData: unknown; companyId?: string }) =>
    api<{ success: boolean; result: unknown }>('/resume/update-student', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  /** Upload PDF/DOCX/TXT → parse → auto-save student.resume */
  importStudent: (payload: { phone: string; file: File; companyId?: string }) => {
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('phone', payload.phone);
    if (payload.companyId) formData.append('companyId', payload.companyId);
    return api<{
      success: boolean;
      resume: Record<string, unknown>;
      source: string;
      filename: string;
      message: string;
    }>('/resume/import-student', {
      method: 'POST',
      body: formData,
    });
  },
};

export const interviewApi = {
  list: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api<{ interviews: Interview[] }>(`/interviews${qs ? `?${qs}` : ''}`);
  },
  stats: (companyId?: string) =>
    api<{ stats: InterviewStats }>(
      `/interviews/stats${companyId ? `?companyId=${companyId}` : ''}`
    ),
  get: (id: string) => api<{ interview: Interview }>(`/interviews/${id}`),
  create: (payload: Partial<Interview> & { candidateName: string }) =>
    api<{ interview: Interview }>('/interviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id: string, payload: Partial<Interview>) =>
    api<{ interview: Interview }>(`/interviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  bulk: (payload: {
    ids: string[];
    action: 'complete' | 'delete';
    movedForward?: boolean;
    movedForwardReason?: string;
  }) =>
    api<{ success: boolean; count: number }>('/interviews/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  delete: (id: string, reason?: string) =>
    api<{ success: boolean }>(`/interviews/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),
  getShared: (token: string) =>
    api<{ interview: Interview; companyLogo: string }>(`/interviews/share/${token}`),
};

export const placementApi = {
  list: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api<{ placements: JobPlacement[] }>(`/placements${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => api<{ placement: JobPlacement }>(`/placements/${id}`),
  create: (payload: Partial<JobPlacement> & { candidateName: string }) =>
    api<{ placement: JobPlacement }>('/placements', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id: string, payload: Partial<JobPlacement>) =>
    api<{ placement: JobPlacement }>(`/placements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  delete: (id: string, password: string, reason?: string) =>
    api<{ success: boolean }>(`/placements/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ password, reason }),
    }),
};

export const teamApi = {
  list: (companyId?: string) =>
    api<{ teams: Team[] }>(`/teams${companyId ? `?companyId=${companyId}` : ''}`),
  my: () => api<{ teams: Team[] }>('/teams/my'),
  get: (id: string) => api<{ team: Team }>(`/teams/${id}`),
  create: (payload: Partial<Team> & { teamName: string; teamLeadName: string }) =>
    api<{ team: Team }>('/teams', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<Team>) =>
    api<{ team: Team }>(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  memberStudents: (teamId: string, username: string) =>
    api<{ students: ExternalStudent[] }>(`/teams/${teamId}/members/${username}/students`),
  companyUsers: (companyId?: string) =>
    api<{ users: Array<{ id: string; name: string; email: string; phone: string }> }>(
      `/teams/users${companyId ? `?companyId=${companyId}` : ''}`
    ),
};

export const externalApi = {
  students: (companyId?: string) =>
    api<{ students: ExternalStudent[] }>('/external/students', {
      method: 'POST',
      body: JSON.stringify(companyId ? { companyId } : {}),
    }),
  studentDetails: (phone: string) =>
    api<{ student: unknown }>('/external/student-details', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  recruiters: (companyId?: string) =>
    api<{ clerks: ExternalRecruiter[] }>('/external/recruiters', {
      method: 'POST',
      body: JSON.stringify(companyId ? { companyId } : {}),
    }),
  getRecruiter: (username: string, companyId?: string) =>
    api<{ clerk: ExternalRecruiter }>(
      `/external/recruiters/${encodeURIComponent(username)}${
        companyId ? `?companyId=${encodeURIComponent(companyId)}` : ''
      }`
    ),
  jobRoles: () => api<{ jobroles: string[] }>('/external/job-roles'),
  createRecruiter: (payload: {
    name: string;
    email: string;
    username: string;
    password: string;
    mobile?: string;
    companyId?: string;
  }) =>
    api<{ success: boolean }>('/external/recruiters/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRecruiter: (payload: {
    username: string;
    companyId?: string;
    data: {
      name?: string;
      email?: string;
      mobile?: string;
      password?: string;
    };
  }) =>
    api<{ success: boolean; clerk: ExternalRecruiter }>('/external/recruiters/update', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const paymentApi = {
  list: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api<{ payments: PaymentRecord[] }>(`/payments${qs ? `?${qs}` : ''}`);
  },
  stats: (companyId?: string) =>
    api<{ stats: PaymentStats }>(`/payments/stats${companyId ? `?companyId=${companyId}` : ''}`),
  createManual: (payload: {
    studentName: string;
    studentPhone?: string;
    studentEmail?: string;
    amount: number;
    currency?: string;
    paymentMethod?: string;
    paymentType?: string;
    description?: string;
    notes?: string;
    companyId?: string;
  }) =>
    api<{ payment: PaymentRecord }>('/payments/manual', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listLinks: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api<{ links: PaymentLink[] }>(`/payments/links${qs ? `?${qs}` : ''}`);
  },
  createLink: (payload: {
    customerName: string;
    customerEmail?: string;
    customerContact?: string;
    amount: number;
    currency?: string;
    description?: string;
    paymentType?: string;
    expireBy?: string;
    notifyEmail?: boolean;
    notifySms?: boolean;
    companyId?: string;
    subscriptionScheduleId?: string;
  }) =>
    api<{ link: PaymentLink; mock?: boolean }>('/payments/razorpay/link', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  simulateMockPay: (razorpayLinkId: string) =>
    api<{ success: boolean; link: PaymentLink }>(
      `/payments/mock/${encodeURIComponent(razorpayLinkId)}/pay`,
      { method: 'POST', body: '{}' }
    ),
  listSubscriptions: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api<{ subscriptions: SubscriptionSchedule[] }>(
      `/payments/subscriptions${qs ? `?${qs}` : ''}`
    );
  },
  createSubscription: (payload: Partial<SubscriptionSchedule> & { studentName: string }) =>
    api<{ subscription: SubscriptionSchedule }>('/payments/subscriptions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const salaryApi = {
  verifyPassword: (password: string) =>
    api<{ success: boolean }>('/salaries/verify-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  list: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api<{ salaries: EmployeeSalary[] }>(`/salaries${qs ? `?${qs}` : ''}`);
  },
  upsert: (payload: {
    userId: string;
    monthlySalary: number;
    currency?: string;
    effectiveFrom?: string;
    notes?: string;
    companyId?: string;
    password: string;
  }) =>
    api<{ salary: EmployeeSalary }>('/salaries', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  delete: (id: string, password: string) =>
    api<{ success: boolean }>(`/salaries/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),
  listLeaves: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api<{ leaves: EmployeeLeave[] }>(`/salaries/leaves${qs ? `?${qs}` : ''}`);
  },
  createLeave: (payload: Partial<EmployeeLeave> & { userId: string; startDate: string; endDate: string }) =>
    api<{ leave: EmployeeLeave }>('/salaries/leaves', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateLeave: (id: string, payload: Partial<EmployeeLeave>) =>
    api<{ leave: EmployeeLeave }>(`/salaries/leaves/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

export const billingApi = {
  list: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api<{ records: BillingRecord[] }>(`/billing${qs ? `?${qs}` : ''}`);
  },
  preview: (year: number, month: number, companyId?: string) => {
    const qs = new URLSearchParams({
      year: String(year),
      month: String(month),
      ...(companyId ? { companyId } : {}),
    });
    return api<{ summary: BillingSummary; lines: BillingLine[] }>(`/billing/preview?${qs}`);
  },
  generate: (payload: { year: number; month: number; companyId?: string; finalize?: boolean }) =>
    api<{ batchId: string; summary: BillingSummary; records: BillingRecord[] }>(
      '/billing/generate',
      { method: 'POST', body: JSON.stringify(payload) }
    ),
  batches: (companyId?: string) =>
    api<{ batches: Array<Record<string, unknown>> }>(
      `/billing/batches${companyId ? `?companyId=${companyId}` : ''}`
    ),
  updateRecord: (id: string, payload: { status?: string; invoiceNumber?: string }) =>
    api<{ record: BillingRecord }>(`/billing/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

export const permissionApi = {
  modules: () => api<{ modules: string[] }>('/permissions/modules'),
  listTemplates: (companyId?: string) =>
    api<{ templates: PermissionTemplate[] }>(
      `/permissions/templates${companyId ? `?companyId=${companyId}` : ''}`
    ),
  createTemplate: (payload: { name: string; modulePermissions: Record<string, boolean>; companyId?: string }) =>
    api<{ template: PermissionTemplate }>('/permissions/templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTemplate: (id: string, payload: Partial<PermissionTemplate>) =>
    api<{ template: PermissionTemplate }>(`/permissions/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteTemplate: (id: string) =>
    api<{ success: boolean }>(`/permissions/templates/${id}`, { method: 'DELETE' }),
  updateUser: (id: string, payload: { modulePermissions?: Record<string, boolean>; permissionTemplateId?: string }) =>
    api<{ user: User }>(`/permissions/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

export const chatApi = {
  conversations: () => api<{ conversations: Conversation[] }>('/chat/conversations'),
  start: (payload: { participantId?: string; participantIds?: string[]; title?: string }) =>
    api<{ conversation: Conversation }>('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  messages: (conversationId: string) =>
    api<{ messages: ChatMessage[]; conversation: Conversation }>(
      `/chat/conversations/${conversationId}/messages`
    ),
  send: (conversationId: string, payload: { text?: string; imageUrl?: string; imagePublicId?: string }) =>
    api<{ message: ChatMessage }>(`/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  markRead: (conversationId: string) =>
    api<{ success: boolean }>(`/chat/conversations/${conversationId}/read`, {
      method: 'POST',
      body: '{}',
    }),
  searchUsers: (q?: string, companyId?: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (companyId) params.set('companyId', companyId);
    const qs = params.toString();
    return api<{ users: Array<{ id: string; name: string; email: string }> }>(
      `/chat/users${qs ? `?${qs}` : ''}`
    );
  },
};

export const studentApi = {
  list: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api<{ students: StudentListItem[]; stats?: StudentListStats }>(
      `/students${qs ? `?${qs}` : ''}`
    );
  },
  lookupByPhone: (phone: string, companyId?: string) => {
    const params = new URLSearchParams({ phone });
    if (companyId) params.set('companyId', companyId);
    return api<{
      exists: boolean;
      student: { id: string; name: string; phone: string; email: string } | null;
    }>(`/students/lookup?${params.toString()}`);
  },
  get: (phone: string, companyId?: string) =>
    api<{
      student: StudentDetail;
      payments: unknown[];
      subscription: unknown | null;
      tickets: StudentTicketRef[];
      interviews: StudentInterviewRef[];
      billing: unknown[];
      activity?: { today: number; week: number; month: number };
    }>(`/students/${encodeURIComponent(phone)}${companyId ? `?companyId=${companyId}` : ''}`),
  create: (payload: {
    name: string;
    mobile: string;
    email?: string;
    password: string;
    companyId?: string;
  }) =>
    api<{ success: boolean; result: unknown }>('/students', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resolveTicketProfile: (ticketId: string) =>
    api<{
      exists: boolean;
      student?: { id: string; phone: string; name: string; email: string };
      ticket?: {
        id: string;
        ticketNumber: string;
        companyId: string;
        resumeFormStatus: 'unfilled' | 'partial' | 'completed';
      };
      prefill?: {
        name: string;
        email: string;
        mobile: string;
        role: string;
        linkedin: string;
        address: string;
        visa: string;
        additionalDetails: Array<{ key: string; data: string }>;
      };
    }>(`/students/ticket/${ticketId}/profile`),
  createFromTicket: (
    ticketId: string,
    payload: {
      name: string;
      mobile: string;
      email?: string;
      role?: string;
      linkedin?: string;
      address?: string;
      visa?: string;
      additionalDetails?: Array<{ key: string; data: string }>;
      password: string;
    }
  ) =>
    api<{
      success: boolean;
      created: boolean;
      student: { id: string; phone: string; name: string; email: string };
      ticketId: string;
    }>(`/students/ticket/${ticketId}/create`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateNotes: (phone: string, notes: string, companyId?: string) =>
    api<{ notes: string }>(`/students/${encodeURIComponent(phone)}/notes`, {
      method: 'PATCH',
      body: JSON.stringify({ notes, companyId }),
    }),
  update: (
    phone: string,
    payload: {
      companyId?: string;
      firstName?: string;
      lastName?: string;
      name?: string;
      email?: string;
      phone?: string;
      role?: string;
      city?: string;
      state?: string;
      linkedin?: string;
      visa?: string;
      status?: string;
      recruiterUsername?: string;
      joinDate?: string;
      subscriptionAmount?: number;
      subscriptionDate?: string | null;
      subscriptionDays?: number;
      additionalDetails?: Array<{ key: string; data: string }>;
      notes?: string;
    }
  ) =>
    api<{
      success: boolean;
      student: StudentDetail;
    }>(`/students/${encodeURIComponent(phone)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

export const resumeTemplateApi = {
  list: (companyId?: string) =>
    api<{ templates: ResumeTemplate[] }>(
      `/resume-templates${companyId ? `?companyId=${companyId}` : ''}`
    ),
  create: (payload: Partial<ResumeTemplate> & { name: string }) =>
    api<{ template: ResumeTemplate }>('/resume-templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id: string, payload: Partial<ResumeTemplate>) =>
    api<{ template: ResumeTemplate }>(`/resume-templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  delete: (id: string) =>
    api<{ success: boolean }>(`/resume-templates/${id}`, { method: 'DELETE' }),
};

export const promptApi = {
  list: () => api<{ prompts: AppPrompt[] }>('/prompts'),
  update: (key: string, payload: { content?: string; label?: string }) =>
    api<{ prompt: AppPrompt }>(`/prompts/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

export const jobScrapApi = {
  stats: (companyId?: string) =>
    api<{ stats: JobScrapStats }>(
      `/job-scrap/stats${companyId ? `?companyId=${companyId}` : ''}`
    ),
  listProfiles: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api<{ profiles: JobSearchProfile[] }>(`/job-scrap/profiles${qs ? `?${qs}` : ''}`);
  },
  createProfile: (payload: {
    name: string;
    filters?: Partial<JobSearchFilters>;
    scheduleTime?: string;
    scheduleDays?: number[];
    timezone?: string;
    isActive?: boolean;
    companyId?: string;
  }) =>
    api<{ profile: JobSearchProfile }>('/job-scrap/profiles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProfile: (id: string, payload: Partial<JobSearchProfile>) =>
    api<{ profile: JobSearchProfile }>(`/job-scrap/profiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteProfile: (id: string) =>
    api<{ success: boolean }>(`/job-scrap/profiles/${id}`, { method: 'DELETE' }),
  syncProfile: (id: string) =>
    api<{ success: boolean; jobsFetched: number; jobsUpserted: number }>(
      `/job-scrap/profiles/${id}/sync`,
      { method: 'POST' }
    ),
  syncAll: (companyId?: string) =>
    api<{ results: Array<{ profileId: string; success: boolean; jobsFetched?: number; jobsUpserted?: number; error?: string }> }>(
      '/job-scrap/sync-all',
      { method: 'POST', body: JSON.stringify({ companyId }) }
    ),
  listJobs: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return api<{ jobs: ScrapedJob[]; total: number; page: number; limit: number }>(
      `/job-scrap/jobs${qs}`
    );
  },
  createManualJob: (payload: {
    jobTitle: string;
    description?: string;
    companyName?: string;
    companyDomain?: string;
    location?: string;
    countryCode?: string;
    remote?: boolean;
    hybrid?: boolean;
    applyUrl?: string;
    seniority?: string;
    notes?: string;
    companyId?: string;
  }) =>
    api<{ job: ScrapedJob }>('/job-scrap/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateJob: (id: string, payload: Partial<ScrapedJob>) =>
    api<{ job: ScrapedJob }>(`/job-scrap/jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteJob: (id: string) =>
    api<{ success: boolean }>(`/job-scrap/jobs/${id}`, { method: 'DELETE' }),
  listRuns: (companyId?: string) =>
    api<{ runs: JobScrapRun[] }>(
      `/job-scrap/runs${companyId ? `?companyId=${companyId}` : ''}`
    ),
  listMaster: (params?: { companyId?: string; category?: MasterDataCategory; activeOnly?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.companyId) qs.set('companyId', params.companyId);
    if (params?.category) qs.set('category', params.category);
    if (params?.activeOnly) qs.set('activeOnly', 'true');
    const query = qs.toString();
    return api<{ items: JobScrapMasterItem[] }>(`/job-scrap/master${query ? `?${query}` : ''}`);
  },
};

export type { TicketView };

export async function uploadFile(file: File, folder = 'nexuspartners') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  return api<{ url: string; publicId: string }>('/upload', {
    method: 'POST',
    body: formData,
  });
}

export function applyBranding(company: Company | null) {
  if (!company) return;
  const root = document.documentElement;
  if (company.primaryColor) root.style.setProperty('--brand-primary', company.primaryColor);
  if (company.secondaryColor) root.style.setProperty('--brand-secondary', company.secondaryColor);
  if (company.appTitle) document.title = company.appTitle;
  else document.title = DEFAULT_APP_TITLE;
  const favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  const faviconHref = company.faviconUrl || DEFAULT_LOGO;
  if (favicon) favicon.href = faviconHref;
  else {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = faviconHref;
    document.head.appendChild(link);
  }
}
