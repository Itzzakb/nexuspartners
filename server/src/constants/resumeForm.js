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
  { value: 'experienced', label: 'I have professional work experience' },
  { value: 'fresher', label: 'I am a fresher / no professional experience yet' },
];

/** Suggested skill categories matching Nexus Partners resume templates. */
export const DEFAULT_SKILL_CATEGORIES = [
  { category: 'Programming Languages', skills: '' },
  { category: 'Cloud Platforms & Services', skills: '' },
  { category: 'Data Engineering & ETL', skills: '' },
  { category: 'Artificial Intelligence & Machine Learning', skills: '' },
  { category: 'Generative AI & LLMs', skills: '' },
  { category: 'Databases', skills: '' },
  { category: 'Data Analysis & Visualization', skills: '' },
  { category: 'Tools & Development Environment', skills: '' },
];

export const WORK_EXPERIENCE_SECTOR_NOTE = `Please highlight your previous work experience across any 3 of the following sectors:

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

export const PROFESSIONAL_SUMMARY_HINT =
  'Add 8–12 strong bullets (one per line). Lead with your target title and years of experience, then tools, domains, and measurable impact (e.g. “improved latency by 30%”).';

export const EXPERIENCE_BULLETS_HINT =
  'Add 6–10 bullets (one per line). Start with action verbs and include metrics where possible (%, time saved, scale).';

export const SKILLS_CATEGORY_HINT =
  'Fill categories used on your resume (e.g. Programming Languages — Python, SQL). Leave unused categories blank or remove them. Format on the resume: Category - skill list.';

export function emptySkillCategory(category = '') {
  return { category, skills: '' };
}

export function emptyWorkExperience() {
  return { client: '', startDate: '', endDate: '', role: '', clientAddress: '', description: '' };
}

export function emptyProject() {
  return { name: '', techStack: '', description: '', startDate: '', endDate: '' };
}

export function emptyResumeFormData() {
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

function hasValue(v) {
  return v !== null && v !== undefined && String(v).trim() !== '';
}

export function formatFormAddress(form = {}) {
  const parts = [
    form.addressLine1,
    form.addressLine2,
    [form.city, form.state, form.zipCode].filter(hasValue).join(', '),
    form.country,
  ].filter(hasValue);
  return parts.join('\n');
}

function normalizeArray(items, fallback) {
  if (!Array.isArray(items) || items.length === 0) return [fallback()];
  return items.map((item) => ({ ...fallback(), ...(item || {}) }));
}

/** Parse "Category - skills" / "Category: skills" lines from free text. */
export function parseSkillCategoryLines(text = '') {
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
    .filter((row) => hasValue(row.category) || hasValue(row.skills));
}

export function skillCategoriesToText(categories = []) {
  return (categories || [])
    .filter((c) => hasValue(c?.skills))
    .map((c) => {
      const cat = String(c.category || '').trim();
      const skills = String(c.skills || '').trim();
      if (cat && skills) return `${cat} - ${skills}`;
      return skills;
    })
    .join('\n');
}

function normalizeSkillCategories(data) {
  const rawCats = Array.isArray(data?.skillCategories) ? data.skillCategories : [];
  const mapped = rawCats.map((c) => ({
    category: String(c?.category || '').trim(),
    skills: String(c?.skills || '').trim(),
  }));
  const hasFilledSkills = mapped.some((c) => hasValue(c.skills));
  if (hasFilledSkills) {
    return mapped.filter((c) => c.category || c.skills);
  }

  const fromText = parseSkillCategoryLines(data?.technicalSkills || '');
  if (fromText.length) {
    return fromText.map((row) =>
      row.category
        ? row
        : { category: 'Technical Skills', skills: row.skills }
    );
  }

  return DEFAULT_SKILL_CATEGORIES.map((c) => ({ ...c }));
}

/** Backward-compatible merge for saved tickets that still use legacy `address`. */
export function normalizeResumeFormData(data) {
  const base = {
    ...emptyResumeFormData(),
    ...(data && typeof data === 'object' ? data : {}),
  };

  if (!hasValue(base.addressLine1) && hasValue(base.address)) {
    base.addressLine1 = String(base.address).trim();
  }

  base.workExperience = normalizeArray(base.workExperience, emptyWorkExperience);
  base.internships = normalizeArray(base.internships, emptyWorkExperience);
  base.projects = normalizeArray(base.projects, emptyProject);
  base.skillCategories = normalizeSkillCategories(base);
  base.technicalSkills = skillCategoriesToText(base.skillCategories) || base.technicalSkills || '';
  base.address = formatFormAddress(base) || base.address || '';

  if (!hasValue(base.experienceLevel)) {
    const hasJobs = base.workExperience.some((e) => hasValue(e.client) || hasValue(e.role));
    base.experienceLevel = hasJobs ? 'experienced' : 'fresher';
  }

  if (!hasValue(base.mastersEndDate)) {
    const legacy = [base.mastersGraduatedMonth, base.mastersGraduatedYear]
      .filter(hasValue)
      .join(' ')
      .trim();
    if (legacy) base.mastersEndDate = legacy;
  }
  if (!hasValue(base.bachelorsEndDate)) {
    const legacy = [base.bachelorsGraduatedMonth, base.bachelorsGraduatedYear]
      .filter(hasValue)
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

export function formatEducationDateRange(startDate = '', endDate = '') {
  const start = String(startDate || '').trim();
  let end = String(endDate || '').trim();
  if (/^current|present|now|ongoing$/i.test(end)) end = 'Present';
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

export function computeFormStatus(data, action = 'save') {
  const form = normalizeResumeFormData(data);
  if (!form) return 'unfilled';

  const fields = [
    form.preferredName,
    form.dateOfBirth,
    form.resumeEmail,
    form.personalPhone,
    form.addressLine1,
    form.city,
    form.state,
    form.zipCode,
    form.country,
    form.visaStatus,
    form.preferredRole,
    form.professionalSummary,
    form.technicalSkills,
    form.experienceLevel,
    form.legalName,
    form.signedDate,
  ];

  const hasAny =
    fields.some(hasValue) ||
    form.workExperience.some((e) => hasValue(e.client) || hasValue(e.role)) ||
    form.projects.some((p) => hasValue(p.name)) ||
    form.internships.some((e) => hasValue(e.client) || hasValue(e.role)) ||
    (form.skillCategories || []).some((c) => hasValue(c.skills)) ||
    hasValue(form.mastersUniversity) ||
    hasValue(form.bachelorsUniversity) ||
    form.consentAccurate === true ||
    form.consentEmailAccess === true;

  // Complete is always allowed (no mandatory fields) — admin/resume team may fill later via upload.
  if (action === 'complete') return 'completed';

  if (!hasAny) return 'unfilled';
  return 'partial';
}

export function formDataToRows(data) {
  const form = normalizeResumeFormData(data);
  if (!form) return [];

  const rows = [
    ['Preferred Name', form.preferredName],
    ['Date of Birth', form.dateOfBirth],
    ['LinkedIn', form.linkedIn],
    ['Resume Email', form.resumeEmail],
    ['Resume Email Password', form.resumeEmailPassword ? '••••••••' : ''],
    ['Personal Phone', form.personalPhone],
    ['Street Address', form.addressLine1],
    ['Apt / Suite', form.addressLine2],
    ['City', form.city],
    ['State', form.state],
    ['ZIP / Postal Code', form.zipCode],
    ['Country', form.country],
    ['Experience Level', form.experienceLevel === 'fresher' ? 'Fresher' : 'Experienced'],
    ['Visa Status', form.visaStatus],
    ['Date of Arrival (USA)', form.dateOfArrivalUSA],
    ['Vendor call', form.vendorCallTime],
    ['Certifications', form.certifications],
    ['Preferred Role', form.preferredRole],
    ['Professional Summary', form.professionalSummary],
    ['Technical Skills', form.technicalSkills],
    ['Relevant Coursework', form.relevantCoursework],
    ['Masters University', form.mastersUniversity],
    ['Masters Field', form.mastersField],
    ['Masters Start Date', form.mastersStartDate],
    [
      'Masters End Date',
      form.mastersEndDate || `${form.mastersGraduatedMonth || ''} ${form.mastersGraduatedYear || ''}`.trim(),
    ],
    ['Bachelors University', form.bachelorsUniversity],
    ['Bachelors Field', form.bachelorsField],
    ['Bachelors Start Date', form.bachelorsStartDate],
    [
      'Bachelors End Date',
      form.bachelorsEndDate ||
        `${form.bachelorsGraduatedMonth || ''} ${form.bachelorsGraduatedYear || ''}`.trim(),
    ],
    ['Legal Name', form.legalName],
    ['Signed Date', form.signedDate],
    ['Consent – Accurate Info', form.consentAccurate ? 'Yes' : 'No'],
    ['Consent – Email Access', form.consentEmailAccess ? 'Yes' : 'No'],
  ];

  (form.skillCategories || []).forEach((c, i) => {
    if (c.category || c.skills) {
      rows.push([`Skill Category ${i + 1}`, `${c.category || 'Skills'}: ${c.skills || ''}`]);
    }
  });

  form.workExperience.forEach((e, i) => {
    if (e.client || e.role) {
      rows.push([
        `Experience ${i + 1}`,
        `${e.role} @ ${e.client} (${e.startDate} – ${e.endDate})\n${e.description}`,
      ]);
    }
  });

  form.projects.forEach((p, i) => {
    if (p.name) {
      rows.push([`Project ${i + 1}`, `${p.name} [${p.techStack}]\n${p.description}`]);
    }
  });

  form.internships.forEach((e, i) => {
    if (e.client || e.role) {
      rows.push([
        `Internship ${i + 1}`,
        `${e.role} @ ${e.client} (${e.startDate} – ${e.endDate})\n${e.description}`,
      ]);
    }
  });

  return rows.filter(([, v]) => hasValue(v));
}

/**
 * Same as formDataToRows but can reveal secrets for authenticated staff/recruiters.
 * @param {object} data
 * @param {{ revealSecrets?: boolean }} [options]
 */
export function formDataToRowsForStaff(data, { revealSecrets = false } = {}) {
  const form = normalizeResumeFormData(data);
  if (!form) return [];

  const rows = formDataToRows(data).map(([label, value]) => {
    if (label === 'Resume Email Password' && revealSecrets) {
      return [label, form.resumeEmailPassword || ''];
    }
    return [label, value];
  });

  // If password was empty/masked out originally, re-add when revealing
  if (revealSecrets && hasValue(form.resumeEmailPassword)) {
    const idx = rows.findIndex(([label]) => label === 'Resume Email Password');
    if (idx === -1) {
      rows.splice(5, 0, ['Resume Email Password', form.resumeEmailPassword]);
    } else {
      rows[idx] = ['Resume Email Password', form.resumeEmailPassword];
    }
  }

  return rows.filter(([, v]) => hasValue(v));
}

/** Flat copy-friendly fields for recruiter apply side panel. */
export function formDataToCopyFields(data) {
  const form = normalizeResumeFormData(data);
  if (!form) return [];

  const address = [form.addressLine1, form.addressLine2, form.city, form.state, form.zipCode, form.country]
    .filter(hasValue)
    .join(', ');

  const fields = [
    { key: 'preferredName', label: 'Preferred Name', value: form.preferredName },
    { key: 'legalName', label: 'Legal Name', value: form.legalName },
    { key: 'dateOfBirth', label: 'Date of Birth', value: form.dateOfBirth },
    { key: 'linkedIn', label: 'LinkedIn', value: form.linkedIn },
    { key: 'resumeEmail', label: 'Resume Email', value: form.resumeEmail },
    { key: 'resumeEmailPassword', label: 'Resume Email Password', value: form.resumeEmailPassword },
    { key: 'personalPhone', label: 'Personal Phone', value: form.personalPhone },
    { key: 'address', label: 'Address', value: address || form.address },
    { key: 'addressLine1', label: 'Street Address', value: form.addressLine1 },
    { key: 'addressLine2', label: 'Apt / Suite', value: form.addressLine2 },
    { key: 'city', label: 'City', value: form.city },
    { key: 'state', label: 'State', value: form.state },
    { key: 'zipCode', label: 'ZIP / Postal Code', value: form.zipCode },
    { key: 'country', label: 'Country', value: form.country },
    {
      key: 'experienceLevel',
      label: 'Experience Level',
      value: form.experienceLevel === 'fresher' ? 'Fresher' : form.experienceLevel === 'experienced' ? 'Experienced' : form.experienceLevel,
    },
    { key: 'visaStatus', label: 'Visa Status', value: form.visaStatus },
    { key: 'dateOfArrivalUSA', label: 'Date of Arrival (USA)', value: form.dateOfArrivalUSA },
    { key: 'vendorCallTime', label: 'Vendor call', value: form.vendorCallTime },
    { key: 'preferredRole', label: 'Preferred Role', value: form.preferredRole },
    { key: 'professionalSummary', label: 'Professional Summary', value: form.professionalSummary },
    { key: 'technicalSkills', label: 'Technical Skills', value: form.technicalSkills },
    { key: 'certifications', label: 'Certifications', value: form.certifications },
    { key: 'relevantCoursework', label: 'Relevant Coursework', value: form.relevantCoursework },
    { key: 'mastersUniversity', label: 'Masters University', value: form.mastersUniversity },
    { key: 'mastersField', label: 'Masters Field', value: form.mastersField },
    { key: 'mastersStartDate', label: 'Masters Start Date', value: form.mastersStartDate },
    {
      key: 'mastersEndDate',
      label: 'Masters End Date',
      value:
        form.mastersEndDate ||
        `${form.mastersGraduatedMonth || ''} ${form.mastersGraduatedYear || ''}`.trim(),
    },
    { key: 'bachelorsUniversity', label: 'Bachelors University', value: form.bachelorsUniversity },
    { key: 'bachelorsField', label: 'Bachelors Field', value: form.bachelorsField },
    { key: 'bachelorsStartDate', label: 'Bachelors Start Date', value: form.bachelorsStartDate },
    {
      key: 'bachelorsEndDate',
      label: 'Bachelors End Date',
      value:
        form.bachelorsEndDate ||
        `${form.bachelorsGraduatedMonth || ''} ${form.bachelorsGraduatedYear || ''}`.trim(),
    },
  ];

  (form.skillCategories || []).forEach((c, i) => {
    if (c.category || c.skills) {
      fields.push({
        key: `skillCategory${i + 1}`,
        label: c.category || `Skill Category ${i + 1}`,
        value: c.skills || '',
      });
    }
  });

  form.workExperience.forEach((e, i) => {
    if (e.client || e.role) {
      fields.push({
        key: `experience${i + 1}`,
        label: `Experience ${i + 1}`,
        value: `${e.role || ''} @ ${e.client || ''} (${e.startDate || ''} – ${e.endDate || ''})\n${e.description || ''}`.trim(),
      });
    }
  });

  form.projects.forEach((p, i) => {
    if (p.name) {
      fields.push({
        key: `project${i + 1}`,
        label: `Project ${i + 1}`,
        value: `${p.name}${p.techStack ? ` [${p.techStack}]` : ''}\n${p.description || ''}`.trim(),
      });
    }
  });

  form.internships.forEach((e, i) => {
    if (e.client || e.role) {
      fields.push({
        key: `internship${i + 1}`,
        label: `Internship ${i + 1}`,
        value: `${e.role || ''} @ ${e.client || ''} (${e.startDate || ''} – ${e.endDate || ''})\n${e.description || ''}`.trim(),
      });
    }
  });

  return fields.filter((f) => hasValue(f.value));
}
