import 'dotenv/config';
import { connectDB } from '../config/db.js';
import Company from '../models/Company.js';
import { seedTheirStackMasterForCompany } from '../utils/theirStackMasterSeed.js';

function parseArgs(argv) {
  const opts = {
    countries: true,
    cities: true,
    companies: true,
    citiesPerCountry: Number(process.env.THEIRSTACK_CITIES_PER_COUNTRY || 150),
    companiesPerCountry: Number(process.env.THEIRSTACK_COMPANIES_PER_COUNTRY || 25),
  };

  for (const arg of argv) {
    if (arg === '--countries-only') {
      opts.cities = false;
      opts.companies = false;
    } else if (arg === '--skip-companies') {
      opts.companies = false;
    } else if (arg === '--skip-cities') {
      opts.cities = false;
    } else if (arg === '--skip-countries') {
      opts.countries = false;
    } else if (arg.startsWith('--cities-per-country=')) {
      opts.citiesPerCountry = Number(arg.split('=')[1]) || opts.citiesPerCountry;
    } else if (arg.startsWith('--companies-per-country=')) {
      opts.companiesPerCountry = Number(arg.split('=')[1]) || opts.companiesPerCountry;
    }
  }
  return opts;
}

async function run() {
  if (!process.env.THEIRSTACK_API_KEY) {
    throw new Error('THEIRSTACK_API_KEY is not configured');
  }

  const opts = parseArgs(process.argv.slice(2));
  await connectDB();

  const companies = await Company.find({});
  console.log(
    `Seeding TheirStack master data for ${companies.length} company(ies) ` +
      `(countries=${opts.countries}, cities=${opts.cities}, companies=${opts.companies})`
  );

  for (const company of companies) {
    console.log(`\n→ ${company.name}`);
    const summary = await seedTheirStackMasterForCompany(company._id, {
      countries: opts.countries,
      cities: opts.cities,
      companies: opts.companies,
      citiesPerCountry: opts.citiesPerCountry,
      companiesPerCountry: opts.companiesPerCountry,
    });

    if (summary.countries) {
      const c = summary.countries;
      console.log(
        `  countries: +${c.created} created, ${c.updated} updated, ${c.skipped} unchanged (${c.total} from API)`
      );
    }
    if (summary.cities) {
      const c = summary.cities;
      console.log(
        `  cities: +${c.created} created, ${c.updated} updated, ${c.skipped} unchanged across ${c.countries} countries`
      );
      if (c.errors?.length) console.log(`  city warnings: ${c.errors.slice(0, 5).join(' | ')}`);
    }
    if (summary.companies) {
      const c = summary.companies;
      if (c.skippedNoCredits) {
        console.log(`  companies: SKIPPED — ${c.errors[0] || 'no TheirStack API credits'}`);
      } else {
        console.log(
          `  companies: +${c.created} created, ${c.updated} updated, ${c.skipped} unchanged`
        );
        if (c.errors?.length) console.log(`  company warnings: ${c.errors.slice(0, 5).join(' | ')}`);
      }
    }
  }

  console.log('\nTheirStack master seed complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
