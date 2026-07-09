import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { resumeFormApi } from '@/lib/resumeFormApi';
import { ResumeFormTable } from '@/components/resumeForm/ResumeFormTable';

export default function ResumeFormViewShare() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<{
    ticketNumber: string;
    candidateName: string;
    companyName: string;
    companyLogo: string;
    rows: [string, string][];
    resumeFormStatus: string;
  } | null>(null);

  useEffect(() => {
    if (!token) return;
    resumeFormApi
      .getSharedView(token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Not found'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-4">
        <div className="np-card p-8 text-center text-body">{error || 'Form not found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted py-8 px-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="np-card p-6">
          <div className="flex items-center gap-4">
            {data.companyLogo && (
              <img src={data.companyLogo} alt="" className="h-10 object-contain" />
            )}
            <div>
              <h1 className="text-2xl">Resume Information</h1>
              <p className="text-body">
                {data.ticketNumber} · {data.candidateName} · {data.companyName}
              </p>
              <span className="mt-1 inline-block rounded-pill bg-muted px-2 py-0.5 text-xs capitalize">
                {data.resumeFormStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="np-card p-6">
          <h2 className="mb-4 text-lg">Form Details</h2>
          <ResumeFormTable rows={data.rows} />
        </div>
      </div>
    </div>
  );
}
