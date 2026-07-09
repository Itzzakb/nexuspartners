export type PostedFilterMode = 'hours' | 'days' | 'range';
export type MasterDataCategory = 'job_title' | 'country_code' | 'domain';

export interface JobSearchFilters {
  job_title_or: string[];
  job_country_code_or: string[];
  url_domain_or: string[];
  job_location_ids: number[];
  posted_filter_mode: PostedFilterMode;
  posted_at_max_age_hours: number;
  posted_at_max_age_days: number;
  posted_at_gte: string;
  posted_at_lte: string;
  remote: boolean | null;
  limit: number;
}

export interface JobSearchProfile {
  id: string;
  name: string;
  companyId: string;
  isActive: boolean;
  filters: JobSearchFilters;
  scheduleTime: string;
  scheduleDays: number[];
  timezone: string;
  lastSyncedAt: string | null;
  lastJobCount: number;
  lastError: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobScrapMasterItem {
  id: string;
  companyId: string;
  category: MasterDataCategory;
  value: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScrapedJob {
  id: string;
  theirstackJobId: number | null;
  source: 'theirstack' | 'manual';
  searchProfileId: string | null;
  companyId: string;
  jobTitle: string;
  description: string;
  companyName: string;
  companyDomain: string;
  location: string;
  countryCode: string;
  remote: boolean;
  hybrid: boolean;
  seniority: string;
  technologySlugs: string[];
  salaryMinUsd: number | null;
  salaryMaxUsd: number | null;
  datePosted: string | null;
  applyUrl: string;
  finalUrl?: string;
  sourceUrl?: string;
  urlDomain: string;
  notes: string;
  status: 'open' | 'applied' | 'closed' | 'archived';
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobScrapRun {
  id: string;
  searchProfileId: string | null;
  trigger: 'manual' | 'cron';
  status: 'success' | 'failed';
  jobsFetched: number;
  jobsUpserted: number;
  error: string;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
}

export interface JobScrapStats {
  total: number;
  manual: number;
  api: number;
  profiles: number;
  activeProfiles: number;
}
