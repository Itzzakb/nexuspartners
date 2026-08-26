import { atsTemplateFixResumeInstructions } from '../constants/atsResumeTemplate.js';
import { parseJsonFromLlmText, stripLlmCodeFences } from '../utils/llmJson.js';

const NEXUS_RESUME_PARSE_URL =
  process.env.NEXUS_RESUME_PARSE_URL ||
  process.env.FUTUREFLUX_RESUME_PARSE_URL ||
  'https://api.futureflux.ai/airesumeparse';

const RESUME_JSON_PROMPT = `You are extracting a resume into structured JSON. Extract EVERYTHING from the source text — do not summarize, shorten, or drop items.

Rules (critical):
- professionalsummary_points: include EVERY bullet / sentence from Professional Summary / Profile Summary / Summary. If there are 12 bullets, return 12 objects. Never cap at 3–5.
- techinicalskills: include EVERY skill category row (e.g. Programming Languages, Cloud, Databases, Tools). If there are 8 categories, return 8 objects. Never merge or drop categories.
- experience: include every role and every bullet under each role.
- education / certifications: include every entry.
- Preserve wording closely; do not invent content.
- Use UNKNOWN only when a field is truly missing.
- Return ONLY valid JSON, no markdown.

JSON template:
{
  "jobtitle": "",
  "education": [{ "visible": true, "education_title": "", "start_end": "", "university": "" }],
  "experience": [{
    "visible": true, "position": "", "location": "", "start": "", "end": "", "company": "",
    "points": [{ "point": "", "form": true }]
  }],
  "professionalsummary_points": [{ "point": "", "form": true }],
  "techinicalskills": [{ "skill_title": "", "skills": "" }],
  "certifications": [{ "visible": true, "certification_title": "" }]
}`;

export function isGeminiConfigured() {
  return !!String(process.env.GEMINI_API_KEY || '').trim();
}

/**
 * Returns the configured Gemini API key.
 * Google AI Studio keys often start with AIza..., but some project keys use other
 * prefixes (e.g. AQ.). Do not reject by prefix — let the API validate the key.
 */
function getGeminiApiKey() {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  return apiKey || null;
}

async function parseWithNexusResumeApi(text) {
  const res = await fetch(NEXUS_RESUME_PARSE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error(`Resume parse API failed (${res.status})`);
  }

  const data = await res.json();
  const parsed = data?.data?.parsed_resume ?? data?.parsed_resume ?? data;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid parse response from resume API');
  }
  return parsed;
}

async function generateJsonWithGemini(promptText, { temperature = 0.2, maxOutputTokens = 8192, retries = 1 } = {}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini API key not configured');

  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  let lastParseError;
  const attempts = Math.max(1, Number(retries) + 1);

  for (let attempt = 0; attempt < attempts; attempt++) {
    const attemptPrompt =
      attempt === 0
        ? promptText
        : `${promptText}

Your previous response was invalid JSON. Return ONLY one valid JSON object. Escape double quotes inside strings with \\". Do not truncate. No markdown.`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: attemptPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: attempt === 0 ? temperature : Math.min(temperature, 0.2),
          maxOutputTokens,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (
        res.status === 401 ||
        errText.includes('UNAUTHENTICATED') ||
        errText.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED')
      ) {
        throw new Error(
          'Gemini authentication failed. Check GEMINI_API_KEY in server/.env (from https://aistudio.google.com/apikey), then restart the server.'
        );
      }
      if (res.status === 429 || errText.includes('RESOURCE_EXHAUSTED')) {
        throw new Error(
          `Gemini quota exceeded for model "${model}". In AI Studio, check Rate limits — if that model shows 0/0, set GEMINI_MODEL=gemini-3.1-flash-lite in server/.env and restart.`
        );
      }
      throw new Error(`Gemini API failed: ${errText}`);
    }

    const data = await res.json();
    const candidate = data?.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const raw = candidate?.content?.parts?.[0]?.text;
    if (!raw) throw new Error('Empty Gemini response');

    if (finishReason === 'MAX_TOKENS') {
      lastParseError = new Error(
        'Gemini response was truncated (max tokens). Try a shorter base resume or reduce experience bullets.'
      );
    }

    try {
      return parseJsonFromLlmText(raw);
    } catch (err) {
      lastParseError = err;
      if (process.env.NODE_ENV !== 'production') {
        const preview = stripLlmCodeFences(raw);
        console.warn(
          `[gemini] JSON parse failed (attempt ${attempt + 1}/${attempts}) at`,
          err.message,
          'preview:',
          preview.slice(0, 240),
          '...',
          preview.slice(-240)
        );
      }
    }
  }

  const detail = lastParseError?.message || 'Unknown parse error';
  throw new Error(`Failed to parse AI resume JSON: ${detail}`);
}

async function parseWithGemini(text) {
  // Larger token budget so long summaries/skills are not truncated mid-JSON.
  return generateJsonWithGemini(`${RESUME_JSON_PROMPT}\n\nResume text:\n${text}`, {
    temperature: 0.1,
    maxOutputTokens: 16384,
  });
}

function countSummaryPoints(parsed) {
  const raw =
    parsed?.professionalsummary_points ||
    parsed?.professional_summary ||
    parsed?.summary ||
    parsed?.summary_points ||
    [];
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === 'string' && raw.trim()) return raw.split(/\n+/).filter(Boolean).length;
  return 0;
}

function countSkillCategories(parsed) {
  const raw =
    parsed?.techinicalskills ||
    parsed?.technicalskills ||
    parsed?.skills ||
    parsed?.technical_skills ||
    [];
  return Array.isArray(raw) ? raw.length : 0;
}

function pickRicherParse(a, b) {
  if (!a) return b;
  if (!b) return a;
  const score = (p) => countSummaryPoints(p) * 3 + countSkillCategories(p) * 2;
  return score(b) > score(a) ? b : a;
}

function cloneResume(resume) {
  return JSON.parse(JSON.stringify(resume || {}));
}

function splitSkillList(skillsStr) {
  return String(skillsStr || '')
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinSkillList(skills) {
  return skills.join(', ');
}

function normalizeSkillToken(skill) {
  return String(skill || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.]/g, '');
}

/**
 * Keep every base skill category/list; append only new skills from the model output.
 */
export function mergeSkillsPreservingBase(baseSkills = [], fixedSkills = []) {
  const result = (Array.isArray(baseSkills) ? baseSkills : []).map((row) => ({
    ...row,
    skill_title: row?.skill_title || '',
    skills: row?.skills || '',
  }));

  const titleIndex = new Map();
  result.forEach((row, i) => {
    const key = String(row.skill_title || '')
      .trim()
      .toLowerCase();
    if (key) titleIndex.set(key, i);
  });

  const globalSkills = new Set();
  result.forEach((row) => {
    splitSkillList(row.skills).forEach((skill) => {
      const token = normalizeSkillToken(skill);
      if (token) globalSkills.add(token);
    });
  });

  for (const row of Array.isArray(fixedSkills) ? fixedSkills : []) {
    const title = String(row?.skill_title || '').trim();
    const skillsStr = String(row?.skills || '').trim();
    if (!title && !skillsStr) continue;

    const titleKey = title.toLowerCase();
    if (titleKey && titleIndex.has(titleKey)) {
      const idx = titleIndex.get(titleKey);
      const existing = splitSkillList(result[idx].skills);
      const existingTokens = new Set(existing.map(normalizeSkillToken).filter(Boolean));
      for (const skill of splitSkillList(skillsStr)) {
        const token = normalizeSkillToken(skill);
        if (!token || existingTokens.has(token) || globalSkills.has(token)) continue;
        existing.push(skill);
        existingTokens.add(token);
        globalSkills.add(token);
      }
      result[idx] = { ...result[idx], skills: joinSkillList(existing) };
      continue;
    }

    const newSkills = splitSkillList(skillsStr).filter((skill) => {
      const token = normalizeSkillToken(skill);
      return token && !globalSkills.has(token);
    });
    if (!newSkills.length) continue;

    newSkills.forEach((skill) => globalSkills.add(normalizeSkillToken(skill)));
    result.push({
      ...(row && typeof row === 'object' ? row : {}),
      skill_title: title || 'Additional Skills',
      skills: joinSkillList(newSkills),
    });
    if (titleKey) titleIndex.set(titleKey, result.length - 1);
  }

  return result;
}

const SLUG_SKILL_LABELS = {
  'power-bi': 'Power BI',
  snowflake: 'Snowflake',
  cortex: 'Snowflake Cortex',
  servicenow: 'ServiceNow',
  github: 'GitHub',
  'github-copilot': 'GitHub Copilot',
  python: 'Python',
  dbt: 'dbt',
  'microsoft-azure': 'Microsoft Azure',
  'azure-data-factory': 'Azure Data Factory',
  kubernetes: 'Kubernetes',
  k8s: 'Kubernetes',
  docker: 'Docker',
  workday: 'Workday',
  prefect: 'Prefect',
};

/** Tools often named in JD body (including “plus”) but missing from skill tags. */
const JD_BODY_SKILL_PATTERNS = [
  { label: 'Prefect', re: /\bprefect\b/i },
  { label: 'Kubernetes', re: /\bkubernetes\b|\bk8s\b/i },
  { label: 'Docker', re: /\bdocker\b/i },
  { label: 'Workday', re: /\bworkday\b/i },
  { label: 'GitHub Copilot', re: /\bgithub\s*copilot\b/i },
  { label: 'Azure Data Factory', re: /\bazure\s*data\s*factory\b|\badf\b/i },
  { label: 'Snowflake Cortex', re: /\bcortex\b/i },
  { label: 'ServiceNow', re: /\bservicenow\b/i },
  { label: 'Power BI', re: /\bpower\s*bi\b/i },
  { label: 'dbt', re: /\bdbt\b/i },
];

const SKILL_TOKEN_ALIASES = {
  microsoftazure: ['azure'],
  snowflakecortex: ['cortex'],
  githubcopilot: ['copilot'],
  azuredatafactory: ['adf', 'datafactory'],
  kubernetes: ['k8s'],
  k8s: ['kubernetes'],
  powerbi: ['pbi'],
};

function labelFromTechnologySlug(slug) {
  const key = String(slug || '')
    .trim()
    .toLowerCase();
  if (!key) return '';
  if (SLUG_SKILL_LABELS[key]) return SLUG_SKILL_LABELS[key];
  return key
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => {
      if (part === 'dbt') return 'dbt';
      if (part === 'github') return 'GitHub';
      if (part === 'bi') return 'BI';
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

function skillAlreadyCovered(token, globalTokens) {
  if (!token) return true;
  const aliases = [token, ...(SKILL_TOKEN_ALIASES[token] || [])];
  for (const alias of aliases) {
    if (globalTokens.has(alias)) return true;
    if (alias.length < 4) continue;
    for (const existing of globalTokens) {
      // Existing "Azure Data Factory" already covers adding "Azure".
      // Do NOT treat existing "GitHub" as covering "GitHub Copilot".
      if (existing.length >= alias.length && existing.includes(alias)) return true;
    }
  }
  return false;
}

function suggestSkillCategory(label, rows = []) {
  const token = normalizeSkillToken(label);
  const rules = [
    {
      tokens: ['kubernetes', 'k8s', 'docker'],
      titleRe: /devops|container|cloud|platform|infrastructure|orchestration/i,
      fallback: 'DevOps & Containers',
    },
    {
      tokens: ['prefect', 'airflow', 'dbt', 'azuredatafactory', 'adf'],
      titleRe: /etl|pipeline|orchestration|transformation|data engineer/i,
      fallback: 'ETL Tools',
    },
    {
      tokens: ['snowflake', 'snowflakecortex', 'cortex'],
      titleRe: /warehouse|database|cloud|platform|data platform/i,
      fallback: 'Cloud Platforms',
    },
    {
      tokens: ['githubcopilot', 'github', 'git', 'copilot'],
      titleRe: /version|git|control|devops/i,
      fallback: 'Version Control',
    },
    {
      tokens: ['workday', 'servicenow', 'salesforce'],
      titleRe: /enterprise|application|saas|business system/i,
      fallback: 'Enterprise Applications',
    },
    {
      tokens: ['powerbi', 'tableau'],
      titleRe: /visual|bi|dashboard|reporting/i,
      fallback: 'Visualization Tools',
    },
  ];
  const rule = rules.find((r) => r.tokens.includes(token));
  if (rule) {
    const match = (Array.isArray(rows) ? rows : []).find((row) =>
      rule.titleRe.test(String(row?.skill_title || ''))
    );
    if (match?.skill_title) return match.skill_title;
    return rule.fallback;
  }
  const additional = (Array.isArray(rows) ? rows : []).find((row) =>
    /additional/i.test(String(row?.skill_title || ''))
  );
  return additional?.skill_title || 'Additional Skills';
}

export function extractRequiredJobSkills({ jobDescription = '', technologySlugs = [] } = {}) {
  const labels = [];
  const seen = new Set();
  const add = (label) => {
    const text = String(label || '').trim();
    const token = normalizeSkillToken(text);
    if (!text || !token || seen.has(token)) return;
    seen.add(token);
    labels.push(text);
  };

  for (const slug of Array.isArray(technologySlugs) ? technologySlugs : []) {
    add(labelFromTechnologySlug(slug));
  }

  const text = String(jobDescription || '');
  for (const { label, re } of JD_BODY_SKILL_PATTERNS) {
    if (re.test(text)) add(label);
  }
  for (const [slug, label] of Object.entries(SLUG_SKILL_LABELS)) {
    if (new RegExp(`\\b${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) {
      add(label);
    }
  }
  return labels;
}

export function injectMissingJobSkills(baseSkills = [], requiredLabels = []) {
  const globalTokens = new Set();
  (Array.isArray(baseSkills) ? baseSkills : []).forEach((row) => {
    splitSkillList(row?.skills).forEach((skill) => {
      const token = normalizeSkillToken(skill);
      if (token) globalTokens.add(token);
    });
  });

  const extraRows = [];
  for (const label of requiredLabels) {
    const token = normalizeSkillToken(label);
    if (skillAlreadyCovered(token, globalTokens)) continue;
    extraRows.push({
      skill_title: suggestSkillCategory(label, baseSkills),
      skills: label,
    });
    globalTokens.add(token);
  }
  if (!extraRows.length) return Array.isArray(baseSkills) ? baseSkills : [];
  return mergeSkillsPreservingBase(baseSkills, extraRows);
}

function isJunkBulletText(text) {
  const value = String(text || '').trim();
  if (!value) return true;
  return /^(true|false|null|undefined|nan)$/i.test(value);
}

function pointText(p) {
  if (p == null || typeof p === 'boolean') return '';
  const raw = typeof p === 'object' ? p.point ?? p.text ?? '' : p;
  if (typeof raw === 'boolean' || raw == null) return '';
  if (typeof raw !== 'string' && typeof raw !== 'number') return '';
  const text = String(raw).trim();
  return isJunkBulletText(text) ? '' : text;
}

function sanitizeResumeBullets(resume) {
  const next = resume && typeof resume === 'object' ? resume : {};
  if (Array.isArray(next.professionalsummary_points)) {
    next.professionalsummary_points = next.professionalsummary_points
      .filter((p) => pointText(p))
      .map((p) => ({ ...p, point: pointText(p), form: p?.form !== false }));
  }
  if (Array.isArray(next.experience)) {
    next.experience = next.experience.map((role) => ({
      ...role,
      points: Array.isArray(role?.points)
        ? role.points
            .filter((p) => pointText(p))
            .map((p) => ({ ...p, point: pointText(p), form: p?.form !== false }))
        : [],
    }));
  }
  return next;
}

export function applyDeterministicTailorFixes(resume, jobContext = {}) {
  const next = sanitizeResumeBullets(resume && typeof resume === 'object' ? resume : {});
  const required = extractRequiredJobSkills({
    jobDescription: jobContext.jobDescription || '',
    technologySlugs: jobContext.technologySlugs || jobContext.technology_slugs || [],
  });
  next.techinicalskills = injectMissingJobSkills(next.techinicalskills || [], required);
  return next;
}

/**
 * Normalize tailored output: allow rewritten summary/experience; lock structure from base.
 * - education / certifications / role metadata from base
 * - skills = base + missed JD skills
 * - summary / experience bullets from model when present
 */
export function normalizeTailoredResume(baseResume, fixedResume) {
  const base = cloneResume(baseResume);
  const fixed =
    fixedResume && typeof fixedResume === 'object' ? cloneResume(fixedResume) : {};
  const out = cloneResume(base);

  const fixedSummary = Array.isArray(fixed.professionalsummary_points)
    ? fixed.professionalsummary_points.filter((p) => pointText(p))
    : null;
  if (fixedSummary?.length) {
    out.professionalsummary_points = fixedSummary.map((p) => ({
      ...p,
      point: pointText(p),
      form: p.form !== false,
    }));
  }

  const fixedSkills =
    fixed.techinicalskills || fixed.technicalskills || fixed.technical_skills || null;
  out.techinicalskills = mergeSkillsPreservingBase(
    base.techinicalskills || [],
    Array.isArray(fixedSkills) ? fixedSkills : base.techinicalskills || []
  );

  const baseExp = Array.isArray(base.experience) ? base.experience : [];
  const fixedExp = Array.isArray(fixed.experience) ? fixed.experience : [];
  out.experience = baseExp.map((role, idx) => {
    const match =
      fixedExp[idx] ||
      fixedExp.find(
        (r) =>
          String(r?.company || '')
            .trim()
            .toLowerCase() ===
            String(role?.company || '')
              .trim()
              .toLowerCase() &&
          String(r?.position || '')
            .trim()
            .toLowerCase() ===
            String(role?.position || '')
              .trim()
              .toLowerCase()
      );
    const rewritten = Array.isArray(match?.points)
      ? match.points.filter((p) => pointText(p)).map((p) => ({
          ...p,
          point: pointText(p),
          form: p.form !== false,
        }))
      : null;
    return {
      ...role,
      company: role.company,
      position: role.position,
      location: role.location,
      start: role.start,
      end: role.end,
      visible: role.visible !== false,
      points: rewritten?.length ? rewritten : role.points || [],
    };
  });

  if (Array.isArray(base.education)) out.education = cloneResume(base.education);
  if (Array.isArray(base.certifications)) out.certifications = cloneResume(base.certifications);
  if (base.jobtitle || base.jobTitle) {
    out.jobtitle = base.jobtitle || base.jobTitle;
    delete out.jobTitle;
  }

  return out;
}

/** @deprecated Use normalizeTailoredResume — kept for callers expecting the old name. */
export function preserveBaseResumeWithAddedSkills(baseResume, fixedResume) {
  return normalizeTailoredResume(baseResume, fixedResume);
}

/** Client target: tailored resumes should reach ATS score 90+. */
export const ATS_TARGET_SCORE = 90;

const DEFAULT_FIX_RESUME_INSTRUCTIONS =
  'Tailor the base resume for the target job: rewrite professional summary bullets for JD keywords (similar count); keep all employers/dates/titles but rewrite and compress experience bullets to about half; keep education and certifications; keep existing technical skills and add missing JD skills.';

export async function fixResumeForJob(resumeData, jobContext, instructions = '') {
  if (!resumeData || typeof resumeData !== 'object') {
    throw new Error('Student resume data not found');
  }

  const {
    jobTitle = '',
    jobDescription = '',
    companyName = '',
    improvements = [],
    previousAtsScore = null,
    isRefix = false,
    structureBase = null,
    technologySlugs = [],
  } = jobContext;

  const requiredSkillLabels = extractRequiredJobSkills({
    jobDescription,
    technologySlugs,
  });
  const requiredSkillsBlock = requiredSkillLabels.length
    ? `\nREQUIRED SKILLS — every item below MUST appear in techinicalskills (append missing ones; keep existing skills). Adding them as skill keywords is required for ATS even if the base resume does not claim production experience with every tool:\n${requiredSkillLabels.map((s) => `- ${s}`).join('\n')}\n`
    : '';

  const adminNotes = String(instructions || '').trim();
  const looksLikeOldPreserveOnly =
    /preserve the base resume exactly|do not rewrite or remove base content/i.test(adminNotes) &&
    !/rewrite|compress|tailor|about half/i.test(adminNotes);
  const baseInstructions =
    adminNotes && !looksLikeOldPreserveOnly
      ? adminNotes
      : DEFAULT_FIX_RESUME_INSTRUCTIONS;

  const improvementList = Array.isArray(improvements)
    ? improvements.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  const improvementBlock = improvementList.length
    ? `\n${isRefix ? 'RE-FIX — ' : ''}Priority improvements you MUST implement in the returned resume JSON (ATS target ${ATS_TARGET_SCORE}+)${
        previousAtsScore != null ? ` (previous ATS score: ${previousAtsScore})` : ''
      }:\n${improvementList.map((item, i) => `${i + 1}. ${item}`).join('\n')}
- Address EVERY item above with concrete resume changes (summary wording, experience bullets, and/or added skills).
- Do not return an unchanged resume. The output must clearly reflect these improvements.\n`
    : '';

  const refixBlock = isRefix
    ? `\nThis is a RE-FIX of an already tailored resume. Start from the resume JSON below (not a blank rewrite from scratch), then apply the improvements and strengthen JD keyword alignment to raise the ATS score toward ${ATS_TARGET_SCORE}+.\n`
    : '';

  const prompt = `${baseInstructions}
${improvementBlock}
${refixBlock}
${atsTemplateFixResumeInstructions()}
${requiredSkillsBlock}

Job title: ${jobTitle}
Company: ${companyName}
Job description:
${jobDescription}

${isRefix ? 'Current tailored resume JSON (apply improvements to this)' : 'Base resume JSON (source of truth for employers, dates, education, certifications, and existing skills)'}:
${JSON.stringify(resumeData, null, 2)}

Return ONLY the full updated resume JSON object.
IMPORTANT:
- Do NOT change the "jobtitle" field.
- Rewrite professionalsummary_points for the job (keep a similar bullet count).
- Keep every experience role (company/title/dates); rewrite responsibility points as needed for the JD${improvementList.length ? ' and the listed improvements' : ''}.
- Every experience/summary "point" must be a real sentence. Never output boolean true/false, or the words "true"/"false", as a bullet.
- Keep education and certifications from the source resume.
- Keep existing techinicalskills and ADD every missing required skill listed above${improvementList.length ? ' plus any skills implied by the improvements' : ''}.`;

  if (!isGeminiConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      return {
        resume: applyDeterministicTailorFixes(
          normalizeTailoredResume(structureBase || resumeData, resumeData),
          { jobDescription, technologySlugs }
        ),
        source: 'mock',
        mock: true,
      };
    }
    throw new Error('Gemini API key not configured');
  }

  const generated = await generateJsonWithGemini(prompt, {
    temperature: isRefix || improvementList.length ? 0.45 : 0.35,
    maxOutputTokens: 16384,
    retries: 2,
  });
  const resume = applyDeterministicTailorFixes(
    normalizeTailoredResume(structureBase || resumeData, generated),
    { jobDescription, technologySlugs }
  );
  return { resume, source: 'gemini' };
}

/**
 * Score a resume against a job using Gemini.
 * Returns atsScore (0–100), improvements[], summary, meetsTarget.
 */
export async function scoreResumeAtsWithGemini(resumeData, jobContext = {}) {
  const { jobTitle = '', jobDescription = '', companyName = '' } = jobContext;

  const prompt = `You are an ATS (Applicant Tracking System) evaluator.
Compare the candidate resume JSON to the target job and return ONLY valid JSON:
{
  "atsScore": 0-100,
  "summary": "one short sentence about overall fit",
  "improvements": ["actionable improvement 1", "actionable improvement 2"]
}

Scoring rules:
- Be realistic and strict. Client target is ${ATS_TARGET_SCORE}+.
- Score below ${ATS_TARGET_SCORE} when keywords, skills, titles, or experience alignment are weak.
- improvements must be concrete and actionable for tailoring (rewrite summary/experience for JD keywords, add missing skills, quantify bullets when supported).
- If score is ${ATS_TARGET_SCORE} or higher, improvements may be empty or only minor polish tips (max 2).
- If score is below ${ATS_TARGET_SCORE}, provide 3-6 prioritized improvements that would raise the score.
- Do not invent work history that is not supported by the resume; suggest reframing/emphasis instead.

Job title: ${jobTitle}
Company: ${companyName}
Job description:
${jobDescription || '(none provided)'}

Resume JSON:
${JSON.stringify(resumeData || {}, null, 2)}`;

  if (!isGeminiConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      return {
        atsScore: 72,
        summary: 'Mock ATS score (Gemini not configured).',
        improvements: [
          'Align summary and skills with the job title keywords.',
          'Quantify 2–3 experience bullets with measurable outcomes.',
          'Add missing tools/technologies mentioned in the job description.',
        ],
        meetsTarget: false,
        source: 'mock',
        mock: true,
        targetScore: ATS_TARGET_SCORE,
      };
    }
    throw new Error('Gemini API key not configured');
  }

  const raw = await generateJsonWithGemini(prompt, { temperature: 0.2 });
  const atsScore = normalizeAtsScore(raw?.atsScore);
  const improvements = normalizeImprovements(raw?.improvements);
  const summary = String(raw?.summary || '').trim();

  return {
    atsScore,
    summary,
    improvements,
    meetsTarget: atsScore >= ATS_TARGET_SCORE,
    source: 'gemini',
    targetScore: ATS_TARGET_SCORE,
  };
}

function normalizeAtsScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 70;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function normalizeImprovements(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

export async function parseResumeText(text) {
  if (!text?.trim()) {
    throw new Error('Resume text is required');
  }

  let parsed = null;
  let source = 'parse';
  const errors = [];

  // Prefer Gemini when configured — external parse APIs often truncate summary/skills.
  if (isGeminiConfigured()) {
    try {
      parsed = await parseWithGemini(text);
      source = 'gemini';
    } catch (err) {
      errors.push(`gemini: ${err.message}`);
      console.warn('Gemini resume parse failed:', err.message);
    }
  }

  try {
    const nexus = await parseWithNexusResumeApi(text);
    if (!parsed) {
      parsed = nexus;
      source = 'nexuspartners';
    } else {
      const richer = pickRicherParse(parsed, nexus);
      if (richer === nexus) {
        parsed = nexus;
        source = 'nexuspartners+gemini';
      }
    }
  } catch (apiErr) {
    errors.push(`nexus: ${apiErr.message}`);
    console.warn('Nexus Partners resume parse API failed:', apiErr.message);
  }

  if (!parsed) {
    throw new Error(
      errors.length
        ? `Resume parse failed (${errors.join('; ')})`
        : 'Resume parse failed'
    );
  }

  return { parsed, source };
}
