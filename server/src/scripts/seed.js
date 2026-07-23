import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import Company from '../models/Company.js';
import User from '../models/User.js';
import { migrateFutureFluxToNexusPartners } from '../utils/companyLegacy.js';
import { seedJobScrapMasterForCompany } from '../utils/jobScrapMasterSeed.js';
import { seedJobSearchProfilesForCompany } from '../utils/jobSearchProfileSeed.js';
import { upsertRecruiterAccount } from '../services/recruiterPortal.service.js';

const SALT_ROUNDS = 12;

async function seed() {
  await connectDB();

  const platformCompany = await Company.findOneAndUpdate(
    { slug: 'nexuspartners' },
    {
      name: 'nexuspartners.com',
      slug: 'nexuspartners',
      appTitle: 'Nexus Partners Admin',
      primaryColor: '#3e6ae1',
      secondaryColor: '#7c3aed',
      isPlatformAdmin: true,
      apiCompanyName: 'nexuspartners',
      website: 'https://nexuspartners.com',
      logoUrl: '',
    },
    { upsert: true, new: true }
  );

  const migration = await migrateFutureFluxToNexusPartners();

  const adminPassword = await bcrypt.hash('Saibaba@2025', SALT_ROUNDS);

  const adminUser = await User.findOneAndUpdate(
    { email: 'vamshi@gmail.com' },
    {
      email: 'vamshi@gmail.com',
      passwordHash: adminPassword,
      name: 'Vamshi Reddy',
      phone: '',
      role: 'admin',
      companyId: platformCompany._id,
      isActive: true,
      isCompanyAdmin: true,
      isPlatformAdmin: true,
    },
    { upsert: true, new: true }
  );

  const resumePassword = await bcrypt.hash('Saibaba@2025', SALT_ROUNDS);
  await User.findOneAndUpdate(
    { email: 'resume@nexuspartners.com' },
    {
      email: 'resume@nexuspartners.com',
      passwordHash: resumePassword,
      name: 'Resume Editor',
      role: 'resume',
      companyId: platformCompany._id,
      isActive: true,
      isCompanyAdmin: false,
      isPlatformAdmin: false,
    },
    { upsert: true, new: true }
  );

  // Move any user still on a @futureflux email domain to nexus company
  await User.updateMany(
    { email: /@futureflux/i },
    { $set: { companyId: platformCompany._id } }
  );

  const masterSeed = await seedJobScrapMasterForCompany(platformCompany._id, adminUser._id);
  const profileSeed = await seedJobSearchProfilesForCompany(platformCompany._id, adminUser._id);

  const testRecruiter = await upsertRecruiterAccount({
    username: 'recruiter',
    password: 'Saibaba@2025',
    name: 'Test Recruiter',
    email: 'recruiter@nexuspartners.com',
    phone: '',
    companyId: platformCompany._id,
  });

  console.log('Seed complete:');
  console.log('  Platform company:', platformCompany.name, platformCompany._id.toString());
  console.log('  Admin user:', adminUser.email, '(password: Saibaba@2025)');
  console.log('  Resume user: resume@nexuspartners.com (password: Saibaba@2025)');
  console.log('  Test recruiter portal: recruiter / Saibaba@2025');
  console.log('  Recruiter account id:', testRecruiter._id.toString());
  console.log('  Legacy migration — users moved:', migration.migratedUsers);
  console.log('  Legacy migration — records moved:', migration.migratedRecords);
  console.log('  Legacy migration — companies removed:', migration.removedCompanies);
  console.log('  Job scrap master:', masterSeed.created, 'created,', masterSeed.skipped, 'skipped');
  console.log(
    '  Job search profiles:',
    profileSeed.created,
    'created,',
    profileSeed.updated,
    'updated,',
    profileSeed.skipped,
    'skipped'
  );
  console.log('  isActive:', adminUser.isActive);

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
