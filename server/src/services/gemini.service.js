const NEXUS_RESUME_PARSE_URL =
  process.env.NEXUS_RESUME_PARSE_URL ||
  process.env.FUTUREFLUX_RESUME_PARSE_URL ||
  'https://api.futureflux.ai/airesumeparse';

const RESUME_JSON_PROMPT = `Format the following text into a structured JSON format for a resume. The JSON structure should follow this template:
{
  "jobtitle": "",
  "education": [{ "visible": true, "education_title": "", "start_end": "", "university": "" }],
  "experience": [{
    "visible": true, "position": "", "location": "", "start": "", "end": "", "company": "",
    "points": [{ "point": "", "fix": true }]
  }],
  "professionalsummary_points": [{ "point": "", "fix": true }],
  "techinicalskills": [{ "skill_title": "", "skills": "" }]
}
Use UNKNOWN for missing fields. Return ONLY valid JSON, no markdown.`;

export function isGeminiConfigured() {
  return !!process.env.GEMINI_API_KEY;
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

async function generateJsonWithGemini(promptText, { temperature = 0.2 } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API failed: ${errText}`);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Empty Gemini response');

  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned);
}

async function parseWithGemini(text) {
  return generateJsonWithGemini(`${RESUME_JSON_PROMPT}\n\nResume text:\n${text}`);
}

export async function fixResumeForJob(resumeData, jobContext, instructions = '') {
  if (!resumeData || typeof resumeData !== 'object') {
    throw new Error('Student resume data not found');
  }

  const { jobTitle = '', jobDescription = '', companyName = '' } = jobContext;
  const baseInstructions =
    instructions ||
    'Tailor the resume JSON for the target job. Emphasize relevant skills and experience. Keep the same JSON schema.';

  const prompt = `${baseInstructions}

Job title: ${jobTitle}
Company: ${companyName}
Job description:
${jobDescription}

Current resume JSON:
${JSON.stringify(resumeData, null, 2)}

Return ONLY the updated resume JSON object.`;

  if (!isGeminiConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      return { resume: resumeData, source: 'mock', mock: true };
    }
    throw new Error('Gemini API key not configured');
  }

  const resume = await generateJsonWithGemini(prompt, { temperature: 0.3 });
  return { resume, source: 'gemini' };
}

export async function parseResumeText(text) {
  if (!text?.trim()) {
    throw new Error('Resume text is required');
  }

  // Prefer external resume parse API, fall back to Gemini
  try {
    return { parsed: await parseWithNexusResumeApi(text), source: 'nexuspartners' };
  } catch (apiErr) {
    console.warn('Nexus Partners resume parse API failed, trying Gemini:', apiErr.message);
    return { parsed: await parseWithGemini(text), source: 'gemini' };
  }
}
