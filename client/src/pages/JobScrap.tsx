import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CalendarClock,
  Calendar,
  Clock,
  ExternalLink,
  Filter,
  Globe,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { jobScrapApi } from '@/lib/api';
import { toast } from '@/lib/toast';
import { canAccessModule } from '@/lib/permissions';
import { Toggle, ToggleField } from '@/components/ui/Toggle';
import { MultiSelectSearch } from '@/components/ui/MultiSelectSearch';
import { PostedTimeFilter } from '@/components/jobScrap/PostedTimeFilter';
import { cn } from '@/lib/utils';
import type {
  JobSearchProfile,
  JobSearchFilters,
  ScrapedJob,
  JobScrapRun,
  JobScrapStats,
  JobScrapMasterItem,
  PostedFilterMode,
} from '@/types/jobScrap';

type Tab = 'profiles' | 'jobs' | 'history';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EMPTY_FILTERS: JobSearchFilters = {
  job_title_or: [],
  job_country_code_or: [],
  url_domain_or: [],
  url_domain_not: [],
  company_domain_or: [],
  job_location_ids: [],
  posted_filter_mode: 'days',
  posted_at_max_age_hours: 24,
  posted_at_max_age_days: 7,
  posted_at_gte: '',
  posted_at_lte: '',
  remote: null,
  limit: 25,
};

function resolvePostedMode(filters: JobSearchFilters): PostedFilterMode {
  if (filters.posted_filter_mode) return filters.posted_filter_mode;
  if (filters.posted_at_gte || filters.posted_at_lte) return 'range';
  return 'days';
}

function parseNumberList(value: string): number[] {
  return value
    .split(/[,;\n]/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}

function formatList(items: string[] | number[]): string {
  return items.join(', ');
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function scheduleSummary(profile: JobSearchProfile) {
  const days = profile.scheduleDays
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join(', ');
  return `${profile.scheduleTime} · ${days || 'No days'} · ${profile.timezone}`;
}

function FilterChips({ filters }: { filters: JobSearchFilters }) {
  const chips: string[] = [];
  if (filters.job_title_or.length) chips.push(`Titles: ${filters.job_title_or.slice(0, 3).join(', ')}${filters.job_title_or.length > 3 ? '…' : ''}`);
  if (filters.job_country_code_or.length) chips.push(`Countries: ${filters.job_country_code_or.join(', ')}`);
  if (filters.url_domain_or.length) chips.push(`Domains: ${filters.url_domain_or.join(', ')}`);
  if (filters.url_domain_not?.length) chips.push(`Except: ${filters.url_domain_not.join(', ')}`);
  if (filters.company_domain_or?.length) {
    chips.push(
      `Companies: ${filters.company_domain_or.slice(0, 3).join(', ')}${filters.company_domain_or.length > 3 ? '…' : ''}`
    );
  }
  if (filters.job_location_ids.length) chips.push(`${filters.job_location_ids.length} city location(s)`);
  const postedMode = resolvePostedMode(filters);
  if (postedMode === 'range' && (filters.posted_at_gte || filters.posted_at_lte)) {
    chips.push(`Posted ${filters.posted_at_gte || '…'} → ${filters.posted_at_lte || '…'}`);
  } else if (postedMode === 'hours') {
    chips.push(`Last ${filters.posted_at_max_age_hours || 24} hours`);
  } else if (filters.posted_at_max_age_days !== undefined) {
    chips.push(`Last ${filters.posted_at_max_age_days} days`);
  }
  if (filters.remote === true) chips.push('Remote only');
  if (filters.remote === false) chips.push('On-site only');

  if (!chips.length) return <span className="text-xs text-body">No filters configured</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip}
          className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

interface ProfileModalProps {
  open: boolean;
  initial?: JobSearchProfile | null;
  companyId: string;
  masterItems: JobScrapMasterItem[];
  onClose: () => void;
  onSaved: () => void;
}

function ProfileModal({ open, initial, companyId, masterItems, onClose, onSaved }: ProfileModalProps) {
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleDays, setScheduleDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [exceptDomains, setExceptDomains] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [locationIds, setLocationIds] = useState('');
  const [postedMode, setPostedMode] = useState<PostedFilterMode>('days');
  const [maxAgeHours, setMaxAgeHours] = useState(24);
  const [maxAgeDays, setMaxAgeDays] = useState(7);
  const [postedGte, setPostedGte] = useState('');
  const [postedLte, setPostedLte] = useState('');
  const [remote, setRemote] = useState<'any' | 'yes' | 'no'>('any');
  const [limit, setLimit] = useState(25);
  const [saving, setSaving] = useState(false);

  const titleOptions = useMemo(
    () =>
      masterItems
        .filter((i) => i.category === 'job_title' && i.isActive)
        .map((i) => ({ value: i.value, label: i.label })),
    [masterItems]
  );
  const countryOptions = useMemo(
    () =>
      masterItems
        .filter((i) => i.category === 'country_code' && i.isActive)
        .map((i) => ({ value: i.value, label: i.label })),
    [masterItems]
  );
  const domainOptions = useMemo(
    () =>
      masterItems
        .filter((i) => i.category === 'domain' && i.isActive)
        .map((i) => ({ value: i.value, label: i.label })),
    [masterItems]
  );
  const cityOptions = useMemo(
    () =>
      masterItems
        .filter((i) => i.category === 'city' && i.isActive)
        .map((i) => ({ value: i.value, label: i.label })),
    [masterItems]
  );
  const companyOptions = useMemo(
    () =>
      masterItems
        .filter((i) => i.category === 'company' && i.isActive)
        .map((i) => ({ value: i.value, label: i.label })),
    [masterItems]
  );

  useEffect(() => {
    if (!open) return;
    const f = initial?.filters ?? EMPTY_FILTERS;
    setName(initial?.name ?? '');
    setIsActive(initial?.isActive ?? true);
    setScheduleTime(initial?.scheduleTime ?? '09:00');
    setScheduleDays(initial?.scheduleDays ?? [1, 2, 3, 4, 5]);
    setTimezone(initial?.timezone ?? 'Asia/Kolkata');
    setSelectedTitles(f.job_title_or || []);
    setSelectedCountries(f.job_country_code_or || []);
    setSelectedDomains(f.url_domain_or || []);
    setExceptDomains(f.url_domain_not || []);
    setSelectedCities((f.job_location_ids || []).map(String));
    setSelectedCompanies(f.company_domain_or || []);
    setLocationIds(formatList(f.job_location_ids));
    setPostedMode(resolvePostedMode(f));
    setMaxAgeHours(f.posted_at_max_age_hours || 24);
    setMaxAgeDays(f.posted_at_max_age_days ?? 7);
    setPostedGte(f.posted_at_gte || '');
    setPostedLte(f.posted_at_lte || '');
    setRemote(f.remote === true ? 'yes' : f.remote === false ? 'no' : 'any');
    setLimit(f.limit || 25);
  }, [open, initial]);

  if (!open) return null;

  const toggleDay = (day: number) => {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Profile name is required');
      return;
    }
    if (!scheduleDays.length) {
      toast.error('Select at least one schedule day');
      return;
    }
    if (
      !selectedTitles.length &&
      !selectedCountries.length &&
      !selectedDomains.length &&
      !exceptDomains.length &&
      !selectedCities.length &&
      !selectedCompanies.length
    ) {
      toast.error('Select at least one job title, country, domain, city, or company');
      return;
    }
    if (postedMode === 'range' && !postedGte && !postedLte) {
      toast.error('Select a start or end date for the calendar range');
      return;
    }

    const cityIds = [
      ...new Set([
        ...selectedCities.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)),
        ...parseNumberList(locationIds),
      ]),
    ];

    const filters: JobSearchFilters = {
      job_title_or: selectedTitles,
      job_country_code_or: selectedCountries,
      url_domain_or: selectedDomains.filter((d) => !exceptDomains.includes(d)),
      url_domain_not: exceptDomains,
      company_domain_or: selectedCompanies,
      job_location_ids: cityIds,
      posted_filter_mode: postedMode,
      posted_at_max_age_hours: maxAgeHours,
      posted_at_max_age_days: maxAgeDays,
      posted_at_gte: postedMode === 'range' ? postedGte : '',
      posted_at_lte: postedMode === 'range' ? postedLte : '',
      remote: remote === 'any' ? null : remote === 'yes',
      limit,
    };

    setSaving(true);
    try {
      const payload = { name: name.trim(), filters, scheduleTime, scheduleDays, timezone, isActive, companyId: companyId || undefined };
      if (initial) await jobScrapApi.updateProfile(initial.id, payload);
      else await jobScrapApi.createProfile(payload);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-xl">
        <div className="sticky top-0 z-10 border-b border-border bg-surface px-6 py-4">
          <h2 className="text-xl font-semibold text-heading">
            {initial ? 'Edit Search Profile' : 'New Search Profile'}
          </h2>
          <p className="mt-1 text-sm text-body">
            Configure TheirStack filters and when this profile should sync automatically.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-body">
              <Settings2 className="h-4 w-4" /> Profile
            </h3>
            <div>
              <label className="mb-1 block text-sm text-heading">Profile name</label>
              <input className="np-input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. US Remote React Roles" />
            </div>
            <ToggleField label="Active — run on schedule" checked={isActive} onChange={setIsActive} />
          </section>

          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-body">
              <Filter className="h-4 w-4" /> Search filters
            </h3>
            {!masterItems.some((i) => i.isActive) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Filter options are not available yet. Contact your platform admin to run the job scrap master seed.
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm text-heading">Job titles</label>
              <MultiSelectSearch
                options={titleOptions}
                value={selectedTitles}
                onChange={setSelectedTitles}
                placeholder="Search job titles…"
                emptyMessage="No job titles available"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-heading">Country codes</label>
                <MultiSelectSearch
                  options={countryOptions}
                  value={selectedCountries}
                  onChange={setSelectedCountries}
                  placeholder="Search countries…"
                  emptyMessage="No countries available"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-heading">Only these domains</label>
                <MultiSelectSearch
                  options={domainOptions}
                  value={selectedDomains}
                  onChange={(next) => {
                    setSelectedDomains(next);
                    setExceptDomains((prev) => prev.filter((d) => !next.includes(d)));
                  }}
                  placeholder="Search domains…"
                  emptyMessage="No domains available"
                />
                <p className="mt-1 text-xs text-body">
                  TheirStack <code className="text-[11px]">url_domain_or</code> — include only these sources.
                </p>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-heading">Except sources</label>
              <MultiSelectSearch
                options={domainOptions}
                value={exceptDomains}
                onChange={(next) => {
                  setExceptDomains(next);
                  setSelectedDomains((prev) => prev.filter((d) => !next.includes(d)));
                }}
                placeholder="Exclude LinkedIn, Indeed, …"
                emptyMessage="No domains available"
              />
              <p className="mt-1 text-xs text-body">
                TheirStack <code className="text-[11px]">url_domain_not</code> — scrape all matching jobs except
                these job boards/sources.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-heading">Cities</label>
                <MultiSelectSearch
                  options={cityOptions}
                  value={selectedCities}
                  onChange={setSelectedCities}
                  placeholder="Search cities…"
                  emptyMessage="No cities seeded yet — run seed:theirstack-master"
                />
                <p className="mt-1 text-xs text-body">
                  TheirStack location IDs for <code className="text-[11px]">job_location_or</code>.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm text-heading">Companies</label>
                <MultiSelectSearch
                  options={companyOptions}
                  value={selectedCompanies}
                  onChange={setSelectedCompanies}
                  placeholder="Search companies…"
                  emptyMessage="No companies seeded yet (needs TheirStack credits)"
                />
                <p className="mt-1 text-xs text-body">
                  TheirStack <code className="text-[11px]">company_domain_or</code>.
                </p>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-heading">Extra city location IDs (optional)</label>
              <input className="np-input w-full" value={locationIds} onChange={(e) => setLocationIds(e.target.value)} placeholder="5128581, 1273294 — TheirStack city IDs" />
              <p className="mt-1 text-xs text-body">Optional extras beyond the Cities picker above.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-heading">Results per sync</label>
                <input type="number" min={1} max={100} className="np-input w-full" value={limit} onChange={(e) => setLimit(parseInt(e.target.value, 10) || 25)} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-heading">Remote</label>
                <select className="np-input w-full" value={remote} onChange={(e) => setRemote(e.target.value as 'any' | 'yes' | 'no')}>
                  <option value="any">Any</option>
                  <option value="yes">Remote only</option>
                  <option value="no">On-site only</option>
                </select>
              </div>
            </div>
            <PostedTimeFilter
              mode={postedMode}
              onModeChange={setPostedMode}
              hours={maxAgeHours}
              onHoursChange={setMaxAgeHours}
              days={maxAgeDays}
              onDaysChange={setMaxAgeDays}
              postedGte={postedGte}
              postedLte={postedLte}
              onPostedGteChange={setPostedGte}
              onPostedLteChange={setPostedLte}
            />
          </section>

          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-body">
              <CalendarClock className="h-4 w-4" /> Schedule
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-heading">Time</label>
                <input type="time" className="np-input w-full" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-heading">Timezone</label>
                <input className="np-input w-full" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Kolkata" />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm text-heading">Days of week</label>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((label, idx) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                      scheduleDays.includes(idx)
                        ? 'border-primary bg-primary text-white'
                        : 'border-border bg-surface text-body hover:border-primary/40'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button type="button" className="np-btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="np-btn-primary" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {initial ? 'Save changes' : 'Create profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ManualJobModalProps {
  open: boolean;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}

function ManualJobModal({ open, companyId, onClose, onSaved }: ManualJobModalProps) {
  const [form, setForm] = useState({
    jobTitle: '',
    companyName: '',
    companyDomain: '',
    location: '',
    countryCode: '',
    applyUrl: '',
    seniority: '',
    description: '',
    notes: '',
    remote: false,
    hybrid: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      jobTitle: '',
      companyName: '',
      companyDomain: '',
      location: '',
      countryCode: '',
      applyUrl: '',
      seniority: '',
      description: '',
      notes: '',
      remote: false,
      hybrid: false,
    });
  }, [open]);

  if (!open) return null;

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.jobTitle.trim()) {
      toast.error('Job title is required');
      return;
    }
    setSaving(true);
    try {
      await jobScrapApi.createManualJob({ ...form, companyId: companyId || undefined });
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add job');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-xl">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-xl font-semibold text-heading">Add job manually</h2>
          <p className="mt-1 text-sm text-body">Recruiters can apply to manual listings alongside scraped jobs.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm text-heading">Job title *</label>
            <input className="np-input w-full" value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-heading">Company</label>
              <input className="np-input w-full" value={form.companyName} onChange={(e) => set('companyName', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-heading">Domain</label>
              <input className="np-input w-full" value={form.companyDomain} onChange={(e) => set('companyDomain', e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-heading">Location</label>
              <input className="np-input w-full" value={form.location} onChange={(e) => set('location', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-heading">Country code</label>
              <input className="np-input w-full" value={form.countryCode} onChange={(e) => set('countryCode', e.target.value)} placeholder="US" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-heading">Apply URL</label>
            <input className="np-input w-full" value={form.applyUrl} onChange={(e) => set('applyUrl', e.target.value)} placeholder="https://" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-heading">Seniority</label>
            <input className="np-input w-full" value={form.seniority} onChange={(e) => set('seniority', e.target.value)} placeholder="Mid-level" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-heading">Description</label>
            <textarea className="np-input min-h-24 w-full" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-6">
            <ToggleField label="Remote" checked={form.remote} onChange={(v) => set('remote', v)} />
            <ToggleField label="Hybrid" checked={form.hybrid} onChange={(v) => set('hybrid', v)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-heading">Internal notes</label>
            <textarea className="np-input min-h-16 w-full" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button type="button" className="np-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="np-btn-primary" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add job
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function JobScrap() {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const [tab, setTab] = useState<Tab>('profiles');
  const [companyId, setCompanyId] = useState('');
  const [stats, setStats] = useState<JobScrapStats | null>(null);
  const [profiles, setProfiles] = useState<JobSearchProfile[]>([]);
  const [jobs, setJobs] = useState<ScrapedJob[]>([]);
  const [runs, setRuns] = useState<JobScrapRun[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobsPage, setJobsPage] = useState(0);
  const [jobQuery, setJobQuery] = useState('');
  const [jobSource, setJobSource] = useState('');
  const [jobStatus, setJobStatus] = useState('');
  const [scrapedFrom, setScrapedFrom] = useState('');
  const [scrapedTo, setScrapedTo] = useState('');
  const [profileCountryFilter, setProfileCountryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [profileModal, setProfileModal] = useState<JobSearchProfile | null | 'new'>(null);
  const [manualModal, setManualModal] = useState(false);
  const [masterItems, setMasterItems] = useState<JobScrapMasterItem[]>([]);

  const effectiveCompanyId = user?.isPlatformAdmin ? companyId : '';

  const loadMaster = useCallback(async () => {
    try {
      const data = await jobScrapApi.listMaster({
        companyId: effectiveCompanyId || undefined,
        activeOnly: true,
      });
      setMasterItems(data.items);
    } catch {
      setMasterItems([]);
    }
  }, [effectiveCompanyId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const profileParams: Record<string, string> = {};
      if (effectiveCompanyId) profileParams.companyId = effectiveCompanyId;
      if (profileCountryFilter) profileParams.country = profileCountryFilter;

      const [statsData, profilesData, runsData] = await Promise.all([
        jobScrapApi.stats(effectiveCompanyId || undefined),
        jobScrapApi.listProfiles(profileParams),
        jobScrapApi.listRuns(effectiveCompanyId || undefined),
      ]);
      setStats(statsData.stats);
      setProfiles(profilesData.profiles);
      setRuns(runsData.runs);
      await loadMaster();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load job scrap data');
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId, loadMaster, profileCountryFilter]);

  const loadJobs = useCallback(async () => {
    try {
      const params: Record<string, string> = {
        page: String(jobsPage),
        limit: '25',
      };
      if (effectiveCompanyId) params.companyId = effectiveCompanyId;
      if (jobQuery.trim()) params.q = jobQuery.trim();
      if (jobSource) params.source = jobSource;
      if (jobStatus) params.status = jobStatus;
      if (scrapedFrom) params.scrapedFrom = scrapedFrom;
      if (scrapedTo) params.scrapedTo = scrapedTo;
      const data = await jobScrapApi.listJobs(params);
      setJobs(data.jobs);
      setJobsTotal(data.total);
    } catch {
      setJobs([]);
      setJobsTotal(0);
    }
  }, [effectiveCompanyId, jobsPage, jobQuery, jobSource, jobStatus, scrapedFrom, scrapedTo]);

  const hasScrapedDateFilter = !!(scrapedFrom || scrapedTo);

  const applyScrapedPreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    setScrapedFrom(from.toISOString().slice(0, 10));
    setScrapedTo(to.toISOString().slice(0, 10));
    setJobsPage(0);
  };

  const clearScrapedDateFilter = () => {
    setScrapedFrom('');
    setScrapedTo('');
    setJobsPage(0);
  };

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'jobs') loadJobs();
  }, [tab, loadJobs]);

  const activeProfiles = useMemo(() => profiles.filter((p) => p.isActive), [profiles]);

  const profileCountryOptions = useMemo(
    () =>
      masterItems
        .filter((i) => i.category === 'country_code' && i.isActive)
        .map((i) => ({ value: i.value, label: i.label })),
    [masterItems]
  );

  const handleSyncProfile = async (id: string) => {
    setSyncing(id);
    try {
      const result = await jobScrapApi.syncProfile(id);
      toast.success(`Synced ${result.jobsUpserted} job(s) from ${result.jobsFetched} fetched`);
      load();
      if (tab === 'jobs') loadJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const result = await jobScrapApi.syncAll(effectiveCompanyId || undefined);
      const ok = result.results.filter((r) => r.success).length;
      toast.success(`Synced ${ok} of ${result.results.length} active profile(s)`);
      load();
      if (tab === 'jobs') loadJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync all failed');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (!window.confirm('Delete this search profile? Scheduled syncs will stop.')) return;
    try {
      await jobScrapApi.deleteProfile(id);
      toast.success('Profile deleted');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete profile');
    }
  };

  const handleToggleActive = async (profile: JobSearchProfile) => {
    try {
      await jobScrapApi.updateProfile(profile.id, { isActive: !profile.isActive });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!window.confirm('Remove this job listing?')) return;
    try {
      await jobScrapApi.deleteJob(id);
      loadJobs();
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete job');
    }
  };

  if (!canAccessModule(user, 'job_scrap')) {
    return (
      <div className="np-card p-8 text-center">
        <Briefcase className="mx-auto h-10 w-10 text-body" />
        <p className="mt-3 text-heading">You do not have access to Job Scrap.</p>
        <p className="mt-1 text-sm text-body">Ask an admin to enable the Job Scrap module in User Access.</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profiles', label: 'Search Profiles' },
    { id: 'jobs', label: 'Scraped Jobs' },
    { id: 'history', label: 'Sync History' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">Job Scrap</h1>
          <p className="mt-1 max-w-2xl text-body">
            Configure automated TheirStack searches, schedule cron syncs, and manage job listings for recruiters.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="np-btn-secondary"
            onClick={handleSyncAll}
            disabled={syncingAll || !activeProfiles.length}
          >
            {syncingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Sync all active
          </button>
          <button type="button" className="np-btn-secondary" onClick={() => { load(); if (tab === 'jobs') loadJobs(); }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
          <button type="button" className="np-btn-primary" onClick={() => setProfileModal('new')}>
            <Plus className="mr-2 h-4 w-4" />
            New profile
          </button>
        </div>
      </div>

      {user?.isPlatformAdmin && (
        <div className="np-card p-4">
          <label className="mb-1 block text-sm text-heading">Company</label>
          <select className="np-input max-w-sm" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Total jobs', value: stats?.total ?? 0, icon: Briefcase },
          { label: 'From API', value: stats?.api ?? 0, icon: Globe },
          { label: 'Manual', value: stats?.manual ?? 0, icon: Plus },
          { label: 'Profiles', value: stats?.profiles ?? 0, icon: Filter },
          { label: 'Active schedules', value: stats?.activeProfiles ?? 0, icon: CalendarClock },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="np-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-body">{label}</p>
              <Icon className="h-4 w-4 text-primary/70" />
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-heading">{value}</p>
          </div>
        ))}
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'border-b-2 pb-3 text-sm font-medium transition-colors',
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-body hover:text-heading'
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {loading && tab !== 'jobs' ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : tab === 'profiles' ? (
        <div className="space-y-4">
          <div className="np-card flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[220px]">
              <label className="mb-1 block text-xs font-medium text-heading">Country</label>
              <select
                className="np-input w-full"
                value={profileCountryFilter}
                onChange={(e) => setProfileCountryFilter(e.target.value)}
              >
                <option value="">All countries</option>
                {profileCountryOptions.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            {profileCountryFilter && (
              <button
                type="button"
                className="np-btn-secondary text-sm"
                onClick={() => setProfileCountryFilter('')}
              >
                Clear filter
              </button>
            )}
            {profileCountryFilter && (
              <p className="text-sm text-body">
                Showing profiles that search in{' '}
                <span className="font-medium text-heading">
                  {profileCountryOptions.find((c) => c.value === profileCountryFilter)?.label
                    || profileCountryFilter}
                </span>
                {' '}({profiles.length} profile{profiles.length === 1 ? '' : 's'})
              </p>
            )}
          </div>

          {!profiles.length ? (
            <div className="np-card flex flex-col items-center justify-center px-6 py-16 text-center">
              <Filter className="h-10 w-10 text-body" />
              <h3 className="mt-4 text-lg text-heading">
                {profileCountryFilter ? 'No profiles for this country' : 'No search profiles yet'}
              </h3>
              <p className="mt-1 max-w-md text-sm text-body">
                {profileCountryFilter
                  ? 'Try another country or clear the filter to see all profiles.'
                  : 'Create a profile with job title filters and a daily schedule. Jobs sync automatically via cron at the configured time.'}
              </p>
              {profileCountryFilter ? (
                <button type="button" className="np-btn-secondary mt-6" onClick={() => setProfileCountryFilter('')}>
                  Clear country filter
                </button>
              ) : (
                <button type="button" className="np-btn-primary mt-6" onClick={() => setProfileModal('new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create first profile
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {profiles.map((profile) => (
                <div key={profile.id} className="np-card overflow-hidden">
                  <div className="flex items-start justify-between gap-3 border-b border-border p-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-lg font-semibold text-heading">{profile.name}</h3>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                            profile.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {profile.isActive ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-body">
                        <Clock className="h-3.5 w-3.5" />
                        {scheduleSummary(profile)}
                      </p>
                    </div>
                    <Toggle
                      checked={profile.isActive}
                      onChange={() => handleToggleActive(profile)}
                      size="sm"
                      aria-label={`Toggle ${profile.name}`}
                    />
                  </div>
                  <div className="space-y-3 p-5">
                    <FilterChips filters={profile.filters} />
                    <div className="flex flex-wrap gap-4 text-xs text-body">
                      <span>Last sync: {formatDate(profile.lastSyncedAt)}</span>
                      <span>{profile.lastJobCount} jobs last run</span>
                    </div>
                    {profile.lastError && (
                      <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{profile.lastError}</p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        className="np-btn-primary text-sm"
                        onClick={() => handleSyncProfile(profile.id)}
                        disabled={syncing === profile.id}
                      >
                        {syncing === profile.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Sync now
                      </button>
                      <button type="button" className="np-btn-secondary text-sm" onClick={() => setProfileModal(profile)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="np-btn-secondary text-sm text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteProfile(profile.id)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : tab === 'jobs' ? (
        <div className="space-y-4">
          <div className="np-card space-y-4 p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
                <input
                  className="np-input w-full pl-9"
                  placeholder="Search title, company, location…"
                  value={jobQuery}
                  onChange={(e) => { setJobQuery(e.target.value); setJobsPage(0); }}
                />
              </div>
              <select className="np-input max-w-[140px]" value={jobSource} onChange={(e) => { setJobSource(e.target.value); setJobsPage(0); }}>
                <option value="">All sources</option>
                <option value="theirstack">TheirStack</option>
                <option value="manual">Manual</option>
              </select>
              <select className="np-input max-w-[140px]" value={jobStatus} onChange={(e) => { setJobStatus(e.target.value); setJobsPage(0); }}>
                <option value="">All status</option>
                <option value="open">Open</option>
                <option value="applied">Applied</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
              <button type="button" className="np-btn-primary" onClick={() => setManualModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add manual job
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
              <div className="flex items-center gap-2 text-sm font-medium text-heading">
                <Calendar className="h-4 w-4 text-primary" />
                Scraped date range
              </div>
              <div>
                <label className="mb-1 block text-xs text-body">From</label>
                <input
                  type="date"
                  className="np-input"
                  value={scrapedFrom}
                  onChange={(e) => { setScrapedFrom(e.target.value); setJobsPage(0); }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-body">To</label>
                <input
                  type="date"
                  className="np-input"
                  value={scrapedTo}
                  onChange={(e) => { setScrapedTo(e.target.value); setJobsPage(0); }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="np-btn-secondary text-xs" onClick={() => applyScrapedPreset(7)}>
                  Last 7 days
                </button>
                <button type="button" className="np-btn-secondary text-xs" onClick={() => applyScrapedPreset(30)}>
                  Last 30 days
                </button>
                {hasScrapedDateFilter && (
                  <button type="button" className="np-btn-secondary text-xs" onClick={clearScrapedDateFilter}>
                    Clear dates
                  </button>
                )}
              </div>
            </div>

            {hasScrapedDateFilter && (
              <div className="rounded-lg bg-primary/5 px-4 py-2.5 text-sm text-heading">
                <span className="font-semibold">{jobsTotal.toLocaleString()}</span>
                {' '}job{jobsTotal === 1 ? '' : 's'} scraped
                {scrapedFrom && scrapedTo ? ` from ${scrapedFrom} to ${scrapedTo}` : scrapedFrom ? ` since ${scrapedFrom}` : ` until ${scrapedTo}`}
              </div>
            )}
          </div>

          <div className="np-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-surface-alt text-xs uppercase text-body">
                  <tr>
                    <th className="px-4 py-3 font-medium">Job</th>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Domain</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Posted</th>
                    <th className="px-4 py-3 font-medium">Scraped</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {!jobs.length ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-body">
                        No jobs found. Run a sync or add a job manually.
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-surface-alt/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-heading">{job.jobTitle}</p>
                          {job.seniority && <p className="text-xs text-body">{job.seniority}</p>}
                        </td>
                        <td className="px-4 py-3 text-body">{job.companyName || '—'}</td>
                        <td className="px-4 py-3">
                          {job.urlDomain ? (
                            <span className="inline-flex rounded-full bg-surface-alt px-2.5 py-0.5 font-mono text-xs text-heading">
                              {job.urlDomain}
                            </span>
                          ) : (
                            <span className="text-body">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-body">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {job.location || job.countryCode || '—'}
                            {job.remote && <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">Remote</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              job.source === 'manual' ? 'bg-amber-100 text-amber-800' : 'bg-primary/10 text-primary'
                            )}
                          >
                            {job.source === 'manual' ? 'Manual' : 'API'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-body">{formatDate(job.datePosted)}</td>
                        <td className="px-4 py-3 text-body">{formatDate(job.createdAt)}</td>
                        <td className="px-4 py-3 capitalize text-body">{job.status}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {job.applyUrl && (
                              <a
                                href={job.applyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg p-2 text-body hover:bg-surface-alt hover:text-primary"
                                title="Open apply link"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                            <button
                              type="button"
                              className="rounded-lg p-2 text-body hover:bg-red-50 hover:text-red-600"
                              onClick={() => handleDeleteJob(job.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {jobsTotal > 25 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-body">
                <span>
                  Showing {jobsPage * 25 + 1}–{Math.min((jobsPage + 1) * 25, jobsTotal)} of {jobsTotal}
                </span>
                <div className="flex gap-2">
                  <button type="button" className="np-btn-secondary text-sm" disabled={jobsPage === 0} onClick={() => setJobsPage((p) => p - 1)}>
                    Previous
                  </button>
                  <button
                    type="button"
                    className="np-btn-secondary text-sm"
                    disabled={(jobsPage + 1) * 25 >= jobsTotal}
                    onClick={() => setJobsPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="np-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-alt text-xs uppercase text-body">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Trigger</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Fetched</th>
                  <th className="px-4 py-3 font-medium">Upserted</th>
                  <th className="px-4 py-3 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!runs.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-body">No sync runs yet.</td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.id}>
                      <td className="px-4 py-3 text-body">{formatDate(run.createdAt)}</td>
                      <td className="px-4 py-3 capitalize text-body">{run.trigger}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            run.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          )}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-body">{run.jobsFetched}</td>
                      <td className="px-4 py-3 text-body">{run.jobsUpserted}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-xs text-red-600">{run.error || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProfileModal
        open={profileModal !== null}
        initial={profileModal === 'new' ? null : profileModal}
        companyId={effectiveCompanyId}
        masterItems={masterItems}
        onClose={() => setProfileModal(null)}
        onSaved={() => { toast.success(profileModal === 'new' ? 'Profile created' : 'Profile updated'); load(); }}
      />

      <ManualJobModal
        open={manualModal}
        companyId={effectiveCompanyId}
        onClose={() => setManualModal(false)}
        onSaved={() => { toast.success('Manual job added'); load(); loadJobs(); }}
      />
    </div>
  );
}
