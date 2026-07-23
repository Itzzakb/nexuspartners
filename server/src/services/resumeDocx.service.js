import {
  AlignmentType,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
  TabStopType,
  TabStopPosition,
} from 'docx';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import ResumeTemplate from '../models/ResumeTemplate.js';
import { isCloudinaryConfigured, uploadBuffer } from './cloudinary.service.js';
import { enrichResumeForDownload } from './resumeEnrich.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/resumes');

/** Match client sample ATS resumes (e.g. Sravani Yedoti). */
const FONT = 'Times New Roman';
const SIZE_NAME = 32; // 16pt
const SIZE_BODY = 22; // 11pt
const SIZE_HEADING = 22; // 11pt bold
const BULLET_REF = 'ats-resume-bullets';

/** @type {Map<string, { filePath: string, filename: string, expiresAt: number }>} */
const downloadTokens = new Map();
const TOKEN_TTL_MS = 15 * 60 * 1000;

function isVisible(item) {
  return item && item.visible !== false;
}

function pointVisible(p) {
  return p && p.form !== false && String(p.point || '').trim();
}

function clean(value) {
  const s = String(value ?? '').trim();
  if (!s || s.toUpperCase() === 'UNKNOWN') return '';
  return s;
}

function stripLeadingBullet(text) {
  return clean(text).replace(/^[\s•\-\*\u2022●◦▪▸►○◆]+/, '').trim();
}

/** Section labels like PROFESSIONAL SUMMARY: */
function sectionHeading(text) {
  const label = String(text).replace(/:$/, '').trim().toUpperCase();
  return new Paragraph({
    spacing: { before: 240, after: 80 },
    children: [
      new TextRun({
        text: `${label}:`,
        bold: true,
        size: SIZE_HEADING,
        font: FONT,
        color: '000000',
      }),
    ],
  });
}

/** Title-case section (Educational Details:) as in the sample */
function sectionHeadingTitleCase(text) {
  const label = String(text).replace(/:$/, '').trim();
  return new Paragraph({
    spacing: { before: 240, after: 80 },
    children: [
      new TextRun({
        text: `${label}:`,
        bold: true,
        size: SIZE_HEADING,
        font: FONT,
        color: '000000',
      }),
    ],
  });
}

function bodyPara(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 40 },
    ...opts,
    children: [
      new TextRun({
        text,
        size: SIZE_BODY,
        font: FONT,
        ...opts.run,
      }),
    ],
  });
}

/** Real Word bullet list item (ATS-friendly, matches sample). */
function bullet(text, { boldPrefix = '', boldAll = false } = {}) {
  const content = stripLeadingBullet(text);
  if (!content) return null;

  const children = [];
  if (boldPrefix) {
    children.push(
      new TextRun({ text: boldPrefix, bold: true, size: SIZE_BODY, font: FONT })
    );
    children.push(
      new TextRun({ text: content, bold: boldAll, size: SIZE_BODY, font: FONT })
    );
  } else {
    children.push(
      new TextRun({ text: content, bold: boldAll, size: SIZE_BODY, font: FONT })
    );
  }

  return new Paragraph({
    spacing: { after: 60, line: 276 },
    numbering: { reference: BULLET_REF, level: 0 },
    children,
  });
}

function resolveResume(details, options = {}) {
  const { resume, contactExtras } = enrichResumeForDownload(details, options);
  if (options.jobtitle) resume.jobtitle = clean(options.jobtitle) || resume.jobtitle;
  return { resume, contactExtras };
}

function labeledContactLine(label, value) {
  if (!clean(value)) return null;
  return new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: SIZE_BODY, font: FONT }),
      new TextRun({ text: clean(value), size: SIZE_BODY, font: FONT }),
    ],
  });
}

function buildSummaryParagraphs(resume) {
  const points = (resume.professionalsummary_points || []).filter(pointVisible);
  if (!points.length) return [];
  return [
    sectionHeading('Professional Summary'),
    ...points.map((p) => bullet(clean(p.point))).filter(Boolean),
  ];
}

function buildExperienceParagraphs(resume) {
  const items = (resume.experience || []).filter(isVisible);
  if (!items.length) return [];
  const paras = [sectionHeading('Professional Experience')];

  for (const exp of items) {
    const company = clean(exp.company);
    const dates = [clean(exp.start), clean(exp.end)].filter(Boolean).join(' – ');
    const role = clean(exp.position);

    // Company + dates on one line (dates right-aligned via tab), both bold — sample style
    if (company || dates) {
      paras.push(
        new Paragraph({
          spacing: { before: 160, after: 40 },
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.RIGHT }],
          children: [
            new TextRun({
              text: company || 'Experience',
              bold: true,
              size: SIZE_BODY,
              font: FONT,
            }),
            ...(dates
              ? [
                  new TextRun({ text: '\t', size: SIZE_BODY, font: FONT }),
                  new TextRun({ text: dates, bold: true, size: SIZE_BODY, font: FONT }),
                ]
              : []),
          ],
        })
      );
    }

    if (role) {
      paras.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: role, bold: true, size: SIZE_BODY, font: FONT })],
        })
      );
    }

    paras.push(
      new Paragraph({
        spacing: { before: 20, after: 40 },
        children: [
          new TextRun({ text: 'Responsibilities:', bold: true, size: SIZE_BODY, font: FONT }),
        ],
      })
    );

    for (const p of (exp.points || []).filter(pointVisible)) {
      const item = bullet(clean(p.point));
      if (item) paras.push(item);
    }
  }
  return paras;
}

function buildEducationParagraphs(resume) {
  const items = (resume.education || []).filter(isVisible);
  if (!items.length) return [];
  const paras = [sectionHeadingTitleCase('Educational Details')];

  for (const edu of items) {
    const degree = clean(edu.education_title);
    const university = clean(edu.university);
    const dates = clean(edu.start_end);

    if (degree || university) {
      // Sample: "Master’s in Computer Science  -  Pace University" (degree bold)
      paras.push(
        new Paragraph({
          spacing: { before: 60, after: 40 },
          children: [
            ...(degree
              ? [
                  new TextRun({
                    text: university ? `${degree}  -  ` : degree,
                    bold: true,
                    size: SIZE_BODY,
                    font: FONT,
                  }),
                ]
              : []),
            ...(university
              ? [new TextRun({ text: university, size: SIZE_BODY, font: FONT })]
              : []),
          ],
        })
      );
    }

    if (dates) {
      paras.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: dates, size: SIZE_BODY, font: FONT })],
        })
      );
    }
  }
  return paras;
}

function buildSkillsParagraphs(resume) {
  const items = (resume.techinicalskills || []).filter(
    (s) => clean(s.skill_title) || clean(s.skills)
  );
  if (!items.length) return [];
  const paras = [sectionHeading('Technical Skills')];

  for (const skill of items) {
    const label = clean(skill.skill_title);
    const value = clean(skill.skills);
    if (label && value) {
      // Sample: bold "Programming Languages -  " then normal skill list
      const item = bullet(value, { boldPrefix: `${label} -  ` });
      if (item) paras.push(item);
    } else {
      const text = label || value;
      const item = bullet(text);
      if (item) paras.push(item);
    }
  }
  return paras;
}

function buildCertificationsParagraphs(resume) {
  const items = (resume.certifications || []).filter(
    (c) => c && c.visible !== false && clean(c.certification_title)
  );
  if (!items.length) return [];
  return [
    sectionHeading('Certifications'),
    ...items.map((c) => bullet(clean(c.certification_title))).filter(Boolean),
  ];
}

const SECTION_BUILDERS = {
  summary: buildSummaryParagraphs,
  experience: buildExperienceParagraphs,
  education: buildEducationParagraphs,
  skills: buildSkillsParagraphs,
  certifications: buildCertificationsParagraphs,
};

async function resolveSections(templateId, companyId) {
  // Sample order: Summary → Skills → Experience → Education
  const defaults = ['summary', 'skills', 'experience', 'education', 'certifications'];
  if (!templateId && !companyId) return defaults;

  let template = null;
  if (templateId) {
    template = await ResumeTemplate.findById(templateId);
  } else if (companyId) {
    template = await ResumeTemplate.findOne({ companyId, isDefault: true });
  }

  if (!template?.sections?.length) return defaults;
  const fromTemplate = template.sections
    .map((s) => String(s).toLowerCase().trim())
    .filter((s) => SECTION_BUILDERS[s]);
  if (!fromTemplate.includes('certifications')) fromTemplate.push('certifications');
  return fromTemplate.length ? fromTemplate : defaults;
}

export async function buildResumeDocxBuffer(details, options = {}) {
  const { resume } = resolveResume(details, options);
  const name = clean(details.name || details.studentname) || 'Candidate';
  const jobTitle = clean(resume.jobtitle) || clean(details.role);
  const sections = await resolveSections(options.templateId, options.companyId);

  const children = [
    // Name — bold, preserve casing (sample is not ALL CAPS)
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: name,
          bold: true,
          size: SIZE_NAME,
          font: FONT,
          color: '000000',
        }),
      ],
    }),
  ];

  const email = clean(details.email);
  const phone = clean(details.phone || details.mobile);
  const emailLine = labeledContactLine('Email', email);
  const phoneLine = labeledContactLine('Mobile', phone);
  if (emailLine) children.push(emailLine);
  if (phoneLine) children.push(phoneLine);

  if (jobTitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 60, after: 120 },
        children: [
          new TextRun({
            text: jobTitle,
            bold: true,
            size: SIZE_HEADING,
            font: FONT,
            color: '000000',
          }),
        ],
      })
    );
  }

  for (const key of sections) {
    children.push(...SECTION_BUILDERS[key](resume));
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: BULLET_REF,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            // ~0.75" margins — clean ATS look like the client sample
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children:
          children.length > 0
            ? children
            : [bodyPara('No resume content available for this student.')],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function formatDownloadDateTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function safeFilename(name) {
  const studentName = clean(name)
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  const dateTime = formatDownloadDateTime();
  return `${studentName || 'Resume'} - ${dateTime}.docx`;
}

export async function ensureResumeUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export function registerDownloadToken(filePath, filename) {
  const token = crypto.randomBytes(24).toString('hex');
  downloadTokens.set(token, {
    filePath,
    filename,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });
  return token;
}

export function consumeDownloadToken(token) {
  const entry = downloadTokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    downloadTokens.delete(token);
    return null;
  }
  return entry;
}

export async function persistResumeDownload({ buffer, details, publicBaseUrl }) {
  await ensureResumeUploadDir();
  const filename = safeFilename(details.name || details.studentname);
  const storedName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]+/g, '_')}`;
  const filePath = path.join(UPLOAD_DIR, storedName);
  await fs.writeFile(filePath, buffer);

  let cloudinaryUrl = '';

  if (isCloudinaryConfigured()) {
    try {
      const uploaded = await uploadBuffer(buffer, 'nexuspartners/resumes', {
        resource_type: 'raw',
        format: 'docx',
      });
      cloudinaryUrl = uploaded?.secure_url || '';
    } catch {
      // fall through to local token URL
    }
  }

  const token = registerDownloadToken(filePath, filename);
  const localUrl = `${publicBaseUrl.replace(/\/$/, '')}/api/resume/download/${token}`;

  return {
    filename,
    downloadUrl: localUrl,
    localDownloadUrl: localUrl,
    cloudinaryUrl,
    filePath,
  };
}

export { UPLOAD_DIR };
