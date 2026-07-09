import JobScrapMasterItem from '../models/JobScrapMasterItem.js';
import { JOB_SCRAP_MASTER_DEFAULTS } from '../constants/jobScrapMaster.js';

export async function seedJobScrapMasterForCompany(companyId, createdBy = null) {
  let created = 0;
  let skipped = 0;

  for (const row of JOB_SCRAP_MASTER_DEFAULTS) {
    const exists = await JobScrapMasterItem.findOne({
      companyId,
      category: row.category,
      value: row.value,
    });
    if (exists) {
      skipped++;
      continue;
    }
    await JobScrapMasterItem.create({
      ...row,
      companyId,
      createdBy,
      isActive: true,
    });
    created++;
  }

  return { created, skipped };
}
