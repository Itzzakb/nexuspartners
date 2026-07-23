import type { Company } from '@/lib/api';
import { applyBranding } from '@/lib/api';
import type {
  RecruiterAccount,
  RecruiterCompany,
  RecruiterStudent,
  RecruiterStudentDetail,
  RecruiterScrapedJob,
  RecruiterJobApplicant,
  StudentActivity,
  RecruiterResumeTemplate,
  RecruiterApplication,
  ApplicationStatus,
  ApplicationStatusOption,
} from '@/types/recruiterPortal';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'recruiterAccessToken';
const COMPANY_KEY = 'recruiterCompany';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredRecruiterCompany(): RecruiterCompany | null {
  const raw = localStorage.getItem(COMPANY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RecruiterCompany;
  } catch {
    return null;
  }
}

export function applyRecruiterBranding(company: RecruiterCompany | null) {
  if (!company) return;
  applyBranding(company as Company);
  if (company.appTitle) {
    document.title = company.appTitle.replace('Admin', 'Recruiter Portal');
  }
}

async function recruiterApi<T>(path: string, options: RequestInit = {}): Promise<T> {
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

  const res = await fetch(`${API_BASE}/recruiter${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || 'Request failed', res.status);
  }

  return data as T;
}

export const recruiterAuthApi = {
  login: (username: string, password: string, companySlug?: string) =>
    recruiterApi<{
      recruiter: RecruiterAccount;
      company: RecruiterCompany;
      accessToken: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, companySlug }),
    }),

  me: () =>
    recruiterApi<{ recruiter: RecruiterAccount; company: RecruiterCompany }>('/auth/me'),

  storeSession: (accessToken: string, company: RecruiterCompany) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(COMPANY_KEY, JSON.stringify(company));
    applyRecruiterBranding(company);
  },

  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(COMPANY_KEY);
  },
};

export const recruiterStudentsApi = {
  list: (params: { q?: string; subscriptionStatus?: string; sort?: string } | string = '') => {
    const opts =
      typeof params === 'string' ? { q: params } : params || {};
    const qs = new URLSearchParams();
    if (opts.q) qs.set('q', opts.q);
    if (opts.subscriptionStatus) qs.set('subscriptionStatus', opts.subscriptionStatus);
    if (opts.sort) qs.set('sort', opts.sort);
    const query = qs.toString();
    return recruiterApi<{ students: RecruiterStudent[]; total: number; assignedCount: number }>(
      `/students${query ? `?${query}` : ''}`
    );
  },

  get: (phone: string) =>
    recruiterApi<{ student: RecruiterStudentDetail }>(`/students/${encodeURIComponent(phone)}`),

  activity: (phone: string) =>
    recruiterApi<{ activity: StudentActivity }>(
      `/students/${encodeURIComponent(phone)}/activity`
    ),

  /** Student-filled resume form details for apply copy/paste panel */
  getResumeForm: (phone: string) =>
    recruiterApi<{
      hasForm: boolean;
      studentPhone: string;
      studentName: string;
      studentEmail: string;
      ticket: {
        id: string;
        ticketNumber: string;
        candidateName: string;
        resumeFormStatus: string;
        updatedAt: string;
      } | null;
      rows: Array<{ label: string; value: string }>;
      fields: Array<{ key: string; label: string; value: string }>;
      formData: Record<string, unknown> | null;
      message?: string;
    }>(`/students/${encodeURIComponent(phone)}/resume-form`),

  updateNotes: (phone: string, notes: string) =>
    recruiterApi<{ notes: string }>(`/students/${encodeURIComponent(phone)}/notes`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    }),

  tickets: (phone: string) =>
    recruiterApi<{ tickets: RecruiterStudentDetail['tickets'] }>(
      `/students/${encodeURIComponent(phone)}/tickets`
    ),
};

export const recruiterJobsApi = {
  list: (params: {
    studentPhone: string;
    page?: number;
    limit?: number;
    q?: string;
    scrapedFrom?: string;
    scrapedTo?: string;
    source?: string;
    remote?: boolean;
    minExp?: number;
    maxExp?: number;
    sponsored?: boolean;
  }) => {
    const qs = new URLSearchParams();
    qs.set('studentPhone', params.studentPhone);
    if (params.page !== undefined) qs.set('page', String(params.page));
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.q) qs.set('q', params.q);
    if (params.scrapedFrom) qs.set('scrapedFrom', params.scrapedFrom);
    if (params.scrapedTo) qs.set('scrapedTo', params.scrapedTo);
    if (params.source) qs.set('source', params.source);
    if (params.remote !== undefined) qs.set('remote', String(params.remote));
    if (params.minExp !== undefined) qs.set('minExp', String(params.minExp));
    if (params.maxExp !== undefined) qs.set('maxExp', String(params.maxExp));
    if (params.sponsored !== undefined) qs.set('sponsored', String(params.sponsored));
    return recruiterApi<{
      jobs: RecruiterScrapedJob[];
      total: number;
      page: number;
      limit: number;
    }>(`/jobs?${qs.toString()}`);
  },

  get: (id: string, studentPhone: string) =>
    recruiterApi<{ job: RecruiterScrapedJob; applicant: RecruiterJobApplicant }>(
      `/jobs/${id}?studentPhone=${encodeURIComponent(studentPhone)}`
    ),

  drop: (id: string, studentPhone: string) =>
    recruiterApi<{ success: boolean }>(`/jobs/${id}/drop`, {
      method: 'POST',
      body: JSON.stringify({ studentPhone }),
    }),

  apply: (id: string, studentPhone: string) =>
    recruiterApi<{
      success: boolean;
      applyUrl: string;
      job?: { id: string; jobTitle: string; companyName: string };
      action: { id?: string; status: string; statusLabel?: string; appliedAt: string | null };
      studentForm?: {
        hasForm: boolean;
        studentPhone: string;
        studentName: string;
        studentEmail: string;
        ticket: Record<string, unknown> | null;
        rows: Array<{ label: string; value: string }>;
        fields: Array<{ key: string; label: string; value: string }>;
        formData: Record<string, unknown> | null;
        message?: string;
      } | null;
    }>(`/jobs/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify({ studentPhone }),
    }),

  fixResume: (id: string, studentPhone: string, improvements?: string[]) =>
    recruiterApi<{
      success: boolean;
      resume: Record<string, unknown>;
      source: string;
      mock?: boolean;
      libraryEntry?: {
        id: string;
        atsScore: number | null;
        atsSummary?: string;
        atsImprovements?: string[];
        atsMeetsTarget?: boolean;
        atsTargetScore?: number;
      };
      action: { resumeFixedAt: string | null; status: string };
    }>(`/jobs/${id}/fix-resume`, {
      method: 'POST',
      body: JSON.stringify({
        studentPhone,
        ...(improvements?.length ? { improvements } : {}),
      }),
    }),

  downloadAtsResume: (id: string, studentPhone: string, templateId?: string) =>
    recruiterApi<{
      success: boolean;
      downloadUrl: string;
      mock?: boolean;
      libraryEntry?: {
        id: string;
        atsScore: number | null;
        atsSummary?: string;
        atsImprovements?: string[];
        atsMeetsTarget?: boolean;
        atsTargetScore?: number;
      };
    }>(`/jobs/${id}/download-ats-resume`, {
      method: 'POST',
      body: JSON.stringify({ studentPhone, templateId }),
    }),
};

export const recruiterApplicationsApi = {
  list: (params: {
    status?: string;
    studentPhone?: string;
    q?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.studentPhone) qs.set('studentPhone', params.studentPhone);
    if (params.q) qs.set('q', params.q);
    if (params.page !== undefined) qs.set('page', String(params.page));
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return recruiterApi<{
      applications: RecruiterApplication[];
      total: number;
      page: number;
      limit: number;
      statuses: ApplicationStatusOption[];
    }>(`/applications${query ? `?${query}` : ''}`);
  },

  statuses: () =>
    recruiterApi<{ statuses: ApplicationStatusOption[] }>('/applications/statuses'),

  get: (id: string) =>
    recruiterApi<{ application: RecruiterApplication; student: RecruiterStudent | null }>(
      `/applications/${id}`
    ),

  updateStatus: (id: string, status: ApplicationStatus, notes?: string) =>
    recruiterApi<{ application: RecruiterApplication }>(`/applications/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    }),
};

export const recruiterResumeApi = {
  listTemplates: () =>
    recruiterApi<{ templates: RecruiterResumeTemplate[] }>('/resume-templates'),

  downloadStudentResume: (phone: string, templateId?: string) => {
    const qs = templateId ? `?templateId=${encodeURIComponent(templateId)}` : '';
    return recruiterApi<{ success: boolean; downloadUrl: string; mock?: boolean }>(
      `/students/${encodeURIComponent(phone)}/resume/download${qs}`
    );
  },

  listLibrary: (params: { q?: string; studentPhone?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.studentPhone) qs.set('studentPhone', params.studentPhone);
    if (params.page !== undefined) qs.set('page', String(params.page));
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return recruiterApi<{
      resumes: Array<{
        id: string;
        studentPhone: string;
        studentName: string;
        jobTitle: string;
        companyName: string;
        downloadUrl: string;
        atsScore: number | null;
        atsSummary?: string;
        atsImprovements?: string[];
        atsMeetsTarget?: boolean;
        atsTargetScore?: number;
        atsScoredAt?: string | null;
        source: string;
        createdAt: string;
      }>;
      total: number;
    }>(`/resume-library${query ? `?${query}` : ''}`);
  },

  getLibrary: (id: string) =>
    recruiterApi<{ resume: Record<string, unknown> }>(`/resume-library/${id}`),

  refreshLibrary: (id: string) =>
    recruiterApi<{
      resume: {
        id: string;
        atsScore: number | null;
        atsSummary?: string;
        atsImprovements?: string[];
        atsMeetsTarget?: boolean;
        atsTargetScore?: number;
        [key: string]: unknown;
      };
    }>(`/resume-library/${id}/refresh`, {
      method: 'POST',
      body: '{}',
    }),

  deleteLibrary: (id: string) =>
    recruiterApi<{ success: boolean }>(`/resume-library/${id}`, { method: 'DELETE' }),
};

export const recruiterDashboardApi = {
  get: (range: '7d' | '30d' | '90d' = '7d') =>
    recruiterApi<{
      kpis: Record<string, number>;
      trend: { range: string; points: Array<{ date: string; count: number }> };
      recentActivity: Array<{ type: string; text: string; at: string }>;
    }>(`/dashboard?range=${range}`),
};

export const recruiterAnalyticsApi = {
  get: () => recruiterApi<Record<string, unknown>>('/analytics'),
};

export const recruiterSearchApi = {
  search: (q: string) =>
    recruiterApi<{ students: RecruiterStudent[]; jobs: RecruiterScrapedJob[]; applications: RecruiterApplication[] }>(
      `/search?q=${encodeURIComponent(q)}`
    ),
};

export const recruiterInterviewsApi = {
  list: (params: { status?: string; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.q) qs.set('q', params.q);
    const query = qs.toString();
    return recruiterApi<{ interviews: Array<Record<string, unknown>>; total: number }>(
      `/interviews${query ? `?${query}` : ''}`
    );
  },
};

export const recruiterSettingsApi = {
  update: (payload: { name?: string; email?: string; phone?: string }) =>
    recruiterApi<{ recruiter: RecruiterAccount }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    recruiterApi<{ success: boolean }>('/settings/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

export const recruiterNotificationsApi = {
  list: () =>
    recruiterApi<{
      notifications: Array<{ id: string; type: string; text: string; createdAt: string; read: boolean }>;
      unreadCount: number;
    }>('/notifications'),
};
