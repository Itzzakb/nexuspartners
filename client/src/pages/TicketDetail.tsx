import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Trash2, Unlock, Link2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ticketApi, uploadFile } from '@/lib/api';
import { StudentSearch } from '@/components/students/StudentSearch';
import type { ExternalStudent } from '@/types/phase4';
import { StageBadge } from '@/components/tickets/StageBadge';
import { ResumeFormTable } from '@/components/resumeForm/ResumeFormTable';
import {
  STAGE_LABELS,
  STAGE_ORDER,
  type Ticket,
  type TicketHistoryEntry,
  type TicketStage,
} from '@/types/ticket';

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [history, setHistory] = useState<TicketHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workNote, setWorkNote] = useState('');
  const [onboardingNote, setOnboardingNote] = useState('');
  const [stageNote, setStageNote] = useState('');
  const [resumeMembers, setResumeMembers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadTicket = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await ticketApi.get(id);
      setTicket(data.ticket);
      setHistory(data.history);
      const team = await ticketApi.resumeTeam(data.ticket.companyId);
      setResumeMembers(team.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [id]);

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
      setError(err instanceof Error ? err.message : 'Failed to change stage');
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
      await loadTicket();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign');
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
      setError(err instanceof Error ? err.message : 'Failed to add note');
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
      setError(err instanceof Error ? err.message : 'Failed to add file');
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
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!ticket || !deleteReason.trim()) return;
    setActionLoading(true);
    try {
      await ticketApi.delete(ticket.id, deleteReason);
      goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setActionLoading(false);
    }
  };

  const copyFormLink = () => {
    if (ticket?.resumeFormLink) {
      navigator.clipboard.writeText(ticket.resumeFormLink);
      setMessage('Resume form link copied');
    }
  };

  const handleEnableFormEdit = async () => {
    if (!ticket) return;
    setActionLoading(true);
    try {
      const data = await ticketApi.enableFormEdit(ticket.id);
      setTicket(data.ticket);
      setMessage('Candidate can edit the form again');
      await loadTicket();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable edit');
    } finally {
      setActionLoading(false);
    }
  };

  const copyShareViewLink = async () => {
    if (!ticket) return;
    try {
      const data = await ticketApi.getFormShareLink(ticket.id);
      await navigator.clipboard.writeText(data.resumeFormViewLink);
      setMessage('View-only share link copied');
      await loadTicket();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get share link');
    }
  };

  const handleLinkStudent = async (s: ExternalStudent) => {
    if (!ticket) return;
    const phone = s.phone || s.mobile || '';
    const profileLink = (s.profilelink || s.profileLink || '') as string;
    setActionLoading(true);
    try {
      const data = await ticketApi.update(ticket.id, {
        studentPhone: phone,
        studentProfileLink: profileLink,
        candidateName: s.name || s.studentname || ticket.candidateName,
        phone: phone || ticket.phone,
        email: s.email || ticket.email,
      });
      setTicket(data.ticket);
      setMessage('Student linked to ticket');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link student');
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
    return <div className="text-body">{error || 'Ticket not found'}</div>;
  }

  const currentIdx = STAGE_ORDER.indexOf(ticket.currentStage);
  const prevStage = currentIdx > 0 ? STAGE_ORDER[currentIdx - 1] : null;
  const nextStage = currentIdx < STAGE_ORDER.length - 1 ? STAGE_ORDER[currentIdx + 1] : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <button
        type="button"
        onClick={goBack}
        className="flex items-center gap-2 text-sm text-body hover:text-heading"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tickets
      </button>

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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-primary font-medium">{ticket.ticketNumber}</span>
              <StageBadge stage={ticket.currentStage} />
            </div>
            <h1 className="mt-2 text-2xl">{ticket.candidateName}</h1>
            <p className="text-sm text-body">
              {ticket.companyName} · Created by{' '}
              {ticket.createdByName || ticket.createdByLabel || 'System'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="np-btn-secondary !px-3 text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Info label="Email" value={ticket.email || '—'} />
          <Info label="Phone" value={ticket.phone || '—'} />
          <Info
            label="Due Date"
            value={ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString() : '—'}
          />
          <Info label="Type" value={ticket.ticketType.replace('_', ' ')} />
          <Info label="Assigned To" value={ticket.assignedToName || 'Unallocated'} />
          {ticket.studentPhone && (
            <Info
              label="Linked Student"
              value={
                <Link
                  to={`/students/${encodeURIComponent(ticket.studentPhone)}`}
                  className="text-primary hover:underline"
                >
                  {ticket.studentPhone}
                </Link>
              }
            />
          )}
          {ticket.studentProfileLink && (
            <Info
              label="Student Profile"
              value={
                <a
                  href={ticket.studentProfileLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Open profile
                </a>
              }
            />
          )}
          {ticket.chatLink && (
            <Info
              label="Chat Link"
              value={
                <a href={ticket.chatLink} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Open
                </a>
              }
            />
          )}
        </div>

        {ticket.notes && (
          <div className="mt-4 rounded-lg bg-muted p-4 text-sm text-body">
            <p className="font-medium text-heading">Instructions</p>
            <p className="mt-1 whitespace-pre-wrap">{ticket.notes}</p>
          </div>
        )}

        {ticket.ticketType === 'new_resume' && ticket.resumeFormLink && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={copyFormLink} className="np-btn-secondary !py-2 text-sm">
              <Copy className="mr-2 h-4 w-4" />
              Copy Resume Form Link
            </button>
            <button type="button" onClick={copyShareViewLink} className="np-btn-secondary !py-2 text-sm">
              <Link2 className="mr-2 h-4 w-4" />
              Copy View-Only Link
            </button>
            {ticket.resumeFormStatus === 'completed' && !ticket.resumeFormEditEnabled && (
              <button type="button" onClick={handleEnableFormEdit} className="np-btn-secondary !py-2 text-sm">
                <Unlock className="mr-2 h-4 w-4" />
                Enable Edit Again
              </button>
            )}
            <span
              className={`rounded-pill px-2 py-0.5 text-xs font-medium ${
                ticket.resumeFormStatus === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : ticket.resumeFormStatus === 'partial'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              Form {ticket.resumeFormStatus === 'completed' ? 'filled' : ticket.resumeFormStatus}
            </span>
          </div>
        )}
      </div>

      <div className="np-card p-6">
        <h2 className="text-lg">Link Student</h2>
        <p className="mt-1 text-sm text-body">
          Connect this ticket to an existing Nexus Partners student record
        </p>
        <div className="mt-3">
          <StudentSearch
            companyId={ticket.companyId}
            onSelect={handleLinkStudent}
            placeholder="Search student to link..."
          />
        </div>
      </div>

      {/* Stage controls */}
      <div className="np-card p-6">
        <h2 className="text-lg">Update Status</h2>
        <textarea
          className="np-input mt-3 min-h-[60px]"
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

      {/* Assign */}
      {(user?.role === 'resume' || user?.isCompanyAdmin || user?.isPlatformAdmin) && (
        <div className="np-card p-6">
          <h2 className="text-lg">Allocate Resume Editor</h2>
          <select
            className="np-input mt-3 max-w-sm"
            value={ticket.assignedTo || ''}
            onChange={(e) => handleAssign(e.target.value)}
            disabled={actionLoading}
          >
            <option value="">Unallocated</option>
            {resumeMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
            ))}
          </select>
          {resumeMembers.length === 0 && (
            <p className="mt-2 text-sm text-amber-600">
              No active Resume team members found for this company.
            </p>
          )}
        </div>
      )}

      {/* Work notes */}
      <div className="np-card p-6">
        <h2 className="text-lg">Work Notes</h2>
        <div className="mt-3 flex gap-2">
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
        <div className="mt-4 space-y-2">
          {ticket.workNotes.map((n) => (
            <div key={n.id} className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-body">{n.text}</p>
              <p className="mt-1 text-xs text-body/70">
                {n.authorName} · {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Resume files */}
      <div className="np-card p-6">
        <h2 className="text-lg">Resume Files</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="np-input max-w-xs"
            placeholder="File name"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
          />
          <input
            className="np-input flex-1"
            placeholder="URL or upload file below"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
          />
          <button type="button" className="np-btn-secondary" onClick={handleAddFile}>
            Add Link
          </button>
          <label className="np-btn-secondary cursor-pointer">
            Upload File
            <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileUpload} />
          </label>
        </div>
        <ul className="mt-4 space-y-2">
          {ticket.resumeFiles.map((f, i) => (
            <li key={i}>
              <a href={f.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {f.name}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Onboarding */}
      {(user?.role === 'onboarding' || user?.isCompanyAdmin || user?.isPlatformAdmin) && (
        <div className="np-card p-6">
          <h2 className="text-lg">Onboarding Notes</h2>
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
          <div className="mt-4 space-y-2">
            {ticket.onboardingNotes.map((n) => (
              <div key={n.id} className="rounded-lg bg-muted p-3 text-sm">
                <p>{n.text}</p>
                <p className="mt-1 text-xs text-body/70">
                  {n.authorName} · {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {ticket.ticketType === 'new_resume' && (
        <div className="np-card p-6">
          <h2 className="text-lg">Resume Information Form</h2>
          <div className="mt-4">
            <ResumeFormTable
              rows={ticket.resumeFormRows || []}
              emptyMessage="Candidate has not started the form yet."
            />
          </div>
        </div>
      )}

      {/* History */}
      <div className="np-card p-6">
        <h2 className="text-lg">Status Timeline</h2>
        <div className="mt-4 space-y-4">
          {history.map((h) => (
            <div key={h.id} className="border-l-2 border-primary/30 pl-4">
              <p className="text-sm font-medium text-heading">
                {h.fromStage ? `${STAGE_LABELS[h.fromStage]} → ` : ''}
                {STAGE_LABELS[h.toStage]}
              </p>
              {h.note && <p className="text-sm text-body">{h.note}</p>}
              <p className="text-xs text-body/70">
                {h.changedByName} · {new Date(h.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="np-card w-full max-w-md p-6">
            <h3 className="text-lg">Delete Ticket</h3>
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

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-body">{label}</p>
      <p className="mt-0.5 text-sm text-heading">{value}</p>
    </div>
  );
}
