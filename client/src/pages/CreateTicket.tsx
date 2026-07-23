import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { studentApi, ticketApi } from '@/lib/api';
import { StudentSearch } from '@/components/students/StudentSearch';
import type { ExternalStudent } from '@/types/phase4';
import { toast } from '@/lib/toast';

export default function CreateTicket() {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [studentLookup, setStudentLookup] = useState<
    'idle' | 'searching' | 'found' | 'not_found'
  >('idle');
  const [form, setForm] = useState({
    ticketType: 'new_resume',
    candidateName: '',
    phone: '',
    email: '',
    dueDate: '',
    notes: '',
    chatLink: '',
    studentId: '',
    studentPhone: '',
    studentProfileLink: '',
    companyId: user?.companyId || '',
  });

  const handleStudentSelect = (s: ExternalStudent) => {
    const name = s.name || s.studentname || '';
    const phone = s.phone || s.mobile || '';
    const email = s.email || '';
    const profileLink = (s.profilelink || s.profileLink || '') as string;
    setForm((f) => ({
      ...f,
      candidateName: name || f.candidateName,
      phone: phone || f.phone,
      email: email || f.email,
      studentId: (s._id as string) || '',
      studentPhone: phone,
      studentProfileLink: profileLink,
    }));
  };

  const lookupPhone = async () => {
    if (form.ticketType !== 'existing_resume' || !form.phone.trim()) return;
    if (form.studentId && form.studentPhone === form.phone) return;

    setStudentLookup('searching');
    try {
      const result = await studentApi.lookupByPhone(
        form.phone.trim(),
        form.companyId || user?.companyId
      );
      if (result.exists && result.student) {
        setForm((current) => ({
          ...current,
          studentId: result.student!.id,
          studentPhone: result.student!.phone,
          candidateName: result.student!.name || current.candidateName,
          phone: result.student!.phone,
          email: result.student!.email || current.email,
        }));
        setStudentLookup('found');
      } else {
        setForm((current) => ({ ...current, studentId: '', studentPhone: '' }));
        setStudentLookup('not_found');
      }
    } catch {
      setStudentLookup('not_found');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await ticketApi.create({
        ...form,
        dueDate: form.dueDate || undefined,
      } as Parameters<typeof ticketApi.create>[0]);
      if (form.ticketType === 'existing_resume' && !data.ticket.studentId) {
        navigate(`/ticket/${data.ticket.id}/student-profile`);
      } else {
        navigate(`/ticket/${data.ticket.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl">Create Ticket</h1>
        <p className="mt-1 text-body">Create a new resume ticket for a candidate</p>
      </div>

      <form onSubmit={handleSubmit} className="np-card space-y-4 p-6">
        {user?.isPlatformAdmin && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Company</label>
            <select
              className="np-input"
              value={form.companyId}
              onChange={(e) => {
                setForm({
                  ...form,
                  companyId: e.target.value,
                  studentId: '',
                  studentPhone: '',
                });
                setStudentLookup('idle');
              }}
              required
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-heading">Ticket Type</label>
          <select
            className="np-input"
            value={form.ticketType}
            onChange={(e) => {
              setForm({
                ...form,
                ticketType: e.target.value,
                studentId: '',
                studentPhone: '',
              });
              setStudentLookup('idle');
            }}
          >
            <option value="new_resume">New Resume</option>
            <option value="existing_resume">Existing Resume</option>
          </select>
        </div>

        {form.ticketType === 'existing_resume' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">
              Search and Link Existing Student
            </label>
            <StudentSearch
              companyId={form.companyId || user?.companyId}
              onSelect={(student) => {
                handleStudentSelect(student);
                setStudentLookup('found');
              }}
              placeholder="Search manually by name, phone or email..."
            />
            <p className="mt-1 text-xs text-body">
              Entering a phone number below also searches automatically. If no student exists,
              you will be taken to Create Student mode after the ticket is created.
            </p>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-heading">Candidate Name</label>
          <input
            className="np-input"
            value={form.candidateName}
            onChange={(e) => setForm({ ...form, candidateName: e.target.value })}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Phone</label>
            <input
              className="np-input"
              value={form.phone}
              onChange={(e) => {
                setForm({
                  ...form,
                  phone: e.target.value,
                  studentId: '',
                  studentPhone: '',
                });
                setStudentLookup('idle');
              }}
              onBlur={lookupPhone}
            />
            {form.ticketType === 'existing_resume' && studentLookup !== 'idle' && (
              <p
                className={`mt-1 text-xs ${
                  studentLookup === 'found'
                    ? 'text-green-700'
                    : studentLookup === 'not_found'
                      ? 'text-amber-700'
                      : 'text-body'
                }`}
              >
                {studentLookup === 'searching' && 'Searching for student...'}
                {studentLookup === 'found' && 'Existing student found and linked.'}
                {studentLookup === 'not_found' &&
                  'No student found. Create Student mode will open after ticket creation.'}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Email</label>
            <input
              type="email"
              className="np-input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-heading">Due Date</label>
          <input
            type="date"
            className="np-input"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-heading">Chat Link (optional)</label>
          <input
            className="np-input"
            value={form.chatLink}
            onChange={(e) => setForm({ ...form, chatLink: e.target.value })}
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-heading">
            Notes for Resume Team
          </label>
          <textarea
            className="np-input min-h-[100px]"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <div className="flex gap-3">
          <button type="submit" className="np-btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Ticket'}
          </button>
          <button
            type="button"
            className="np-btn-secondary"
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
