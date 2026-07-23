/**
 * Default Job Search Profiles seed data.
 * Compatible with JobSearchProfile model (`server/src/models/JobSearchProfile.js`).
 *
 * Settings (per user request):
 * - Country: United States (US)
 * - Limit: 10 jobs per profile
 * - Posted window: last 24 hours
 * - Sync: daily at 09:00 Asia/Kolkata (IST)
 */

/** Unique roles from the provided lists (duplicate "BI Analyst & Data Analyst" removed). */
export const JOB_SEARCH_PROFILE_ROLES = [
  'Business Intelligence Analyst',
  'Data Engineer Analyst-H1B',
  'BI Analyst & Data Analyst',
  'Python',
  'Industrial Engineer',
  'Network Engineer',
  'UI Developer',
  'SQL Developer',
  'Frontend Developer',
  'Data Engineer',
  'Cloud Data Engineer',
  'Java Developer',
  'Data Scientist',
  'Software Engineer',
  'System Administrator Remote',
  'Full Stack Developer',
  'Java with React Js',
  'Java FullStack',
  'Finance Analyst',
  'Gen AI',
];

/** Extra TheirStack title patterns for roles that need broader matching. */
export const JOB_SEARCH_PROFILE_TITLE_ALIASES = {
  'Gen AI': [
    'Gen AI',
    'GenAI',
    'Generative AI',
    'Generative AI Engineer',
    'Gen AI Engineer',
    'AI Engineer',
    'LLM Engineer',
  ],
};

export const JOB_SEARCH_PROFILE_SEED_DEFAULTS = {
  countryCode: 'US',
  countryLabel: 'United States',
  limit: 10,
  postedFilterMode: 'hours',
  postedAtMaxAgeHours: 24,
  postedAtMaxAgeDays: 1,
  scheduleTime: '09:00',
  /** Sun–Sat (matches JobScrap UI / node-cron with timezone) */
  scheduleDays: [0, 1, 2, 3, 4, 5, 6],
  timezone: 'Asia/Kolkata',
  isActive: true,
};

/**
 * Build a JobSearchProfile-compatible document (without companyId / createdBy).
 * @param {string} role
 */
export function buildJobSearchProfileDoc(role) {
  const d = JOB_SEARCH_PROFILE_SEED_DEFAULTS;
  const title = String(role || '').trim();
  const titles = JOB_SEARCH_PROFILE_TITLE_ALIASES[title] || [title];
  return {
    name: `${title} — ${d.countryLabel}`,
    isActive: d.isActive,
    filters: {
      job_title_or: titles,
      job_country_code_or: [d.countryCode],
      url_domain_or: [],
      url_domain_not: [],
      company_domain_or: [],
      job_location_ids: [],
      posted_filter_mode: d.postedFilterMode,
      posted_at_max_age_hours: d.postedAtMaxAgeHours,
      posted_at_max_age_days: d.postedAtMaxAgeDays,
      posted_at_gte: '',
      posted_at_lte: '',
      remote: null,
      limit: d.limit,
    },
    scheduleTime: d.scheduleTime,
    scheduleDays: [...d.scheduleDays],
    timezone: d.timezone,
    lastSyncedAt: null,
    lastJobCount: 0,
    lastError: '',
  };
}

export function buildAllJobSearchProfileDocs() {
  return JOB_SEARCH_PROFILE_ROLES.map(buildJobSearchProfileDoc);
}
