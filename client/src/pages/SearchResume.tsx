import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Search } from 'lucide-react';
import { externalApi, resumeParseApi, resumeTemplateApi } from '@/lib/api';
import type { ResumeTemplate } from '@/types/phase7';

export default function SearchResume() {
  const [searchParams] = useSearchParams();
  const [phone, setPhone] = useState(searchParams.get('phone') || '');
  const [student, setStudent] = useState<Record<string, unknown> | null>(null);
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [resumeJson, setResumeJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    resumeTemplateApi.list().then((d) => {
      setTemplates(d.templates);
      const def = d.templates.find((t) => t.isDefault);
      if (def) setTemplateId(def.id);
    }).catch(() => {});
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setError('');
    setStudent(null);
    try {
      const data = await externalApi.studentDetails(phone.trim());
      const s = (data.student || {}) as Record<string, unknown>;
      setStudent(s);
      setResumeJson(JSON.stringify(s.resume || s, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Student not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchParams.get('phone')) handleSearch();
  }, []);

  const handleBuild = async () => {
    setBuilding(true);
    setError('');
    try {
      const data = await resumeParseApi.buildDownload({
        phone: phone.trim(),
        templateId: templateId || undefined,
      });
      const url = data.result?.downloadUrl;
      if (url) {
        window.open(url, '_blank');
        setMessage('Resume download started');
      } else {
        setMessage('Build requested (mock mode — no download URL in dev)');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Build failed');
    } finally {
      setBuilding(false);
    }
  };

  const handleUpdate = async () => {
    setSaving(true);
    setError('');
    try {
      const resumeData = JSON.parse(resumeJson);
      await resumeParseApi.updateStudent({ phone: phone.trim(), resumeData });
      setMessage('Resume updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed — check JSON format');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl">Search Resume</h1>
        <p className="mt-1 text-body">Look up a student and build or update their ATS resume</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      <form onSubmit={handleSearch} className="np-card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
            <input
              className="np-input pl-9"
              placeholder="Student phone number..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <button type="submit" className="np-btn-primary" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {student && (
        <>
          <div className="np-card p-6">
            <h2 className="text-lg">
              {(student.name || student.studentname || 'Student') as string}
            </h2>
            <p className="text-sm text-body">
              {String(student.phone || student.mobile || phone)}
              {student.email ? ` · ${student.email}` : ''}
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <select
                className="np-input max-w-xs"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">Default template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="np-btn-primary"
                onClick={handleBuild}
                disabled={building}
              >
                <Download className="mr-2 h-4 w-4" />
                {building ? 'Building...' : 'Build & Download'}
              </button>
            </div>
          </div>

          <div className="np-card p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg">Resume Data (JSON)</h2>
              <button
                type="button"
                className="np-btn-secondary !py-2 text-sm"
                onClick={handleUpdate}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Update Resume'}
              </button>
            </div>
            <textarea
              className="np-input min-h-[320px] font-mono text-xs"
              value={resumeJson}
              onChange={(e) => setResumeJson(e.target.value)}
            />
          </div>
        </>
      )}
    </div>
  );
}
