import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

type SharedStudentPayload = {
  student: {
    name: string;
    phone: string;
    email: string;
    role: string;
    location: string;
    status: string;
    companyLabel: string;
    details: Record<string, string>;
  };
  activity: { today: number; week: number; month: number };
  companyLogo?: string;
};

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'blue' | 'green' | 'purple';
}) {
  const tones = {
    blue: 'from-sky-50 to-white text-sky-600',
    green: 'from-emerald-50 to-white text-emerald-600',
    purple: 'from-violet-50 to-white text-violet-600',
  };
  return (
    <div className={cn('rounded-xl border border-border bg-gradient-to-br p-4 shadow-sm', tones[tone])}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-body">{label}</p>
          <p className="mt-1 text-3xl font-semibold text-heading">{value}</p>
        </div>
        <Activity className="h-8 w-8 opacity-40" />
      </div>
    </div>
  );
}

function formatLabel(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export default function StudentShare() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedStudentPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/students/share/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Student link not found');
        return body as SharedStudentPayload;
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6">
        <p className="text-body">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6">
        <p className="text-body">Loading...</p>
      </div>
    );
  }

  const { student, activity, companyLogo } = data;
  const detailEntries = Object.entries(student.details || {}).filter(
    ([key]) =>
      !['name', 'studentname', 'phone', 'mobile', 'email', 'role', 'status', 'company', 'companyId'].includes(
        key.toLowerCase()
      )
  );

  return (
    <div className="min-h-screen bg-muted p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-5">
        {companyLogo && (
          <img src={companyLogo} alt={student.companyLabel || 'Company'} className="h-10 object-contain" />
        )}

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-heading md:text-3xl">{student.name}</h1>
              {student.role && <p className="mt-0.5 text-body">{student.role}</p>}
              <div className="mt-3 space-y-1 text-sm text-body">
                {student.phone && <p>{student.phone}</p>}
                {student.email && <p>{student.email}</p>}
                {student.location && <p>{student.location}</p>}
                {student.companyLabel && <p>{student.companyLabel}</p>}
              </div>
            </div>
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium capitalize text-white">
              {student.status || 'active'}
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Applied today" value={activity.today || 0} tone="blue" />
          <StatCard label="This week" value={activity.week || 0} tone="green" />
          <StatCard label="This month" value={activity.month || 0} tone="purple" />
        </div>

        {detailEntries.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-heading">Details</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {detailEntries.map(([key, value]) => (
                <div key={key} className="rounded-lg bg-muted px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-body">{formatLabel(key)}</p>
                  <p className="text-sm text-heading">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
