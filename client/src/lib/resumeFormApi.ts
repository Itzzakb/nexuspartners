import type { PublicFormResponse, ResumeFormData } from '@/types/resumeForm';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function publicApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export const resumeFormApi = {
  get: (ticketId: string) =>
    publicApi<PublicFormResponse>(`/resume-form/${ticketId}`),

  save: (ticketId: string, formData: ResumeFormData, action: 'save_exit' | 'complete' | 'reset') =>
    publicApi<PublicFormResponse>(`/resume-form/${ticketId}`, {
      method: 'PUT',
      body: JSON.stringify({ formData, action }),
    }),

  getSharedView: (token: string) =>
    publicApi<{
      ticketNumber: string;
      candidateName: string;
      companyName: string;
      companyLogo: string;
      resumeFormStatus: string;
      rows: [string, string][];
      formData: ResumeFormData;
    }>(`/resume-form-view/${token}`),
};
