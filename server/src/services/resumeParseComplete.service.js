/**
 * Recover summary bullets / skill categories that LLM/external parsers often truncate.
 * Uses the raw extracted resume text as the source of truth when it has more items.
 */

const SUMMARY_HEADERS =
  'PROFESSIONAL SUMMARY|PROFILE SUMMARY|SUMMARY OF QUALIFICATIONS|CAREER SUMMARY|PROFILE|SUMMARY|ABOUT ME';

const SKILL_HEADERS =
  'TECHNICAL SKILLS|TECHNICAL PROFICIENCIES|CORE COMPETENCIES|CORE SKILLS|SKILLS|TECHNOLOGIES|TECHNICAL PROFICIENCY';

const NEXT_SECTION =
  'EXPERIENCE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EMPLOYMENT|EDUCATION|CERTIFICATION|CERTIFICATIONS|PROJECTS|PROJECT EXPERIENCE|ACHIEVEMENTS|AWARDS|LANGUAGES|INTERESTS|REFERENCES|TECHNICAL SKILLS|SKILLS|SUMMARY|PROFILE';

function cleanLine(line = '') {
  return String(line || '')
    .replace(/^[\s•\-\*\u2022●◦▪▸►○◆]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSection(text, headerPattern) {
  const re = new RegExp(
    `(?:^|\\n)\\s*(?:${headerPattern})\\s*[:\\-]?\\s*\\n([\\s\\S]*?)(?=\\n\\s*(?:${NEXT_SECTION})\\b|$)`,
    'i'
  );
  const match = String(text || '').match(re);
  return match ? String(match[1] || '').trim() : '';
}

function splitBulletLines(block) {
  if (!block) return [];
  const lines = [];
  for (const raw of String(block).split(/\n+/)) {
    const line = cleanLine(raw);
    if (!line) continue;
    // Skip short labels / section crumbs
    if (line.length < 12) continue;
    if (/^(professional summary|profile|skills|experience|education)\b/i.test(line)) continue;
    lines.push(line);
  }

  // Also split a single dense paragraph with mid-line bullets
  if (lines.length === 1 && /[•\u2022●]/.test(lines[0])) {
    return lines[0]
      .split(/[•\u2022●]+/)
      .map(cleanLine)
      .filter((l) => l.length >= 12);
  }

  return lines;
}

function extractSkillCategories(block) {
  if (!block) return [];
  const rows = [];
  for (const raw of String(block).split(/\n+/)) {
    const line = cleanLine(raw);
    if (!line) continue;
    const match = line.match(/^(.{2,60}?)\s*[-–—:|]\s*(.+)$/);
    if (match) {
      const skill_title = cleanLine(match[1]).replace(/[:\-–—|]+$/, '').trim();
      const skills = cleanLine(match[2]);
      if (skill_title && skills) rows.push({ skill_title, skills });
      continue;
    }
    // Multi-column category without delimiter: "Python SQL Java" under a prior header — skip orphans
  }
  return rows;
}

function asPointArray(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap((p) => {
        if (typeof p === 'string') return splitBulletLines(p);
        if (p && typeof p === 'object') {
          const text = String(p.point || p.text || p.description || p.value || '').trim();
          return text.includes('\n') || /[•\u2022]/.test(text)
            ? splitBulletLines(text)
            : text
              ? [text]
              : [];
        }
        return [];
      })
      .map((point) => ({ point, form: true }))
      .filter((p) => p.point);
  }
  if (typeof value === 'string' && value.trim()) {
    return splitBulletLines(value).map((point) => ({ point, form: true }));
  }
  return [];
}

function asSkillArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((s) => {
      if (typeof s === 'string') {
        const text = cleanLine(s);
        return text ? { skill_title: '', skills: text } : null;
      }
      if (!s || typeof s !== 'object') return null;
      const skill_title = cleanLine(s.skill_title || s.category || s.title);
      const skills = cleanLine(s.skills || s.skill || s.value || s.items);
      if (!skill_title && !skills) return null;
      return { skill_title, skills };
    })
    .filter(Boolean);
}

/**
 * If the source resume text has more summary bullets / skill categories than the
 * parsed JSON, replace those sections with the fuller extraction from text.
 */
export function completeParsedResumeFromText(parsed, sourceText) {
  if (!parsed || typeof parsed !== 'object') return parsed;
  const text = String(sourceText || '');
  if (!text.trim()) return parsed;

  const next = { ...parsed };

  const existingSummary = asPointArray(
    parsed.professionalsummary_points ||
      parsed.professional_summary ||
      parsed.summary ||
      parsed.summary_points
  );
  const textSummary = splitBulletLines(
    extractSection(text, SUMMARY_HEADERS)
  ).map((point) => ({ point, form: true }));

  if (textSummary.length > existingSummary.length) {
    next.professionalsummary_points = textSummary;
  } else if (existingSummary.length) {
    // Still expand multi-line single points from the model
    next.professionalsummary_points = existingSummary;
  }

  const existingSkills = asSkillArray(
    parsed.techinicalskills ||
      parsed.technicalskills ||
      parsed.skills ||
      parsed.technical_skills
  );
  const textSkills = extractSkillCategories(extractSection(text, SKILL_HEADERS));

  if (textSkills.length > existingSkills.length) {
    next.techinicalskills = textSkills;
  } else if (existingSkills.length) {
    next.techinicalskills = existingSkills;
  }

  return next;
}
