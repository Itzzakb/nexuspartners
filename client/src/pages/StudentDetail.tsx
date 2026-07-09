import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { studentApi } from '@/lib/api';
import type { StudentDetail as StudentDetailData, StudentInterviewRef, StudentTicketRef } from '@/types/phase7';

export default function StudentDetailPage() {
  const { phone } = useParams<{ phone: string }>();
  const [student, setStudent] = useState<StudentDetailData | null>(null);
  const [tickets, setTickets] = useState<StudentTicketRef[]>([]);
  const [interviews, setInterviews] = useState<StudentInterviewRef[]>([]);
  const [payments, setPayments] = useState<unknown[]>([]);
  const [billing, setBilling] = useState<unknown[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    if (!phone) return;
    setLoading(true);
    try {
      const data = await studentApi.get(decodeURIComponent(phone));
      setStudent(data.student);
      setTickets(data.tickets);
      setInterviews(data.interviews);
      setPayments(data.payments);
      setBilling(data.billing);
      setNotes(data.student.notes || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student');
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
    setMessage('');
    try {
      await studentApi.updateNotes(decodeURIComponent(phone), notes);
      setMessage('Notes saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setSaving(false);
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
    return <p className="text-body">{error || 'Student not found'}</p>;
  }

  const details = student.details as Record<string, string>;
  const displayName = details.name || details.studentname || student.phone;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/students" className="inline-flex items-center gap-2 text-sm text-body hover:text-heading">
        <ArrowLeft className="h-4 w-4" />
        Back to students
      </Link>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      <div className="np-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl">{displayName}</h1>
            <p className="mt-1 text-body">
              {student.phone} · {student.companyLabel}
            </p>
            {details.email && <p className="text-sm text-body">{details.email}</p>}
          </div>
          <Link
            to={`/search-resume?phone=${encodeURIComponent(student.phone)}`}
            className="np-btn-secondary !py-2 text-sm"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Search Resume
          </Link>
        </div>

        {Object.keys(details).length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {Object.entries(details)
              .filter(([k]) => !['name', 'studentname', 'phone', 'mobile', 'email'].includes(k))
              .slice(0, 8)
              .map(([key, value]) => (
                <div key={key} className="rounded-lg bg-muted px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-body">{key}</p>
                  <p className="text-sm text-heading">{String(value)}</p>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="np-card p-6">
        <h2 className="text-lg">Notes</h2>
        <textarea
          className="np-input mt-3 min-h-[100px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes about this student..."
        />
        <button
          type="button"
          className="np-btn-primary mt-3"
          onClick={handleSaveNotes}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Notes'}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Tickets" empty={tickets.length === 0}>
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
        </Section>

        <Section title="Interviews" empty={interviews.length === 0}>
          {interviews.map((i) => (
            <Link
              key={i.id}
              to={`/interviews/${i.id}`}
              className="block rounded-lg border border-border px-4 py-3 transition hover:bg-muted"
            >
              <p className="font-medium text-heading">{i.candidateName}</p>
              <p className="text-xs text-body">
                {i.interviewNumber} · {i.currentStage.replace(/_/g, ' ')}
              </p>
            </Link>
          ))}
        </Section>

        <Section title="Payments" empty={payments.length === 0}>
          {payments.slice(0, 5).map((p, idx) => {
            const pay = p as Record<string, unknown>;
            return (
              <div key={idx} className="rounded-lg border border-border px-4 py-3">
                <p className="font-medium text-heading">{String(pay.studentName || 'Payment')}</p>
                <p className="text-xs text-body">
                  {pay.status as string} · {pay.paymentType as string}
                </p>
              </div>
            );
          })}
        </Section>

        <Section title="Billing" empty={billing.length === 0}>
          {billing.slice(0, 5).map((b, idx) => {
            const bill = b as Record<string, unknown>;
            return (
              <div key={idx} className="rounded-lg border border-border px-4 py-3">
                <p className="font-medium text-heading">
                  {bill.billingMonth as string}/{bill.billingYear as string}
                </p>
                <p className="text-xs text-body">{bill.status as string}</p>
              </div>
            );
          })}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="np-card p-6">
      <h2 className="mb-4 text-lg">{title}</h2>
      {empty ? (
        <p className="text-sm text-body">No {title.toLowerCase()} linked</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}
