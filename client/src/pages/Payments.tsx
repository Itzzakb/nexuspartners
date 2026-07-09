import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { paymentApi } from '@/lib/api';
import type { PaymentRecord } from '@/types/payment';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-700',
};

export default function Payments() {
  const { user, company } = useAuth();
  const { companies } = useCompanies();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [stats, setStats] = useState<{ total: number; paid: number; pending: number; totalCollected: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState('');
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    studentName: '',
    studentPhone: '',
    studentEmail: '',
    amount: '',
    currency: company?.salaryCurrency || 'INR',
    paymentMethod: 'cash',
    paymentType: 'other',
    description: '',
    notes: '',
  });

  const paymentTypes = company?.paymentTypes || ['Cash', 'UPI', 'Bank Transfer'];

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (companyId) params.companyId = companyId;
      if (status) params.status = status;
      const [listData, statsData] = await Promise.all([
        paymentApi.list(params),
        paymentApi.stats(companyId || undefined),
      ]);
      setPayments(listData.payments);
      setStats(statsData.stats);
    } catch {
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId, status]);

  const handleManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const amount = Math.round(parseFloat(form.amount) * 100);
      await paymentApi.createManual({
        ...form,
        amount,
        paymentMethod: form.paymentMethod.toLowerCase().replace(' ', '_'),
        companyId: companyId || undefined,
      });
      setShowForm(false);
      setForm({
        studentName: '',
        studentPhone: '',
        studentEmail: '',
        amount: '',
        currency: company?.salaryCurrency || 'INR',
        paymentMethod: 'cash',
        paymentType: 'other',
        description: '',
        notes: '',
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const collectedFormatted = stats
    ? new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: company?.salaryCurrency || 'INR',
      }).format(stats.totalCollected / 100)
    : '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">Payments</h1>
          <p className="mt-1 text-body">Payment history and manual payment recording</p>
        </div>
        <div className="flex gap-2">
          <Link to="/payment-links" className="np-btn-secondary">
            Payment Links
          </Link>
          <button type="button" className="np-btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-4 w-4" />
            Record payment
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="np-card p-4">
            <p className="text-sm text-body">Total records</p>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </div>
          <div className="np-card p-4">
            <p className="text-sm text-body">Paid</p>
            <p className="text-2xl font-semibold text-green-700">{stats.paid}</p>
          </div>
          <div className="np-card p-4">
            <p className="text-sm text-body">Pending</p>
            <p className="text-2xl font-semibold text-amber-700">{stats.pending}</p>
          </div>
          <div className="np-card p-4">
            <p className="text-sm text-body">Collected</p>
            <p className="text-2xl font-semibold">{collectedFormatted}</p>
          </div>
        </div>
      )}

      <div className="np-card flex flex-wrap gap-3 p-4">
        <select className="np-input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        {user?.isPlatformAdmin && (
          <select className="np-input max-w-xs" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleManual} className="np-card space-y-4 p-6">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <h2 className="text-lg">Record manual payment</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <input className="np-input" placeholder="Student name *" required value={form.studentName}
              onChange={(e) => setForm({ ...form, studentName: e.target.value })} />
            <input className="np-input" placeholder="Phone" value={form.studentPhone}
              onChange={(e) => setForm({ ...form, studentPhone: e.target.value })} />
            <input className="np-input" placeholder="Email" value={form.studentEmail}
              onChange={(e) => setForm({ ...form, studentEmail: e.target.value })} />
            <input className="np-input" type="number" step="0.01" placeholder="Amount *" required value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <select className="np-input" value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              {paymentTypes.map((t) => (
                <option key={t} value={t.toLowerCase().replace(' ', '_')}>{t}</option>
              ))}
            </select>
            <select className="np-input" value={form.paymentType}
              onChange={(e) => setForm({ ...form, paymentType: e.target.value })}>
              <option value="new">New</option>
              <option value="renewal">Renewal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <input className="np-input" placeholder="Description" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <textarea className="np-input min-h-20" placeholder="Notes" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button type="submit" className="np-btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save payment'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-body">Loading...</p>
      ) : payments.length === 0 ? (
        <div className="np-card p-8 text-center text-body">No payments found</div>
      ) : (
        <div className="overflow-x-auto np-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-body">
                <th className="p-4">Payment</th>
                <th className="p-4">Student</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Method</th>
                <th className="p-4">Status</th>
                <th className="p-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-border">
                  <td className="p-4">
                    <p className="font-medium text-heading">{p.paymentNumber}</p>
                    <p className="text-xs text-body">{p.paymentType}</p>
                  </td>
                  <td className="p-4">
                    <p>{p.studentName}</p>
                    <p className="text-xs text-body">{p.studentPhone}</p>
                  </td>
                  <td className="p-4">{p.amountFormatted}</td>
                  <td className="p-4">{PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</td>
                  <td className="p-4">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusColors[p.status])}>
                      {p.status}
                    </span>
                  </td>
                  <td className="p-4 text-body">
                    {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
