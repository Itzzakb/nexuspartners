import AppPrompt from '../models/AppPrompt.js';

const DEFAULT_PROMPTS = [
  {
    key: 'resume_parse',
    label: 'Resume Parse (Gemini)',
    content: 'Extract structured resume data as JSON with fields: name, email, phone, summary, experience, education, skills.',
  },
  {
    key: 'ats_build',
    label: 'ATS Resume Build',
    content: 'Format the resume for ATS compatibility with clear section headers and keyword optimization.',
  },
  {
    key: 'resume_fix_for_job',
    label: 'Fix Resume for Job (Recruiter)',
    content:
      'Tailor the base resume for the job like a competitor ATS tailor: rewrite all professional summary bullets for JD keywords (keep a similar count); keep all employers/dates/titles but rewrite and compress experience bullets to about half; keep education and certifications; keep existing technical skills and add any missing JD skills/tools. Do not invent employers or degrees.',
  },
];

export async function listPrompts(req, res) {
  try {
    if (!req.user.isPlatformAdmin) {
      return res.status(403).json({ error: 'Platform admin only' });
    }

    const existing = await AppPrompt.find({}).sort({ key: 1 });
    if (existing.length === 0) {
      await AppPrompt.insertMany(DEFAULT_PROMPTS);
      const seeded = await AppPrompt.find({}).sort({ key: 1 });
      return res.json({ prompts: seeded });
    }

    return res.json({ prompts: existing });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list prompts' });
  }
}

export async function updatePrompt(req, res) {
  try {
    if (!req.user.isPlatformAdmin) {
      return res.status(403).json({ error: 'Platform admin only' });
    }

    const item = await AppPrompt.findOne({ key: req.params.key });
    if (!item) return res.status(404).json({ error: 'Prompt not found' });

    if (req.body.content !== undefined) item.content = req.body.content;
    if (req.body.label !== undefined) item.label = req.body.label;
    item.updatedBy = req.user._id;
    await item.save();

    return res.json({ prompt: item });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update prompt' });
  }
}

export async function getPromptByKey(key) {
  const item = await AppPrompt.findOne({ key });
  const def = DEFAULT_PROMPTS.find((p) => p.key === key);

  // Prefer built-in competitor-style tailor policy if DB still has the old preserve-only prompt.
  if (key === 'resume_fix_for_job') {
    const content = String(item?.content || '').trim();
    const looksLikeTailorPolicy =
      /rewrite|compress|tailor|competitor|about half|jd keywords/i.test(content);
    const looksLikeOldPreserveOnly =
      /preserve the base resume exactly|do not rewrite or remove base content/i.test(content) &&
      !looksLikeTailorPolicy;
    if (content && looksLikeTailorPolicy) return content;
    if (looksLikeOldPreserveOnly) return def?.content || content || '';
    return def?.content || content || '';
  }

  if (item) return item.content;
  return def?.content || '';
}
