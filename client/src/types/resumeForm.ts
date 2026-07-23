export interface WorkExperience {
  client: string;
  startDate: string;
  endDate: string;
  role: string;
  clientAddress: string;
  description: string;
}

export interface ProjectEntry {
  name: string;
  techStack: string;
  description: string;
  startDate: string;
  endDate: string;
}

export interface SkillCategory {
  category: string;
  skills: string;
}

export type ExperienceLevel = 'experienced' | 'fresher' | '';

export interface ResumeFormData {
  preferredName: string;
  dateOfBirth: string;
  linkedIn: string;
  resumeEmail: string;
  resumeEmailPassword: string;
  personalPhone: string;
  /** Derived full address for legacy display */
  address: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  experienceLevel: ExperienceLevel;
  workExperience: WorkExperience[];
  internships: WorkExperience[];
  projects: ProjectEntry[];
  mastersUniversity: string;
  mastersField: string;
  mastersStartDate: string;
  mastersEndDate: string;
  /** @deprecated Prefer mastersStartDate / mastersEndDate */
  mastersGraduatedMonth: string;
  /** @deprecated Prefer mastersStartDate / mastersEndDate */
  mastersGraduatedYear: string;
  bachelorsUniversity: string;
  bachelorsField: string;
  bachelorsStartDate: string;
  bachelorsEndDate: string;
  /** @deprecated Prefer bachelorsStartDate / bachelorsEndDate */
  bachelorsGraduatedMonth: string;
  /** @deprecated Prefer bachelorsStartDate / bachelorsEndDate */
  bachelorsGraduatedYear: string;
  visaStatus: string;
  dateOfArrivalUSA: string;
  /** Preferred time window for vendor calls, or "Any time" */
  vendorCallTime: string;
  certifications: string;
  preferredRole: string;
  professionalSummary: string;
  /** Serialized skill categories (Category - skills per line) for backward compatibility */
  technicalSkills: string;
  skillCategories: SkillCategory[];
  relevantCoursework: string;
  consentAccurate: boolean;
  consentEmailAccess: boolean;
  legalName: string;
  signedDate: string;
}

export interface PublicFormResponse {
  ticketId: string;
  ticketNumber: string;
  candidateName: string;
  company: {
    name: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    appTitle: string;
  };
  formData: ResumeFormData;
  resumeFormStatus: 'unfilled' | 'partial' | 'completed';
  resumeFormEditEnabled: boolean;
  locked: boolean;
}

export const VISA_OPTIONS = [
  'F-1 Visa',
  'F-1 OPT',
  'F-1 STEM OPT',
  'OPT EAD',
  'H-1B Visa',
  'H-4 EAD Visa',
  'GC (Green Card - Permanent Residency)',
  'GC EAD',
  'U.S. Citizenship',
];

export const EXPERIENCE_LEVEL_OPTIONS = [
  { value: 'experienced' as const, label: 'I have professional work experience' },
  { value: 'fresher' as const, label: 'I am a fresher / no professional experience yet' },
];

export const DEFAULT_SKILL_CATEGORIES: SkillCategory[] = [
  { category: 'Programming Languages', skills: '' },
  { category: 'Cloud Platforms & Services', skills: '' },
  { category: 'Data Engineering & ETL', skills: '' },
  { category: 'Artificial Intelligence & Machine Learning', skills: '' },
  { category: 'Generative AI & LLMs', skills: '' },
  { category: 'Databases', skills: '' },
  { category: 'Data Analysis & Visualization', skills: '' },
  { category: 'Tools & Development Environment', skills: '' },
];

export const PROFESSIONAL_SUMMARY_HINT =
  'Add 8–12 strong bullets (one per line). Lead with your target title and years of experience, then tools, domains, and measurable impact (e.g. “improved latency by 30%”).';

export const EXPERIENCE_BULLETS_HINT =
  'Add 6–10 bullets (one per line). Start with action verbs and include metrics where possible (%, time saved, scale).';

export const SKILLS_CATEGORY_HINT =
  'Fill categories used on your resume (e.g. Programming Languages — Python, SQL). Leave unused categories blank or remove them. Format on the resume: Category - skill list.';

export function emptyWorkExperience(): WorkExperience {
  return {
    client: '',
    startDate: '',
    endDate: '',
    role: '',
    clientAddress: '',
    description: '',
  };
}

export function emptyProject(): ProjectEntry {
  return { name: '', techStack: '', description: '', startDate: '', endDate: '' };
}

export function emptySkillCategory(category = ''): SkillCategory {
  return { category, skills: '' };
}

export function formatFormAddress(form: Partial<ResumeFormData>): string {
  const has = (v?: string) => v !== null && v !== undefined && String(v).trim() !== '';
  const parts = [
    form.addressLine1,
    form.addressLine2,
    [form.city, form.state, form.zipCode].filter(has).join(', '),
    form.country,
  ].filter(has);
  return parts.join('\n');
}

export function parseSkillCategoryLines(text = ''): SkillCategory[] {
  return String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)\s*[-–—:]\s*(.+)$/);
      if (match) {
        return { category: match[1].trim(), skills: match[2].trim() };
      }
      return { category: '', skills: line };
    })
    .filter((row) => row.category || row.skills);
}

export function skillCategoriesToText(categories: SkillCategory[] = []): string {
  return (categories || [])
    .filter((c) => c?.skills?.trim())
    .map((c) => {
      const cat = String(c.category || '').trim();
      const skills = String(c.skills || '').trim();
      if (cat && skills) return `${cat} - ${skills}`;
      return skills;
    })
    .join('\n');
}

export function normalizeResumeFormData(data?: Partial<ResumeFormData> | null): ResumeFormData {
  const base: ResumeFormData = {
    ...emptyResumeFormData(),
    ...(data || {}),
  };

  if (!base.addressLine1.trim() && base.address.trim()) {
    base.addressLine1 = base.address.trim();
  }

  base.workExperience =
    Array.isArray(base.workExperience) && base.workExperience.length
      ? base.workExperience.map((item) => ({ ...emptyWorkExperience(), ...item }))
      : [emptyWorkExperience()];

  base.internships =
    Array.isArray(base.internships) && base.internships.length
      ? base.internships.map((item) => ({ ...emptyWorkExperience(), ...item }))
      : [emptyWorkExperience()];

  base.projects =
    Array.isArray(base.projects) && base.projects.length
      ? base.projects.map((item) => ({ ...emptyProject(), ...item }))
      : [emptyProject()];

  if (Array.isArray(base.skillCategories) && base.skillCategories.some((c) => String(c?.skills || '').trim())) {
    base.skillCategories = base.skillCategories
      .map((c) => ({
        category: String(c?.category || '').trim(),
        skills: String(c?.skills || '').trim(),
      }))
      .filter((c) => c.category || c.skills);
  } else {
    const parsed = parseSkillCategoryLines(base.technicalSkills);
    base.skillCategories = parsed.length
      ? parsed.map((row) =>
          row.category ? row : { category: 'Technical Skills', skills: row.skills }
        )
      : DEFAULT_SKILL_CATEGORIES.map((c) => ({ ...c }));
  }

  if (!base.skillCategories.length) {
    base.skillCategories = DEFAULT_SKILL_CATEGORIES.map((c) => ({ ...c }));
  }

  const syncedSkills = skillCategoriesToText(base.skillCategories);
  base.technicalSkills = syncedSkills || base.technicalSkills || '';
  base.address = formatFormAddress(base) || base.address || '';

  if (!base.experienceLevel) {
    const hasJobs = base.workExperience.some((e) => e.client.trim() || e.role.trim());
    base.experienceLevel = hasJobs ? 'experienced' : 'fresher';
  }

  // Migrate legacy graduated month/year into end date when start/end are empty
  if (!String(base.mastersEndDate || '').trim()) {
    const legacy = [base.mastersGraduatedMonth, base.mastersGraduatedYear]
      .filter((v) => String(v || '').trim())
      .join(' ')
      .trim();
    if (legacy) base.mastersEndDate = legacy;
  }
  if (!String(base.bachelorsEndDate || '').trim()) {
    const legacy = [base.bachelorsGraduatedMonth, base.bachelorsGraduatedYear]
      .filter((v) => String(v || '').trim())
      .join(' ')
      .trim();
    if (legacy) base.bachelorsEndDate = legacy;
  }

  base.mastersStartDate = String(base.mastersStartDate || '');
  base.mastersEndDate = String(base.mastersEndDate || '');
  base.bachelorsStartDate = String(base.bachelorsStartDate || '');
  base.bachelorsEndDate = String(base.bachelorsEndDate || '');
  base.vendorCallTime = String(base.vendorCallTime || '');

  return base;
}

export function emptyResumeFormData(): ResumeFormData {
  return {
    preferredName: '',
    dateOfBirth: '',
    linkedIn: '',
    resumeEmail: '',
    resumeEmailPassword: '',
    personalPhone: '',
    address: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
    experienceLevel: '',
    workExperience: [emptyWorkExperience()],
    internships: [emptyWorkExperience()],
    projects: [emptyProject()],
    mastersUniversity: '',
    mastersField: '',
    mastersStartDate: '',
    mastersEndDate: '',
    mastersGraduatedMonth: '',
    mastersGraduatedYear: '',
    bachelorsUniversity: '',
    bachelorsField: '',
    bachelorsStartDate: '',
    bachelorsEndDate: '',
    bachelorsGraduatedMonth: '',
    bachelorsGraduatedYear: '',
    visaStatus: '',
    dateOfArrivalUSA: '',
    vendorCallTime: '',
    certifications: '',
    preferredRole: '',
    professionalSummary: '',
    technicalSkills: '',
    skillCategories: DEFAULT_SKILL_CATEGORIES.map((c) => ({ ...c })),
    relevantCoursework: '',
    consentAccurate: false,
    consentEmailAccess: false,
    legalName: '',
    signedDate: '',
  };
}

export const WORK_EXPERIENCE_NOTE = `Please highlight your previous work experience across any 3 of the following sectors:

Technology & Software – Google, Microsoft, Apple
Healthcare & Pharmaceuticals – Pfizer, Johnson & Johnson, UnitedHealth Group
Banking & Financial Services – JPMorgan Chase, Bank of America, Goldman Sachs
Retail & E-commerce – Amazon, Walmart, Target
Manufacturing & Industrial – General Motors, Boeing, 3M
Energy (Oil, Gas, Renewables) – ExxonMobil, Chevron, NextEra Energy
Telecommunications – AT&T, Verizon, T-Mobile
Education & EdTech – Coursera, Chegg, Khan Academy
Transportation & Logistics – FedEx, UPS, Tesla
Media & Entertainment – Netflix, Disney, Warner Bros.`;
