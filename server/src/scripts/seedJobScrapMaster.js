import 'dotenv/config';
import { connectDB } from '../config/db.js';
import Company from '../models/Company.js';
import { seedJobScrapMasterForCompany } from '../utils/jobScrapMasterSeed.js';

async function run() {
  await connectDB();

  const companies = await Company.find({});
  let totalCreated = 0;

  for (const company of companies) {
    const result = await seedJobScrapMasterForCompany(company._id);
    totalCreated += result.created;
    console.log(`  ${company.name}: +${result.created} (${result.skipped} already existed)`);
  }

  console.log(`Job scrap master seed complete — ${totalCreated} new item(s) across ${companies.length} company(ies)`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
