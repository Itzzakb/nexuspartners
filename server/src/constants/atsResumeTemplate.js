/**

 * Client ATS resume shape (from recruiter/client template).

 * Fix Resume (competitor-style tailor): rewrite summary + experience for the JD,

 * keep employers/education, compress experience ~50%, add missing skills.

 */

export const ATS_RESUME_TEMPLATE = {

  sectionOrder: ['summary', 'skills', 'experience', 'education', 'certifications'],

  /** Target density when shaping long resumes; tailor may keep a similar count to base when rewriting. */

  summaryBullets: 12,

  skillCategories: 5,

  /** Responsibility bullets per experience role (newest → older) after compress/rewrite. */

  experienceBulletsByRole: [10, 9, 8],

  minExtraRoleBullets: 5,

  educationEntries: 2,

  floors: {

    summaryBullets: 8,

    skillCategories: 4,

    experienceBulletsByRole: [8, 6, 5],

    minExtraRoleBullets: 4,

  },

  writingStyle: [

    'Start bullets with strong action verbs (Builds, Implements, Designs, Develops, Applies, Uses, Performs).',

    'Include technologies and measurable impact (e.g. improved X by Y%) when supported by the base resume.',

    'Do not invent employers, degrees, or metrics not grounded in the base resume; rephrase/emphasize instead.',

  ],

};



/**

 * Competitor-style Fix Resume / tailor instructions.

 */

export function atsTemplateFixResumeInstructions() {

  const t = ATS_RESUME_TEMPLATE;

  return `

FIX RESUME / TAILOR RULES (match competitor-style tailored resumes):

- PROFESSIONAL SUMMARY: Rewrite EVERY professionalsummary_points bullet for the target job (JD keywords, tighter wording). Keep a similar bullet count to the base (do not collapse a rich summary down to only 3). Prefer about ${t.summaryBullets} strong bullets when the base is very long.

- TECHNICAL SKILLS: Keep ALL existing techinicalskills categories and skills from the base. ADD any tools/technologies required by the JD that are missing (append to a matching skill_title, or add a new category).

- PROFESSIONAL EXPERIENCE: Keep ALL employers, job titles, locations, and dates from the base. Rewrite responsibility bullets for the JD and compress to about half of the base bullet count per role (newest roles can keep more). Target about ${t.experienceBulletsByRole.join(' / ')} bullets for the first roles when the base is long; older roles keep at least ${t.minExtraRoleBullets}. Do not drop entire roles.

- EDUCATION: keep all real entries from the base unchanged.

- CERTIFICATIONS: keep all real certifications from the base unchanged.

- Do NOT change jobtitle.

- Do not invent employers, degrees, certifications, dates, or metrics not grounded in the base resume.

- Writing: ${t.writingStyle.join(' ')}

- Return the FULL resume JSON with the same schema/field names as the base resume.

`.trim();

}


