import JobScrapMasterItem from '../models/JobScrapMasterItem.js';
import { seedJobScrapMasterForCompany } from '../utils/jobScrapMasterSeed.js';

/** Active job titles for a company — single source of truth for role dropdowns. */
export async function listActiveJobTitles(companyId) {
  if (!companyId) return [];
  try {
    await seedJobScrapMasterForCompany(companyId);
  } catch {
    /* ignore seed failures */
  }
  const items = await JobScrapMasterItem.find({
    companyId,
    category: 'job_title',
    isActive: true,
  }).sort({ sortOrder: 1, label: 1, value: 1 });
  return items.map((i) => String(i.label || i.value || '').trim()).filter(Boolean);
}

/** Active country codes for a company — used by recruiter job filters. */
export async function listActiveCountries(companyId) {
  if (!companyId) return [];
  try {
    await seedJobScrapMasterForCompany(companyId);
  } catch {
    /* ignore seed failures */
  }
  const items = await JobScrapMasterItem.find({
    companyId,
    category: 'country_code',
    isActive: true,
  }).sort({ sortOrder: 1, label: 1, value: 1 });
  const seen = new Set();
  return items
    .map((i) => {
      const value = String(i.value || '').trim().toUpperCase();
      const label = String(i.label || i.value || '').trim();
      return { value, label: label || value };
    })
    .filter((c) => {
      if (!c.value || seen.has(c.value)) return false;
      seen.add(c.value);
      return true;
    });
}
