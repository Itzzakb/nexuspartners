import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Search,
} from 'lucide-react';
import { DateRangeCalendar } from '@/components/recruiter/DateRangeCalendar';
import { ExperienceRangeSlider } from '@/components/recruiter/ExperienceRangeSlider';
import { recruiterJobsApi, recruiterStudentsApi } from '@/lib/recruiterApi';
import { toast } from '@/lib/toast';
import type { RecruiterScrapedJob, RecruiterStudent } from '@/types/recruiterPortal';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const EXP_FLOOR = 0;
const EXP_CEILING = 15;

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function JobCard({
  job,
  studentPhone,
}: {
  job: RecruiterScrapedJob;
  studentPhone: string;
}) {
  const isApplied = job.isApplied ?? job.studentAction?.status === 'applied';
  const isSponsored = job.isSponsored ?? job.visaSponsorship;

  return (
    <Link
      to={`/recruiter-portal/jobs/${job.id}?studentPhone=${encodeURIComponent(studentPhone)}`}
      className="block rounded-xl border border-border bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-heading">{job.jobTitle}</h3>
          <p className="mt-0.5 text-sm text-body">{job.companyName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {isSponsored && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              Sponsored
            </span>
          )}
          {isApplied && (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              Applied
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-body">
        {job.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {job.location}
          </span>
        )}
        {job.datePosted && <span>Posted {formatDate(job.datePosted)}</span>}
        {job.remote && <span className="text-primary">Remote</span>}
      </div>

      {job.description && (
        <p className="mt-3 line-clamp-2 text-sm text-body">{job.description}</p>
      )}
    </Link>
  );
}

export default function RecruiterApplications() {
  const [students, setStudents] = useState<RecruiterStudent[]>([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedPhone, setSelectedPhone] = useState('');
  const [jobs, setJobs] = useState<RecruiterScrapedJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [jobQuery, setJobQuery] = useState('');
  const [scrapedFrom, setScrapedFrom] = useState('');
  const [scrapedTo, setScrapedTo] = useState('');
  const [expMin, setExpMin] = useState(EXP_FLOOR);
  const [expMax, setExpMax] = useState(EXP_CEILING);
  const [expFilterActive, setExpFilterActive] = useState(false);
  const [sponsoredFilter, setSponsoredFilter] = useState<'any' | 'yes' | 'no'>('any');
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [filteringJobs, setFilteringJobs] = useState(false);
  const showFullLoaderRef = useRef(true);

  const loadStudents = useCallback(async (q = '') => {
    setLoadingStudents(true);
    try {
      const data = await recruiterStudentsApi.list(q);
      setStudents(data.students);
      if (!selectedPhone && data.students.length > 0) {
        setSelectedPhone(data.students[0].phone);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedPhone]);

  const loadJobs = useCallback(async () => {
    if (!selectedPhone) {
      setJobs([]);
      setTotal(0);
      showFullLoaderRef.current = true;
      return;
    }
    const fullLoader = showFullLoaderRef.current;
    if (fullLoader) setLoadingJobs(true);
    else setFilteringJobs(true);
    try {
      const data = await recruiterJobsApi.list({
        studentPhone: selectedPhone,
        page,
        limit: PAGE_SIZE,
        q: jobQuery,
        scrapedFrom: scrapedFrom || undefined,
        scrapedTo: scrapedTo || undefined,
        ...(expFilterActive
          ? {
              minExp: expMin,
              maxExp: expMax,
            }
          : {}),
        ...(sponsoredFilter === 'yes'
          ? { sponsored: true }
          : sponsoredFilter === 'no'
            ? { sponsored: false }
            : {}),
      });
      setJobs(data.jobs);
      setTotal(data.total);
      showFullLoaderRef.current = false;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoadingJobs(false);
      setFilteringJobs(false);
    }
  }, [
    selectedPhone,
    page,
    jobQuery,
    scrapedFrom,
    scrapedTo,
    expMin,
    expMax,
    expFilterActive,
    sponsoredFilter,
  ]);

  useEffect(() => {
    showFullLoaderRef.current = true;
  }, [selectedPhone]);

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadStudents(studentQuery), 300);
    return () => clearTimeout(timer);
  }, [studentQuery]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const selectedStudent = students.find((s) => s.phone === selectedPhone);
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Applications</h1>
        <p className="mt-1 text-sm text-body">
          Select a student to view matched job openings
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="np-card flex flex-col overflow-hidden p-0">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
              <input
                type="search"
                placeholder="Search students..."
                className="np-input !pl-9 !py-2 text-sm"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-2">
            {loadingStudents ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : students.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-body">No students assigned</p>
            ) : (
              students.map((student) => (
                <button
                  key={student.phone}
                  type="button"
                  onClick={() => {
                    setSelectedPhone(student.phone);
                    setPage(0);
                  }}
                  className={cn(
                    'mb-1 w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                    selectedPhone === student.phone
                      ? 'bg-primary/10 text-heading'
                      : 'hover:bg-muted'
                  )}
                >
                  <p className="truncate text-sm font-medium">{student.name}</p>
                  <p className="truncate text-xs text-body">{student.role || student.phone}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-block h-1.5 w-1.5 rounded-full',
                        student.isActive ? 'bg-green-500' : 'bg-gray-400'
                      )}
                    />
                    <span className="text-xs text-body">
                      {student.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="space-y-4">
          {selectedStudent && (
            <div className="np-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-heading">{selectedStudent.name}</h2>
                  <p className="text-sm text-body">
                    {selectedStudent.role || 'No role'} · {selectedStudent.location || 'No location'}
                  </p>
                  <p className="text-xs text-body">
                    {selectedStudent.phone}
                    {selectedStudent.email ? ` · ${selectedStudent.email}` : ''}
                  </p>
                </div>
                <Link
                  to={`/recruiter-portal/students/${encodeURIComponent(selectedStudent.phone)}`}
                  className="np-btn-secondary !py-2 text-sm"
                >
                  Student details
                </Link>
              </div>
            </div>
          )}

          <div className="np-card p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="relative min-w-[200px] flex-1">
                <label className="mb-1 block text-xs font-medium text-body">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
                  <input
                    type="search"
                    placeholder="Search jobs..."
                    className="np-input !pl-9 !py-2 text-sm"
                    value={jobQuery}
                    onChange={(e) => {
                      setJobQuery(e.target.value);
                      setPage(0);
                    }}
                  />
                </div>
              </div>

              <DateRangeCalendar
                className="min-w-[240px] flex-1 sm:max-w-xs"
                from={scrapedFrom}
                to={scrapedTo}
                onChange={({ from, to }) => {
                  setScrapedFrom(from);
                  setScrapedTo(to);
                  setPage(0);
                }}
              />

              <ExperienceRangeSlider
                className="min-w-[220px] flex-1 sm:max-w-sm"
                min={EXP_FLOOR}
                max={EXP_CEILING}
                step={1}
                valueMin={expMin}
                valueMax={expMax}
                isAny={!expFilterActive}
                onCommit={({ min, max }) => {
                  setExpMin(min);
                  setExpMax(max);
                  setExpFilterActive(true);
                  setPage(0);
                }}
                onClear={() => {
                  setExpMin(EXP_FLOOR);
                  setExpMax(EXP_CEILING);
                  setExpFilterActive(false);
                  setPage(0);
                }}
              />

              <div className="min-w-[140px]">
                <label className="mb-1 block text-xs font-medium text-body">Sponsored</label>
                <select
                  className="np-input !py-2 text-sm"
                  value={sponsoredFilter}
                  onChange={(e) => {
                    setSponsoredFilter(e.target.value as 'any' | 'yes' | 'no');
                    setPage(0);
                  }}
                >
                  <option value="any">Any</option>
                  <option value="yes">Sponsored only</option>
                  <option value="no">Not sponsored</option>
                </select>
              </div>
            </div>
            {filteringJobs && (
              <p className="mt-2 text-xs text-body">Updating results…</p>
            )}
          </div>

          {loadingJobs ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !selectedPhone ? (
            <div className="np-card flex flex-col items-center justify-center py-16 text-center">
              <Briefcase className="mb-3 h-10 w-10 text-body" />
              <p className="text-body">Select a student to view jobs</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="np-card flex flex-col items-center justify-center py-16 text-center">
              <Briefcase className="mb-3 h-10 w-10 text-body" />
              <p className="text-body">No matching jobs found for this student</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} studentPhone={selectedPhone} />
                ))}
              </div>

              <div className="flex items-center justify-between np-card px-4 py-3">
                <p className="text-sm text-body">
                  {total} job{total !== 1 ? 's' : ''} · Page {page + 1} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="np-btn-secondary !py-2"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(p - 1, 0))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="np-btn-secondary !py-2"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
