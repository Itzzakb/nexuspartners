import { useEffect, useState } from 'react';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { studentApi } from '@/lib/api';
import { toast } from '@/lib/toast';

interface StudentForm {
  name: string;
  email: string;
  mobile: string;
  role: string;
  linkedin: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  visa: string;
  password: string;
  additionalDetails: Array<{ key: string; data: string }>;
}

const emptyForm: StudentForm = {
  name: '',
  email: '',
  mobile: '',
  role: '',
  linkedin: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  visa: '',
  password: '',
  additionalDetails: [],
};

export default function TicketStudentProfile() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [ticketNumber, setTicketNumber] = useState('');
  const [formStatus, setFormStatus] = useState<'unfilled' | 'partial' | 'completed'>('unfilled');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!ticketId) return;

    const load = async () => {
      try {
        const data = await studentApi.resolveTicketProfile(ticketId);
        if (data.exists && data.student) {
          navigate(`/students/${encodeURIComponent(data.student.phone)}`, { replace: true });
          return;
        }

        setTicketNumber(data.ticket?.ticketNumber || '');
        setFormStatus(data.ticket?.resumeFormStatus || 'unfilled');
        setForm({
          ...emptyForm,
          ...(data.prefill || {}),
          additionalDetails: data.prefill?.additionalDetails || [],
        });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load ticket profile');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [ticketId, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ticketId) return;

    setSaving(true);
    try {
      const result = await studentApi.createFromTicket(ticketId, form);
      navigate(`/students/${encodeURIComponent(result.student.phone)}`, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create student');
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

  if (loadError) {
    return <div className="text-body">{loadError}</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to={`/ticket/${ticketId}`}
        className="inline-flex items-center gap-2 text-sm text-body hover:text-heading"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to ticket
      </Link>

      <div>
        <h1 className="text-3xl">Create Student Profile</h1>
        <p className="mt-1 text-body">
          {ticketNumber
            ? `Prefilled from ${ticketNumber} and its Resume Information Form`
            : 'Create and link this student to the ticket'}
        </p>
      </div>

      {formStatus !== 'completed' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The Resume Information Form is {formStatus}. You can create the student now, but some
          fields may need to be entered manually.
        </div>
      )}

      <form onSubmit={submit} className="np-card space-y-5 p-6">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <h2 className="text-lg">Student details</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Name *"
            value={form.name}
            onChange={(name) => setForm({ ...form, name })}
            required
          />
          <Field
            label="Phone *"
            value={form.mobile}
            onChange={(mobile) => setForm({ ...form, mobile })}
            required
          />
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(email) => setForm({ ...form, email })}
          />
          <Field
            label="Role / Job Title"
            value={form.role}
            onChange={(role) => setForm({ ...form, role })}
          />
          <Field
            label="LinkedIn"
            value={form.linkedin}
            onChange={(linkedin) => setForm({ ...form, linkedin })}
          />
          <Field
            label="Visa Status"
            value={form.visa}
            onChange={(visa) => setForm({ ...form, visa })}
          />
          <Field
            label="City"
            value={form.city}
            onChange={(city) => setForm({ ...form, city })}
          />
          <Field
            label="State"
            value={form.state}
            onChange={(state) => setForm({ ...form, state })}
          />
          <Field
            label="ZIP / Postal Code"
            value={form.zipCode}
            onChange={(zipCode) => setForm({ ...form, zipCode })}
          />
          <Field
            label="Country"
            value={form.country}
            onChange={(country) => setForm({ ...form, country })}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-heading">Street Address</label>
          <textarea
            className="np-input min-h-[80px]"
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
        </div>

        {form.additionalDetails.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-heading">Imported form details</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {form.additionalDetails.map((detail, index) => (
                <div key={`${detail.key}-${index}`} className="rounded-lg bg-muted px-3 py-2">
                  <p className="text-xs text-body">{detail.key}</p>
                  <p className="text-sm text-heading">{detail.data}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-heading">
            Create Student Password
          </label>
          <input
            className="np-input"
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="Company-configured password"
          />
        </div>

        <button type="submit" className="np-btn-primary" disabled={saving}>
          {saving ? 'Creating student...' : 'Create Student'}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-heading">{label}</label>
      <input
        className="np-input"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </div>
  );
}
