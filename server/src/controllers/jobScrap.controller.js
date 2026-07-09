import JobSearchProfile from '../models/JobSearchProfile.js';
import ScrapedJob from '../models/ScrapedJob.js';
import JobScrapRun from '../models/JobScrapRun.js';
import JobScrapMasterItem from '../models/JobScrapMasterItem.js';
import Company from '../models/Company.js';
import { getCompanyFilter } from '../services/billing.service.js';
import {
  profileToJSON,
  scrapedJobToJSON,
  syncProfileById,
  syncAllActiveProfiles,
  extractJobUrlDomain,
} from '../services/jobScrap.service.js';
import { rescheduleProfile, unscheduleProfile } from '../services/jobScrap.scheduler.js';

async function resolveCompanyId(user, companyId) {
  let targetId = user.companyId._id;
  if (user.isPlatformAdmin && companyId) targetId = companyId;
  const company = await Company.findById(targetId);
  if (!company) throw new Error('Company not found');
  return company;
}

export async function listProfiles(req, res) {
  try {
    const filter = getCompanyFilter(req.user, req.query.companyId);
    const items = await JobSearchProfile.find(filter).sort({ name: 1 });
    return res.json({ profiles: items.map(profileToJSON) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list profiles' });
  }
}

export async function createProfile(req, res) {
  try {
    const company = await resolveCompanyId(req.user, req.body.companyId);
    const { name, filters, scheduleTime, scheduleDays, timezone, isActive } = req.body;

    if (!name) return res.status(400).json({ error: 'Profile name is required' });

    const item = await JobSearchProfile.create({
      name,
      companyId: company._id,
      filters: filters || {},
      scheduleTime: scheduleTime || '09:00',
      scheduleDays: scheduleDays ?? [1, 2, 3, 4, 5],
      timezone: timezone || 'Asia/Kolkata',
      isActive: isActive !== false,
      createdBy: req.user._id,
    });

    if (item.isActive) rescheduleProfile(item);

    return res.status(201).json({ profile: profileToJSON(item) });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to create profile' });
  }
}

export async function updateProfile(req, res) {
  try {
    const item = await JobSearchProfile.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Profile not found' });

    const fields = ['name', 'filters', 'scheduleTime', 'scheduleDays', 'timezone', 'isActive'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) item[f] = req.body[f];
    });

    await item.save();

    if (item.isActive) rescheduleProfile(item);
    else unscheduleProfile(item._id);

    return res.json({ profile: profileToJSON(item) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update profile' });
  }
}

export async function deleteProfile(req, res) {
  try {
    const item = await JobSearchProfile.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Profile not found' });
    unscheduleProfile(item._id);
    await item.deleteOne();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete profile' });
  }
}

export async function syncProfileNow(req, res) {
  try {
    const result = await syncProfileById(req.params.id, 'manual');
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Sync failed' });
  }
}

export async function syncAllNow(req, res) {
  try {
    const filter = getCompanyFilter(req.user, req.body.companyId);
    const profiles = await JobSearchProfile.find({ ...filter, isActive: true });
    const results = [];
    for (const profile of profiles) {
      try {
        const result = await syncProfileById(profile._id, 'manual');
        results.push({ profileId: profile._id.toString(), success: true, ...result });
      } catch (err) {
        results.push({ profileId: profile._id.toString(), success: false, error: err.message });
      }
    }
    return res.json({ results });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Sync failed' });
  }
}

export async function listJobs(req, res) {
  try {
    const filter = getCompanyFilter(req.user, req.query.companyId);
    if (req.query.source) filter.source = req.query.source;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.scrapedFrom || req.query.scrapedTo) {
      filter.createdAt = {};
      if (req.query.scrapedFrom) {
        filter.createdAt.$gte = new Date(`${req.query.scrapedFrom}T00:00:00.000Z`);
      }
      if (req.query.scrapedTo) {
        filter.createdAt.$lte = new Date(`${req.query.scrapedTo}T23:59:59.999Z`);
      }
    }
    if (req.query.q) {
      const q = req.query.q.trim();
      filter.$or = [
        { jobTitle: { $regex: q, $options: 'i' } },
        { companyName: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } },
      ];
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const page = Math.max(parseInt(req.query.page, 10) || 0, 0);

    const [items, total] = await Promise.all([
      ScrapedJob.find(filter).sort({ datePosted: -1, createdAt: -1 }).skip(page * limit).limit(limit),
      ScrapedJob.countDocuments(filter),
    ]);

    return res.json({
      jobs: items.map(scrapedJobToJSON),
      total,
      page,
      limit,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list jobs' });
  }
}

export async function getJob(req, res) {
  try {
    const item = await ScrapedJob.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Job not found' });
    return res.json({ job: scrapedJobToJSON(item) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get job' });
  }
}

export async function createManualJob(req, res) {
  try {
    const company = await resolveCompanyId(req.user, req.body.companyId);
    const {
      jobTitle,
      description,
      companyName,
      companyDomain,
      location,
      countryCode,
      remote,
      hybrid,
      applyUrl,
      seniority,
      notes,
    } = req.body;

    if (!jobTitle) return res.status(400).json({ error: 'Job title is required' });

    const item = await ScrapedJob.create({
      source: 'manual',
      companyId: company._id,
      jobTitle,
      description: description || '',
      companyName: companyName || '',
      companyDomain: companyDomain || '',
      location: location || '',
      countryCode: countryCode || '',
      remote: !!remote,
      hybrid: !!hybrid,
      applyUrl: applyUrl || '',
      urlDomain: extractJobUrlDomain(applyUrl, companyDomain),
      seniority: seniority || '',
      notes: notes || '',
      status: 'open',
      createdBy: req.user._id,
      datePosted: new Date(),
    });

    return res.status(201).json({ job: scrapedJobToJSON(item) });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to create job' });
  }
}

export async function updateJob(req, res) {
  try {
    const item = await ScrapedJob.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Job not found' });

    const fields = [
      'jobTitle',
      'description',
      'companyName',
      'companyDomain',
      'location',
      'countryCode',
      'remote',
      'hybrid',
      'applyUrl',
      'seniority',
      'notes',
      'status',
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) item[f] = req.body[f];
    });

    await item.save();
    return res.json({ job: scrapedJobToJSON(item) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update job' });
  }
}

export async function deleteJob(req, res) {
  try {
    const item = await ScrapedJob.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Job not found' });
    await item.deleteOne();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete job' });
  }
}

export async function listRuns(req, res) {
  try {
    const filter = getCompanyFilter(req.user, req.query.companyId);
    const items = await JobScrapRun.find(filter).sort({ createdAt: -1 }).limit(30);
    return res.json({
      runs: items.map((r) => ({
        id: r._id.toString(),
        searchProfileId: r.searchProfileId?.toString?.() ?? null,
        trigger: r.trigger,
        status: r.status,
        jobsFetched: r.jobsFetched,
        jobsUpserted: r.jobsUpserted,
        error: r.error,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list runs' });
  }
}

export async function getStats(req, res) {
  try {
    const filter = getCompanyFilter(req.user, req.query.companyId);
    const [total, manual, api, profiles, activeProfiles] = await Promise.all([
      ScrapedJob.countDocuments(filter),
      ScrapedJob.countDocuments({ ...filter, source: 'manual' }),
      ScrapedJob.countDocuments({ ...filter, source: 'theirstack' }),
      JobSearchProfile.countDocuments(filter),
      JobSearchProfile.countDocuments({ ...filter, isActive: true }),
    ]);

    return res.json({
      stats: { total, manual, api, profiles, activeProfiles },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get stats' });
  }
}

function masterItemToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    companyId: o.companyId?.toString?.() ?? o.companyId,
    category: o.category,
    value: o.value,
    label: o.label || o.value,
    isActive: o.isActive,
    sortOrder: o.sortOrder,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export async function listMasterItems(req, res) {
  try {
    const filter = getCompanyFilter(req.user, req.query.companyId);
    if (req.query.category) filter.category = req.query.category;
    if (req.query.activeOnly === 'true') filter.isActive = true;

    const items = await JobScrapMasterItem.find(filter).sort({ sortOrder: 1, label: 1, value: 1 });
    return res.json({ items: items.map(masterItemToJSON) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list master data' });
  }
}
