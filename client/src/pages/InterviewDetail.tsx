import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { interviewApi, uploadFile } from '@/lib/api';
import { StudentSearch } from '@/components/students/StudentSearch';
import type { Interview, InterviewStage } from '@/types/phase4';
import { INTERVIEW_STAGE_LABELS } from '@/types/phase4';
import type { ExternalStudent } from '@/types/phase4';
import { ToggleField } from '@/components/ui/Toggle';

const STAGES: InterviewStage[] = ['interview_reported', 'ready_for_interview', 'interview_completed'];

export default function InterviewDetail() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { user } = useAuth();

  const [interview, setInterview] = useState<Partial<Interview>>({
    candidateName: '',
    phone: '',
    studentPhone: '',
    position: '',
    companyName: '',
    interviewDateTime: '',
    timezone: 'America/New_York',
    jobDescription: '',
    screenshotUrl: '',
    resumeFileUrl: '',
    currentStage: 'interview_reported',
    isSelfInstruction: false,
    isCancelled: false,
    companyId: user?.companyId,
  });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isNew || !id) return;
    setLoading(true);
    interviewApi
      .get(id)
      .then((data) => {
        const i = data.interview;
        setInterview({
          ...i,
          interviewDateTime: i.interviewDateTime
            ? new Date(i.interviewDateTime).toISOString().slice(0, 16)
            : '',
        });
      })
      .catch(() => setError('Interview not found'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const handleStudentSelect = (s: ExternalStudent) => {
    setInterview((prev) => ({
      ...prev,
      candidateName: (s.name || s.studentname || prev.candidateName) as string,
      phone: (s.phone || s.mobile || prev.phone) as string,
      studentPhone: (s.phone || s.mobile || prev.studentPhone) as string,
    }));
  };

  const handleFile = async (file: File, field: 'screenshotUrl' | 'resumeFileUrl') => {
    const uploaded = await uploadFile(file, 'interviews');
    setInterview((prev) => ({ ...prev, [field]: uploaded.url }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        const data = await interviewApi.create({
          candidateName: interview.candidateName || '',
          phone: interview.phone,
          studentPhone: interview.studentPhone,
          position: interview.position,
          companyName: interview.companyName,
          interviewDateTime: interview.interviewDateTime || undefined,
          timezone: interview.timezone,
          jobDescription: interview.jobDescription,
          screenshotUrl: interview.screenshotUrl,
          resumeFileUrl: interview.resumeFileUrl,
          isSelfInstruction: interview.isSelfInstruction,
          companyId: interview.companyId,
        });
        navigate(`/interviews/${data.interview.id}`);
      } else if (id) {
        const data = await interviewApi.update(id, {
          ...interview,
          interviewDateTime: interview.interviewDateTime || null,
        });
        setInterview(data.interview);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const copyShare = async () => {
    if (!interview.shareLink) return;
    await navigator.clipboard.writeText(interview.shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <p className="text-body">Loading...</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/interviews" className="text-body hover:text-heading">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl">{isNew ? 'Report Interview' : interview.candidateName}</h1>
          {!isNew && (
            <p className="text-sm text-body">{interview.interviewNumber}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="np-card space-y-4 p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-heading">Link student</label>
          <StudentSearch companyId={interview.companyId} onSelect={handleStudentSelect} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Candidate name *</label>
            <input
              className="np-input"
              value={interview.candidateName || ''}
              onChange={(e) => setInterview({ ...interview, candidateName: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Phone / student mobile</label>
            <input
              className="np-input"
              value={interview.studentPhone || interview.phone || ''}
              onChange={(e) =>
                setInterview({ ...interview, studentPhone: e.target.value, phone: e.target.value })
              }
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Position</label>
            <input
              className="np-input"
              value={interview.position || ''}
              onChange={(e) => setInterview({ ...interview, position: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Interview company</label>
            <input
              className="np-input"
              value={interview.companyName || ''}
              onChange={(e) => setInterview({ ...interview, companyName: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Interview date & time</label>
            <input
              type="datetime-local"
              className="np-input"
              value={interview.interviewDateTime || ''}
              onChange={(e) => setInterview({ ...interview, interviewDateTime: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Timezone</label>
            <input
              className="np-input"
              value={interview.timezone || 'America/New_York'}
              onChange={(e) => setInterview({ ...interview, timezone: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-heading">Job description</label>
          <textarea
            className="np-input min-h-24"
            value={interview.jobDescription || ''}
            onChange={(e) => setInterview({ ...interview, jobDescription: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Screenshot</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], 'screenshotUrl')}
            />
            {interview.screenshotUrl && (
              <a href={interview.screenshotUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-primary">
                View uploaded
              </a>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Resume file</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], 'resumeFileUrl')}
            />
            {interview.resumeFileUrl && (
              <a href={interview.resumeFileUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-primary">
                View uploaded
              </a>
            )}
          </div>
        </div>

        {!isNew && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">Stage</label>
              <select
                className="np-input"
                value={interview.currentStage}
                onChange={(e) =>
                  setInterview({ ...interview, currentStage: e.target.value as InterviewStage })
                }
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {INTERVIEW_STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-6">
              <ToggleField
                label="Cancelled"
                checked={!!interview.isCancelled}
                onChange={(checked) => setInterview({ ...interview, isCancelled: checked })}
              />
              <ToggleField
                label="Self instruction"
                checked={!!interview.isSelfInstruction}
                onChange={(checked) => setInterview({ ...interview, isSelfInstruction: checked })}
              />
            </div>

            {interview.currentStage === 'interview_completed' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">Moved forward?</label>
                  <select
                    className="np-input"
                    value={
                      interview.movedForward === true
                        ? 'yes'
                        : interview.movedForward === false
                          ? 'no'
                          : ''
                    }
                    onChange={(e) =>
                      setInterview({
                        ...interview,
                        movedForward: e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null,
                      })
                    }
                  >
                    <option value="">Not set</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">Reason</label>
                  <input
                    className="np-input"
                    value={interview.movedForwardReason || ''}
                    onChange={(e) => setInterview({ ...interview, movedForwardReason: e.target.value })}
                  />
                </div>
              </div>
            )}

            {interview.shareLink && (
              <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm">
                <span className="truncate text-body">{interview.shareLink}</span>
                <button type="button" className="np-btn-secondary shrink-0" onClick={copyShare}>
                  <Copy className="mr-1 h-4 w-4" />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" className="np-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Create interview' : 'Save changes'}
          </button>
          {!isNew && (
            <Link to="/interviews?view=completed" className="np-btn-secondary">
              View completed
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
