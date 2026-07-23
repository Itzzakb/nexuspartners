const API_BASE = 'https://api.theirstack.com';

function getApiKey() {
  const key = process.env.THEIRSTACK_API_KEY;
  if (!key) {
    throw new Error('THEIRSTACK_API_KEY is not configured');
  }
  return key;
}

function hasRequiredAnchor(payload) {
  if (payload.posted_at_max_age_days !== undefined && payload.posted_at_max_age_days !== null) {
    return true;
  }
  if (payload.posted_at_gte || payload.posted_at_lte) return true;
  if (payload.company_domain_or?.length) return true;
  if (payload.company_linkedin_url_or?.length) return true;
  if (payload.company_name_or?.length) return true;
  if (payload.company_name_case_insensitive_or?.length) return true;
  if (payload.company_name_partial_match_or?.length) return true;
  if (payload.company_id_or?.length) return true;
  if (payload.job_id_or?.length) return true;
  return false;
}

export function buildSearchPayload(profileFilters) {
  const filters = profileFilters || {};
  const payload = {
    page: 0,
    limit: Math.min(Math.max(filters.limit || 25, 1), 100),
    blur_company_data: false,
    include_total_results: false,
    order_by: [
      { field: 'date_posted', desc: true },
      { field: 'discovered_at', desc: true },
    ],
  };

  if (filters.job_title_or?.length) payload.job_title_or = filters.job_title_or;
  if (filters.job_country_code_or?.length) payload.job_country_code_or = filters.job_country_code_or;
  if (filters.url_domain_or?.length) payload.url_domain_or = filters.url_domain_or;
  if (filters.url_domain_not?.length) payload.url_domain_not = filters.url_domain_not;
  if (filters.company_domain_or?.length) payload.company_domain_or = filters.company_domain_or;
  if (filters.job_location_ids?.length) {
    payload.job_location_or = filters.job_location_ids.map((id) => ({ id: Number(id) }));
  }
  if (filters.remote === true || filters.remote === false) payload.remote = filters.remote;

  const postedMode = filters.posted_filter_mode || 'days';

  if (postedMode === 'range' && (filters.posted_at_gte || filters.posted_at_lte)) {
    if (filters.posted_at_gte) payload.posted_at_gte = filters.posted_at_gte;
    if (filters.posted_at_lte) payload.posted_at_lte = filters.posted_at_lte;
  } else if (postedMode === 'hours') {
    const hours = Math.max(Number(filters.posted_at_max_age_hours) || 24, 1);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    payload.discovered_at_gte = since.toISOString();
    // TheirStack requires posted_at_* or company_* — url_domain_or does not count
    payload.posted_at_max_age_days = Math.max(1, Math.ceil(hours / 24));
  } else {
    const days = filters.posted_at_max_age_days;
    payload.posted_at_max_age_days = days !== undefined && days !== null ? days : 7;
  }

  if (!hasRequiredAnchor(payload)) {
    payload.posted_at_max_age_days = 7;
  }

  return payload;
}

export async function searchJobsPage(payload, page = 0) {
  const res = await fetch(`${API_BASE}/v1/jobs/search`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({ ...payload, page }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      body?.error?.description ||
      body?.error?.title ||
      body?.message ||
      `TheirStack API error ${res.status}`;
    throw new Error(msg);
  }

  return body;
}

export async function searchJobsAllPages(profileFilters, maxPages = 5) {
  const payload = buildSearchPayload(profileFilters);
  const limit = payload.limit;
  const allJobs = [];

  for (let page = 0; page < maxPages; page++) {
    const result = await searchJobsPage(payload, page);
    const batch = result.data || [];
    allJobs.push(...batch);
    if (batch.length < limit) break;
  }

  return allJobs;
}

async function theirStackRequest(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.error?.description ||
      data?.error?.title ||
      data?.message ||
      `TheirStack API error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.code = data?.error?.code;
    throw err;
  }
  return data;
}

/** Free catalog: countries with job/company counts. */
export async function fetchCatalogCountries({ limit = 100 } = {}) {
  const all = [];
  let page = 0;
  for (;;) {
    const result = await theirStackRequest(
      `/v0/catalog/jobs_companies_per_job_country_code?limit=${limit}&page=${page}`
    );
    const batch = Array.isArray(result?.data) ? result.data : [];
    all.push(...batch);
    const total = Number(result?.metadata?.total_results || 0);
    if (!batch.length || all.length >= total) break;
    page += 1;
    if (page > 50) break;
  }
  return all;
}

/**
 * Free catalog: geographic locations (cities, regions, …).
 * Response is a bare array (not wrapped in { data }).
 */
export async function fetchCatalogLocations({
  name = '',
  countryCode = '',
  featureCode = 'PPL',
  offset = 0,
  limit = 100,
} = {}) {
  const params = new URLSearchParams();
  if (name) params.set('name', name);
  if (countryCode) params.set('country_code', countryCode);
  if (featureCode) params.set('feature_code', featureCode);
  params.set('offset', String(offset));
  params.set('limit', String(Math.min(Math.max(limit, 1), 100)));
  const result = await theirStackRequest(`/v0/catalog/locations?${params.toString()}`);
  return Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];
}

/** Paid: company search (1 credit per company returned when unblurred). */
export async function searchCompaniesPage(payload = {}, page = 0) {
  return theirStackRequest('/v1/companies/search', {
    method: 'POST',
    body: {
      blur_company_data: false,
      include_total_results: false,
      order_by: [{ field: 'employee_count', desc: true }],
      limit: 25,
      ...payload,
      page,
    },
  });
}
