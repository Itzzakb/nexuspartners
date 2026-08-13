import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { studentApi, resumeParseApi } from '@/lib/api';
import { downloadFileFromUrl } from '@/lib/downloadFile';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { StudentListItem } from '@/types/phase7';

type AppliedResume = {
  id: string;
  jobTitle: string;
  companyName: string;
  downloadUrl: string;
  hasResumeData: boolean;
  applyUrl?: string;
  createdAt: string;
  scrapedJobId?: string | null;
  studentPhone: string;
  studentName: string;
  source: string;
};

function formatDate(value: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SearchResume() {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const [searchParams] = useSearchParams();

  const [companyId, setCompanyId] = useState(searchParams.get('companyId') || '');
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [showStudentList, setShowStudentList] = useState(false);
  const [selected, setSelected] = useState<StudentListItem | null>(null);
  const [phone, setPhone] = useState(searchParams.get('phone') || '');

  const [companyFilter, setCompanyFilter] = useState('');
  const [jobTitleFilter, setJobTitleFilter] = useState('');
  const [descriptionFilter, setDescriptionFilter] = useState('');

  const [resumes, setResumes] = useState<AppliedResume[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searching, setSearching] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const pickerRef = useRef<HTMLDivElement>(null);
  const effectiveCompanyId = user?.isPlatformAdmin ? companyId || undefined : undefined;

  const loadStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const params: Record<string, string> = {};
      if (effectiveCompanyId) params.companyId = effectiveCompanyId;
      const data = await studentApi.list(params);
      setStudents(data.students || []);
    } catch {
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [effectiveCompanyId]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    if (user?.isPlatformAdmin && !companyId && companies.length) {
      setCompanyId(companies[0].id);
    }
  }, [user?.isPlatformAdmin, companyId, companies]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students.slice(0, 12);
    return students
      .filter((s) => {
        const blob = `${s.name} ${s.phone} ${s.email}`.toLowerCase();
        return blob.includes(q);
      })
      .slice(0, 20);
  }, [students, studentQuery]);

  const selectStudent = (s: StudentListItem) => {
    setSelected(s);
    setPhone(s.phone);
    setStudentQuery('');
    setShowStudentList(false);
  };

  const clearStudent = () => {
    setSelected(null);
    setPhone('');
    setResumes([]);
    setStudentQuery('');
  };

  const searchResumes = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const mobile = phone.trim();
    if (!mobile) {
      toast.error('Select a student or enter a mobile number');
      return;
    }
    setSearching(true);
    try {
      // Resolve student card if only phone was typed
      if (!selected || selected.phone !== mobile) {
        const match = students.find((s) => s.phone === mobile || s.phone.replace(/\D/g, '') === mobile.replace(/\D/g, ''));
        if (match) setSelected(match);
        else {
          try {
            const data = await studentApi.get(mobile, effectiveCompanyId);
            setSelected({
              phone: data.student.phone,
              name: String(
                (data.student.details as Record<string, unknown>)?.name ||
                  (data.student.details as Record<string, unknown>)?.studentname ||
                  'Student'
              ),
              email: String((data.student.details as Record<string, unknown>)?.email || ''),
              companyId: data.student.companyId,
              companyLabel: data.student.companyLabel,
              paymentCount: 0,
              hasActiveSubscription: false,
              status: 'active',
            });
          } catch {
            /* keep phone-only search */
          }
        }
      }

      const data = await resumeParseApi.listApplied({
        phone: mobile,
        companyId: effectiveCompanyId,
        company: companyFilter.trim() || undefined,
        jobTitle: jobTitleFilter.trim() || undefined,
        q: descriptionFilter.trim() || undefined,
      });
      setResumes(data.resumes || []);
    } catch (err) {
      setResumes([]);
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  // Prefill from deep link
  useEffect(() => {
    const p = searchParams.get('phone');
    if (!p) return;
    setPhone(p);
    // defer until students may be loaded
    const t = window.setTimeout(() => {
      searchResumes();
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-load resumes when student is selected
  useEffect(() => {
    if (!selected?.phone) return;
    searchResumes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.phone]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setShowStudentList(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const handleDownload = async (row: AppliedResume) => {
    setDownloadingId(row.id);
    try {
      let url = row.downloadUrl;
      let filename = `${(row.studentName || 'Resume').replace(/\s+/g, '_')}_${(row.companyName || 'Company').replace(/\s+/g, '_')}.docx`;

      try {
        const data = await resumeParseApi.downloadApplied(row.id, effectiveCompanyId);
        if (data.downloadUrl) {
          url = data.downloadUrl;
          if (data.filename) filename = data.filename;
        }
      } catch {
        /* fall back to existing url for action-only rows */
      }

      if (!url) {
        toast.error('No resume file available for this application yet');
        return;
      }
      await downloadFileFromUrl(url, filename);
      toast.success('Resume downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  const copyApplyUrl = async (row: AppliedResume) => {
    const text = row.applyUrl || row.downloadUrl || '';
    if (!text) {
      toast.error('Nothing to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl">Search Resume</h1>
        {user?.isPlatformAdmin && (
          <select
            className="np-input max-w-xs"
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              clearStudent();
            }}
          >
            <option value="">Select company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* SELECT STUDENT */}
      <div className="np-card space-y-4 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-body">Select student</p>

        {selected ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
            <div>
              <p className="font-semibold text-heading">{selected.name}</p>
              <p className="text-sm text-body">{selected.phone}</p>
            </div>
            <button type="button" className="np-btn-secondary !py-1.5 text-sm" onClick={clearStudent}>
              Change
            </button>
          </div>
        ) : (
          <div ref={pickerRef} className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
              <input
                className="np-input pl-9"
                placeholder="Search students by name, phone, or email..."
                value={studentQuery}
                onChange={(e) => {
                  setStudentQuery(e.target.value);
                  setShowStudentList(true);
                }}
                onFocus={() => setShowStudentList(true)}
              />
            </div>
            {showStudentList && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
                {loadingStudents ? (
                  <p className="p-3 text-sm text-body">Loading students…</p>
                ) : filteredStudents.length === 0 ? (
                  <p className="p-3 text-sm text-body">No students found</p>
                ) : (
                  filteredStudents.map((s) => (
                    <button
                      key={`${s.phone}-${s.companyId}`}
                      type="button"
                      className="flex w-full flex-col items-start gap-0.5 border-b border-border px-4 py-2.5 text-left last:border-0 hover:bg-muted"
                      onClick={() => selectStudent(s)}
                    >
                      <span className="font-medium text-heading">{s.name}</span>
                      <span className="text-xs text-body">
                        {s.phone}
                        {s.email ? ` · ${s.email}` : ''}
                        {s.status && s.status !== 'active' ? ` · (${s.status})` : ''}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm text-body">Mobile Number (can edit after selection)</label>
          <div className="relative">
            <input
              className="np-input"
              placeholder="+1234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {phone && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-body hover:bg-muted"
                onClick={() => setPhone('')}
                aria-label="Clear phone"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SEARCH CRITERIA */}
      <form onSubmit={searchResumes} className="np-card space-y-4 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-body">Search criteria</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-body">Company</label>
            <input
              className="np-input"
              placeholder="e.g., Google, Amazon..."
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-body">Job Title</label>
            <input
              className="np-input"
              placeholder="e.g., Data Engineer..."
              value={jobTitleFilter}
              onChange={(e) => setJobTitleFilter(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-body">Description (keywords)</label>
          <textarea
            className="np-input min-h-[88px]"
            placeholder="Enter keywords or description to search..."
            value={descriptionFilter}
            onChange={(e) => setDescriptionFilter(e.target.value)}
          />
        </div>
        <button type="submit" className="np-btn-primary w-full" disabled={searching}>
          {searching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching…
            </>
          ) : (
            'Search Resumes'
          )}
        </button>
      </form>

      {/* RESULTS */}
      {(selected || resumes.length > 0) && (
        <div className="np-card overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-body">
              Search results ({resumes.length})
            </p>
          </div>
          {searching ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : resumes.length === 0 ? (
            <p className="p-6 text-sm text-body">
              No applied resumes found for this student yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-body">
                    <th className="px-5 py-3 font-medium">Title</th>
                    <th className="px-5 py-3 font-medium">Organization</th>
                    <th className="px-5 py-3 font-medium">Created</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {resumes.map((row) => {
                    const canDownload = !!(row.downloadUrl || row.hasResumeData);
                    return (
                      <tr key={row.id} className="border-b border-border last:border-0">
                        <td className="px-5 py-3 font-medium text-heading">{row.jobTitle || '—'}</td>
                        <td className="px-5 py-3 text-body">{row.companyName || '—'}</td>
                        <td className="px-5 py-3 text-body">{formatDate(row.createdAt)}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="rounded p-2 text-body hover:bg-muted hover:text-heading"
                              title="Copy link"
                              onClick={() => copyApplyUrl(row)}
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            {row.applyUrl ? (
                              <a
                                href={row.applyUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded p-2 text-body hover:bg-muted hover:text-heading"
                                title="Open job"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            ) : (
                              <span className="rounded p-2 text-body/30" title="No job link">
                                <ExternalLink className="h-4 w-4" />
                              </span>
                            )}
                            <button
                              type="button"
                              className={cn(
                                'rounded p-2 text-body hover:bg-muted hover:text-heading',
                                !canDownload && 'opacity-40'
                              )}
                              title="Download resume"
                              disabled={!canDownload || downloadingId === row.id}
                              onClick={() => handleDownload(row)}
                            >
                              {downloadingId === row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
