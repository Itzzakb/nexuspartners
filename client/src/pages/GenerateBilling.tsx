import { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { billingApi } from '@/lib/api';
import type { BillingLine, BillingSummary } from '@/types/phase6';

export default function GenerateBilling() {
  const { user, company } = useAuth();
  const { companies } = useCompanies();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [companyId, setCompanyId] = useState('');
  const [preview, setPreview] = useState<{ summary: BillingSummary; lines: BillingLine[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const billRate = company?.billRatePerDay ?? 4;
  const currency = company?.salaryCurrency || 'INR';

  const loadPreview = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await billingApi.preview(year, month, companyId || undefined);
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreview();
  }, [year, month, companyId]);

  const handleGenerate = async (finalize: boolean) => {
    setGenerating(true);
    setError('');
    try {
      const data = await billingApi.generate({
        year,
        month,
        companyId: companyId || undefined,
        finalize,
      });
      setMessage(`Generated ${data.records.length} records (batch ${data.batchId.slice(0, 8)}…)`);
      loadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setGenerating(false);
    }
  };

  const formatAmount = (amount: number, cur: string) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur }).format(amount / 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Generate Billing</h1>
        <p className="mt-1 text-body">
          Day-rate billing at {billRate} {currency}/day per active student
        </p>
      </div>

      <div className="np-card flex flex-wrap gap-3 p-4">
        <select className="np-input max-w-[120px]" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(2000, i).toLocaleString('default', { month: 'long' })}
            </option>
          ))}
        </select>
        <input className="np-input max-w-[100px]" type="number" value={year}
          onChange={(e) => setYear(Number(e.target.value))} />
        {user?.isPlatformAdmin && (
          <select className="np-input max-w-xs" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Current company</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <button type="button" className="np-btn-secondary" onClick={loadPreview} disabled={loading}>
          Refresh preview
        </button>
        <button type="button" className="np-btn-primary" onClick={() => handleGenerate(false)} disabled={generating}>
          <Calculator className="mr-2 h-4 w-4" />
          Generate draft
        </button>
        <button type="button" className="np-btn-accent" onClick={() => handleGenerate(true)} disabled={generating}>
          Finalize billing
        </button>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {preview && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="np-card p-4">
            <p className="text-sm text-body">Students</p>
            <p className="text-2xl font-semibold">{preview.summary.totalStudents}</p>
          </div>
          <div className="np-card p-4">
            <p className="text-sm text-body">Billable</p>
            <p className="text-2xl font-semibold text-green-700">{preview.summary.billableStudents}</p>
          </div>
          <div className="np-card p-4">
            <p className="text-sm text-body">Excluded</p>
            <p className="text-2xl font-semibold">{preview.summary.excludedStudents}</p>
          </div>
          <div className="np-card p-4">
            <p className="text-sm text-body">Total</p>
            <p className="text-2xl font-semibold">
              {formatAmount(preview.summary.totalAmount, preview.summary.currency)}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-body">Loading preview...</p>
      ) : preview ? (
        <div className="overflow-x-auto np-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-body">
                <th className="p-4">Student</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Active days</th>
                <th className="p-4">Rate/day</th>
                <th className="p-4">Total</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.lines.map((line, i) => (
                <tr key={i} className={`border-b border-border ${line.excluded ? 'opacity-50' : ''}`}>
                  <td className="p-4 font-medium">{line.studentName}</td>
                  <td className="p-4">{line.studentPhone}</td>
                  <td className="p-4">{line.activeDays}</td>
                  <td className="p-4">{line.billRatePerDay}</td>
                  <td className="p-4">{formatAmount(line.totalAmount, line.currency)}</td>
                  <td className="p-4 text-body">
                    {line.excluded ? line.excludedReason || 'Excluded' : 'Billable'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
