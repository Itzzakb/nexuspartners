import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { ticketApi } from '@/lib/api';
import { StudentSearch } from '@/components/students/StudentSearch';
import type { ExternalStudent } from '@/types/phase4';

export default function CreateTicket() {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    ticketType: 'new_resume',
    candidateName: '',
    phone: '',
    email: '',
    dueDate: '',
    notes: '',
    chatLink: '',
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
      studentPhone: phone,
      studentProfileLink: profileLink,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await ticketApi.create({
        ...form,
        dueDate: form.dueDate || undefined,
      } as Parameters<typeof ticketApi.create>[0]);
      navigate(`/ticket/${data.ticket.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
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
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {user?.isPlatformAdmin && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Company</label>
            <select
              className="np-input"
              value={form.companyId}
              onChange={(e) => setForm({ ...form, companyId: e.target.value })}
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
            onChange={(e) => setForm({ ...form, ticketType: e.target.value })}
          >
            <option value="new_resume">New Resume</option>
            <option value="existing_resume">Existing Resume</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-heading">Link Student (optional)</label>
          <StudentSearch
            companyId={form.companyId || user?.companyId}
            onSelect={handleStudentSelect}
            placeholder="Search existing student to auto-fill..."
          />
        </div>

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
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
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
