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
  const baseInstructions =
    instructions ||
    'Tailor the resume JSON for the target job. Emphasize relevant skills and experience. Keep the same JSON schema.';

  const improvementBlock = Array.isArray(improvements) && improvements.length
    ? `\nPriority improvements to address (ATS target score is 90+):\n${improvements
        .map((item, i) => `${i + 1}. ${String(item)}`)
        .join('\n')}\n`
    : '';

  const prompt = `${baseInstructions}
${improvementBlock}
Job title: ${jobTitle}
Company: ${companyName}
Job description:
${jobDescription}

Current resume JSON:
${JSON.stringify(resumeData, null, 2)}

Return ONLY the updated resume JSON object. Keep ALL existing summary bullets and skill categories unless you are expanding them. Do not drop items.
IMPORTANT: Do NOT change the "jobtitle" field — leave it exactly as in the current resume JSON. Tailor summary, skills, and experience wording for the job without renaming the candidate's target role.`;

  if (!isGeminiConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      return { resume: resumeData, source: 'mock', mock: true };
    }
    throw new Error('Gemini API key not configured');
  }

  const resume = await generateJsonWithGemini(prompt, {
    temperature: 0.3,
    maxOutputTokens: 16384,
  });
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
- improvements must be concrete and actionable for rewriting the resume (not vague advice).
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
