import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { interviewApi } from '@/lib/api';
import type { Interview } from '@/types/phase4';
import { INTERVIEW_STAGE_LABELS } from '@/types/phase4';

export default function InterviewShare() {
  const { token } = useParams<{ token: string }>();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [logo, setLogo] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    interviewApi
      .getShared(token)
      .then((data) => {
        setInterview(data.interview);
        setLogo(data.companyLogo);
      })
      .catch(() => setError('Interview not found'));
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-body">{error}</p>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-body">Loading...</p>
      </div>
    );
  }

  const dt = interview.interviewDateTime
    ? new Date(interview.interviewDateTime).toLocaleString()
    : 'TBD';

  return (
    <div className="min-h-screen bg-muted p-6">
      <div className="mx-auto max-w-2xl np-card p-8">
        {logo && (
          <img src={logo} alt="Company" className="mb-6 h-12 object-contain" />
        )}
        <h1 className="text-2xl">Interview Details</h1>
        <p className="mt-1 text-sm text-body">{interview.interviewNumber}</p>

        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-body">Candidate</dt>
            <dd className="font-medium text-heading">{interview.candidateName}</dd>
          </div>
          <div>
            <dt className="text-body">Position</dt>
            <dd className="font-medium text-heading">{interview.position || '—'}</dd>
          </div>
          <div>
            <dt className="text-body">Company</dt>
            <dd className="font-medium text-heading">{interview.companyName || '—'}</dd>
          </div>
          <div>
            <dt className="text-body">Date & time</dt>
            <dd className="font-medium text-heading">{dt} ({interview.timezone})</dd>
          </div>
          <div>
            <dt className="text-body">Stage</dt>
            <dd className="font-medium text-heading">
              {INTERVIEW_STAGE_LABELS[interview.currentStage]}
            </dd>
          </div>
          {interview.jobDescription && (
            <div>
              <dt className="text-body">Job description</dt>
              <dd className="mt-1 whitespace-pre-wrap text-heading">{interview.jobDescription}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
