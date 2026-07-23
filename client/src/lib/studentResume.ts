/** Normalize student.resume JSON for the Student Detail View sub-tabs. */

export type ResumeViewTab = 'summary' | 'experience' | 'education' | 'skills' | 'projects' | 'certs';

export const RESUME_VIEW_TABS: Array<{ id: ResumeViewTab; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'experience', label: 'Experience' },
  { id: 'education', label: 'Education' },
  { id: 'skills', label: 'Skills' },
  { id: 'projects', label: 'Projects' },
  { id: 'certs', label: 'Certs' },
];

export interface ResumePoint {
  point: string;
}

export interface ResumeExperience {
  position: string;
  company: string;
  location: string;
  start: string;
  end: string;
  points: ResumePoint[];
}

export interface ResumeEducation {
  education_title: string;
  university: string;
  start_end: string;
}

export interface ResumeSkillGroup {
  skill_title: string;
  skills: string[];
}

export interface ResumeProject {
  name: string;
  role: string;
  tech: string;
  start: string;
  end: string;
  description: string;
  link: string;
  points: ResumePoint[];
}

export interface ResumeCertification {
  certification_title: string;
}

/** Editable draft used by the Resume Editor tab. */
export interface EditablePoint {
  id: string;
  point: string;
  starred: boolean;
}

export interface EditableExperience {
  id: string;
  visible: boolean;
  position: string;
  company: string;
  location: string;
  start: string;
  end: string;
  points: EditablePoint[];
}

export interface EditableEducation {
  id: string;
  visible: boolean;
  education_title: string;
  university: string;
  start_end: string;
}

export interface EditableSkillGroup {
  id: string;
  skill_title: string;
  /** Comma-separated skills text (matches editor design). */
  skills: string;
}

export interface EditableProject {
  id: string;
  title: string;
  description: string;
  link: string;
}

export interface EditableCertification {
  id: string;
  title: string;
}

export interface EditableResumeDraft {
  jobtitle: string;
  summary: EditablePoint[];
  experience: EditableExperience[];
  education: EditableEducation[];
  skills: EditableSkillGroup[];
  projects: EditableProject[];
  certifications: EditableCertification[];
}

export function newId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export interface ParsedStudentResume {
  jobtitle: string;
  summary: string[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
  skills: ResumeSkillGroup[];
  projects: ResumeProject[];
  certifications: ResumeCertification[];
}

function clean(value: unknown): string {
  const s = String(value ?? '').trim();
  if (!s || s.toUpperCase() === 'UNKNOWN') return '';
  return s;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toPoints(raw: unknown): ResumePoint[] {
  const expand = (text: string): string[] => {
    const value = clean(text);
    if (!value) return [];
    if (!/\n|[•\u2022●]/.test(value)) return [value];
    return value
      .split(/\n+|[•\u2022●]+/)
      .map((line) => line.replace(/^[\s\-*>]+/, '').trim())
      .filter((line) => line.length >= 8);
  };

  if (typeof raw === 'string') {
    return expand(raw).map((point) => ({ point }));
  }

  return asArray(raw)
    .flatMap((p) => {
      if (typeof p === 'string') return expand(p).map((point) => ({ point }));
      if (p && typeof p === 'object') {
        const obj = p as Record<string, unknown>;
        return expand(String(obj.point || obj.text || obj.description || obj.value || '')).map(
          (point) => ({ point })
        );
      }
      return [];
    })
    .filter((p): p is ResumePoint => Boolean(p.point));
}

function splitSkills(text: string): string[] {
  return text
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function additionalDetailsMap(details: Record<string, unknown> = {}): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of asArray(details.additionalDetails || details.adtionaldetails)) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const key = clean(row.key || row.label);
    const data = clean(row.data || row.value);
    if (key && data) map[key.toLowerCase()] = data;
  }
  return map;
}

export function getAdditionalDetail(
  details: Record<string, unknown>,
  ...keys: string[]
): string {
  const map = additionalDetailsMap(details);
  for (const key of keys) {
    const hit = map[key.toLowerCase()];
    if (hit) return hit;
  }
  return '';
}

/** Split "Jan 2020 – May 2022" / "2020-2022" into start and end. */
export function splitEducationDateRange(value: string): { start: string; end: string } {
  const raw = String(value || '').trim();
  if (!raw) return { start: '', end: '' };
  const parts = raw.split(/\s*[–—]\s*|\s+-\s+|\s+to\s+/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { start: parts[0], end: parts.slice(1).join(' - ') };
  }
  // Bare year range like 2020-2022
  const yearRange = raw.match(/^(\d{4})\s*-\s*(\d{4}|[A-Za-z]+)$/);
  if (yearRange) return { start: yearRange[1], end: yearRange[2] };
  return { start: '', end: raw };
}

export function getEducationDates(
  details: Record<string, unknown>,
  level: 'Masters' | 'Bachelors'
): { start: string; end: string } {
  const start = getAdditionalDetail(details, `${level} Start Date`);
  const end = getAdditionalDetail(details, `${level} End Date`);
  if (start || end) return { start, end };

  const combined = getAdditionalDetail(details, `${level} Start-End Date`, `${level} Dates`);
  if (combined) return splitEducationDateRange(combined);

  const graduated = [
    getAdditionalDetail(details, `${level} Graduated Month`),
    getAdditionalDetail(details, `${level} Graduated Year`),
  ]
    .filter(Boolean)
    .join(' ');
  return { start: '', end: graduated };
}

export function formatEducationDateRange(start: string, end: string): string {
  const s = String(start || '').trim();
  let e = String(end || '').trim();
  if (/^current|present|now|ongoing$/i.test(e)) e = 'Present';
  if (s && e) return `${s} – ${e}`;
  return s || e || '';
}

function parseExperience(items: unknown[]): ResumeExperience[] {
  return items
    .map((exp) => {
      if (!exp || typeof exp !== 'object') return null;
      const e = exp as Record<string, unknown>;
      let points = toPoints(e.points || e.bullets || e.responsibilities);
      if (!points.length && typeof e.description === 'string' && clean(e.description)) {
        points = clean(e.description)
          .split(/\n+/)
          .map((line) => ({ point: line.trim() }))
          .filter((p) => p.point);
      }
      const position = clean(e.position || e.role || e.title || e.name);
      const company = clean(e.company || e.client || e.employer);
      if (!position && !company) return null;
      return {
        position,
        company,
        location: clean(e.location || e.clientAddress || e.city),
        start: clean(e.start || e.startDate || e.from),
        end: clean(e.end || e.endDate || e.to),
        points,
      };
    })
    .filter((e): e is ResumeExperience => Boolean(e));
}

function parseEducation(items: unknown[]): ResumeEducation[] {
  return items
    .map((edu) => {
      if (!edu || typeof edu !== 'object') return null;
      const e = edu as Record<string, unknown>;
      const education_title = clean(e.education_title || e.degree || e.field || e.title);
      const university = clean(e.university || e.school || e.college);
      if (!education_title && !university) return null;
      return {
        education_title,
        university,
        start_end: clean(e.start_end || e.dates || e.graduation || e.year),
      };
    })
    .filter((e): e is ResumeEducation => Boolean(e));
}

function parseSkills(items: unknown[], fallbackText = ''): ResumeSkillGroup[] {
  const fromItems = items
    .map((s) => {
      if (typeof s === 'string') {
        const text = clean(s);
        return text ? { skill_title: '', skills: splitSkills(text) } : null;
      }
      if (!s || typeof s !== 'object') return null;
      const row = s as Record<string, unknown>;
      const skill_title = clean(row.skill_title || row.category || row.title);
      const skillsRaw = clean(row.skills || row.skill || row.value || row.items);
      const skills = Array.isArray(row.skills)
        ? (row.skills as unknown[]).map(clean).filter(Boolean)
        : splitSkills(skillsRaw);
      if (!skill_title && !skills.length) return null;
      return { skill_title, skills };
    })
    .filter((s): s is ResumeSkillGroup => Boolean(s));

  if (fromItems.length) return fromItems;

  const lines = String(fallbackText || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length) {
    const parsed = lines
      .map((line) => {
        const match = line.match(/^(.+?)\s*[-–—:]\s*(.+)$/);
        if (match) return { skill_title: clean(match[1]), skills: splitSkills(match[2]) };
        return { skill_title: '', skills: splitSkills(line) };
      })
      .filter((s) => s.skill_title || s.skills.length);
    if (parsed.length) return parsed;
  }

  return [];
}

function parseProjects(items: unknown[]): ResumeProject[] {
  return items
    .map((p) => {
      if (!p || typeof p !== 'object') return null;
      const row = p as Record<string, unknown>;
      const name = clean(row.name || row.title || row.project || row.position);
      const role = clean(row.role);
      const description = clean(row.description || row.summary);
      if (!name && !role && !description) return null;
      return {
        name: name || role || 'Project',
        role: name && role && name !== role ? role : '',
        tech: clean(row.tech || row.technologies || row.stack || row.location),
        start: clean(row.start || row.startDate),
        end: clean(row.end || row.endDate),
        description,
        link: clean(row.link || row.url || row.github),
        points: toPoints(row.points || row.bullets),
      };
    })
    .filter((p): p is ResumeProject => Boolean(p));
}

function parseCertifications(items: unknown[], fallbackText = ''): ResumeCertification[] {
  const fromItems = items
    .map((c) => {
      if (typeof c === 'string') {
        const t = clean(c);
        return t ? { certification_title: t } : null;
      }
      if (!c || typeof c !== 'object') return null;
      const row = c as Record<string, unknown>;
      const title = clean(row.certification_title || row.title || row.name || row.data);
      return title ? { certification_title: title } : null;
    })
    .filter((c): c is ResumeCertification => Boolean(c));

  if (fromItems.length) return fromItems;

  const fallback = clean(fallbackText);
  if (!fallback) return [];
  return fallback
    .split(/\n+/)
    .map((line) => clean(line))
    .filter(Boolean)
    .map((certification_title) => ({ certification_title }));
}

function educationFromAdditionalDetails(details: Record<string, unknown>): ResumeEducation[] {
  const education: ResumeEducation[] = [];
  const mastersUni = getAdditionalDetail(details, 'Masters University', "Master's University");
  const mastersField = getAdditionalDetail(details, 'Masters Field', "Master's Field");
  const mastersDates = getEducationDates(details, 'Masters');
  const mastersGrad = formatEducationDateRange(mastersDates.start, mastersDates.end);
  if (mastersUni || mastersField || mastersGrad) {
    education.push({
      education_title: mastersField || "Master's",
      university: mastersUni,
      start_end: mastersGrad,
    });
  }
  const bachUni = getAdditionalDetail(details, 'Bachelors University', "Bachelor's University");
  const bachField = getAdditionalDetail(details, 'Bachelors Field', "Bachelor's Field");
  const bachDates = getEducationDates(details, 'Bachelors');
  const bachGrad = formatEducationDateRange(bachDates.start, bachDates.end);
  if (bachUni || bachField || bachGrad) {
    education.push({
      education_title: bachField || "Bachelor's",
      university: bachUni,
      start_end: bachGrad,
    });
  }
  return education;
}

export function parseStudentResume(details: Record<string, unknown> = {}): ParsedStudentResume {
  const raw = (details.resume && typeof details.resume === 'object'
    ? (details.resume as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const extras = additionalDetailsMap(details);
  const summary = toPoints(
    raw.professionalsummary_points ||
      raw.professional_summary ||
      raw.summary ||
      raw.summary_points ||
      raw.professionalSummary
  ).map((p) => p.point);

  const experience = parseExperience(
    asArray(raw.experience || raw.experiences || raw.workExperience)
  );
  let education = parseEducation(asArray(raw.education || raw.educations));
  if (!education.length) education = educationFromAdditionalDetails(details);

  const skills = parseSkills(
    asArray(raw.techinicalskills || raw.technicalskills || raw.skills || raw.technical_skills),
    clean(raw.technicalSkills) || extras['technical skills'] || ''
  );

  const projects = parseProjects(asArray(raw.projects || raw.project));
  const certifications = parseCertifications(
    asArray(raw.certifications),
    extras.certifications || extras.certification || ''
  );

  return {
    jobtitle: clean(raw.jobtitle || raw.jobTitle || details.role),
    summary,
    experience,
    education,
    skills,
    projects,
    certifications,
  };
}

export function formatDateRange(start: string, end: string): string {
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

export function formatMoney(amount: unknown): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

export function formatShortDate(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' });
}

function toEditablePoints(raw: unknown): EditablePoint[] {
  return asArray(raw).map((p, i) => {
    if (typeof p === 'string') {
      return { id: newId(`pt-${i}`), point: clean(p), starred: false };
    }
    if (p && typeof p === 'object') {
      const obj = p as Record<string, unknown>;
      return {
        id: newId(`pt-${i}`),
        point: clean(obj.point || obj.text || obj.description || obj.value),
        starred: Boolean(obj.starred || obj.form),
      };
    }
    return { id: newId(`pt-${i}`), point: '', starred: false };
  });
}

/** Build an editable draft from student.details (including resume JSON). */
export function detailsToEditableDraft(details: Record<string, unknown> = {}): EditableResumeDraft {
  const parsed = parseStudentResume(details);
  const raw = (details.resume && typeof details.resume === 'object'
    ? (details.resume as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const experienceRaw = asArray(raw.experience || raw.experiences || raw.workExperience);
  const educationRaw = asArray(raw.education || raw.educations);

  return {
    jobtitle: parsed.jobtitle,
    summary: parsed.summary.map((point, i) => ({
      id: newId(`sum-${i}`),
      point,
      starred: false,
    })),
    experience: parsed.experience.map((exp, i) => {
      const src = (experienceRaw[i] && typeof experienceRaw[i] === 'object'
        ? (experienceRaw[i] as Record<string, unknown>)
        : {}) as Record<string, unknown>;
      return {
        id: newId(`exp-${i}`),
        visible: src.visible !== false,
        position: exp.position,
        company: exp.company,
        location: exp.location || (clean(src.location) === 'UNKNOWN' ? 'UNKNOWN' : exp.location),
        start: exp.start,
        end: exp.end,
        points: exp.points.length
          ? exp.points.map((p, j) => ({ id: newId(`exp-${i}-pt-${j}`), point: p.point, starred: false }))
          : toEditablePoints(src.points),
      };
    }),
    education: (parsed.education.length
      ? parsed.education
      : []
    ).map((edu, i) => {
      const src = (educationRaw[i] && typeof educationRaw[i] === 'object'
        ? (educationRaw[i] as Record<string, unknown>)
        : {}) as Record<string, unknown>;
      return {
        id: newId(`edu-${i}`),
        visible: src.visible !== false,
        education_title: edu.education_title,
        university: edu.university,
        start_end: edu.start_end || clean(src.start_end) || 'UNKNOWN',
      };
    }),
    skills: parsed.skills.map((g, i) => ({
      id: newId(`sk-${i}`),
      skill_title: g.skill_title,
      skills: g.skills.join(', '),
    })),
    projects: parsed.projects.map((p, i) => ({
      id: newId(`proj-${i}`),
      title: p.name,
      description:
        p.description ||
        p.points.map((pt) => pt.point).join('\n') ||
        (p.tech ? `Stack: ${p.tech}` : ''),
      link: p.link,
    })),
    certifications: parsed.certifications.map((c, i) => ({
      id: newId(`cert-${i}`),
      title: c.certification_title,
    })),
  };
}

/** Serialize editor draft back to stored student.resume JSON shape. */
export function editableDraftToResumeData(draft: EditableResumeDraft): Record<string, unknown> {
  return {
    jobtitle: draft.jobtitle.trim(),
    professionalsummary_points: draft.summary
      .map((p) => ({ point: p.point.trim(), form: true }))
      .filter((p) => p.point),
    experience: draft.experience.map((exp) => ({
      visible: exp.visible,
      position: exp.position.trim(),
      company: exp.company.trim(),
      location: exp.location.trim() || 'UNKNOWN',
      start: exp.start.trim(),
      end: exp.end.trim(),
      points: exp.points
        .map((p) => ({ point: p.point.trim(), form: true }))
        .filter((p) => p.point),
    })),
    education: draft.education.map((edu) => ({
      visible: edu.visible,
      education_title: edu.education_title.trim(),
      university: edu.university.trim(),
      start_end: edu.start_end.trim() || 'UNKNOWN',
    })),
    techinicalskills: draft.skills
      .map((g) => ({
        skill_title: g.skill_title.trim(),
        skills: g.skills.trim(),
      }))
      .filter((g) => g.skill_title || g.skills),
    projects: draft.projects
      .map((p) => ({
        title: p.title.trim(),
        name: p.title.trim(),
        description: p.description.trim(),
        link: p.link.trim(),
      }))
      .filter((p) => p.title || p.description || p.link),
    certifications: draft.certifications
      .map((c) => ({
        certification_title: c.title.trim(),
        visible: true,
      }))
      .filter((c) => c.certification_title),
  };
}

/** Merge a parsed resume payload (from Upload/Parse) into an editable draft. */
export function parsedPayloadToEditableDraft(parsed: unknown): EditableResumeDraft {
  const raw = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  return detailsToEditableDraft({ resume: raw, role: raw.jobtitle || raw.jobTitle || '' });
}

export function emptySummaryPoint(): EditablePoint {
  return { id: newId('sum'), point: '', starred: false };
}

export function emptyExperience(): EditableExperience {
  return {
    id: newId('exp'),
    visible: true,
    position: '',
    company: '',
    location: '',
    start: '',
    end: '',
    points: [emptySummaryPoint()],
  };
}

export function emptyEducation(): EditableEducation {
  return {
    id: newId('edu'),
    visible: true,
    education_title: '',
    university: '',
    start_end: '',
  };
}

export function emptySkillGroup(): EditableSkillGroup {
  return { id: newId('sk'), skill_title: 'New Skill Group', skills: '' };
}

export function emptyProject(): EditableProject {
  return {
    id: newId('proj'),
    title: 'My Awesome Project',
    description: '',
    link: '',
  };
}

export function emptyCertification(): EditableCertification {
  return { id: newId('cert'), title: '' };
}
