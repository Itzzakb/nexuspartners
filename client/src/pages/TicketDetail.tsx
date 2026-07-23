import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Mail,
  Phone,
  RefreshCw,
  Trash2,
  User,
  UserRound,
  FilePenLine,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ticketApi, uploadFile, externalApi } from '@/lib/api';
import { toPublicAppUrl } from '@/lib/publicAppUrl';
import { StudentSearch } from '@/components/students/StudentSearch';
import type { ExternalStudent, ExternalRecruiter } from '@/types/phase4';
import { StageBadge } from '@/components/tickets/StageBadge';
import { ResumeFormDetails } from '@/components/resumeForm/ResumeFormDetails';
import {
  STAGE_LABELS,
  STAGE_ORDER,
  type Ticket,
  type TicketHistoryEntry,
  type TicketStage,
} from '@/types/ticket';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ticketTypeLabel(type: string) {
  if (type === 'new_resume') return 'New Resume';
  if (type === 'existing_resume') return 'Existing Resume';
  return type.replace(/_/g, ' ');
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [history, setHistory] = useState<TicketHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [workNote, setWorkNote] = useState('');
  const [onboardingNote, setOnboardingNote] = useState('');
  const [stageNote, setStageNote] = useState('');
  const [resumeMembers, setResumeMembers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [recruiters, setRecruiters] = useState<ExternalRecruiter[]>([]);
  const [selectedRecruiter, setSelectedRecruiter] = useState('');
  const [chatLinkDraft, setChatLinkDraft] = useState('');
  const [showStudentSearch, setShowStudentSearch] = useState(false);

  const loadTicket = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await ticketApi.get(id);
      setTicket(data.ticket);
      setHistory(data.history);
      setSelectedRecruiter(data.ticket.recruiterUsername || '');
      setChatLinkDraft(data.ticket.chatLink || '');
      const team = await ticketApi.resumeTeam(data.ticket.companyId);
      setResumeMembers(team.members);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [id]);

  const canManageOnboarding =
    user?.role === 'onboarding' || user?.isCompanyAdmin || user?.isPlatformAdmin;

  useEffect(() => {
    if (!ticket?.companyId || !canManageOnboarding) return;
    externalApi
      .recruiters(ticket.companyId)
      .then((data) => setRecruiters(data.clerks || []))
      .catch(() => setRecruiters([]));
  }, [ticket?.companyId, canManageOnboarding]);

  const goBack = () => {
    const from = (location.state as { from?: string })?.from;
    navigate(from || '/tickets');
  };

  const handleStageChange = async (stage: TicketStage) => {
    if (!ticket) return;
    setActionLoading(true);
    try {
      const data = await ticketApi.changeStage(ticket.id, stage, stageNote);
      setTicket(data.ticket);
      setStageNote('');
      await loadTicket();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change stage');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssign = async (assignedTo: string) => {
    if (!ticket) return;
    setActionLoading(true);
    try {
      const data = await ticketApi.assign(ticket.id, assignedTo || null);
      setTicket(data.ticket);
      toast.success(assignedTo ? 'Resume editor assigned' : 'Ticket unassigned');
      await loadTicket();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async (type: 'work' | 'onboarding') => {
    if (!ticket) return;
    const text = type === 'work' ? workNote : onboardingNote;
    if (!text.trim()) return;
    setActionLoading(true);
    try {
      const data = await ticketApi.addNote(ticket.id, text, type);
      setTicket(data.ticket);
      if (type === 'work') setWorkNote('');
      else setOnboardingNote('');
      await loadTicket();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignRecruiter = async () => {
    if (!ticket) return;
    setActionLoading(true);
    try {
      const data = await ticketApi.assignRecruiter(ticket.id, selectedRecruiter || null);
      setTicket(data.ticket);
      setSelectedRecruiter(data.ticket.recruiterUsername || '');
      toast.success(
        data.ticket.recruiterUsername
          ? `Recruiter assigned: ${data.ticket.recruiterName || data.ticket.recruiterUsername}`
          : 'Recruiter unassigned'
      );
      await loadTicket();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign recruiter');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddFile = async () => {
    if (!ticket || !fileUrl.trim()) return;
    setActionLoading(true);
    try {
      await ticketApi.addFile(ticket.id, {
        name: fileName || 'Resume file',
        url: fileUrl,
        type: fileUrl.startsWith('http') ? 'link' : 'file',
      });
      setFileUrl('');
      setFileName('');
      await loadTicket();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add file');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !ticket) return;
    setActionLoading(true);
    try {
      const result = await uploadFile(file, 'resumes');
      await ticketApi.addFile(ticket.id, {
        name: file.name,
        url: result.url,
        type: 'file',
      });
      await loadTicket();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!ticket || !deleteReason.trim()) return;
    setActionLoading(true);
    try {
      await ticketApi.delete(ticket.id, deleteReason);
      toast.success('Ticket deleted');
      goBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setActionLoading(false);
    }
  };

  const copyFormLink = () => {
    if (ticket?.resumeFormLink) {
      navigator.clipboard.writeText(toPublicAppUrl(ticket.resumeFormLink));
      toast.success('Resume form link copied');
    }
  };

  const handleEnableFormEdit = async () => {
    if (!ticket) return;
    setActionLoading(true);
    try {
      const data = await ticketApi.enableFormEdit(ticket.id);
      setTicket(data.ticket);
      toast.success('Form edit enabled. Share the resume form link so the student can make changes.');
      await loadTicket();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to enable edit');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncStudentResume = async () => {
    if (!ticket) return;
    setActionLoading(true);
    try {
      const data = await ticketApi.syncStudentResume(ticket.id);
      toast.success(
        `Student resume synced from form for ${data.student.name}. Open Edit Student Resume / Build & Download to see full content.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync student resume');
    } finally {
      setActionLoading(false);
    }
  };

  const ensureViewLink = async () => {
    if (!ticket) return '';
    if (ticket.resumeFormViewLink) return toPublicAppUrl(ticket.resumeFormViewLink);
    const data = await ticketApi.getFormShareLink(ticket.id);
    setTicket((t) => (t ? { ...t, resumeFormViewLink: data.resumeFormViewLink } : t));
    return toPublicAppUrl(data.resumeFormViewLink);
  };

  const copyShareViewLink = async () => {
    if (!ticket) return;
    try {
      const link = await ensureViewLink();
      await navigator.clipboard.writeText(link);
      toast.success('View-only share link copied');
      await loadTicket();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to get share link');
    }
  };

  const openShareViewLink = async () => {
    if (!ticket) return;
    try {
      const link = await ensureViewLink();
      window.open(link, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open share link');
    }
  };

  const handleSaveChatLink = async () => {
    if (!ticket) return;
    setActionLoading(true);
    try {
      const data = await ticketApi.update(ticket.id, { chatLink: chatLinkDraft.trim() });
      setTicket(data.ticket);
      setChatLinkDraft(data.ticket.chatLink || '');
      toast.success('Chat link saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save chat link');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLinkStudent = async (s: ExternalStudent) => {
    if (!ticket) return;
    const phone = s.phone || s.mobile || '';
    const profileLink = (s.profilelink || s.profileLink || '') as string;
    setActionLoading(true);
    try {
      const data = await ticketApi.update(ticket.id, {
        studentId: (s._id as string) || null,
        studentPhone: phone,
        studentProfileLink: profileLink,
        candidateName: s.name || s.studentname || ticket.candidateName,
        phone: phone || ticket.phone,
        email: s.email || ticket.email,
      });
      setTicket(data.ticket);
      setShowStudentSearch(false);
      toast.success('Student linked to ticket');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to link student');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlinkStudent = async () => {
    if (!ticket) return;
    if (!window.confirm('Unlink this student from the ticket?')) return;
    setActionLoading(true);
    try {
      const data = await ticketApi.update(ticket.id, {
        studentId: null,
        studentPhone: '',
        studentProfileLink: '',
      });
      setTicket(data.ticket);
      toast.success('Student unlinked from ticket');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unlink student');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!ticket) {
    return <div className="text-body">{loadError || 'Ticket not found'}</div>;
  }

  const currentIdx = STAGE_ORDER.indexOf(ticket.currentStage);
  const prevStage = currentIdx > 0 ? STAGE_ORDER[currentIdx - 1] : null;
  const nextStage = currentIdx < STAGE_ORDER.length - 1 ? STAGE_ORDER[currentIdx + 1] : null;
  const isOnboarded = ticket.currentStage === 'onboarded_successfully';
  const canUnlockForm =
    ticket.ticketType === 'new_resume' &&
    (ticket.resumeFormStatusStored === 'completed' || ticket.resumeFormStatus === 'completed') &&
    !ticket.resumeFormEditEnabled;

  const timeline = [...history].reverse();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-2 text-sm text-body transition hover:text-heading"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tickets
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-heading md:text-3xl">
            {ticket.candidateName}
          </h1>
          <p className="mt-1 text-sm text-body">Ticket {ticket.ticketNumber}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StageBadge
            stage={ticket.currentStage}
            className={cn(
              'rounded-full px-3 py-1 text-sm',
              isOnboarded && 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
            )}
          />
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="np-btn-secondary !px-3 text-red-600"
            title="Delete ticket"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Top: Candidate + Details */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm md:p-6">
          <SectionTitle>Candidate Information</SectionTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FieldIcon icon={User} label="Name" value={ticket.candidateName} />
            <FieldIcon icon={Mail} label="Email" value={ticket.email || '—'} />
            <FieldIcon icon={Phone} label="Phone" value={ticket.phone || '—'} />
            <FieldIcon icon={FileText} label="Type" value={ticketTypeLabel(ticket.ticketType)} />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm md:p-6">
          <SectionTitle>Details</SectionTitle>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <DetailCell label="Created" value={formatDate(ticket.createdAt)} />
            <DetailCell label="Due Date" value={ticket.dueDate ? formatDate(ticket.dueDate) : '—'} />
            <DetailCell
              label="Created By"
              value={ticket.createdByName || ticket.createdByLabel || 'System'}
            />
            <DetailCell label="Assigned To" value={ticket.assignedToName || 'Unallocated'} />
          </dl>
        </section>
      </div>

      {/* Middle: Timeline + Actions */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)]">
        <div className="space-y-5">
          {ticket.notes ? (
            <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm md:p-6">
              <SectionTitle>Instructions from Mentor</SectionTitle>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-body">{ticket.notes}</p>
            </section>
          ) : null}

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm md:p-6">
            <SectionTitle>Status Timeline</SectionTitle>
            <div className="relative mt-5">
              {timeline.length === 0 ? (
                <p className="text-sm text-body">No status changes yet.</p>
              ) : (
                timeline.map((h, idx) => {
                  const isLatest = idx === timeline.length - 1;
                  return (
                    <div key={h.id} className="relative flex gap-4 pb-6 last:pb-0">
                      {idx < timeline.length - 1 && (
                        <span className="absolute left-[7px] top-4 h-[calc(100%-8px)] w-px bg-border" />
                      )}
                      <span
                        className={cn(
                          'relative z-10 mt-1 h-4 w-4 shrink-0 rounded-full border-2',
                          isLatest ? 'border-primary bg-primary' : 'border-border bg-surface'
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-heading">{STAGE_LABELS[h.toStage]}</p>
                          {isLatest && <StageBadge stage={h.toStage} />}
                        </div>
                        {h.fromStage && (
                          <p className="mt-0.5 text-xs text-body">From {STAGE_LABELS[h.fromStage]}</p>
                        )}
                        {h.note && (
                          <div className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm text-body">
                            {h.note}
                          </div>
                        )}
                        <p className="mt-1 text-xs text-body/70">
                          {formatDateTime(h.createdAt)}
                          {h.changedByName ? ` · ${h.changedByName}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <SectionTitle>Chat Link (Optional)</SectionTitle>
            <div className="mt-3 flex gap-2">
              <input
                className="np-input"
                placeholder="Enter chat link..."
                value={chatLinkDraft}
                onChange={(e) => setChatLinkDraft(e.target.value)}
              />
              <button
                type="button"
                className="np-btn-primary shrink-0 !px-4"
                onClick={handleSaveChatLink}
                disabled={actionLoading || chatLinkDraft.trim() === (ticket.chatLink || '')}
              >
                Save
              </button>
            </div>
          </section>

          {ticket.ticketType === 'new_resume' && ticket.resumeFormLink && (
            <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <SectionTitle>Resume Information Form</SectionTitle>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
                <p className="min-w-0 flex-1 truncate text-xs text-body">
                  {toPublicAppUrl(ticket.resumeFormLink)}
                </p>
                <button
                  type="button"
                  className="np-btn-secondary !px-2.5 !py-1.5 text-xs"
                  onClick={copyFormLink}
                  title="Copy form link"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </section>
          )}

          {ticket.ticketType === 'new_resume' && (
            <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <SectionTitle>Resume Details (View Only)</SectionTitle>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="np-btn-secondary !py-2 text-sm" onClick={copyShareViewLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </button>
                <button type="button" className="np-btn-secondary !py-2 text-sm" onClick={openShareViewLink}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open
                </button>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <SectionTitle>Student Profile</SectionTitle>
            {ticket.studentId && ticket.studentPhone ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-body">
                  Linked:{' '}
                  <Link
                    to={`/students/${encodeURIComponent(ticket.studentPhone)}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {ticket.studentPhone}
                  </Link>
                </p>
                <div className="flex flex-col gap-2">
                  <Link
                    to={`/ticket/${ticket.id}/student-profile`}
                    className="np-btn-secondary w-full justify-center"
                  >
                    <UserRound className="mr-2 h-4 w-4" />
                    Edit Profile
                  </Link>
                  <Link
                    to={`/search-resume?phone=${encodeURIComponent(ticket.studentPhone)}&companyId=${encodeURIComponent(ticket.companyId)}`}
                    className="inline-flex w-full items-center justify-center rounded-pill border border-violet-200 bg-violet-50 px-6 py-2.5 text-sm font-medium text-violet-800 transition hover:bg-violet-100"
                  >
                    <FilePenLine className="mr-2 h-4 w-4" />
                    Edit Student Resume
                  </Link>
                  <button
                    type="button"
                    className="np-btn-secondary w-full justify-center text-red-600 hover:bg-red-50"
                    onClick={handleUnlinkStudent}
                    disabled={actionLoading}
                  >
                    Unlink Student
                  </button>
                  <button
                    type="button"
                    className="text-left text-sm text-primary hover:underline"
                    onClick={() => setShowStudentSearch((v) => !v)}
                  >
                    {showStudentSearch ? 'Hide search' : 'Link a different student'}
                  </button>
                </div>
                {showStudentSearch && (
                  <StudentSearch
                    companyId={ticket.companyId}
                    onSelect={handleLinkStudent}
                    placeholder="Search student to link..."
                  />
                )}
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-body">No student linked to this ticket.</p>
                <StudentSearch
                  companyId={ticket.companyId}
                  onSelect={handleLinkStudent}
                  placeholder="Search student to link..."
                />
              </div>
            )}
          </section>

          {isOnboarded && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <h3 className="font-semibold text-emerald-900">Successfully Onboarded</h3>
                  <p className="mt-1 text-sm text-emerald-800/80">
                    This candidate has been successfully onboarded. The ticket is now closed.
                  </p>
                </div>
              </div>
            </section>
          )}
        </aside>
      </div>

      {/* Bottom: structured form details */}
      {ticket.ticketType === 'new_resume' && (
        <ResumeFormDetails
          formData={ticket.resumeFormData}
          status={ticket.resumeFormStatus}
          updatedAt={ticket.updatedAt}
          onUnlock={canUnlockForm ? handleEnableFormEdit : undefined}
          unlockDisabled={actionLoading}
        />
      )}

      {/* Operational controls kept below the reference layout */}
      <section className="rounded-2xl border border-dashed border-border bg-surface/80 p-5 md:p-6">
        <SectionTitle>Manage Ticket</SectionTitle>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-heading">Update Status</h3>
            <textarea
              className="np-input mt-2 min-h-[72px]"
              placeholder="Optional note for stage change..."
              value={stageNote}
              onChange={(e) => setStageNote(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {prevStage && (
                <button
                  type="button"
                  className="np-btn-secondary"
                  disabled={actionLoading}
                  onClick={() => handleStageChange(prevStage)}
                >
                  ← {STAGE_LABELS[prevStage]}
                </button>
              )}
              {nextStage && (
                <button
                  type="button"
                  className="np-btn-primary"
                  disabled={actionLoading}
                  onClick={() => handleStageChange(nextStage)}
                >
                  {STAGE_LABELS[nextStage]} →
                </button>
              )}
            </div>
          </div>

          {(user?.role === 'resume' || user?.isCompanyAdmin || user?.isPlatformAdmin) && (
            <div>
              <h3 className="text-sm font-medium text-heading">Allocate Resume Editor</h3>
              <select
                className="np-input mt-2"
                value={ticket.assignedTo || ''}
                onChange={(e) => handleAssign(e.target.value)}
                disabled={actionLoading}
              >
                <option value="">Unallocated</option>
                {resumeMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-heading">Work Notes</h3>
            <div className="mt-2 flex gap-2">
              <input
                className="np-input"
                value={workNote}
                onChange={(e) => setWorkNote(e.target.value)}
                placeholder="Add a work note..."
              />
              <button
                type="button"
                className="np-btn-primary shrink-0"
                onClick={() => handleAddNote('work')}
                disabled={actionLoading}
              >
                Add
              </button>
            </div>
            <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
              {ticket.workNotes.map((n) => (
                <div key={n.id} className="rounded-lg bg-muted p-2.5 text-sm">
                  <p>{n.text}</p>
                  <p className="mt-1 text-xs text-body/70">
                    {n.authorName} · {formatDateTime(n.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-heading">Resume Files</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                className="np-input max-w-[140px]"
                placeholder="File name"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
              />
              <input
                className="np-input flex-1"
                placeholder="URL"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
              />
              <button type="button" className="np-btn-secondary" onClick={handleAddFile}>
                Add Link
              </button>
              <label className="np-btn-secondary cursor-pointer">
                Upload
                <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileUpload} />
              </label>
            </div>
            <ul className="mt-3 space-y-1">
              {ticket.resumeFiles.map((f, i) => (
                <li key={i}>
                  <a href={f.url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                    {f.name}
                  </a>
                </li>
              ))}
            </ul>
            {ticket.studentPhone && ticket.resumeFormData && (
              <button
                type="button"
                onClick={handleSyncStudentResume}
                className="np-btn-secondary mt-3 !py-2 text-sm"
                disabled={actionLoading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Resume from Form
              </button>
            )}
          </div>

          {canManageOnboarding && (
            <div className="lg:col-span-2">
              <h3 className="text-sm font-medium text-heading">Onboarding / Recruiter</h3>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <select
                    className="np-input w-full"
                    value={selectedRecruiter}
                    onChange={(e) => setSelectedRecruiter(e.target.value)}
                    disabled={actionLoading || !ticket.studentId}
                  >
                    <option value="">— No recruiter —</option>
                    {recruiters.map((r, i) => (
                      <option key={r.username || i} value={r.username || ''}>
                        {r.name || r.username}
                        {r.username ? ` (@${r.username})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="np-btn-primary"
                  onClick={handleAssignRecruiter}
                  disabled={actionLoading || !ticket.studentId}
                >
                  Save Recruiter
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className="np-input"
                  value={onboardingNote}
                  onChange={(e) => setOnboardingNote(e.target.value)}
                  placeholder="Add onboarding note..."
                />
                <button
                  type="button"
                  className="np-btn-primary shrink-0"
                  onClick={() => handleAddNote('onboarding')}
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-heading">Delete Ticket</h3>
            <p className="mt-2 text-sm text-body">Please provide a reason for deletion.</p>
            <textarea
              className="np-input mt-4 min-h-[80px]"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Reason..."
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="np-btn-primary bg-red-600 hover:bg-red-700"
                onClick={handleDelete}
                disabled={!deleteReason.trim() || actionLoading}
              >
                Delete
              </button>
              <button type="button" className="np-btn-secondary" onClick={() => setShowDelete(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-body">{children}</h2>
  );
}

function FieldIcon({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-body">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-body">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-heading">{value}</p>
      </div>
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-body">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-heading">{value}</dd>
    </div>
  );
}
