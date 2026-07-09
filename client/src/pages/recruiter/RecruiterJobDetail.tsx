import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { recruiterJobsApi, recruiterResumeApi } from '@/lib/recruiterApi';
import type {
  RecruiterJobApplicant,
  RecruiterResumeTemplate,
  RecruiterScrapedJob,
} from '@/types/recruiterPortal';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function RecruiterJobDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const studentPhone = searchParams.get('studentPhone') || '';

  const [job, setJob] = useState<RecruiterScrapedJob | null>(null);
  const [applicant, setApplicant] = useState<RecruiterJobApplicant | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [templates, setTemplates] = useState<RecruiterResumeTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    recruiterResumeApi
      .listTemplates()
      .then((data) => {
        setTemplates(data.templates);
        const def = data.templates.find((t) => t.isDefault);
        if (def) setTemplateId(def.id);
      })
      .catch(() => {});
  }, []);

  const load = async () => {
    if (!id || !studentPhone) return;
    setLoading(true);
    try {
      const data = await recruiterJobsApi.get(id, studentPhone);
      setJob(data.job);
      setApplicant(data.applicant);
      setNotes(data.applicant.notes || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id, studentPhone]);

  const handleDrop = async () => {
    if (!id || !studentPhone) return;
    setActing(true);
    setError('');
    try {
      await recruiterJobsApi.drop(id, studentPhone);
      setMessage('Job dropped for this student');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to drop job');
    } finally {
      setActing(false);
    }
  };

  const handleApply = async () => {
    if (!id || !studentPhone) return;
    setActing(true);
    setError('');
    try {
      const data = await recruiterJobsApi.apply(id, studentPhone);
      setMessage('Application recorded');
      if (data.applyUrl) {
        window.open(data.applyUrl, '_blank', 'noopener,noreferrer');
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply');
    } finally {
      setActing(false);
    }
  };

  const handleFixResume = async () => {
    if (!id || !studentPhone) return;
    setActing(true);
    setError('');
    setMessage('');
    try {
      const data = await recruiterJobsApi.fixResume(id, studentPhone);
      setMessage(
        data.mock
          ? 'Resume tailored (dev mock — Gemini not configured)'
          : 'Resume tailored for this job and saved to student profile'
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fix resume');
    } finally {
      setActing(false);
    }
  };

  const handleDownloadAts = async () => {
    if (!id || !studentPhone) return;
    setActing(true);
    setError('');
    setMessage('');
    try {
      const data = await recruiterJobsApi.downloadAtsResume(
        id,
        studentPhone,
        templateId || undefined
      );
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
        setMessage('ATS resume download started');
      } else {
        setMessage(
          data.mock
            ? 'ATS build requested (dev mock — no download URL)'
            : 'ATS resume build completed'
        );
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download ATS resume');
    } finally {
      setActing(false);
    }
  };

  if (!studentPhone) {
    return (
      <div className="np-card p-6 text-body">
        Missing student context.{' '}
        <Link to="/recruiter-portal/applications" className="text-primary hover:underline">
          Go back to applications
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!job || !applicant) {
    return <p className="text-body">{error || 'Job not found'}</p>;
  }

  const applicantDetails = applicant.details as Record<string, unknown>;
  const applicantName =
    (applicantDetails.name as string) ||
    (applicantDetails.studentname as string) ||
    applicant.phone;
  const isDropped = job.studentAction?.status === 'dropped';
  const isApplied = job.studentAction?.status === 'applied';
  const resumeFixed = !!job.studentAction?.resumeFixedAt;
  const atsReady = !!job.studentAction?.atsResumeUrl;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        to="/recruiter-portal/applications"
        className="inline-flex items-center gap-2 text-sm text-body hover:text-heading"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to applications
      </Link>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      <div className="np-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-heading">{job.jobTitle}</h1>
            <p className="mt-1 text-lg text-body">{job.companyName}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-body">
              {job.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {job.location}
                </span>
              )}
              {job.datePosted && <span>Posted {formatDate(job.datePosted)}</span>}
              {job.urlDomain && <span>{job.urlDomain}</span>}
              {job.remote && <span className="text-primary">Remote</span>}
              {job.hybrid && <span>Hybrid</span>}
            </div>
          </div>
          {isApplied && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
              Applied
            </span>
          )}
          {isDropped && (
            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
              Dropped
            </span>
          )}
        </div>

        {job.description && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-body">
              Description
            </h2>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-body">
              {job.description}
            </div>
          </div>
        )}

        {(job.applyUrl || job.finalUrl || job.sourceUrl) && (
          <a
            href={job.applyUrl || job.finalUrl || job.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            View original posting
          </a>
        )}
      </div>

      <div className="np-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-heading">Applicant</h2>
        <p className="font-medium text-heading">{applicantName}</p>
        <p className="text-sm text-body">{applicant.phone}</p>
        {applicantDetails.email && (
          <p className="text-sm text-body">{String(applicantDetails.email)}</p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted px-3 py-2 text-center">
            <p className="text-xl font-bold text-primary">{applicant.activity.today}</p>
            <p className="text-xs text-body">Today</p>
          </div>
          <div className="rounded-lg bg-muted px-3 py-2 text-center">
            <p className="text-xl font-bold text-primary">{applicant.activity.week}</p>
            <p className="text-xs text-body">This week</p>
          </div>
          <div className="rounded-lg bg-muted px-3 py-2 text-center">
            <p className="text-xl font-bold text-primary">{applicant.activity.month}</p>
            <p className="text-xs text-body">This month</p>
          </div>
        </div>
      </div>

      <div className="np-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-heading">Recruiter notes</h2>
        <p className="whitespace-pre-wrap text-sm text-body">
          {notes || 'No notes yet for this student.'}
        </p>
        <Link
          to={`/recruiter-portal/students/${encodeURIComponent(studentPhone)}`}
          className="mt-3 inline-block text-sm text-primary hover:underline"
        >
          Edit notes on student profile
        </Link>
      </div>

      <div className="np-card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-heading">Resume actions</h2>
          {templates.length > 0 && (
            <select
              className="np-input max-w-xs !py-2 text-sm"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Default template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {resumeFixed && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-medium text-blue-700">
              Resume fixed {formatDate(job.studentAction?.resumeFixedAt || null)}
            </span>
          )}
          {atsReady && (
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 font-medium text-purple-700">
              ATS resume ready
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="np-btn-secondary"
            onClick={handleDrop}
            disabled={acting || isDropped}
          >
            <XCircle className="mr-2 inline h-4 w-4" />
            Drop
          </button>
          <button
            type="button"
            className="np-btn-secondary"
            onClick={handleFixResume}
            disabled={acting || isDropped}
          >
            <Sparkles className="mr-2 inline h-4 w-4" />
            {acting ? 'Working...' : resumeFixed ? 'Re-fix Resume' : 'Fix Resume'}
          </button>
          <button
            type="button"
            className="np-btn-secondary"
            onClick={handleDownloadAts}
            disabled={acting || isDropped}
          >
            <Download className="mr-2 inline h-4 w-4" />
            Download ATS Resume
          </button>
          {atsReady && job.studentAction?.atsResumeUrl && (
            <a
              href={job.studentAction.atsResumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="np-btn-secondary"
            >
              <Download className="mr-2 inline h-4 w-4" />
              Open last ATS file
            </a>
          )}
          <button
            type="button"
            className="np-btn-primary ml-auto"
            onClick={handleApply}
            disabled={acting || isDropped}
          >
            {isApplied ? 'Open apply link' : 'Apply Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
