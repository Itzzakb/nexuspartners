import ScrapedJob from '../models/ScrapedJob.js';
import JobSearchProfile from '../models/JobSearchProfile.js';
import JobScrapRun from '../models/JobScrapRun.js';
import { searchJobsAllPages } from './theirstack.service.js';

export function extractJobUrlDomain(...urls) {
  for (const url of urls) {
    if (!url || typeof url !== 'string') continue;
    try {
      const normalized = url.startsWith('http') ? url : `https://${url}`;
      const host = new URL(normalized).hostname.toLowerCase();
      return host.replace(/^www\./, '');
    } catch {
      // skip invalid URLs
    }
  }
  return '';
}

const SENIORITY_EXPERIENCE_YEARS = {
  intern: [0, 1],
  internship: [0, 1],
  entry: [0, 2],
  entry_level: [0, 2],
  junior: [0, 2],
  mid: [2, 5],
  mid_level: [2, 5],
  intermediate: [2, 5],
  senior: [5, 10],
  staff: [8, 15],
  principal: [8, 15],
  lead: [6, 12],
  c_level: [10, 25],
  'c-level': [10, 25],
};

function toYearNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(50, Math.round(n));
}

/**
 * Derive min/max experience years from TheirStack payload, explicit fields, text, or seniority.
 */
export function extractExperienceYears(job = {}) {
  const explicitMin = toYearNumber(
    job.minExperienceYears ??
      job.min_experience_years ??
      job.min_years_experience ??
      job.experience_min ??
      job.years_experience_min ??
      job.min_years
  );
  const explicitMax = toYearNumber(
    job.maxExperienceYears ??
      job.max_experience_years ??
      job.max_years_experience ??
      job.experience_max ??
      job.years_experience_max ??
      job.max_years
  );

  if (explicitMin != null || explicitMax != null) {
    let min = explicitMin;
    let max = explicitMax;
    if (min != null && max != null && min > max) [min, max] = [max, min];
    return { minExperienceYears: min, maxExperienceYears: max };
  }

  const text = `${job.job_title || job.jobTitle || ''} ${job.description || ''}`.toLowerCase();
  const rangeMatch = text.match(/(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*\+?\s*years?/);
  if (rangeMatch) {
    let min = toYearNumber(rangeMatch[1]);
    let max = toYearNumber(rangeMatch[2]);
    if (min != null && max != null && min > max) [min, max] = [max, min];
    return { minExperienceYears: min, maxExperienceYears: max };
  }

  const plusMatch = text.match(/(\d{1,2})\s*\+\s*years?/);
  if (plusMatch) {
    const min = toYearNumber(plusMatch[1]);
    return { minExperienceYears: min, maxExperienceYears: null };
  }

  const atLeastMatch = text.match(/(?:at least|minimum of|min(?:imum)?)\s*(\d{1,2})\s*years?/);
  if (atLeastMatch) {
    return { minExperienceYears: toYearNumber(atLeastMatch[1]), maxExperienceYears: null };
  }

  const seniorityKey = String(job.seniority || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const band = SENIORITY_EXPERIENCE_YEARS[seniorityKey];
  if (band) {
    return { minExperienceYears: band[0], maxExperienceYears: band[1] };
  }

  return { minExperienceYears: null, maxExperienceYears: null };
}

export function mapTheirStackJob(job, { companyId, searchProfileId }) {
  const applyUrl = job.url || '';
  const finalUrl = job.final_url || '';
  const sourceUrl = job.source_url || '';
  const urlDomain =
    extractJobUrlDomain(applyUrl, sourceUrl, finalUrl) ||
    (job.company_object?.domain || job.company_domain || '').toLowerCase();
  const experience = extractExperienceYears(job);

  return {
    theirstackJobId: job.id,
    source: 'theirstack',
    searchProfileId: searchProfileId || null,
    companyId,
    jobTitle: job.job_title || 'Untitled',
    description: job.description || '',
    companyName: job.company_object?.name || job.company || '',
    companyDomain: job.company_object?.domain || job.company_domain || '',
    location: job.location || job.short_location || job.long_location || '',
    countryCode: job.country_code || '',
    remote: !!job.remote,
    hybrid: !!job.hybrid,
    seniority: job.seniority || '',
    minExperienceYears: experience.minExperienceYears,
    maxExperienceYears: experience.maxExperienceYears,
    technologySlugs: job.technology_slugs || [],
    salaryMinUsd: job.min_annual_salary_usd ?? null,
    salaryMaxUsd: job.max_annual_salary_usd ?? null,
    datePosted: job.date_posted ? new Date(job.date_posted) : null,
    discoveredAt: job.discovered_at ? new Date(job.discovered_at) : null,
    closedAt: job.closed_at ? new Date(job.closed_at) : null,
    isClosed: !!job.closed_at,
    applyUrl,
    finalUrl,
    sourceUrl,
    urlDomain,
    lastSyncedAt: new Date(),
    raw: job,
  };
}

export function scrapedJobToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    theirstackJobId: o.theirstackJobId,
    source: o.source,
    searchProfileId: o.searchProfileId?.toString?.() ?? o.searchProfileId,
    companyId: o.companyId?.toString?.() ?? o.companyId,
    jobTitle: o.jobTitle,
    description: o.description,
    companyName: o.companyName,
    companyDomain: o.companyDomain,
    location: o.location,
    countryCode: o.countryCode,
    remote: o.remote,
    hybrid: o.hybrid,
    seniority: o.seniority,
    minExperienceYears: o.minExperienceYears ?? null,
    maxExperienceYears: o.maxExperienceYears ?? null,
    technologySlugs: o.technologySlugs,
    salaryMinUsd: o.salaryMinUsd,
    salaryMaxUsd: o.salaryMaxUsd,
    datePosted: o.datePosted,
    discoveredAt: o.discoveredAt,
    closedAt: o.closedAt,
    isClosed: o.isClosed,
    applyUrl: o.applyUrl,
    finalUrl: o.finalUrl,
    sourceUrl: o.sourceUrl,
    urlDomain:
      o.urlDomain ||
      extractJobUrlDomain(o.applyUrl, o.sourceUrl, o.finalUrl, o.companyDomain),
    notes: o.notes,
    status: o.status,
    lastSyncedAt: o.lastSyncedAt,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export function profileToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    name: o.name,
    companyId: o.companyId?.toString?.() ?? o.companyId,
    isActive: o.isActive,
    filters: o.filters,
    scheduleTime: o.scheduleTime,
    scheduleDays: o.scheduleDays,
    timezone: o.timezone,
    lastSyncedAt: o.lastSyncedAt,
    lastJobCount: o.lastJobCount,
    lastError: o.lastError,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

async function upsertJobs(jobs, { companyId, searchProfileId }) {
  let upserted = 0;
  for (const job of jobs) {
    const mapped = mapTheirStackJob(job, { companyId, searchProfileId });
    await ScrapedJob.findOneAndUpdate(
      { theirstackJobId: mapped.theirstackJobId, companyId },
      mapped,
      { upsert: true, new: true }
    );
    upserted++;
  }
  return upserted;
}

export async function syncSearchProfile(profile, trigger = 'manual') {
  const run = await JobScrapRun.create({
    companyId: profile.companyId,
    searchProfileId: profile._id,
    trigger,
    status: 'success',
    startedAt: new Date(),
  });

  try {
    const jobs = await searchJobsAllPages(profile.filters);
    const upserted = await upsertJobs(jobs, {
      companyId: profile.companyId,
      searchProfileId: profile._id,
    });

    profile.lastSyncedAt = new Date();
    profile.lastJobCount = upserted;
    profile.lastError = '';
    await profile.save();

    run.jobsFetched = jobs.length;
    run.jobsUpserted = upserted;
    run.finishedAt = new Date();
    await run.save();

    return { jobsFetched: jobs.length, jobsUpserted: upserted, runId: run._id.toString() };
  } catch (err) {
    profile.lastError = err.message || 'Sync failed';
    await profile.save();

    run.status = 'failed';
    run.error = err.message || 'Sync failed';
    run.finishedAt = new Date();
    await run.save();

    throw err;
  }
}

export async function syncProfileById(profileId, trigger = 'manual') {
  const profile = await JobSearchProfile.findById(profileId);
  if (!profile) throw new Error('Search profile not found');
  return syncSearchProfile(profile, trigger);
}

export async function syncAllActiveProfiles(trigger = 'cron') {
  const profiles = await JobSearchProfile.find({ isActive: true });
  const results = [];

  for (const profile of profiles) {
    try {
      const result = await syncSearchProfile(profile, trigger);
      results.push({ profileId: profile._id.toString(), success: true, ...result });
    } catch (err) {
      results.push({
        profileId: profile._id.toString(),
        success: false,
        error: err.message,
      });
    }
  }

  return results;
}
