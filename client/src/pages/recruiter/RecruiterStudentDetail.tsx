import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, Download, Loader2 } from 'lucide-react';
import { recruiterStudentsApi, recruiterResumeApi } from '@/lib/recruiterApi';
import type { RecruiterStudentDetail } from '@/types/recruiterPortal';

function ActivityCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-primary/5 px-4 py-3 text-center">
      <p className="text-2xl font-bold text-primary">{value}</p>
      <p className="text-xs text-body">{label}</p>
    </div>
  );
}

export default function RecruiterStudentDetail() {
  const { phone } = useParams<{ phone: string }>();
  const decodedPhone = phone ? decodeURIComponent(phone) : '';

  const [student, setStudent] = useState<RecruiterStudentDetail | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!decodedPhone) return;
    setLoading(true);
    recruiterStudentsApi
      .get(decodedPhone)
      .then((data) => {
        setStudent(data.student);
        setNotes(data.student.notes || '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load student'))
      .finally(() => setLoading(false));
  }, [decodedPhone]);

  const handleSaveNotes = async () => {
    if (!decodedPhone) return;
    setSaving(true);
    setMessage('');
    try {
      await recruiterStudentsApi.updateNotes(decodedPhone, notes);
      setMessage('Notes saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadResume = async () => {
    if (!decodedPhone) return;
    setDownloading(true);
    setError('');
    setMessage('');
    try {
      const data = await recruiterResumeApi.downloadStudentResume(decodedPhone);
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
        setMessage('Resume download started');
      } else {
        setMessage(data.mock ? 'Resume build requested (dev mock)' : 'Resume build completed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download resume');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!student) {
    return <p className="text-body">{error || 'Student not found'}</p>;
  }

  const details = student.details as Record<string, unknown>;
  const displayName =
    student.name ||
    (details.name as string) ||
    (details.studentname as string) ||
    student.phone;
  const resumeData = details.resume;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        to="/recruiter-portal/students"
        className="inline-flex items-center gap-2 text-sm text-body hover:text-heading"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Students
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
            <h1 className="text-2xl font-semibold text-heading">{displayName}</h1>
            <p className="mt-1 text-body">
              {student.phone} · {student.companyLabel}
            </p>
            {(student.email || details.email) && (
              <p className="text-sm text-body">{String(student.email || details.email)}</p>
            )}
            {student.role && <p className="text-sm text-body">Role: {student.role}</p>}
            {student.location && <p className="text-sm text-body">Location: {student.location}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/recruiter-portal/applications?student=${encodeURIComponent(student.phone)}`}
              className="np-btn-primary !py-2 text-sm"
            >
              <Briefcase className="mr-2 inline h-4 w-4" />
              View applications
            </Link>
            <button
              type="button"
              className="np-btn-secondary !py-2 text-sm"
              onClick={handleDownloadResume}
              disabled={downloading}
            >
              <Download className="mr-2 inline h-4 w-4" />
              {downloading ? 'Preparing...' : 'Download Resume'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ActivityCard label="Applied today" value={student.activity.today} />
        <ActivityCard label="Applied this week" value={student.activity.week} />
        <ActivityCard label="Applied this month" value={student.activity.month} />
      </div>

      {Object.keys(details).length > 0 && (
        <div className="np-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-heading">Basic information</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(details)
              .filter(([k]) => !['resume', 'name', 'studentname', 'phone', 'mobile', 'email'].includes(k))
              .slice(0, 12)
              .map(([key, value]) => (
                <div key={key} className="rounded-lg bg-muted px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-body">{key}</p>
                  <p className="text-sm text-heading">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {student.subscription && (
        <div className="np-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-heading">Subscription</h2>
          <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs text-body">
            {JSON.stringify(student.subscription, null, 2)}
          </pre>
        </div>
      )}

      {student.payments.length > 0 && (
        <div className="np-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-heading">Recent payments</h2>
          <div className="space-y-2">
            {student.payments.map((p, i) => (
              <div key={i} className="rounded-lg border border-border px-3 py-2 text-sm text-body">
                {JSON.stringify(p)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="np-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-heading">Recruiter notes</h2>
        <textarea
          className="np-input min-h-[120px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this student..."
        />
        <button
          type="button"
          className="np-btn-primary mt-3"
          onClick={handleSaveNotes}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save notes'}
        </button>
      </div>

      {student.tickets.length > 0 && (
        <div className="np-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-heading">Tickets</h2>
          <div className="space-y-2">
            {student.tickets.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-heading">{t.ticketNumber}</p>
                  <p className="text-xs text-body">{t.candidateName}</p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-body">
                  {t.currentStage}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {resumeData !== undefined && resumeData !== null && (
        <div className="np-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-heading">Resume data</h2>
          <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs text-body">
            {typeof resumeData === 'string'
              ? resumeData
              : JSON.stringify(resumeData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
