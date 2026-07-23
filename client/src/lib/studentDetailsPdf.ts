/** Minimal text PDF builder (no external deps) for student details handoff. */

export interface StudentDetailsPdfInput {
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phone: string;
  linkedin: string;
  city: string;
  state: string;
  companyLabel?: string;
  notes: string;
  additionalDetails: Array<{ key: string; data: string }>;
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

/** Helvetica is WinAnsi; map common punctuation and drop unsupported glyphs. */
function toPdfSafeText(value: string): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E\t]/g, (ch) => (ch === '\n' || ch === '\r' ? ch : '?'));
}

function escapePdfText(value: string): string {
  return toPdfSafeText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function stripHtml(value: string): string {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function wrapLine(text: string, maxChars: number): string[] {
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const paragraphs = cleaned.split('\n');
  const out: string[] = [];
  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= maxChars) {
        line = next;
      } else {
        if (line) out.push(line);
        if (word.length <= maxChars) {
          line = word;
        } else {
          for (let i = 0; i < word.length; i += maxChars) {
            out.push(word.slice(i, i + maxChars));
          }
          line = '';
        }
      }
    }
    if (line) out.push(line);
  }
  return out;
}

type PdfLine =
  | { kind: 'title'; text: string }
  | { kind: 'section'; text: string }
  | { kind: 'row'; label: string; value: string }
  | { kind: 'body'; text: string }
  | { kind: 'spacer' };

const EDUCATION_FIELD_KEYS = new Set(
  [
    'Masters University',
    "Master's University",
    'Masters Field',
    "Master's Field",
    'Masters Start Date',
    'Masters End Date',
    'Masters Start-End Date',
    'Masters Dates',
    'Masters Graduated Month',
    'Masters Graduated Year',
    'Bachelors University',
    "Bachelor's University",
    'Bachelors Field',
    "Bachelor's Field",
    'Bachelors Start Date',
    'Bachelors End Date',
    'Bachelors Start-End Date',
    'Bachelors Dates',
    'Bachelors Graduated Month',
    'Bachelors Graduated Year',
  ].map((k) => k.toLowerCase())
);

function fieldMap(fields: Array<{ key: string; data: string }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const field of fields) {
    const key = field.key.trim();
    if (!key) continue;
    map[key.toLowerCase()] = stripHtml(field.data);
  }
  return map;
}

function pickField(map: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const hit = map[key.toLowerCase()];
    if (hit) return hit;
  }
  return '';
}

function splitEducationDateRange(value: string): { start: string; end: string } {
  const raw = String(value || '').trim();
  if (!raw) return { start: '', end: '' };
  const parts = raw
    .split(/\s*[–—]\s*|\s+-\s+|\s+to\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return { start: parts[0], end: parts.slice(1).join(' - ') };
  const yearRange = raw.match(/^(\d{4})\s*-\s*(\d{4}|[A-Za-z]+)$/);
  if (yearRange) return { start: yearRange[1], end: yearRange[2] };
  return { start: '', end: raw };
}

function educationDates(
  map: Record<string, string>,
  level: 'Masters' | 'Bachelors'
): { start: string; end: string } {
  const start = pickField(map, `${level} Start Date`);
  const end = pickField(map, `${level} End Date`);
  if (start || end) return { start, end };
  const combined = pickField(map, `${level} Start-End Date`, `${level} Dates`);
  if (combined) return splitEducationDateRange(combined);
  const graduated = [pickField(map, `${level} Graduated Month`), pickField(map, `${level} Graduated Year`)]
    .filter(Boolean)
    .join(' ');
  return { start: '', end: graduated };
}

function appendEducationBlock(
  lines: PdfLine[],
  title: string,
  university: string,
  field: string,
  start: string,
  end: string
) {
  if (!university && !field && !start && !end) return;
  lines.push({ kind: 'body', text: title });
  if (university) lines.push({ kind: 'row', label: 'University', value: university });
  if (field) lines.push({ kind: 'row', label: 'Field of Study', value: field });
  lines.push({ kind: 'row', label: 'Start Date', value: start || '—' });
  lines.push({ kind: 'row', label: 'End Date', value: end || '—' });
  lines.push({ kind: 'spacer' });
}

function buildLines(input: StudentDetailsPdfInput): PdfLine[] {
  const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ') || 'Student';
  const lines: PdfLine[] = [
    { kind: 'title', text: 'Student Details' },
    { kind: 'body', text: fullName },
    { kind: 'spacer' },
    { kind: 'section', text: 'Personal Information' },
    { kind: 'row', label: 'First Name', value: input.firstName },
    { kind: 'row', label: 'Last Name', value: input.lastName },
    { kind: 'row', label: 'Role / Job Title', value: input.role },
    { kind: 'spacer' },
    { kind: 'section', text: 'Contact Information' },
    { kind: 'row', label: 'Email', value: input.email },
    { kind: 'row', label: 'Phone', value: input.phone },
    { kind: 'row', label: 'LinkedIn', value: input.linkedin },
    { kind: 'spacer' },
    { kind: 'section', text: 'Location' },
    { kind: 'row', label: 'City', value: input.city },
    { kind: 'row', label: 'State', value: input.state },
  ];

  if (input.companyLabel) {
    lines.push({ kind: 'row', label: 'Company', value: input.companyLabel });
  }

  const extras = input.additionalDetails.filter((f) => f.key.trim());
  const map = fieldMap(extras);
  const mastersDates = educationDates(map, 'Masters');
  const bachDates = educationDates(map, 'Bachelors');
  const mastersUni = pickField(map, 'Masters University', "Master's University");
  const mastersField = pickField(map, 'Masters Field', "Master's Field");
  const bachUni = pickField(map, 'Bachelors University', "Bachelor's University");
  const bachField = pickField(map, 'Bachelors Field', "Bachelor's Field");
  const hasEducation =
    mastersUni ||
    mastersField ||
    mastersDates.start ||
    mastersDates.end ||
    bachUni ||
    bachField ||
    bachDates.start ||
    bachDates.end;

  if (hasEducation) {
    lines.push({ kind: 'spacer' }, { kind: 'section', text: 'Education' });
    appendEducationBlock(
      lines,
      "Master's Degree",
      mastersUni,
      mastersField,
      mastersDates.start,
      mastersDates.end
    );
    appendEducationBlock(
      lines,
      "Bachelor's Degree",
      bachUni,
      bachField,
      bachDates.start,
      bachDates.end
    );
  }

  const otherExtras = extras.filter((f) => !EDUCATION_FIELD_KEYS.has(f.key.trim().toLowerCase()));
  if (otherExtras.length) {
    lines.push({ kind: 'spacer' }, { kind: 'section', text: 'Additional Details' });
    for (const field of otherExtras) {
      lines.push({ kind: 'row', label: field.key.trim(), value: stripHtml(field.data) });
    }
  }

  const notes = stripHtml(input.notes);
  if (notes) {
    lines.push({ kind: 'spacer' }, { kind: 'section', text: 'Notes' });
    for (const part of wrapLine(notes, 92)) {
      lines.push({ kind: 'body', text: part });
    }
  }

  return lines;
}

function pdfObject(id: number, body: string): string {
  return `${id} 0 obj\n${body}\nendobj\n`;
}

/** Build a multi-page Helvetica PDF and trigger download. */
export function downloadStudentDetailsPdf(input: StudentDetailsPdfInput): void {
  const contentLines = buildLines(input);
  const pageWidth = 612;
  const pageHeight = 792;
  const marginLeft = 48;
  const marginTop = 54;
  const marginBottom = 54;

  type DrawCmd = { x: number; y: number; size: number; bold: boolean; text: string };
  const pages: DrawCmd[][] = [];
  let page: DrawCmd[] = [];
  let y = pageHeight - marginTop;

  const startPage = () => {
    page = [];
    pages.push(page);
    y = pageHeight - marginTop;
  };

  const ensureSpace = (needed: number) => {
    // PDF y grows upward; break when the next line would go below the bottom margin.
    if (y - needed < marginBottom) startPage();
  };

  startPage();

  for (const line of contentLines) {
    if (line.kind === 'spacer') {
      y -= 10;
      continue;
    }
    if (line.kind === 'title') {
      ensureSpace(28);
      page.push({ x: marginLeft, y, size: 18, bold: true, text: line.text });
      y -= 26;
      continue;
    }
    if (line.kind === 'section') {
      ensureSpace(24);
      y -= 6;
      page.push({ x: marginLeft, y, size: 12, bold: true, text: line.text });
      y -= 18;
      continue;
    }
    if (line.kind === 'row') {
      const label = `${line.label}:`;
      const value = line.value?.trim() || '—';
      const valueParts = wrapLine(value, 70);
      ensureSpace(14 + Math.max(0, valueParts.length - 1) * 13);
      page.push({ x: marginLeft, y, size: 10, bold: true, text: label });
      page.push({ x: marginLeft + 140, y, size: 10, bold: false, text: valueParts[0] || '—' });
      y -= 14;
      for (let i = 1; i < valueParts.length; i += 1) {
        ensureSpace(14);
        page.push({ x: marginLeft + 140, y, size: 10, bold: false, text: valueParts[i] });
        y -= 13;
      }
      continue;
    }
    // body
    const parts = wrapLine(line.text, 92);
    for (const part of parts) {
      ensureSpace(14);
      page.push({ x: marginLeft, y, size: 10, bold: false, text: part });
      y -= 14;
    }
  }

  const objects: string[] = [];
  objects[1] = pdfObject(1, '<< /Type /Catalog /Pages 2 0 R >>');

  const pageObjectIds: number[] = [];
  let nextId = 3;

  const fontRegularId = nextId++;
  const fontBoldId = nextId++;
  objects[fontRegularId] = pdfObject(fontRegularId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects[fontBoldId] = pdfObject(fontBoldId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  for (const cmds of pages) {
    const contentId = nextId++;
    const pageId = nextId++;
    pageObjectIds.push(pageId);

    const streamParts: string[] = [];
    for (const cmd of cmds) {
      const fontRef = cmd.bold ? fontBoldId : fontRegularId;
      streamParts.push('BT');
      streamParts.push(`/${cmd.bold ? 'F2' : 'F1'} ${cmd.size} Tf`);
      streamParts.push(`${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)} Td`);
      streamParts.push(`(${escapePdfText(cmd.text)}) Tj`);
      streamParts.push('ET');
    }
    const stream = streamParts.join('\n');
    objects[contentId] = pdfObject(
      contentId,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    );
    objects[pageId] = pdfObject(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> >>`
    );
  }

  objects[2] = pdfObject(
    2,
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`
  );

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 1; i < objects.length; i += 1) {
    if (!objects[i]) continue;
    offsets[i] = pdf.length;
    pdf += objects[i];
  }

  const xrefStart = pdf.length;
  const maxObj = objects.length - 1;
  pdf += `xref\n0 ${maxObj + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= maxObj; i += 1) {
    const off = offsets[i] ?? 0;
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const namePart =
    sanitizeFilenamePart([input.firstName, input.lastName].filter(Boolean).join('_')) ||
    sanitizeFilenamePart(input.phone) ||
    'student';
  a.href = url;
  a.download = `${namePart}_details.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
