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
