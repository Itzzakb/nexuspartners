import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
  TabStopType,
} from 'docx';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import ResumeTemplate from '../models/ResumeTemplate.js';
import ResumeDownloadToken from '../models/ResumeDownloadToken.js';
import { isCloudinaryConfigured, uploadBuffer } from './cloudinary.service.js';
import { enrichResumeForDownload } from './resumeEnrich.service.js';
import { ATS_RESUME_TEMPLATE } from '../constants/atsResumeTemplate.js';
import { normalizeDownloadToken } from '../utils/resumeDownloadToken.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/resumes');

/** Match client sample ATS resumes (e.g. Sravani Yedoti). */
const FONT = 'Times New Roman';
/** US Letter (12240) minus 0.75" left/right margins (720 each) — right-tab for dates. */
const CONTENT_WIDTH_TWIPS = 10800;
const SIZE_NAME = 32; // 16pt
const SIZE_BODY = 22; // 11pt
const SIZE_HEADING = 22; // 11pt bold
const BULLET_REF = 'ats-resume-bullets';

/** In-process cache. Durable source of truth is ResumeDownloadToken in Mongo. */
/** @type {Map<string, { filePath: string, filename: string, cloudinaryUrl?: string }>} */
const downloadTokens = new Map();

function isVisible(item) {
  return item && item.visible !== false;
}

function pointVisible(p) {
  if (!p || p.form === false) return false;
  if (typeof p.point === 'boolean') return false;
  const text = String(p.point || '').trim();
  if (!text || /^(true|false|null|undefined|nan)$/i.test(text)) return false;
  return true;
}

function clean(value) {
  if (typeof value === 'boolean') return '';
  const s = String(value ?? '').trim();
  if (!s || s.toUpperCase() === 'UNKNOWN') return '';
  if (/^(true|false|null|undefined|nan)$/i.test(s)) return '';
  return s;
}

function stripLeadingBullet(text) {
  return clean(text).replace(/^[\s•\-\*\u2022●◦▪▸►○◆]+/, '').trim();
}

/** Section labels like PROFESSIONAL SUMMARY: */
function sectionHeading(text) {
  const label = String(text).replace(/:$/, '').trim().toUpperCase();
  return new Paragraph({
    spacing: { before: 160, after: 60 },
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
    spacing: { before: 160, after: 60 },
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
    spacing: { after: 40, line: 264 },
    numbering: { reference: BULLET_REF, level: 0 },
    children,
  });
}

function resolveResume(details, options = {}) {
  const { resume, contactExtras } = enrichResumeForDownload(details, options);
  if (options.jobtitle) resume.jobtitle = clean(options.jobtitle) || resume.jobtitle;
  // ATS exports: soft page fit after tailor (summary/experience already rewritten+compressed).
  return {
    resume: fitResumeToAtsPageBudget(resume, {
      jobTitle: options.jobtitle || resume.jobtitle || details.role || '',
      jobDescription: options.jobdescription || options.jobDescription || '',
    }),
    contactExtras,
  };
}

/**
 * Normalize + soft page budget. Prefer keeping tailored content; only shape when clearly over ~3 pages.
 */
export function fitResumeToAtsPageBudget(resume = {}, jobContext = {}) {
  const next = {
    ...resume,
    professionalsummary_points: (resume.professionalsummary_points || [])
      .filter(pointVisible)
      .map((p) => ({ ...p, point: clean(p.point) })),
    techinicalskills: (resume.techinicalskills || [])
      .filter((s) => clean(s.skill_title) || clean(s.skills))
      .map((s) => ({ ...s, skills: clean(s.skills), skill_title: clean(s.skill_title) })),
    experience: (resume.experience || [])
      .filter(isVisible)
      .map((exp) => ({
        ...exp,
        points: (exp.points || [])
          .filter(pointVisible)
          .map((p) => ({ ...p, point: clean(p.point) })),
      })),
    education: (resume.education || []).filter(isVisible),
    certifications: (resume.certifications || []).filter(
      (c) => c && c.visible !== false && clean(c.certification_title)
    ),
  };

  const MAX_LINES = 144;
  if (estimateResumeLines(next) <= MAX_LINES) return next;

  const shaped = shapeTowardAtsTemplate(next, jobContext);
  if (estimateResumeLines(shaped) <= MAX_LINES) return shaped;

  return trimNonRequiredAtsBullets(shaped, MAX_LINES, jobContext);
}

function roleBulletFloor(roleIndex, floors = false) {
  const list = floors
    ? ATS_RESUME_TEMPLATE.floors.experienceBulletsByRole
    : ATS_RESUME_TEMPLATE.experienceBulletsByRole;
  if (roleIndex < list.length) return list[roleIndex];
  return floors
    ? ATS_RESUME_TEMPLATE.floors.minExtraRoleBullets
    : ATS_RESUME_TEMPLATE.minExtraRoleBullets;
}

/** When clearly over template density, prefer template targets before page-trim. */
function shapeTowardAtsTemplate(resume, jobContext = {}) {
  const jobTokens = buildJobTokenSet(jobContext);
  const next = {
    ...resume,
    professionalsummary_points: [...(resume.professionalsummary_points || [])],
    techinicalskills: [...(resume.techinicalskills || [])],
    experience: (resume.experience || []).map((exp) => ({
      ...exp,
      points: [...(exp.points || [])],
    })),
    education: [...(resume.education || [])],
    certifications: [...(resume.certifications || [])],
  };

  const targetSummary = ATS_RESUME_TEMPLATE.summaryBullets;
  if (next.professionalsummary_points.length > targetSummary + 2) {
    next.professionalsummary_points = rankByAtsRelevance(
      next.professionalsummary_points,
      (p) => p.point,
      jobTokens
    ).slice(0, Math.max(targetSummary, ATS_RESUME_TEMPLATE.floors.summaryBullets));
  }

  const targetSkills = ATS_RESUME_TEMPLATE.skillCategories;
  if (next.techinicalskills.length > targetSkills + 2) {
    next.techinicalskills = rankByAtsRelevance(
      next.techinicalskills,
      (s) => [clean(s.skill_title), clean(s.skills)].filter(Boolean).join(' '),
      jobTokens
    ).slice(0, Math.max(targetSkills, ATS_RESUME_TEMPLATE.floors.skillCategories));
  }

  next.experience = next.experience.map((exp, idx) => {
    const maxBullets = roleBulletFloor(idx, false);
    if ((exp.points || []).length <= maxBullets + 2) return exp;
    return {
      ...exp,
      points: rankByAtsRelevance(exp.points || [], (p) => p.point, jobTokens).slice(
        0,
        Math.max(maxBullets, roleBulletFloor(idx, true))
      ),
    };
  });

  if (next.education.length > ATS_RESUME_TEMPLATE.educationEntries + 1) {
    next.education = next.education.slice(0, ATS_RESUME_TEMPLATE.educationEntries);
  }

  return next;
}

function rankByAtsRelevance(items, textFn, jobTokens) {
  return [...items]
    .map((item, index) => ({
      item,
      index,
      score: atsRelevanceScore(textFn(item), jobTokens),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.item);
}

function estimateWrappedLines(text, charsPerLine = 92) {
  const s = clean(text);
  if (!s) return 0;
  return Math.max(1, Math.ceil(s.length / charsPerLine));
}

function estimateResumeLines(resume) {
  let lines = 6; // name + email + phone + title + spacing

  const summary = (resume.professionalsummary_points || []).filter(pointVisible);
  if (summary.length) {
    lines += 2;
    for (const p of summary) lines += estimateWrappedLines(p.point);
  }

  const skills = (resume.techinicalskills || []).filter(
    (s) => clean(s.skill_title) || clean(s.skills)
  );
  if (skills.length) {
    lines += 2;
    for (const s of skills) {
      lines += estimateWrappedLines(
        [clean(s.skill_title), clean(s.skills)].filter(Boolean).join(' - ')
      );
    }
  }

  const experience = (resume.experience || []).filter(isVisible);
  if (experience.length) {
    lines += 2;
    for (const exp of experience) {
      lines += 3; // company/dates + role + Responsibilities:
      for (const p of (exp.points || []).filter(pointVisible)) {
        lines += estimateWrappedLines(p.point);
      }
    }
  }

  const education = (resume.education || []).filter(isVisible);
  if (education.length) {
    lines += 2;
    lines += education.length * 2;
  }

  const certs = (resume.certifications || []).filter(
    (c) => c && c.visible !== false && clean(c.certification_title)
  );
  if (certs.length) {
    lines += 2;
    for (const c of certs) lines += estimateWrappedLines(c.certification_title);
  }

  return lines;
}

const ATS_STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'with',
  'by',
  'at',
  'from',
  'as',
  'is',
  'are',
  'be',
  'this',
  'that',
  'will',
  'you',
  'your',
  'our',
  'we',
  'they',
  'their',
  'using',
  'used',
  'work',
  'works',
  'working',
  'team',
  'experience',
  'years',
  'year',
  'role',
  'job',
  'ability',
  'strong',
  'good',
  'including',
  'etc',
]);

function tokenizeForAts(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !ATS_STOP_WORDS.has(t));
}

function atsRelevanceScore(text, jobTokens) {
  const tokens = tokenizeForAts(text);
  if (!tokens.length) return 0;
  if (!jobTokens.size) return 0.25; // no JD: treat as weakly required; prefer keeping earlier items via index bias elsewhere
  let hits = 0;
  for (const t of tokens) {
    if (jobTokens.has(t)) hits += 1;
  }
  return hits / tokens.length;
}

function buildJobTokenSet(jobContext = {}) {
  const blob = `${jobContext.jobTitle || ''} ${jobContext.jobDescription || ''}`;
  return new Set(tokenizeForAts(blob));
}

/**
 * Over page budget: remove bullets/skills least required for the ATS job match.
 * Keep certifications and every experience role (including older roles).
 */
function trimNonRequiredAtsBullets(resume, maxLines, jobContext = {}) {
  const jobTokens = buildJobTokenSet(jobContext);
  const next = {
    ...resume,
    professionalsummary_points: [...(resume.professionalsummary_points || [])],
    techinicalskills: [...(resume.techinicalskills || [])],
    experience: (resume.experience || []).map((exp) => ({
      ...exp,
      points: [...(exp.points || [])],
    })),
    education: [...(resume.education || [])],
    certifications: [...(resume.certifications || [])],
  };

  const stillOver = () => estimateResumeLines(next) > maxLines;

  const removable = [];

  next.professionalsummary_points.forEach((p, index) => {
    removable.push({
      kind: 'summary',
      index,
      score: atsRelevanceScore(p.point, jobTokens),
      // Prefer cutting later/weaker items when scores tie
      order: index,
    });
  });

  next.experience.forEach((exp, expIndex) => {
    (exp.points || []).forEach((p, pointIndex) => {
      removable.push({
        kind: 'experience',
        expIndex,
        pointIndex,
        score: atsRelevanceScore(p.point, jobTokens),
        order: expIndex * 100 + pointIndex,
      });
    });
  });

  next.techinicalskills.forEach((s, index) => {
    const text = [clean(s.skill_title), clean(s.skills)].filter(Boolean).join(' ');
    removable.push({
      kind: 'skill',
      index,
      score: atsRelevanceScore(text, jobTokens),
      order: index,
    });
  });

  // Lowest ATS relevance first; never touch certs / roles / education here.
  removable.sort((a, b) => a.score - b.score || b.order - a.order);

  const removedSummary = new Set();
  const removedSkills = new Set();
  const removedExpPoints = new Map(); // expIndex -> Set(pointIndex)

  for (const item of removable) {
    if (!stillOver()) break;

    if (item.kind === 'summary') {
      const kept = next.professionalsummary_points.filter((_, i) => !removedSummary.has(i)).length;
      if (kept <= ATS_RESUME_TEMPLATE.floors.summaryBullets) continue;
      removedSummary.add(item.index);
    } else if (item.kind === 'skill') {
      const kept = next.techinicalskills.filter((_, i) => !removedSkills.has(i)).length;
      if (kept <= ATS_RESUME_TEMPLATE.floors.skillCategories) continue;
      removedSkills.add(item.index);
    } else if (item.kind === 'experience') {
      const points = next.experience[item.expIndex]?.points || [];
      const removedSet = removedExpPoints.get(item.expIndex) || new Set();
      const kept = points.filter((_, i) => !removedSet.has(i)).length;
      if (kept <= roleBulletFloor(item.expIndex, true)) continue;
      removedSet.add(item.pointIndex);
      removedExpPoints.set(item.expIndex, removedSet);
    }
  }

  next.professionalsummary_points = next.professionalsummary_points.filter(
    (_, i) => !removedSummary.has(i)
  );
  next.techinicalskills = next.techinicalskills.filter((_, i) => !removedSkills.has(i));
  next.experience = next.experience.map((exp, expIndex) => {
    const removedSet = removedExpPoints.get(expIndex);
    if (!removedSet?.size) return exp;
    return {
      ...exp,
      points: (exp.points || []).filter((_, i) => !removedSet.has(i)),
    };
  });

  // Last resort: keep cutting lowest-ATS-relevance bullets only — never roles/certs.
  while (stillOver()) {
    let cut = false;

    if (next.professionalsummary_points.length > ATS_RESUME_TEMPLATE.floors.summaryBullets) {
      let worstIdx = 0;
      let worstScore = Infinity;
      next.professionalsummary_points.forEach((p, i) => {
        const score = atsRelevanceScore(p.point, jobTokens);
        if (score < worstScore) {
          worstScore = score;
          worstIdx = i;
        }
      });
      next.professionalsummary_points.splice(worstIdx, 1);
      cut = true;
    }

    if (!stillOver()) break;

    let worst = null;
    next.experience.forEach((exp, expIndex) => {
      const points = exp.points || [];
      const minKeep = roleBulletFloor(expIndex, true);
      if (points.length <= minKeep) return;
      points.forEach((p, pointIndex) => {
        const score = atsRelevanceScore(p.point, jobTokens);
        if (!worst || score < worst.score) {
          worst = { expIndex, pointIndex, score };
        }
      });
    });
    if (worst) {
      next.experience[worst.expIndex].points.splice(worst.pointIndex, 1);
      cut = true;
    }

    if (!cut) break;
  }

  return next;
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

    // Company left + dates right on one line (right tab at content edge)
    if (company || dates) {
      paras.push(
        new Paragraph({
          spacing: { before: 120, after: 40 },
          tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH_TWIPS }],
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
  const paras = [sectionHeading('Education')];

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
  const defaults = [...ATS_RESUME_TEMPLATE.sectionOrder];
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
  if (!fromTemplate.includes('certifications') && SECTION_BUILDERS.certifications) {
    fromTemplate.push('certifications');
  }
  return fromTemplate.length ? fromTemplate : defaults;
}

function packetHeading(text) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: SIZE_HEADING,
        font: FONT,
        color: '000000',
      }),
    ],
  });
}

function htmlToPlainParagraphs(html) {
  const raw = String(html || '');
  if (!raw.trim()) return [];
  const withBreaks = raw
    .replace(/\r\n/g, '\n')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|h[1-6]|tr|li)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return withBreaks
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
}

const PACKET_INTERVIEW_QUESTIONS = [
  'Can you walk me through your background?',
  'What do you know about our company and what we do?',
  'Why do you think this role aligns well with your skills and experience?',
];

async function buildResumeBodyParagraphs(details, options = {}) {
  const { resume } = resolveResume(details, options);
  const name = clean(details.name || details.studentname) || 'Candidate';
  const jobTitle = clean(resume.jobtitle) || clean(details.role);
  const sections = await resolveSections(options.templateId, options.companyId);

  const children = [
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
  if (email || phone) {
    const parts = [];
    if (email) {
      parts.push(new TextRun({ text: 'Email: ', bold: true, size: SIZE_BODY, font: FONT }));
      parts.push(new TextRun({ text: email, size: SIZE_BODY, font: FONT }));
    }
    if (email && phone) {
      parts.push(new TextRun({ text: ' | ', size: SIZE_BODY, font: FONT }));
    }
    if (phone) {
      parts.push(new TextRun({ text: 'Mobile: ', bold: true, size: SIZE_BODY, font: FONT }));
      parts.push(new TextRun({ text: phone, size: SIZE_BODY, font: FONT }));
    }
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: parts,
      })
    );
  }

  if (jobTitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 60, after: 60 },
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

  children.push(
    new Paragraph({
      spacing: { before: 40, after: 160 },
      border: {
        bottom: {
          color: '000000',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 12,
        },
      },
      children: [],
    })
  );

  for (const key of sections) {
    children.push(...SECTION_BUILDERS[key](resume));
  }

  return children;
}

function packResumeDocument(children) {
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

export async function buildResumeDocxBuffer(details, options = {}) {
  const children = await buildResumeBodyParagraphs(details, options);
  return packResumeDocument(children);
}

/** Admin Search Resume packet: job header + JD + applied resume (matches sample DOCX). */
export async function buildAppliedResumePacketDocxBuffer(details, options = {}) {
  const company = clean(options.companyname || options.companyName);
  const jobTitle = clean(options.jobtitle || options.jobTitle || details.role);
  const header = [company, jobTitle].filter(Boolean).join(' – ');
  const jdLines = htmlToPlainParagraphs(options.jobdescription || options.jobDescription || '');
  const resumeParas = await buildResumeBodyParagraphs(details, options);

  const children = [];
  if (header) {
    children.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: header,
            bold: true,
            size: SIZE_NAME,
            font: FONT,
            color: '000000',
          }),
        ],
      })
    );
  }

  children.push(packetHeading('Job Description'));
  if (jdLines.length) {
    for (const line of jdLines) {
      if (/^[•\-\*]\s+/.test(line)) {
        const item = bullet(line);
        if (item) children.push(item);
      } else {
        children.push(bodyPara(line, { spacing: { after: 80 } }));
      }
    }
  } else {
    children.push(bodyPara('Job description is not available for this application.'));
  }

  children.push(packetHeading('Application Resume'));
  children.push(...resumeParas);

  children.push(packetHeading('Please prepare responses for the questions listed below'));
  for (const question of PACKET_INTERVIEW_QUESTIONS) {
    const item = bullet(`"${question}"`);
    if (item) children.push(item);
  }

  return packResumeDocument(children);
}

export function packetDownloadFilename(jobTitle, jobNumericId) {
  const title = String(jobTitle || 'Applied_Resume')
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
  const id = String(jobNumericId || '').replace(/\D/g, '');
  return `${title || 'Applied_Resume'}${id ? `_${id}` : ''}.docx`;
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

function sanitizeDownloadFilename(name) {
  let filename = String(name || 'Resume.docx')
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!filename) filename = 'Resume.docx';
  if (!/\.docx$/i.test(filename)) filename = `${filename}.docx`;
  return filename.slice(0, 180);
}

export async function ensureResumeUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function toTokenEntry(doc) {
  if (!doc) return null;
  return {
    filePath: doc.filePath,
    filename: doc.filename,
    cloudinaryUrl: doc.cloudinaryUrl || '',
  };
}

export async function registerDownloadToken(filePath, filename, extra = {}) {
  const token = normalizeDownloadToken(extra.token) || crypto.randomBytes(24).toString('hex');
  const $set = { filePath, filename };
  if (extra.cloudinaryUrl) $set.cloudinaryUrl = extra.cloudinaryUrl;
  if (extra.companyId) $set.companyId = extra.companyId;
  if (extra.studentPhone) $set.studentPhone = extra.studentPhone;
  if (extra.resumeLibraryId) $set.resumeLibraryId = extra.resumeLibraryId;

  downloadTokens.set(token, toTokenEntry({ ...$set, filename, filePath }));
  await ResumeDownloadToken.findOneAndUpdate(
    { token },
    { $set },
    { upsert: true, new: true }
  );
  return token;
}

export async function getDownloadToken(token) {
  const key = normalizeDownloadToken(token);
  if (!key) return null;
  const cached = downloadTokens.get(key);
  if (cached) return cached;
  const doc = await ResumeDownloadToken.findOne({ token: key }).lean();
  if (!doc) return null;
  const entry = toTokenEntry(doc);
  downloadTokens.set(key, entry);
  return entry;
}

/** @deprecated Use getDownloadToken — tokens are long-lived and no longer consumed. */
export async function consumeDownloadToken(token) {
  return getDownloadToken(token);
}

export async function persistResumeDownload({
  buffer,
  details,
  publicBaseUrl,
  token: existingToken,
  companyId,
  studentPhone,
  resumeLibraryId,
  filename: filenameOverride,
}) {
  await ensureResumeUploadDir();
  const filename = sanitizeDownloadFilename(
    filenameOverride || safeFilename(details.name || details.studentname)
  );
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

  const token = await registerDownloadToken(filePath, filename, {
    token: existingToken,
    cloudinaryUrl,
    companyId,
    studentPhone: studentPhone || details.phone || details.mobile || '',
    resumeLibraryId,
  });
  const localUrl = `${publicBaseUrl.replace(/\/$/, '')}/api/resume/download/${token}`;

  return {
    filename,
    downloadUrl: localUrl,
    localDownloadUrl: localUrl,
    cloudinaryUrl,
    filePath,
    token,
  };
}

export { UPLOAD_DIR };
