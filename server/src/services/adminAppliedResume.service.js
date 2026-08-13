import RecruiterResumeLibrary from '../models/RecruiterResumeLibrary.js';
import StudentJobAction from '../models/StudentJobAction.js';
import ScrapedJob from '../models/ScrapedJob.js';
import { buildResumeDownload } from './nexusStudentApi.service.js';
import { resumeLibraryToJSON } from './recruiterPortal.service.js';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Admin: all job-application resumes for a student in a company
 * (from RecruiterResumeLibrary across recruiters + actions with atsResumeUrl).
 */
export async function listAppliedResumesForStudent({
  companyId,
  studentPhone,
  company = '',
  jobTitle = '',
  q = '',
}) {
  const phone = String(studentPhone || '').trim();
  if (!phone) return { resumes: [], total: 0 };

  const libraryItems = await RecruiterResumeLibrary.find({
    companyId,
    studentPhone: phone,
  })
    .sort({ createdAt: -1 })
    .lean();

  const byKey = new Map();
  for (const item of libraryItems) {
    const key = `${item.scrapedJobId || 'none'}:${item.recruiterUsername || ''}`;
    byKey.set(key, {
      ...resumeLibraryToJSON(item),
      scrapedJobId: item.scrapedJobId?.toString?.() || null,
      applyUrl: '',
    });
  }

  // Include applied actions that have a download URL but no library row yet.
  const actions = await StudentJobAction.find({
    companyId,
    studentPhone: phone,
    status: { $nin: ['dropped', 'saved'] },
  })
    .sort({ appliedAt: -1, createdAt: -1 })
    .lean();

  const jobIds = [
    ...new Set(
      [
        ...libraryItems.map((i) => i.scrapedJobId?.toString?.() || ''),
        ...actions.map((a) => a.scrapedJobId?.toString?.() || String(a.scrapedJobId || '')),
      ].filter(Boolean)
    ),
  ];
  const jobs = jobIds.length
    ? await ScrapedJob.find({ _id: { $in: jobIds } })
        .select('jobTitle companyName applyUrl finalUrl sourceUrl')
        .lean()
    : [];
  const jobMap = new Map(jobs.map((j) => [j._id.toString(), j]));

  for (const row of byKey.values()) {
    const job = row.scrapedJobId ? jobMap.get(String(row.scrapedJobId)) : null;
    if (job) {
      row.applyUrl = job.applyUrl || job.finalUrl || job.sourceUrl || '';
      if (!row.jobTitle) row.jobTitle = job.jobTitle || '';
      if (!row.companyName) row.companyName = job.companyName || '';
    }
  }

  for (const action of actions) {
    const jobId = action.scrapedJobId?.toString?.() || '';
    const key = `${jobId}:${action.recruiterUsername || ''}`;
    const job = jobMap.get(jobId);
    const applyUrl = job?.applyUrl || job?.finalUrl || job?.sourceUrl || '';

    if (byKey.has(key)) {
      const existing = byKey.get(key);
      existing.applyUrl = existing.applyUrl || applyUrl;
      if (!existing.downloadUrl && action.atsResumeUrl) {
        existing.downloadUrl = action.atsResumeUrl;
      }
      continue;
    }

    if (!action.atsResumeUrl && !job) continue;

    byKey.set(key, {
      id: action._id.toString(),
      companyId: companyId.toString(),
      recruiterUsername: action.recruiterUsername || '',
      studentPhone: phone,
      studentName: '',
      scrapedJobId: jobId || null,
      jobTitle: job?.jobTitle || '',
      companyName: job?.companyName || '',
      downloadUrl: action.atsResumeUrl || '',
      atsScore: null,
      atsSummary: '',
      atsImprovements: [],
      atsMeetsTarget: false,
      atsScoredAt: null,
      source: action.atsResumeUrl ? 'ats_download' : 'applied',
      notes: '',
      createdAt: action.appliedAt || action.createdAt,
      updatedAt: action.updatedAt,
      hasResumeData: false,
      applyUrl,
      fromActionOnly: true,
    });
  }

  let resumes = Array.from(byKey.values());

  const companyQ = company.trim().toLowerCase();
  const titleQ = jobTitle.trim().toLowerCase();
  const keywordQ = q.trim().toLowerCase();

  if (companyQ) {
    resumes = resumes.filter((r) => (r.companyName || '').toLowerCase().includes(companyQ));
  }
  if (titleQ) {
    resumes = resumes.filter((r) => (r.jobTitle || '').toLowerCase().includes(titleQ));
  }
  if (keywordQ) {
    resumes = resumes.filter((r) => {
      const blob = `${r.jobTitle} ${r.companyName} ${r.atsSummary || ''} ${r.notes || ''}`.toLowerCase();
      return blob.includes(keywordQ);
    });
  }

  // Prefer entries with downloadable content first, then newest.
  resumes.sort((a, b) => {
    const aReady = a.downloadUrl || a.hasResumeData ? 1 : 0;
    const bReady = b.downloadUrl || b.hasResumeData ? 1 : 0;
    if (bReady !== aReady) return bReady - aReady;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return { resumes, total: resumes.length };
}

export async function downloadAppliedResumeById({
  companyId,
  resumeId,
  publicBaseUrl,
}) {
  const item = await RecruiterResumeLibrary.findOne({
    _id: resumeId,
    companyId,
  });
  if (!item) {
    const err = new Error('Resume not found');
    err.status = 404;
    throw err;
  }

  if (item.downloadUrl) {
    return {
      downloadUrl: item.downloadUrl,
      filename: '',
      resume: resumeLibraryToJSON(item),
    };
  }

  if (!item.resumeData) {
    const err = new Error('No resume file available for this application yet');
    err.status = 404;
    throw err;
  }

  const result = await buildResumeDownload(item.studentPhone, {
    companyId,
    publicBaseUrl,
    jobtitle: item.jobTitle,
    companyname: item.companyName,
    scrapedJobId: item.scrapedJobId?.toString?.() || undefined,
    resume: item.resumeData,
  });

  const downloadUrl = result?.downloadUrl || '';
  if (downloadUrl) {
    item.downloadUrl = downloadUrl;
    await item.save();
  }

  return {
    downloadUrl,
    filename: result?.filename || '',
    resume: resumeLibraryToJSON(item),
  };
}

export { escapeRegex };
