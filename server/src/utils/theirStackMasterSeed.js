import JobScrapMasterItem from '../models/JobScrapMasterItem.js';
import {
  fetchCatalogCountries,
  fetchCatalogLocations,
  searchCompaniesPage,
} from '../services/theirstack.service.js';

/** Priority countries for city seeding (ISO2). */
export const CITY_SEED_COUNTRY_CODES = ['US', 'IN', 'GB', 'CA', 'AU', 'DE', 'SG', 'AE', 'NL', 'IE'];

/** Well-known metros resolved by name search (more useful than random PPL pages). */
export const MAJOR_CITY_NAMES = {
  US: [
    'New York City',
    'San Francisco',
    'Los Angeles',
    'Chicago',
    'Austin',
    'Seattle',
    'Boston',
    'Dallas',
    'Atlanta',
    'Denver',
    'Washington',
    'San Jose',
    'San Diego',
    'Phoenix',
    'Philadelphia',
    'Houston',
    'Miami',
    'Minneapolis',
    'Detroit',
    'Portland',
    'Charlotte',
    'Raleigh',
    'Tampa',
    'Orlando',
    'Salt Lake City',
  ],
  IN: [
    'Bengaluru',
    'Bangalore',
    'Hyderabad',
    'Chennai',
    'Mumbai',
    'Pune',
    'Delhi',
    'New Delhi',
    'Noida',
    'Gurgaon',
    'Gurugram',
    'Kolkata',
    'Ahmedabad',
    'Jaipur',
    'Kochi',
    'Coimbatore',
    'Chandigarh',
    'Indore',
  ],
  GB: ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow', 'Bristol', 'Leeds', 'Cambridge', 'Oxford', 'Reading'],
  CA: ['Toronto', 'Vancouver', 'Montreal', 'Ottawa', 'Calgary', 'Edmonton', 'Waterloo', 'Mississauga'],
  AU: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra'],
  DE: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart', 'Düsseldorf'],
  SG: ['Singapore'],
  AE: ['Dubai', 'Abu Dhabi'],
  NL: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven'],
  IE: ['Dublin', 'Cork', 'Galway'],
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function upsertMasterRow(companyId, row, createdBy = null) {
  const existing = await JobScrapMasterItem.findOne({
    companyId,
    category: row.category,
    value: row.value,
  });
  if (existing) {
    const nextLabel = row.label || existing.label;
    const nextMeta = { ...(existing.meta || {}), ...(row.meta || {}) };
    let changed = false;
    if (nextLabel && nextLabel !== existing.label) {
      existing.label = nextLabel;
      changed = true;
    }
    if (JSON.stringify(existing.meta || {}) !== JSON.stringify(nextMeta)) {
      existing.meta = nextMeta;
      changed = true;
    }
    if (typeof row.sortOrder === 'number' && row.sortOrder !== existing.sortOrder) {
      existing.sortOrder = row.sortOrder;
      changed = true;
    }
    if (changed) await existing.save();
    return { created: false, updated: changed };
  }

  await JobScrapMasterItem.create({
    companyId,
    category: row.category,
    value: row.value,
    label: row.label || row.value,
    meta: row.meta || {},
    sortOrder: row.sortOrder || 0,
    isActive: true,
    createdBy,
  });
  return { created: true, updated: false };
}

export async function seedCountriesFromTheirStack(companyId, createdBy = null) {
  const countries = await fetchCatalogCountries({ limit: 100 });
  let created = 0;
  let updated = 0;
  let skipped = 0;

  countries
    .filter((c) => c?.iso2)
    .sort((a, b) => Number(b.num_jobs || 0) - Number(a.num_jobs || 0))
    .forEach((c, index) => {
      c._sortOrder = index + 1;
    });

  for (const country of countries) {
    if (!country?.iso2) continue;
    const result = await upsertMasterRow(
      companyId,
      {
        category: 'country_code',
        value: String(country.iso2).toUpperCase(),
        label: country.country
          ? `${country.country} (${String(country.iso2).toUpperCase()})`
          : String(country.iso2).toUpperCase(),
        sortOrder: country._sortOrder || 0,
        meta: {
          source: 'theirstack',
          numJobs: country.num_jobs || 0,
          numCompanies: country.num_companies || 0,
        },
      },
      createdBy
    );
    if (result.created) created += 1;
    else if (result.updated) updated += 1;
    else skipped += 1;
  }

  return { created, updated, skipped, total: countries.length };
}

function pickBestCityMatch(rows, queryName) {
  if (!rows?.length) return null;
  const q = String(queryName || '')
    .trim()
    .toLowerCase();
  const exact = rows.find((r) => String(r.name || '').toLowerCase() === q);
  if (exact) return exact;
  return rows[0];
}

async function seedMajorCitiesForCountry(companyId, countryCode, createdBy, stats) {
  const names = MAJOR_CITY_NAMES[countryCode] || [];
  for (const name of names) {
    try {
      const rows = await fetchCatalogLocations({
        name,
        countryCode,
        featureCode: 'PPL',
        limit: 10,
      });
      const best = pickBestCityMatch(rows, name);
      if (!best?.id) continue;
      const result = await upsertMasterRow(
        companyId,
        {
          category: 'city',
          value: String(best.id),
          label: best.display_name || `${best.name}, ${best.country_name || countryCode}`,
          sortOrder: 0,
          meta: {
            source: 'theirstack',
            countryCode: best.country_code || countryCode,
            name: best.name,
            admin1: best.admin1_name || '',
            featureCode: best.feature_code || 'PPL',
            major: true,
          },
        },
        createdBy
      );
      if (result.created) stats.created += 1;
      else if (result.updated) stats.updated += 1;
      else stats.skipped += 1;
      await sleep(40);
    } catch (err) {
      stats.errors.push(`${countryCode}/${name}: ${err.message}`);
    }
  }
}

async function seedCityPagesForCountry(companyId, countryCode, perCountryLimit, createdBy, stats) {
  let offset = 0;
  let fetched = 0;
  while (fetched < perCountryLimit) {
    const pageSize = Math.min(100, perCountryLimit - fetched);
    let rows = [];
    try {
      rows = await fetchCatalogLocations({
        countryCode,
        featureCode: 'PPL',
        offset,
        limit: pageSize,
      });
    } catch (err) {
      stats.errors.push(`${countryCode} page@${offset}: ${err.message}`);
      break;
    }
    if (!rows.length) break;

    for (const city of rows) {
      if (!city?.id) continue;
      const result = await upsertMasterRow(
        companyId,
        {
          category: 'city',
          value: String(city.id),
          label: city.display_name || `${city.name}, ${city.country_name || countryCode}`,
          sortOrder: fetched + 1000,
          meta: {
            source: 'theirstack',
            countryCode: city.country_code || countryCode,
            name: city.name,
            admin1: city.admin1_name || '',
            featureCode: city.feature_code || 'PPL',
            major: false,
          },
        },
        createdBy
      );
      if (result.created) stats.created += 1;
      else if (result.updated) stats.updated += 1;
      else stats.skipped += 1;
      fetched += 1;
      if (fetched >= perCountryLimit) break;
    }

    offset += rows.length;
    if (rows.length < pageSize) break;
    await sleep(60);
  }
}

export async function seedCitiesFromTheirStack(
  companyId,
  { countryCodes = CITY_SEED_COUNTRY_CODES, perCountryLimit = 200, createdBy = null } = {}
) {
  const stats = { created: 0, updated: 0, skipped: 0, errors: [], countries: countryCodes.length };

  for (const countryCode of countryCodes) {
    await seedMajorCitiesForCountry(companyId, countryCode, createdBy, stats);
    await seedCityPagesForCountry(companyId, countryCode, perCountryLimit, createdBy, stats);
  }

  return stats;
}

export async function seedCompaniesFromTheirStack(
  companyId,
  {
    countryCodes = ['US', 'IN', 'GB', 'CA'],
    maxPerCountry = 50,
    createdBy = null,
  } = {}
) {
  const stats = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    skippedNoCredits: false,
    countries: countryCodes.length,
  };

  for (const countryCode of countryCodes) {
    let page = 0;
    let fetched = 0;
    while (fetched < maxPerCountry) {
      const limit = Math.min(25, maxPerCountry - fetched);
      let result;
      try {
        result = await searchCompaniesPage(
          {
            limit,
            company_country_code_or: [countryCode],
            blur_company_data: false,
          },
          page
        );
      } catch (err) {
        if (err.status === 402 || /no api credits/i.test(err.message || '')) {
          stats.skippedNoCredits = true;
          stats.errors.push(
            `Companies skipped — TheirStack has no API credits left (${err.message})`
          );
          return stats;
        }
        stats.errors.push(`${countryCode} page ${page}: ${err.message}`);
        break;
      }

      const batch = Array.isArray(result?.data) ? result.data : [];
      if (!batch.length) break;

      for (const company of batch) {
        const domain = String(company.domain || '')
          .trim()
          .toLowerCase();
        if (!domain || !company.name) continue;
        // Skip obviously blurred preview payloads
        if (/^x+$/i.test(domain.replace(/\./g, '')) || /X{3,}/.test(String(company.name))) continue;
        const resultUpsert = await upsertMasterRow(
          companyId,
          {
            category: 'company',
            value: domain,
            label: company.name ? `${company.name} (${domain})` : domain,
            sortOrder: fetched,
            meta: {
              source: 'theirstack',
              theirstackId: company.id,
              countryCode: company.country_code || countryCode,
              city: company.city || '',
              employeeCount: company.employee_count || 0,
            },
          },
          createdBy
        );
        if (resultUpsert.created) stats.created += 1;
        else if (resultUpsert.updated) stats.updated += 1;
        else stats.skipped += 1;
        fetched += 1;
        if (fetched >= maxPerCountry) break;
      }

      page += 1;
      if (batch.length < limit) break;
      await sleep(80);
    }
  }

  return stats;
}

export async function seedTheirStackMasterForCompany(
  companyId,
  {
    countries = true,
    cities = true,
    companies = true,
    cityCountryCodes = CITY_SEED_COUNTRY_CODES,
    citiesPerCountry = 200,
    companiesPerCountry = 50,
    companyCountryCodes = ['US', 'IN', 'GB', 'CA'],
    createdBy = null,
  } = {}
) {
  const summary = {};

  if (countries) {
    summary.countries = await seedCountriesFromTheirStack(companyId, createdBy);
  }
  if (cities) {
    summary.cities = await seedCitiesFromTheirStack(companyId, {
      countryCodes: cityCountryCodes,
      perCountryLimit: citiesPerCountry,
      createdBy,
    });
  }
  if (companies) {
    summary.companies = await seedCompaniesFromTheirStack(companyId, {
      countryCodes: companyCountryCodes,
      maxPerCountry: companiesPerCountry,
      createdBy,
    });
  }

  return summary;
}
