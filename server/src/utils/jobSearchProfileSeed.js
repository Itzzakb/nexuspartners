import JobSearchProfile from '../models/JobSearchProfile.js';
import JobScrapMasterItem from '../models/JobScrapMasterItem.js';
import {
  JOB_SEARCH_PROFILE_ROLES,
  buildJobSearchProfileDoc,
} from '../constants/jobSearchProfileSeed.js';

/**
 * Idempotent seed of JobSearchProfile docs for a company.
 * Also ensures matching job_title master items exist for the Job Scrap UI.
 *
 * @param {import('mongoose').Types.ObjectId|string} companyId
 * @param {import('mongoose').Types.ObjectId|string|null} [createdBy]
 * @returns {Promise<{ created: number, updated: number, skipped: number, masterCreated: number }>}
 */
export async function seedJobSearchProfilesForCompany(companyId, createdBy = null) {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let masterCreated = 0;

  for (let i = 0; i < JOB_SEARCH_PROFILE_ROLES.length; i++) {
    const role = JOB_SEARCH_PROFILE_ROLES[i];
    const doc = buildJobSearchProfileDoc(role);

    const masterExists = await JobScrapMasterItem.findOne({
      companyId,
      category: 'job_title',
      value: role,
    });
    if (!masterExists) {
      await JobScrapMasterItem.create({
        companyId,
        category: 'job_title',
        value: role,
        label: role,
        sortOrder: 100 + i,
        isActive: true,
        createdBy,
      });
      masterCreated++;
    }

    const existing = await JobSearchProfile.findOne({
      companyId,
      name: doc.name,
    });

    if (existing) {
      // Refresh filters/schedule to match seed defaults (keeps idempotent re-runs useful)
      existing.filters = doc.filters;
      existing.scheduleTime = doc.scheduleTime;
      existing.scheduleDays = doc.scheduleDays;
      existing.timezone = doc.timezone;
      existing.isActive = doc.isActive;
      await existing.save();
      updated++;
      continue;
    }

    // Also skip if same title+country already exists under a different name
    const byTitle = await JobSearchProfile.findOne({
      companyId,
      'filters.job_title_or': role,
      'filters.job_country_code_or': 'US',
    });
    if (byTitle) {
      skipped++;
      continue;
    }

    await JobSearchProfile.create({
      ...doc,
      companyId,
      createdBy,
    });
    created++;
  }

  return { created, updated, skipped, masterCreated };
}
