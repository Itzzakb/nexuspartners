import fs from 'fs';
import multer from 'multer';
import { buildResumeDownload, updateStudentResume } from '../services/nexusStudentApi.service.js';
import { consumeDownloadToken } from '../services/resumeDocx.service.js';
import { parseResumeText } from '../services/gemini.service.js';
import { extractTextFromResumeFile } from '../services/resumeTextExtract.service.js';
import { completeParsedResumeFromText } from '../services/resumeParseComplete.service.js';
import { enrichResumeForDownload } from '../services/resumeEnrich.service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const resumeImportUpload = upload.single('file');

function requestPublicBaseUrl(req) {
  if (process.env.SERVER_URL) return process.env.SERVER_URL.replace(/\/$/, '');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}

export async function buildResume(req, res) {
  try {
    const { phone, templateId, companyId } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone is required' });

    const targetCompanyId =
      req.user.isPlatformAdmin && companyId ? companyId : req.user.companyId._id;
    const result = await buildResumeDownload(phone, {
      templateId,
      companyId: targetCompanyId,
      publicBaseUrl: requestPublicBaseUrl(req),
    });
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Build failed' });
  }
}

export async function downloadResumeFile(req, res) {
  try {
    const entry = consumeDownloadToken(req.params.token);
    if (!entry) return res.status(404).json({ error: 'Download link expired or invalid' });
    if (!fs.existsSync(entry.filePath)) {
      return res.status(404).json({ error: 'Resume file not found' });
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${entry.filename.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(entry.filename)}`
    );
    return fs.createReadStream(entry.filePath).pipe(res);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Download failed' });
  }
}

export async function updateResume(req, res) {
  try {
    const { phone, resumeData, companyId } = req.body;
    if (!phone || !resumeData) {
      return res.status(400).json({ error: 'phone and resumeData are required' });
    }

    const targetCompanyId =
      req.user.isPlatformAdmin && companyId ? companyId : req.user.companyId._id;
    const result = await updateStudentResume(phone, resumeData, targetCompanyId);
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Update failed' });
  }
}

/**
 * Upload DOCX/PDF/TXT → extract text → parse → save student.resume (auto-save).
 * Multipart fields: phone, companyId?, file
 */
export async function importStudentResume(req, res) {
  try {
    const phone = String(req.body.phone || '').trim();
    if (!phone) return res.status(400).json({ error: 'Phone is required' });
    if (!req.file) return res.status(400).json({ error: 'Resume file is required' });

    const targetCompanyId =
      req.user.isPlatformAdmin && req.body.companyId
        ? req.body.companyId
        : req.user.companyId._id;

    const { text, sourceType } = await extractTextFromResumeFile(req.file);

    let parsed;
    let parseSource = sourceType;
    try {
      const asJson = JSON.parse(text);
      if (asJson && typeof asJson === 'object') {
        parsed = asJson.resume || asJson.parsed_resume || asJson;
        parseSource = 'json';
      }
    } catch {
      const result = await parseResumeText(text);
      parsed = result.parsed;
      parseSource = result.source || 'parse';
    }

    if (!parsed || typeof parsed !== 'object') {
      return res.status(400).json({ error: 'Could not parse resume into structured data' });
    }

    // Recover summary bullets / skill categories often truncated by parse APIs
    parsed = completeParsedResumeFromText(parsed, text);

    const { resume } = enrichResumeForDownload({
      resume: parsed,
      role: parsed.jobtitle || parsed.jobTitle || '',
      name: parsed.name || '',
    });

    await updateStudentResume(phone, resume, targetCompanyId);

    return res.json({
      success: true,
      resume,
      source: parseSource,
      filename: req.file.originalname,
      message: 'Resume imported and saved',
    });
  } catch (err) {
    console.error('Import student resume error:', err);
    return res.status(500).json({ error: err.message || 'Import failed' });
  }
}
