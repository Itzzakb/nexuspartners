import fs from 'fs';
import RecruiterResumeLibrary from '../models/RecruiterResumeLibrary.js';
import ResumeDownloadToken from '../models/ResumeDownloadToken.js';
import ScrapedJob from '../models/ScrapedJob.js';
import StudentJobAction from '../models/StudentJobAction.js';
import {
  buildResumeDocxBuffer,
  getDownloadToken,
  persistResumeDownload,
} from './resumeDocx.service.js';
import { DOWNLOAD_TOKEN_FORMAT } from '../utils/resumeDownloadToken.js';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function publicBaseUrlFromDownloadUrl(url, fallback = '') {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return String(fallback || process.env.SERVER_URL || '').replace(/\/$/, '');
  }
}

async function findLibraryForToken(token) {
  const byField = await RecruiterResumeLibrary.findOne({ downloadToken: token });
  if (byField) return byField;

  const byId = await ResumeDownloadToken.findOne({ token }).select('resumeLibraryId').lean();
  if (byId?.resumeLibraryId) {
    const linked = await RecruiterResumeLibrary.findById(byId.resumeLibraryId);
    if (linked) return linked;
  }

  return RecruiterResumeLibrary.findOne({
    downloadUrl: { $regex: `${escapeRegex(token)}$`, $options: 'i' },
  });
}

async function findActionForToken(token) {
  return StudentJobAction.findOne({
    atsResumeUrl: { $regex: `${escapeRegex(token)}$`, $options: 'i' },
  });
}

async function jobContext(scrapedJobId, fallback = {}) {
  if (!scrapedJobId) return fallback;
  const job = await ScrapedJob.findById(scrapedJobId)
    .select('jobTitle companyName description')
    .lean();
  if (!job) return fallback;
  return {
    jobTitle: fallback.jobTitle || job.jobTitle || '',
    companyName: fallback.companyName || job.companyName || '',
    jobDescription: job.description || '',
  };
}

async function persistFromLibrary(item, token, publicBaseUrl, extra = {}) {
  const details = {
    name: item.studentName || extra.name || '',
    studentname: item.studentName || extra.name || '',
    phone: item.studentPhone,
    mobile: item.studentPhone,
    email: extra.email || '',
    resume: extra.resume || item.resumeData,
  };
  const buffer = await buildResumeDocxBuffer(details, {
    companyId: item.companyId,
    jobtitle: extra.jobTitle || item.jobTitle,
    companyname: extra.companyName || item.companyName,
    jobdescription: extra.jobDescription || '',
  });
  return persistResumeDownload({
    buffer,
    details,
    publicBaseUrl,
    token,
    companyId: item.companyId,
    studentPhone: item.studentPhone,
    resumeLibraryId: item._id,
  });
}

async function rebuildFromLibrary(item, token, publicBaseUrl) {
  const ctx = await jobContext(item.scrapedJobId, {
    jobTitle: item.jobTitle,
    companyName: item.companyName,
  });
  const { buildResumeDownload } = await import('./nexusStudentApi.service.js');
  try {
    await buildResumeDownload(item.studentPhone, {
      companyId: item.companyId,
      publicBaseUrl,
      downloadToken: token,
      jobtitle: ctx.jobTitle,
      companyname: ctx.companyName,
      jobdescription: ctx.jobDescription,
      scrapedJobId: item.scrapedJobId?.toString?.() || undefined,
      resume: item.resumeData || undefined,
    });
  } catch (err) {
    if (!item.resumeData) throw err;
    await persistFromLibrary(item, token, publicBaseUrl, ctx);
  }

  if (!item.downloadToken) {
    item.downloadToken = token;
    if (!item.downloadUrl) {
      item.downloadUrl = `${publicBaseUrl.replace(/\/$/, '')}/api/resume/download/${token}`;
    }
    await item.save();
  }

  return getDownloadToken(token);
}

async function rebuildFromAction(action, token, publicBaseUrl) {
  const library = await RecruiterResumeLibrary.findOne({
    companyId: action.companyId,
    studentPhone: action.studentPhone,
    scrapedJobId: action.scrapedJobId || null,
  });
  if (library) return rebuildFromLibrary(library, token, publicBaseUrl);

  const ctx = await jobContext(action.scrapedJobId);
  const { buildResumeDownload } = await import('./nexusStudentApi.service.js');
  await buildResumeDownload(action.studentPhone, {
    companyId: action.companyId,
    publicBaseUrl,
    downloadToken: token,
    jobtitle: ctx.jobTitle,
    companyname: ctx.companyName,
    jobdescription: ctx.jobDescription,
    scrapedJobId: action.scrapedJobId?.toString?.() || undefined,
  });
  return getDownloadToken(token);
}

/**
 * Resolve a download token to a file. Tokens no longer expire.
 * If the file or token record is missing, rebuild from the stored applied resume
 * and rebind the same token so old URLs keep working.
 */
export async function resolveResumeDownload(token, options = {}) {
  const key = String(token || '').trim().toLowerCase();
  if (!DOWNLOAD_TOKEN_FORMAT.test(key)) return null;

  const existing = await getDownloadToken(key);
  if (existing?.filePath && fs.existsSync(existing.filePath)) return existing;

  const library = await findLibraryForToken(key);
  const action = library ? null : await findActionForToken(key);
  const storedUrl = library?.downloadUrl || action?.atsResumeUrl || '';
  const publicBaseUrl =
    options.publicBaseUrl ||
    publicBaseUrlFromDownloadUrl(storedUrl) ||
    process.env.SERVER_URL ||
    '';

  try {
    if (library) return await rebuildFromLibrary(library, key, publicBaseUrl);
    if (action) return await rebuildFromAction(action, key, publicBaseUrl);
  } catch (err) {
    console.error('Failed to rebuild resume for download token:', err.message);
    return existing || null;
  }

  return existing || null;
}
