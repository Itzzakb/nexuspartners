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
      'Tailor the student resume JSON for the target job. Emphasize relevant skills, experience bullets, and summary keywords from the job description. Keep the same JSON schema and field names. Do not invent employers or degrees.',
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
  if (item) return item.content;
  const def = DEFAULT_PROMPTS.find((p) => p.key === key);
  return def?.content || '';
}
