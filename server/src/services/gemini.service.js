import { atsTemplateFixResumeInstructions } from '../constants/atsResumeTemplate.js';

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

async function generateJsonWithGemini(promptText, { temperature = 0.2, maxOutputTokens = 8192 } = {}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini API key not configured');

  // Google AI Studio / Generative Language API: API key auth only.
  // Use x-goog-api-key header (preferred). Do NOT send Authorization: Bearer —
  // that endpoint rejects OAuth-style credentials with ACCESS_TOKEN_TYPE_UNSUPPORTED.
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature,
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
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Empty Gemini response');

  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned);
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

/**
 * Enforce client Fix Resume policy: base summary/experience/etc. unchanged; skills may only grow.
 */
export function preserveBaseResumeWithAddedSkills(baseResume, fixedResume) {
  const out = cloneResume(baseResume);
  const fixedSkills =
    fixedResume?.techinicalskills ||
    fixedResume?.technicalskills ||
    fixedResume?.technical_skills ||
    null;

  if (Array.isArray(fixedSkills)) {
    out.techinicalskills = mergeSkillsPreservingBase(baseResume?.techinicalskills || [], fixedSkills);
  }

  // Hard restore — model must never rewrite these sections.
  if (Array.isArray(baseResume?.professionalsummary_points)) {
    out.professionalsummary_points = cloneResume(baseResume.professionalsummary_points);
  }
  if (Array.isArray(baseResume?.experience)) {
    out.experience = cloneResume(baseResume.experience);
  }
  if (Array.isArray(baseResume?.education)) {
    out.education = cloneResume(baseResume.education);
  }
  if (Array.isArray(baseResume?.certifications)) {
    out.certifications = cloneResume(baseResume.certifications);
  }

  return out;
}

const DEFAULT_FIX_RESUME_INSTRUCTIONS =
  'Preserve the base resume. Keep all professional summary bullets, experience, education, and certifications unchanged. Keep all existing technical skills. Only add skills/tools from the job description that are missing from the base technical skills.';

export async function fixResumeForJob(resumeData, jobContext, instructions = '') {
  if (!resumeData || typeof resumeData !== 'object') {
    throw new Error('Student resume data not found');
  }

  const {
    jobTitle = '',
    jobDescription = '',
    companyName = '',
    improvements = [],
  } = jobContext;

  const adminNotes = String(instructions || '').trim();
  const baseInstructions =
    adminNotes && /preserve|keep all|only add|missing/i.test(adminNotes)
      ? adminNotes
      : DEFAULT_FIX_RESUME_INSTRUCTIONS;

  const improvementBlock = Array.isArray(improvements) && improvements.length
    ? `\nOptional notes (do NOT use these to rewrite or remove base summary/experience; skills additions only if truly missing):\n${improvements
        .map((item, i) => `${i + 1}. ${String(item)}`)
        .join('\n')}\n`
    : '';

  const prompt = `${baseInstructions}
${improvementBlock}
${atsTemplateFixResumeInstructions()}

Job title: ${jobTitle}
Company: ${companyName}
Job description:
${jobDescription}

Base resume JSON (source of truth — preserve summary, experience, education, certifications, and existing skills):
${JSON.stringify(resumeData, null, 2)}

Return ONLY the full updated resume JSON object.
IMPORTANT:
- Do NOT change the "jobtitle" field.
- Do NOT rewrite professionalsummary_points or experience.
- Only augment techinicalskills with missed JD skills.`;

  if (!isGeminiConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      return {
        resume: preserveBaseResumeWithAddedSkills(resumeData, resumeData),
        source: 'mock',
        mock: true,
      };
    }
    throw new Error('Gemini API key not configured');
  }

  const generated = await generateJsonWithGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 16384,
  });
  const resume = preserveBaseResumeWithAddedSkills(resumeData, generated);
  return { resume, source: 'gemini' };
}

/** Client target: tailored resumes should reach ATS score 90+. */
export const ATS_TARGET_SCORE = 90;

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
- improvements must be concrete and actionable. Prefer missing skills/tools from the JD to add (Fix Resume only adds skills; it does not rewrite summary or experience).
- If score is ${ATS_TARGET_SCORE} or higher, improvements may be empty or only minor polish tips (max 2).
- If score is below ${ATS_TARGET_SCORE}, provide 3-6 prioritized improvements focused on missing keywords/skills.
- Do not invent work history that is not supported by the resume.

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
