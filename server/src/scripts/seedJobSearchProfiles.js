import 'dotenv/config';
import { connectDB } from '../config/db.js';
import Company from '../models/Company.js';
import { seedJobSearchProfilesForCompany } from '../utils/jobSearchProfileSeed.js';
import { JOB_SEARCH_PROFILE_ROLES, JOB_SEARCH_PROFILE_SEED_DEFAULTS } from '../constants/jobSearchProfileSeed.js';

/**
 * Seed JobSearchProfile documents for one or all companies.
 *
 * Usage:
 *   npm run seed:job-search-profiles
 *   COMPANY_SLUG=nexuspartners npm run seed:job-search-profiles
 */
async function run() {
  await connectDB();

  const slug = process.env.COMPANY_SLUG || process.env.SEED_COMPANY_SLUG || '';
  const companies = slug
    ? await Company.find({ slug })
    : await Company.find({ slug: 'nexuspartners' }).limit(1);

  if (!companies.length) {
    // Fallback: first company in DB
    const all = await Company.find({}).sort({ createdAt: 1 }).limit(1);
    if (!all.length) {
      console.error('No companies found. Run `npm run seed` first.');
      process.exit(1);
    }
    companies.push(...all);
  }

  console.log(
    `Seeding ${JOB_SEARCH_PROFILE_ROLES.length} job search profiles ` +
      `(US, limit ${JOB_SEARCH_PROFILE_SEED_DEFAULTS.limit}, last ${JOB_SEARCH_PROFILE_SEED_DEFAULTS.postedAtMaxAgeHours}h, ` +
      `daily ${JOB_SEARCH_PROFILE_SEED_DEFAULTS.scheduleTime} ${JOB_SEARCH_PROFILE_SEED_DEFAULTS.timezone})`
  );

  for (const company of companies) {
    const result = await seedJobSearchProfilesForCompany(company._id);
    console.log(
      `  ${company.name} (${company.slug || company._id}): ` +
        `+${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ` +
        `${result.masterCreated} master titles added`
    );
  }

  console.log('Job search profile seed complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
