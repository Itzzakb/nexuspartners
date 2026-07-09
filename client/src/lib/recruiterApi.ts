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
  list: (q = '') =>
    recruiterApi<{ students: RecruiterStudent[]; total: number }>(
      `/students${q ? `?q=${encodeURIComponent(q)}` : ''}`
    ),

  get: (phone: string) =>
    recruiterApi<{ student: RecruiterStudentDetail }>(`/students/${encodeURIComponent(phone)}`),

  activity: (phone: string) =>
    recruiterApi<{ activity: StudentActivity }>(
      `/students/${encodeURIComponent(phone)}/activity`
    ),

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
  }) => {
    const qs = new URLSearchParams();
    qs.set('studentPhone', params.studentPhone);
    if (params.page !== undefined) qs.set('page', String(params.page));
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.q) qs.set('q', params.q);
    if (params.scrapedFrom) qs.set('scrapedFrom', params.scrapedFrom);
    if (params.scrapedTo) qs.set('scrapedTo', params.scrapedTo);
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
    recruiterApi<{ success: boolean; applyUrl: string }>(`/jobs/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify({ studentPhone }),
    }),

  fixResume: (id: string, studentPhone: string) =>
    recruiterApi<{
      success: boolean;
      resume: Record<string, unknown>;
      source: string;
      mock?: boolean;
      action: { resumeFixedAt: string | null; status: string };
    }>(`/jobs/${id}/fix-resume`, {
      method: 'POST',
      body: JSON.stringify({ studentPhone }),
    }),

  downloadAtsResume: (id: string, studentPhone: string, templateId?: string) =>
    recruiterApi<{
      success: boolean;
      downloadUrl: string;
      mock?: boolean;
    }>(`/jobs/${id}/download-ats-resume`, {
      method: 'POST',
      body: JSON.stringify({ studentPhone, templateId }),
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
};
