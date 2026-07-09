import 'dotenv/config';
import { connectDB } from '../config/db.js';
import { migrateFutureFluxToNexusPartners } from '../utils/companyLegacy.js';

async function run() {
  await connectDB();
  const result = await migrateFutureFluxToNexusPartners();
  console.log('Legacy company migration complete:');
  console.log('  Users moved to nexuspartners:', result.migratedUsers);
  console.log('  Records moved:', result.migratedRecords);
  console.log('  Legacy companies removed:', result.removedCompanies);
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
