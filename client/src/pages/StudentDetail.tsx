import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  ExternalLink,
  Eye,
  FileText,
  CreditCard,
  UserRound,
  Video,
} from 'lucide-react';
import { resumeParseApi, studentApi } from '@/lib/api';
import { toast } from '@/lib/toast';
import { StudentViewTab } from '@/components/students/StudentViewTab';
import { StudentResumeEditor } from '@/components/students/StudentResumeEditor';
import { StudentDetailsEditor } from '@/components/students/StudentDetailsEditor';
import { StudentSubscriptionEditor } from '@/components/students/StudentSubscriptionEditor';
import { StudentInterviewsPanel } from '@/components/students/StudentInterviewsPanel';
import { cn } from '@/lib/utils';
import type { ResumeViewTab } from '@/lib/studentResume';
import type { StudentDetail as StudentDetailData, StudentInterviewRef, StudentTicketRef } from '@/types/phase7';

type MainTab = 'view' | 'interviews' | 'resume' | 'details' | 'subscription';

const MAIN_TABS: Array<{ id: MainTab; label: string; icon: typeof Eye }> = [
  { id: 'view', label: 'View', icon: Eye },
  { id: 'interviews', label: 'Interviews', icon: Video },
  { id: 'resume', label: 'Resume', icon: FileText },
  { id: 'details', label: 'Details', icon: UserRound },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
];

export default function StudentDetailPage() {
  const { phone } = useParams<{ phone: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const initialTab =
    (location.state as { tab?: MainTab } | null)?.tab &&
    ['view', 'interviews', 'resume', 'details', 'subscription'].includes(
      (location.state as { tab?: string }).tab || ''
    )
      ? ((location.state as { tab: MainTab }).tab)
      : 'view';
  const [student, setStudent] = useState<StudentDetailData | null>(null);
  const [tickets, setTickets] = useState<StudentTicketRef[]>([]);
  const [interviews, setInterviews] = useState<StudentInterviewRef[]>([]);
  const [subscription, setSubscription] = useState<Record<string, unknown> | null>(null);
  const [activity, setActivity] = useState({ today: 0, week: 0, month: 0 });
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [mainTab, setMainTab] = useState<MainTab>(initialTab);
  const [resumeTab, setResumeTab] = useState<ResumeViewTab>('summary');

  const load = async () => {
    if (!phone) return;
    setLoading(true);
    try {
      const data = await studentApi.get(decodeURIComponent(phone));
      setStudent(data.student);
      setTickets(data.tickets);
      setInterviews(data.interviews);
      setSubscription((data.subscription as Record<string, unknown> | null) || null);
      setActivity(data.activity || { today: 0, week: 0, month: 0 });
      setNotes(data.student.notes || '');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load student');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [phone]);

  const handleSaveNotes = async () => {
    if (!phone) return;
    setSaving(true);
    try {
      await studentApi.updateNotes(decodeURIComponent(phone), notes);
      toast.success('Notes saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!student) return;
    setDownloading(true);
    try {
      const data = await resumeParseApi.buildDownload({
        phone: student.phone,
        companyId: student.companyId,
      });
      const url = data.result?.downloadUrl;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        toast.success(data.result?.message || 'Resume build completed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to download resume');
    } finally {
      setDownloading(false);
    }
  };

  const applyStudentUpdate = (next: StudentDetailData, nextNotes?: string) => {
    const prevPhone = student?.phone;
    setStudent(next);
    if (nextNotes !== undefined) setNotes(nextNotes);
    if (prevPhone && next.phone && next.phone !== prevPhone) {
      navigate(`/students/${encodeURIComponent(next.phone)}`, { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!student) {
    return <p className="text-body">{loadError || 'Student not found'}</p>;
  }

  const details = student.details as Record<string, unknown>;
  const displayName = String(details.name || details.studentname || student.phone);
  const role = String(details.role || '');
  const status = String(details.status || 'active');

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/students" className="inline-flex items-center gap-2 text-sm text-body hover:text-heading">
          <ArrowLeft className="h-4 w-4" />
          Back to students
        </Link>
        <Link
          to={`/search-resume?phone=${encodeURIComponent(student.phone)}&companyId=${encodeURIComponent(student.companyId)}`}
          className="np-btn-secondary !py-2 text-sm"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Edit Student Resume
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-heading md:text-3xl">{displayName}</h1>
          {role && <p className="mt-0.5 text-body">{role}</p>}
        </div>
        <span className="rounded-pill bg-primary px-3 py-1 text-xs font-medium capitalize text-white">
          {status}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Today" value={activity.today} tone="blue" />
        <StatCard label="Week" value={activity.week} tone="green" />
        <StatCard label="Month" value={activity.month} tone="purple" />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {MAIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = mainTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMainTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-body hover:text-heading'
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-body')} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {mainTab === 'view' && (
        <StudentViewTab
          student={student}
          notes={notes}
          onNotesChange={setNotes}
          onSaveNotes={handleSaveNotes}
          savingNotes={saving}
          subscription={subscription}
          resumeTab={resumeTab}
          onResumeTabChange={setResumeTab}
          onDownload={handleDownload}
          downloading={downloading}
        />
      )}

      {mainTab === 'interviews' && <StudentInterviewsPanel interviews={interviews} />}

      {mainTab === 'resume' && (
        <StudentResumeEditor
          student={student}
          onError={(m) => toast.error(m)}
          onMessage={(m) => toast.success(m)}
          onSaved={(resumeData) => {
            setStudent((prev) => {
              if (!prev) return prev;
              const nextDetails = { ...(prev.details as Record<string, unknown>) };
              nextDetails.resume = resumeData;
              if (resumeData.jobtitle) nextDetails.role = resumeData.jobtitle;
              return { ...prev, details: nextDetails };
            });
          }}
        />
      )}

      {mainTab === 'details' && (
        <div className="space-y-4">
          <StudentDetailsEditor
            student={student}
            notes={notes}
            onError={(m) => toast.error(m)}
            onMessage={(m) => toast.success(m)}
            onSaved={({ student: next, notes: nextNotes }) => applyStudentUpdate(next, nextNotes)}
          />
          {tickets.length > 0 && (
            <div className="np-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-heading">Linked Tickets</h3>
              <div className="space-y-2">
                {tickets.map((t) => (
                  <Link
                    key={t.id}
                    to={`/ticket/${t.id}`}
                    className="block rounded-lg border border-border px-4 py-3 transition hover:bg-muted"
                  >
                    <p className="font-medium text-heading">{t.candidateName}</p>
                    <p className="text-xs text-body">
                      {t.ticketNumber} · {t.currentStage.replace(/_/g, ' ')}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {mainTab === 'subscription' && (
        <StudentSubscriptionEditor
          student={student}
          onError={(m) => toast.error(m)}
          onMessage={(m) => toast.success(m)}
          onSaved={(next) => applyStudentUpdate(next)}
        />
      )}
    </div>
  );
}

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
    <div className={cn('np-card bg-gradient-to-br p-4', tones[tone])}>
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
