import { buildResumeDownload, updateStudentResume } from '../services/nexusStudentApi.service.js';

export async function buildResume(req, res) {
  try {
    const { phone, templateId } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone is required' });

    const result = await buildResumeDownload(phone, { templateId });
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Build failed' });
  }
}

export async function updateResume(req, res) {
  try {
    const { phone, resumeData } = req.body;
    if (!phone || !resumeData) {
      return res.status(400).json({ error: 'phone and resumeData are required' });
    }

    const result = await updateStudentResume(phone, resumeData);
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Update failed' });
  }
}
