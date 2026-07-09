import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, ExternalLink, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { paymentApi } from '@/lib/api';
import { StudentSearch } from '@/components/students/StudentSearch';
import type { PaymentLink } from '@/types/payment';
import { LINK_STATUS_LABELS } from '@/types/payment';
import type { ExternalStudent } from '@/types/phase4';
import { cn } from '@/lib/utils';
import { ToggleField } from '@/components/ui/Toggle';

const statusColors: Record<string, string> = {
  created: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  expired: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-800',
  partially_paid: 'bg-amber-100 text-amber-800',
};

export default function PaymentLinks() {
  const { user, company } = useAuth();
  const { companies } = useCompanies();
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    customerContact: '',
    amount: '',
    currency: company?.salaryCurrency || 'INR',
    description: '',
    paymentType: 'renewal',
    expireBy: '',
    notifyEmail: true,
    notifySms: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (companyId) params.companyId = companyId;
      const data = await paymentApi.listLinks(params);
      setLinks(data.links);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const handleStudentSelect = (s: ExternalStudent) => {
    setForm((prev) => ({
      ...prev,
      customerName: (s.name || s.studentname || prev.customerName) as string,
      customerContact: (s.phone || s.mobile || prev.customerContact) as string,
      customerEmail: (s.email || prev.customerEmail) as string,
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const amount = Math.round(parseFloat(form.amount) * 100);
      await paymentApi.createLink({
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        customerContact: form.customerContact,
        amount,
        currency: form.currency,
        description: form.description || `${company?.name} subscription payment`,
        paymentType: form.paymentType,
        expireBy: form.expireBy || undefined,
        notifyEmail: form.notifyEmail,
        notifySms: form.notifySms,
        companyId: companyId || undefined,
      });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create link');
    } finally {
      setSaving(false);
    }
  };

  const copyUrl = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">Payment Links</h1>
          <p className="mt-1 text-body">Create and track Razorpay payment links</p>
        </div>
        <div className="flex gap-2">
          <Link to="/payments" className="np-btn-secondary">Payments</Link>
          <button type="button" className="np-btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-4 w-4" />
            Create link
          </button>
        </div>
      </div>

      {user?.isPlatformAdmin && (
        <div className="np-card p-4">
          <select className="np-input max-w-xs" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="np-card space-y-4 p-6">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <h2 className="text-lg">New Razorpay payment link</h2>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Link student</label>
            <StudentSearch companyId={companyId || company?.id} onSelect={handleStudentSelect} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <input className="np-input" placeholder="Customer name *" required value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            <input className="np-input" placeholder="Phone with country code" value={form.customerContact}
              onChange={(e) => setForm({ ...form, customerContact: e.target.value })} />
            <input className="np-input" placeholder="Email" value={form.customerEmail}
              onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} />
            <input className="np-input" type="number" step="0.01" placeholder="Amount *" required value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <select className="np-input" value={form.paymentType}
              onChange={(e) => setForm({ ...form, paymentType: e.target.value })}>
              <option value="new">New subscription</option>
              <option value="renewal">Renewal</option>
              <option value="other">Other</option>
            </select>
            <input type="datetime-local" className="np-input" value={form.expireBy}
              onChange={(e) => setForm({ ...form, expireBy: e.target.value })} />
          </div>

          <input className="np-input" placeholder="Description" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <div className="flex flex-wrap gap-6 text-sm">
            <ToggleField
              label="Notify via email"
              checked={form.notifyEmail}
              onChange={(checked) => setForm({ ...form, notifyEmail: checked })}
            />
            <ToggleField
              label="Notify via SMS"
              checked={form.notifySms}
              onChange={(checked) => setForm({ ...form, notifySms: checked })}
            />
          </div>

          <button type="submit" className="np-btn-primary" disabled={saving}>
            {saving ? 'Creating...' : 'Create payment link'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-body">Loading...</p>
      ) : links.length === 0 ? (
        <div className="np-card p-8 text-center text-body">No payment links yet</div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <div key={link.id} className="np-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-heading">{link.customerName}</p>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusColors[link.status])}>
                      {LINK_STATUS_LABELS[link.status]}
                    </span>
                    <span className="text-xs text-body">{link.paymentType}</span>
                  </div>
                  <p className="mt-1 text-sm text-body">
                    {link.amountFormatted} · {link.customerContact || link.customerEmail}
                  </p>
                  <p className="text-xs text-body">{link.description}</p>
                  {link.ticketId && (
                    <Link to={`/ticket/${link.ticketId}`} className="mt-1 block text-xs text-primary">
                      View auto-created ticket
                    </Link>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {link.shortUrl && (
                    <>
                      <a href={link.shortUrl} target="_blank" rel="noreferrer" className="np-btn-secondary text-sm">
                        <ExternalLink className="mr-1 h-4 w-4" />
                        Open
                      </a>
                      <button type="button" className="np-btn-secondary text-sm"
                        onClick={() => copyUrl(link.shortUrl, link.id)}>
                        <Copy className="mr-1 h-4 w-4" />
                        {copied === link.id ? 'Copied' : 'Copy'}
                      </button>
                    </>
                  )}
                  {link.razorpayLinkId.startsWith('plink_mock_') && link.status === 'created' && (
                    <button type="button" className="np-btn-accent text-sm"
                      onClick={() => paymentApi.simulateMockPay(link.razorpayLinkId).then(() => load()).catch((err) => setError(err.message))}>
                      Simulate pay (mock)
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
