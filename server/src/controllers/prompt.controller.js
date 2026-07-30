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
      'Preserve the base resume exactly for professional summary, experience, education, and certifications. Keep all existing technical skills. Only add skills/tools from the job description that are missing from the base technical skills (append to matching categories or add a new category). Do not rewrite or remove base content.',
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

  // Prefer built-in Fix Resume policy if DB still has the old "tailor/rewrite" prompt.
  if (key === 'resume_fix_for_job') {
    const content = String(item?.content || '').trim();
    const looksLikePreservePolicy =
      /preserve|keep all|only add|missing from the base|do not rewrite/i.test(content);
    if (content && looksLikePreservePolicy) return content;
    return def?.content || content || '';
  }

  if (item) return item.content;
  return def?.content || '';
}
