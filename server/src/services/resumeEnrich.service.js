/**
 * Normalize + enrich sparse resume JSON so DOCX/build has usable content.
 */

import { formatFormAddress, normalizeResumeFormData, formatEducationDateRange } from '../constants/resumeForm.js';

function clean(value) {
  const s = String(value ?? '').trim();
  if (!s || s.toUpperCase() === 'UNKNOWN') return '';
  return s;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function detailMap(details = {}) {
  const map = {};
  for (const item of asArray(details.additionalDetails || details.adtionaldetails)) {
    const key = clean(item?.key || item?.label);
    const data = clean(item?.data || item?.value);
    if (key && data) map[key.toLowerCase()] = data;
  }
  return map;
}

function pointFromText(text) {
  const point = clean(text);
  if (!point) return null;
  return { point, form: true };
}

function expandPointText(text) {
  const value = clean(text);
  if (!value) return [];
  if (!/\n|[•\u2022●]/.test(value)) return [value];
  return value
    .split(/\n+|[•\u2022●]+/)
    .map((line) => line.replace(/^[\s\-*>]+/, '').trim())
    .filter((line) => line.length >= 8);
}

function normalizePoints(raw) {
  // Accept a plain multi-line string (not only arrays)
  if (typeof raw === 'string') {
    return expandPointText(raw)
      .map((line) => pointFromText(line))
      .filter(Boolean);
  }

  return asArray(raw)
    .flatMap((p) => {
      if (typeof p === 'string') {
        return expandPointText(p).map((line) => pointFromText(line));
      }
      if (p && typeof p === 'object') {
        return expandPointText(p.point || p.text || p.description || p.value).map((line) =>
          pointFromText(line)
        );
      }
      return [];
    })
    .filter(Boolean);
}

function linesToPoints(text) {
  return normalizePoints(String(text || '').split(/\n+/));
}

function normalizeExperience(items) {
  return asArray(items)
    .map((exp) => {
      if (!exp || typeof exp !== 'object') return null;
      let points = normalizePoints(
        exp.points || exp.bullets || exp.responsibilities || exp.description
      );
      if (!points.length && typeof exp.description === 'string' && clean(exp.description)) {
        points = linesToPoints(exp.description);
      }
      return {
        visible: exp.visible !== false,
        position: clean(exp.position || exp.role || exp.title || exp.name),
        company: clean(exp.company || exp.client || exp.employer),
        location: clean(exp.location || exp.clientAddress || exp.city),
        start: clean(exp.start || exp.startDate || exp.from),
        end: clean(exp.end || exp.endDate || exp.to),
        points,
      };
    })
    .filter((e) => e && (e.position || e.company || e.start || e.end));
}

function normalizeEducation(items) {
  return asArray(items)
    .map((edu) => {
      if (!edu || typeof edu !== 'object') return null;
      return {
        visible: edu.visible !== false,
        education_title: clean(edu.education_title || edu.degree || edu.field || edu.title),
        university: clean(edu.university || edu.school || edu.college),
        start_end: clean(edu.start_end || edu.dates || edu.graduation || edu.year),
      };
    })
    .filter((e) => e && (e.education_title || e.university));
}

function normalizeSkills(items, fallbackText = '') {
  const fromItems = asArray(items)
    .map((s) => {
      if (typeof s === 'string') {
        const text = clean(s);
        return text ? { skill_title: '', skills: text } : null;
      }
      if (!s || typeof s !== 'object') return null;
      const skill_title = clean(s.skill_title || s.category || s.title);
      const skills = clean(s.skills || s.skill || s.value || s.items);
      if (!skill_title && !skills) return null;
      return { skill_title, skills };
    })
    .filter(Boolean);

  if (fromItems.length) return fromItems;

  // Parse "Category - skills" / "Category: skills" lines from free text
  const lines = String(fallbackText || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > 1 || (lines.length === 1 && /[-–—:]/.test(lines[0]))) {
    const parsed = lines
      .map((line) => {
        const match = line.match(/^(.+?)\s*[-–—:]\s*(.+)$/);
        if (match) return { skill_title: clean(match[1]), skills: clean(match[2]) };
        return { skill_title: '', skills: clean(line) };
      })
      .filter((s) => s.skill_title || s.skills);
    if (parsed.length) return parsed;
  }

  const fallback = clean(fallbackText);
  if (!fallback) return [];
  return [{ skill_title: 'Technical Skills', skills: fallback }];
}

function normalizeCertifications(items, fallbackText = '') {
  const fromItems = asArray(items)
    .map((c) => {
      if (typeof c === 'string') {
        const t = clean(c);
        return t ? { certification_title: t, visible: true } : null;
      }
      if (!c || typeof c !== 'object') return null;
      const title = clean(c.certification_title || c.title || c.name || c.data);
      return title ? { certification_title: title, visible: c.visible !== false } : null;
    })
    .filter(Boolean);

  if (fromItems.length) return fromItems;
  const fallback = clean(fallbackText);
  return fallback ? [{ certification_title: fallback, visible: true }] : [];
}

function defaultExperienceBullets(exp) {
  const bullets = [];
  const role = exp.position || 'team member';
  const company = exp.company || 'the organization';
  bullets.push(
    pointFromText(
      `Worked as ${role} at ${company}, contributing to day-to-day delivery and team goals.`
    )
  );
  if (exp.location) {
    bullets.push(
      pointFromText(`Based in ${exp.location}; collaborated with stakeholders across projects.`)
    );
  }
  if (exp.start || exp.end) {
    const range = [exp.start, exp.end].filter(Boolean).join(' – ');
    bullets.push(pointFromText(`Tenure: ${range}.`));
  }
  return bullets.filter(Boolean);
}

function defaultSummary(details, resume) {
  const role = clean(resume.jobtitle) || clean(details.role) || 'professional';
  const name = clean(details.name) || 'Candidate';
  const companies = asArray(resume.experience)
    .map((e) => clean(e.company))
    .filter(Boolean)
    .slice(0, 3);
  const edu = asArray(resume.education)
    .map((e) => [clean(e.education_title), clean(e.university)].filter(Boolean).join(' from '))
    .filter(Boolean)[0];

  let sentence = `${name} is a ${role}`;
  if (companies.length) sentence += ` with experience at ${companies.join(', ')}`;
  sentence += '.';
  if (edu) sentence += ` Education includes ${edu}.`;
  return [pointFromText(sentence)].filter(Boolean);
}

function defaultSkills(details, resume, extras) {
  const skills = [];
  const role = clean(resume.jobtitle) || clean(details.role);
  if (role) skills.push({ skill_title: 'Target Role', skills: role });

  const certs = asArray(resume.certifications)
    .map((c) => clean(c.certification_title))
    .filter(Boolean);
  if (certs.length) {
    skills.push({ skill_title: 'Certifications', skills: certs.join('; ') });
  } else if (extras.certifications) {
    skills.push({ skill_title: 'Certifications', skills: extras.certifications });
  }

  const tools = clean(extras.skills || extras.technicalskills || extras['technical skills']);
  if (tools) skills.push({ skill_title: 'Skills', skills: tools });

  const coursework = clean(extras['relevant coursework']);
  if (coursework) skills.push({ skill_title: 'Relevant Coursework', skills: coursework });

  return skills;
}

function mapWorkRows(items, { companyFallback = 'UNKNOWN' } = {}) {
  return asArray(items)
    .filter((item) => item.client || item.role || item.startDate || item.endDate || item.description)
    .map((item) => {
      const position = clean(item.role) || clean(item.name) || 'UNKNOWN';
      const company = clean(item.client) || companyFallback;
      const location = clean(item.clientAddress) || '';
      const start = clean(item.startDate) || '';
      const end = clean(item.endDate) || '';
      const points = linesToPoints(item.description);
      return {
        visible: true,
        position,
        location,
        start,
        end,
        company,
        points: points.length
          ? points
          : defaultExperienceBullets({ position, company, location, start, end }),
      };
    });
}

function mapProjects(items) {
  return asArray(items)
    .filter((p) => p.name || p.description)
    .map((p) => {
      const position = clean(p.name) || 'Project';
      const tech = clean(p.techStack);
      const points = linesToPoints(p.description);
      if (tech) points.unshift(pointFromText(`Technologies: ${tech}`));
      return {
        visible: true,
        position,
        company: 'Academic / Personal Project',
        location: tech ? `Stack: ${tech}` : '',
        start: clean(p.startDate),
        end: clean(p.endDate),
        points: points.length ? points.filter(Boolean) : [pointFromText(`Project: ${position}`)],
      };
    });
}

/**
 * @param {object} details - external student shape (name, role, resume, additionalDetails, …)
 * @param {object} [options]
 * @returns {object} enriched resume JSON
 */
export function enrichResumeForDownload(details = {}, options = {}) {
  const raw = { ...(details.resume || options.resume || {}) };
  const extras = detailMap(details);

  const resume = {
    jobtitle: clean(raw.jobtitle || raw.jobTitle || details.role || options.jobtitle),
    education: normalizeEducation(raw.education || raw.educations),
    experience: normalizeExperience(raw.experience || raw.experiences || raw.workExperience),
    professionalsummary_points: normalizePoints(
      raw.professionalsummary_points ||
        raw.professional_summary ||
        raw.summary ||
        raw.summary_points ||
        raw.professionalSummary
    ),
    techinicalskills: normalizeSkills(
      raw.techinicalskills || raw.technicalskills || raw.skills || raw.technical_skills,
      raw.technicalSkills || extras['technical skills']
    ),
    certifications: normalizeCertifications(
      raw.certifications,
      extras.certifications || extras.certification
    ),
  };

  resume.experience = resume.experience.map((exp) => ({
    ...exp,
    points: exp.points.length ? exp.points : defaultExperienceBullets(exp),
  }));

  if (!resume.professionalsummary_points.length) {
    resume.professionalsummary_points = defaultSummary(details, resume);
  }

  if (!resume.techinicalskills.length) {
    resume.techinicalskills = defaultSkills(details, resume, extras);
  }

  return {
    resume,
    contactExtras: {
      address:
        extras.address ||
        clean(details.address) ||
        formatFormAddress(details.formAddress || details),
      visa: extras['visa status'] || clean(details.visa),
      dateOfBirth: extras['date of birth'],
    },
  };
}

/**
 * Build structured resume JSON from intake form (used on Create Student).
 */
export function buildResumeFromFormData(formInput = {}, ticket = {}) {
  const form = normalizeResumeFormData(formInput);
  const education = [];

  if (form.mastersUniversity || form.mastersField) {
    education.push({
      visible: true,
      education_title: clean(form.mastersField) || 'UNKNOWN',
      start_end:
        formatEducationDateRange(form.mastersStartDate, form.mastersEndDate) ||
        [form.mastersGraduatedMonth, form.mastersGraduatedYear].filter(Boolean).join(' ') ||
        'UNKNOWN',
      university: clean(form.mastersUniversity) || 'UNKNOWN',
    });
  }
  if (form.bachelorsUniversity || form.bachelorsField) {
    education.push({
      visible: true,
      education_title: clean(form.bachelorsField) || 'UNKNOWN',
      start_end:
        formatEducationDateRange(form.bachelorsStartDate, form.bachelorsEndDate) ||
        [form.bachelorsGraduatedMonth, form.bachelorsGraduatedYear].filter(Boolean).join(' ') ||
        'UNKNOWN',
      university: clean(form.bachelorsUniversity) || 'UNKNOWN',
    });
  }

  let experience = [];
  if (form.experienceLevel === 'experienced') {
    experience = mapWorkRows(form.workExperience);
  } else {
    experience = [
      ...mapWorkRows(form.internships, { companyFallback: 'Internship' }),
      ...mapProjects(form.projects),
    ];
  }

  const summaryPoints = linesToPoints(form.professionalSummary);
  const fromCategories = asArray(form.skillCategories)
    .map((c) => ({
      skill_title: clean(c.category || c.skill_title || c.title),
      skills: clean(c.skills),
    }))
    .filter((c) => c.skill_title || c.skills);
  const skillItems = fromCategories.length
    ? fromCategories
    : normalizeSkills([], form.technicalSkills);
  if (clean(form.relevantCoursework)) {
    skillItems.push({
      skill_title: 'Relevant Coursework',
      skills: clean(form.relevantCoursework),
    });
  }

  const jobtitle = clean(form.preferredRole) || '';
  const name = clean(form.preferredName || form.legalName || ticket.candidateName);
  const certifications = normalizeCertifications([], form.certifications);

  const draftDetails = {
    name,
    role: jobtitle,
    city: form.city,
    state: form.state,
    formAddress: form,
    resume: {
      jobtitle,
      education,
      experience,
      professionalsummary_points: summaryPoints,
      techinicalskills: skillItems,
      certifications,
    },
    additionalDetails: [
      formatFormAddress(form) && { key: 'Address', data: formatFormAddress(form) },
      form.visaStatus && { key: 'Visa Status', data: form.visaStatus },
      form.vendorCallTime && { key: 'Vendor call', data: form.vendorCallTime },
      form.certifications && { key: 'Certifications', data: form.certifications },
      form.technicalSkills && { key: 'Technical Skills', data: form.technicalSkills },
      form.relevantCoursework && { key: 'Relevant Coursework', data: form.relevantCoursework },
      form.dateOfBirth && { key: 'Date of Birth', data: form.dateOfBirth },
    ].filter(Boolean),
  };

  return enrichResumeForDownload(draftDetails).resume;
}

export { formatFormAddress, normalizeResumeFormData };
