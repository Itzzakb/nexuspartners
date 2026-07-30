/**
 * Client ATS resume shape (from recruiter/client template).
 * Fix Resume: keep full base summary / experience / skills; only add missing JD skills.
 * DOCX export uses section order; it must not strip preserved base content.
 */
export const ATS_RESUME_TEMPLATE = {
  sectionOrder: ['summary', 'skills', 'experience', 'education', 'certifications'],
  summaryBullets: 8,
  skillCategories: 4,
  /** Responsibility bullets per experience role (newest → older). Extra roles keep at least minExtraRoleBullets. */
  experienceBulletsByRole: [8, 5, 3],
  minExtraRoleBullets: 3,
  educationEntries: 2,
  /** Soft floors when over page budget — never collapse like 12 → 3. */
  floors: {
    summaryBullets: 6,
    skillCategories: 4,
    experienceBulletsByRole: [5, 3, 2],
    minExtraRoleBullets: 2,
  },
  writingStyle: [
    'Start bullets with strong action verbs (Builds, Implements, Designs, Develops, Applies, Uses, Performs).',
    'Include technologies and measurable impact (e.g. improved X by Y%) when supported by the base resume.',
    'Do not invent employers, degrees, or metrics not grounded in the base resume; rephrase/emphasize instead.',
  ],
};

/**
 * Fix Resume policy: preserve base resume substance; only add missing JD skills.
 */
export function atsTemplateFixResumeInstructions() {
  return `
FIX RESUME RULES (strict — client requirement):
- Keep ALL professionalsummary_points from the base resume exactly as-is (do not rewrite, shorten, reorder, or drop any).
- Keep ALL experience roles and ALL responsibility bullets from the base resume exactly as-is.
- Keep ALL existing techinicalskills categories and skill lists from the base resume.
- ONLY add extra skills/tools/technologies that the job description requires but are missing from the base technical skills.
  Prefer appending missed skills into an existing matching skill_title category; otherwise add a new category (e.g. "Additional Skills").
- Do not invent employers, degrees, certifications, dates, or metrics.
- Do not change jobtitle, education, or certifications.
- Return the FULL resume JSON with the same schema/field names as the base resume.
`.trim();
}
