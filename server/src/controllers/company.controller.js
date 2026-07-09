import Company from '../models/Company.js';
import { slugify } from '../middleware/auth.js';
import { visibleCompaniesQuery } from '../utils/companyLegacy.js';

function companyToJSON(company) {
  return {
    id: company._id.toString(),
    name: company.name,
    slug: company.slug,
    logoUrl: company.logoUrl,
    faviconUrl: company.faviconUrl,
    appTitle: company.appTitle,
    primaryColor: company.primaryColor,
    secondaryColor: company.secondaryColor,
    isPlatformAdmin: company.isPlatformAdmin,
    website: company.website,
    owners: company.owners,
    documents: company.documents,
    razorpay: company.razorpay,
    zohoEnabled: company.zohoEnabled,
    skipBillingNames: company.skipBillingNames,
    demoProfileIds: company.demoProfileIds,
    paymentTypes: company.paymentTypes,
    billRatePerDay: company.billRatePerDay,
    salaryCurrency: company.salaryCurrency,
    createStudentPassword: company.createStudentPassword,
    visaTypes: company.visaTypes,
    additionalDetailFields: company.additionalDetailFields,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}

export async function listPublicCompanies(req, res) {
  try {
    const companies = await Company.find(visibleCompaniesQuery())
      .select('name slug logoUrl isPlatformAdmin')
      .sort({ name: 1 });
    return res.json({
      companies: companies.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        slug: c.slug,
        logoUrl: c.logoUrl,
        isPlatformAdmin: c.isPlatformAdmin,
      })),
    });
  } catch (err) {
    console.error('List companies error:', err);
    return res.status(500).json({ error: 'Failed to list companies' });
  }
}

export async function listAllCompanies(req, res) {
  try {
    const companies = await Company.find(visibleCompaniesQuery()).sort({ name: 1 });
    return res.json({ companies: companies.map(companyToJSON) });
  } catch (err) {
    console.error('List all companies error:', err);
    return res.status(500).json({ error: 'Failed to list companies' });
  }
}

export async function createCompany(req, res) {
  try {
    const { name, slug, appTitle, primaryColor, secondaryColor, website } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const finalSlug = slug || slugify(name);
    const existing = await Company.findOne({ $or: [{ name }, { slug: finalSlug }] });
    if (existing) {
      return res.status(400).json({ error: 'Company name or slug already exists' });
    }

    const company = await Company.create({
      name,
      slug: finalSlug,
      appTitle: appTitle || `${name} Admin`,
      primaryColor: primaryColor || '#3e6ae1',
      secondaryColor: secondaryColor || '#7c3aed',
      website: website || '',
      isPlatformAdmin: false,
    });

    return res.status(201).json({ company: companyToJSON(company) });
  } catch (err) {
    console.error('Create company error:', err);
    return res.status(500).json({ error: 'Failed to create company' });
  }
}

export async function getCompany(req, res) {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (!req.user.isPlatformAdmin && company._id.toString() !== req.user.companyId._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json({ company: companyToJSON(company) });
  } catch (err) {
    console.error('Get company error:', err);
    return res.status(500).json({ error: 'Failed to get company' });
  }
}

export async function updateCompany(req, res) {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const isOwnCompany = company._id.toString() === req.user.companyId._id.toString();
    const isPlatform = req.user.isPlatformAdmin;
    const isAdmin = isPlatform || req.user.isCompanyAdmin;

    if (!isOwnCompany && !isPlatform) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      name,
      slug,
      logoUrl,
      logoPublicId,
      faviconUrl,
      faviconPublicId,
      appTitle,
      primaryColor,
      secondaryColor,
      website,
      owners,
      documents,
      razorpay,
      zohoEnabled,
      skipBillingNames,
      demoProfileIds,
      paymentTypes,
      billRatePerDay,
      salaryCurrency,
      createStudentPassword,
      visaTypes,
      additionalDetailFields,
    } = req.body;

    // Platform admin can change name and slug; company admins can update billing settings
    if (isPlatform) {
      if (name) company.name = name;
      if (slug) company.slug = slug;
    }
    if (isAdmin && billRatePerDay !== undefined) company.billRatePerDay = billRatePerDay;
    if (isAdmin && skipBillingNames !== undefined) company.skipBillingNames = skipBillingNames;
    if (isAdmin && demoProfileIds !== undefined) company.demoProfileIds = demoProfileIds;

    if (logoUrl !== undefined) company.logoUrl = logoUrl;
    if (logoPublicId !== undefined) company.logoPublicId = logoPublicId;
    if (faviconUrl !== undefined) company.faviconUrl = faviconUrl;
    if (faviconPublicId !== undefined) company.faviconPublicId = faviconPublicId;
    if (appTitle !== undefined) company.appTitle = appTitle;
    if (primaryColor !== undefined) company.primaryColor = primaryColor;
    if (secondaryColor !== undefined) company.secondaryColor = secondaryColor;
    if (website !== undefined) company.website = website;
    if (owners !== undefined) company.owners = owners;
    if (documents !== undefined) company.documents = documents;
    if (createStudentPassword !== undefined) company.createStudentPassword = createStudentPassword;
    if (visaTypes !== undefined) company.visaTypes = visaTypes;
    if (additionalDetailFields !== undefined) company.additionalDetailFields = additionalDetailFields;
    if (salaryCurrency !== undefined) company.salaryCurrency = salaryCurrency;

    if (isPlatform && razorpay !== undefined) {
      company.razorpay = { ...company.razorpay.toObject?.() ?? company.razorpay, ...razorpay };
    }
    if (isPlatform && zohoEnabled !== undefined) company.zohoEnabled = zohoEnabled;
    if (paymentTypes !== undefined) company.paymentTypes = paymentTypes;

    await company.save();

    return res.json({ company: companyToJSON(company) });
  } catch (err) {
    console.error('Update company error:', err);
    return res.status(500).json({ error: 'Failed to update company' });
  }
}

export async function getMyCompanySettings(req, res) {
  try {
    const company = await Company.findById(req.user.companyId._id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    return res.json({ company: companyToJSON(company) });
  } catch (err) {
    console.error('Get my company error:', err);
    return res.status(500).json({ error: 'Failed to get company settings' });
  }
}

export async function updateMyCompanySettings(req, res) {
  req.params.id = req.user.companyId._id.toString();
  return updateCompany(req, res);
}
