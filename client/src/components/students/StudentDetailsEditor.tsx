import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignLeft,
  Bold,
  Download,
  GripVertical,
  Italic,
  Link2,
  List,
  ListOrdered,
  Mail,
  MessageSquareText,
  Phone,
  Plus,
  Search,
  Strikethrough,
  Trash2,
  Underline,
  UserRound,
} from 'lucide-react';
import { studentApi } from '@/lib/api';
import { downloadStudentDetailsPdf } from '@/lib/studentDetailsPdf';
import { moveItem, newId } from '@/lib/studentResume';
import { cn } from '@/lib/utils';
import { VISA_OPTIONS } from '@/types/resumeForm';
import type { StudentDetail } from '@/types/phase7';

const ROLE_OPTIONS = [
  'Data Analyst',
  'Business Analyst',
  'Software Engineer',
  'Full Stack Developer',
  'Java Developer',
  'Python Developer',
  'DevOps Engineer',
  'QA Engineer',
  'Project Manager',
  'Scrum Master',
  'Gen AI',
];

const DETAIL_VISA_OPTIONS = ['OPT', ...VISA_OPTIONS.filter((v) => v !== 'OPT')];

/** Fields that belong in the Resume tab — keep out of Details suggestions & list. */
const RESUME_ONLY_FIELDS = new Set(['professional summary', 'technical skills']);

const SUGGESTED_DETAIL_FIELDS: Array<{ key: string; required?: boolean }> = [
  { key: 'Password', required: true },
  { key: 'Date of Birth', required: true },
  { key: 'Vendor call' },
  { key: 'USA Entry', required: true },
  { key: 'Contact No', required: true },
  { key: 'Visa Status', required: true },
  { key: 'Address', required: true },
  { key: 'Date of Arrival' },
  { key: 'Masters University' },
  { key: 'Masters Field' },
  { key: 'Masters Start Date' },
  { key: 'Masters End Date' },
  { key: 'Bachelors University' },
  { key: 'Bachelors Field' },
  { key: 'Bachelors Start Date' },
  { key: 'Bachelors End Date' },
];

function isResumeOnlyField(key: string) {
  return RESUME_ONLY_FIELDS.has(key.trim().toLowerCase());
}

interface DetailField {
  id: string;
  key: string;
  data: string;
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

/** Expand legacy "Start-End Date" into separate Start/End fields for editing. */
function normalizeDetailFields(rows: DetailField[]): DetailField[] {
  const byKey = new Map(rows.map((r) => [r.key.trim().toLowerCase(), r]));
  const next = [...rows];

  const expand = (level: 'Masters' | 'Bachelors') => {
    const combinedKey = `${level} Start-End Date`.toLowerCase();
    const startKey = `${level} Start Date`.toLowerCase();
    const endKey = `${level} End Date`.toLowerCase();
    const combined = byKey.get(combinedKey);
    if (!combined) return;
    const hasStart = byKey.has(startKey);
    const hasEnd = byKey.has(endKey);
    const { start, end } = splitEducationDateRange(combined.data);
    if (!hasStart && start) {
      const row = { id: newId('fld'), key: `${level} Start Date`, data: start };
      next.push(row);
      byKey.set(startKey, row);
    }
    if (!hasEnd && end) {
      const row = { id: newId('fld'), key: `${level} End Date`, data: end };
      next.push(row);
      byKey.set(endKey, row);
    }
    // Drop the combined field once split (or when separate fields already exist).
    const idx = next.findIndex((r) => r.key.trim().toLowerCase() === combinedKey);
    if (idx >= 0) next.splice(idx, 1);
  };

  expand('Masters');
  expand('Bachelors');
  return next;
}

interface StudentDetailsEditorProps {
  student: StudentDetail;
  notes: string;
  onSaved: (next: { student: StudentDetail; notes: string }) => void;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}

function splitName(name: string) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function toDateInput(value: string): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
}

export function StudentDetailsEditor({
  student,
  notes: initialNotes,
  onSaved,
  onError,
  onMessage,
}: StudentDetailsEditorProps) {
  const details = student.details as Record<string, unknown>;
  const fromName = splitName(String(details.name || details.studentname || ''));
  const [firstName, setFirstName] = useState(String(details.firstname || fromName.firstName || ''));
  const [lastName, setLastName] = useState(String(details.lastname || fromName.lastName || ''));
  const [role, setRole] = useState(String(details.role || ''));
  const [email, setEmail] = useState(String(details.email || ''));
  const [phone, setPhone] = useState(String(details.phone || details.mobile || student.phone || ''));
  const [linkedin, setLinkedin] = useState(String(details.linkedin || ''));
  const [city, setCity] = useState(String(details.city || ''));
  const [state, setState] = useState(String(details.state || ''));
  const [notes, setNotes] = useState(initialNotes);
  const [fields, setFields] = useState<DetailField[]>([]);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [pickerForId, setPickerForId] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const roleOptions = useMemo(() => {
    const set = new Set(ROLE_OPTIONS);
    if (role) set.add(role);
    return Array.from(set);
  }, [role]);

  useEffect(() => {
    const d = student.details as Record<string, unknown>;
    const split = splitName(String(d.name || d.studentname || ''));
    setFirstName(String(d.firstname || split.firstName || ''));
    setLastName(String(d.lastname || split.lastName || ''));
    setRole(String(d.role || ''));
    setEmail(String(d.email || ''));
    setPhone(String(d.phone || d.mobile || student.phone || ''));
    setLinkedin(String(d.linkedin || ''));
    setCity(String(d.city || ''));
    setState(String(d.state || ''));
    setNotes(initialNotes);

    const raw = Array.isArray(d.additionalDetails)
      ? d.additionalDetails
      : Array.isArray(d.adtionaldetails)
        ? d.adtionaldetails
        : [];
    setFields(
      normalizeDetailFields(
        raw
          .map((item, i) => {
            const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
            return {
              id: newId(`fld-${i}`),
              key: String(row.key || row.label || ''),
              data: String(row.data || row.value || ''),
            };
          })
          .filter((row) => row.key && !isResumeOnlyField(row.key))
      )
    );
    setPickerForId(null);
    setPickerQuery('');
  }, [student.phone, student.details, initialNotes]);

  useEffect(() => {
    if (!pickerForId) return;
    const onPointerDown = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerForId(null);
        setPickerQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [pickerForId]);

  const usedKeys = useMemo(
    () => new Set(fields.map((f) => f.key.trim().toLowerCase()).filter(Boolean)),
    [fields]
  );

  const filteredSuggestions = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const currentKey =
      fields.find((f) => f.id === pickerForId)?.key.trim().toLowerCase() || '';
    return SUGGESTED_DETAIL_FIELDS.filter((item) => {
      if (isResumeOnlyField(item.key)) return false;
      const lower = item.key.toLowerCase();
      if (usedKeys.has(lower) && lower !== currentKey) return false;
      if (!q) return true;
      return lower.includes(q);
    });
  }, [pickerQuery, usedKeys, fields, pickerForId]);

  const canAddCustom = (() => {
    const q = pickerQuery.trim();
    if (!q || isResumeOnlyField(q)) return false;
    const lower = q.toLowerCase();
    const currentKey =
      fields.find((f) => f.id === pickerForId)?.key.trim().toLowerCase() || '';
    if (usedKeys.has(lower) && lower !== currentKey) return false;
    if (SUGGESTED_DETAIL_FIELDS.some((s) => s.key.toLowerCase() === lower)) return false;
    return true;
  })();

  const openPickerFor = (fieldId: string) => {
    setPickerForId(fieldId);
    setPickerQuery('');
  };

  const applyFieldKey = (fieldId: string, key: string) => {
    const nextKey = key.trim();
    if (!nextKey || isResumeOnlyField(nextKey)) return;
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, key: nextKey } : f))
    );
    setPickerForId(null);
    setPickerQuery('');
  };

  const handleAddField = () => {
    const id = newId('fld');
    setFields((prev) => [...prev, { id, key: '', data: '' }]);
    setPickerForId(id);
    setPickerQuery('');
  };

  const wrapSelection = (before: string, after = before) => {
    const el = notesRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = notes.slice(start, end) || 'text';
    const next = `${notes.slice(0, start)}${before}${selected}${after}${notes.slice(end)}`;
    setNotes(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const visaField = fields.find((f) => f.key.toLowerCase() === 'visa status');
      const data = await studentApi.update(student.phone, {
        companyId: student.companyId,
        firstName,
        lastName,
        email,
        phone,
        role,
        city,
        state,
        linkedin,
        visa: visaField?.data || String(details.visa || ''),
        additionalDetails: fields
          .filter((f) => f.key.trim() && !isResumeOnlyField(f.key))
          .map(({ key, data: value }) => ({ key: key.trim(), data: value })),
        notes,
      });
      onSaved({ student: data.student, notes: data.student.notes || notes });
      onMessage('Student details saved');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save details');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = () => {
    setDownloadingPdf(true);
    try {
      downloadStudentDetailsPdf({
        firstName,
        lastName,
        role,
        email,
        phone,
        linkedin,
        city,
        state,
        companyLabel: student.companyLabel,
        notes,
        additionalDetails: fields
          .filter((f) => f.key.trim() && !isResumeOnlyField(f.key))
          .map(({ key, data: value }) => ({ key: key.trim(), data: value })),
      });
      onMessage('Student details PDF downloaded');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to download PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="np-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <UserRound className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-heading">Student Details Editor</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="np-btn-secondary !py-2 text-sm"
            disabled={downloadingPdf}
            onClick={handleDownloadPdf}
            title="Download student details as PDF for resume team"
          >
            <Download className="mr-1.5 h-4 w-4" />
            {downloadingPdf ? 'Preparing…' : 'Download PDF'}
          </button>
          <button
            type="button"
            className="np-btn-primary !py-2 text-sm"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="space-y-8 p-5">
        <section>
          <h3 className="mb-3 text-sm font-semibold text-heading">Personal Information</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="First Name" value={firstName} onChange={setFirstName} />
            <Field label="Last Name" value={lastName} onChange={setLastName} />
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-heading">Role / Job Title</span>
              <select className="np-input" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Select role</option>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-heading">Contact Information</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <IconField icon={Mail} label="Email" value={email} onChange={setEmail} type="email" />
            <IconField icon={Phone} label="Phone" value={phone} onChange={setPhone} />
            <IconField
              icon={Link2}
              label="LinkedIn"
              value={linkedin}
              onChange={setLinkedin}
              placeholder="https://linkedin.com/in/…"
            />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-heading">Location</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" value={city} onChange={setCity} />
            <Field label="State" value={state} onChange={setState} />
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-heading">Additional Details</h3>
            <button
              type="button"
              className="np-btn-secondary !py-1.5 text-xs"
              onClick={handleAddField}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Field
            </button>
          </div>
          <div className="space-y-2">
            {fields.length === 0 && (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-body">
                No additional fields yet. Click Add Field to choose from suggestions or create a custom field.
              </p>
            )}
            {fields.map((field, index) => {
              const isVisa = field.key.toLowerCase() === 'visa status';
              const isDateLike = /date|birth|arrival|entry|graduated/i.test(field.key);
              const showPicker = pickerForId === field.id;
              return (
                <div
                  key={field.id}
                  draggable={!showPicker}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex != null) setFields((prev) => moveItem(prev, dragIndex, index));
                    setDragIndex(null);
                  }}
                  className="flex flex-wrap items-start gap-2 rounded-lg border border-border bg-surface p-2 sm:flex-nowrap sm:items-center"
                >
                  <GripVertical className="mt-2.5 h-4 w-4 shrink-0 cursor-grab text-body sm:mt-0" />
                  <div className="relative w-full max-w-[220px] shrink-0" ref={showPicker ? pickerRef : undefined}>
                    <button
                      type="button"
                      className="np-input flex w-full items-center justify-between gap-2 bg-muted/40 text-left"
                      onClick={() => (showPicker ? setPickerForId(null) : openPickerFor(field.id))}
                    >
                      <span className={cn('truncate', !field.key && 'text-body')}>
                        {field.key || 'Select field…'}
                      </span>
                    </button>
                    {showPicker && (
                      <div className="absolute left-0 top-full z-30 mt-1 w-[min(100vw-3rem,280px)] overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                        <div className="relative border-b border-border p-2">
                          <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-body" />
                          <input
                            autoFocus
                            className="np-input !py-2 pl-8 text-sm"
                            placeholder="Search field..."
                            value={pickerQuery}
                            onChange={(e) => setPickerQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (filteredSuggestions[0]) {
                                  applyFieldKey(field.id, filteredSuggestions[0].key);
                                } else if (canAddCustom) {
                                  applyFieldKey(field.id, pickerQuery);
                                }
                              } else if (e.key === 'Escape') {
                                setPickerForId(null);
                                setPickerQuery('');
                              }
                            }}
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto py-1">
                          <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-body">
                            Suggested Fields
                          </p>
                          {filteredSuggestions.length === 0 && !canAddCustom && (
                            <p className="px-3 py-2 text-sm text-body">No matching fields</p>
                          )}
                          {filteredSuggestions.map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-heading hover:bg-muted"
                              onClick={() => applyFieldKey(field.id, item.key)}
                            >
                              <span>{item.key}</span>
                              {item.required && (
                                <span className="text-xs font-medium text-red-500">(required)</span>
                              )}
                            </button>
                          ))}
                          {canAddCustom && (
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-muted"
                              onClick={() => applyFieldKey(field.id, pickerQuery)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add “{pickerQuery.trim()}”
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {isVisa ? (
                    <select
                      className="np-input min-w-0 flex-1 bg-muted/40"
                      value={field.data}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((f) => (f.id === field.id ? { ...f, data: e.target.value } : f))
                        )
                      }
                    >
                      <option value="">Select visa</option>
                      {DETAIL_VISA_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                      {field.data && !DETAIL_VISA_OPTIONS.includes(field.data) && (
                        <option value={field.data}>{field.data}</option>
                      )}
                    </select>
                  ) : (
                    <input
                      className="np-input min-w-0 flex-1 bg-muted/40"
                      type={isDateLike && /^\d{4}-\d{2}-\d{2}/.test(field.data) ? 'date' : 'text'}
                      value={
                        isDateLike && /^\d{4}-\d{2}-\d{2}/.test(field.data)
                          ? toDateInput(field.data)
                          : field.data
                      }
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((f) => (f.id === field.id ? { ...f, data: e.target.value } : f))
                        )
                      }
                      placeholder="Value"
                    />
                  )}
                  <button
                    type="button"
                    className="mt-2 shrink-0 text-red-500 hover:text-red-700 sm:mt-0"
                    onClick={() => {
                      setFields((prev) => prev.filter((f) => f.id !== field.id));
                      if (pickerForId === field.id) {
                        setPickerForId(null);
                        setPickerQuery('');
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-heading">Recruiter Notes</h3>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex flex-wrap gap-1 border-b border-border bg-muted/50 px-2 py-1.5">
              <ToolBtn icon={Bold} label="Bold" onClick={() => wrapSelection('**')} />
              <ToolBtn icon={Italic} label="Italic" onClick={() => wrapSelection('_')} />
              <ToolBtn icon={Underline} label="Underline" onClick={() => wrapSelection('<u>', '</u>')} />
              <ToolBtn
                icon={Strikethrough}
                label="Strike"
                onClick={() => wrapSelection('~~')}
              />
              <ToolBtn icon={List} label="Bullet list" onClick={() => wrapSelection('\n- ', '')} />
              <ToolBtn
                icon={ListOrdered}
                label="Numbered list"
                onClick={() => wrapSelection('\n1. ', '')}
              />
              <ToolBtn icon={AlignLeft} label="Align" onClick={() => notesRef.current?.focus()} />
              <ToolBtn
                icon={Link2}
                label="Link"
                onClick={() => wrapSelection('[', '](https://)')}
              />
            </div>
            <textarea
              ref={notesRef}
              className="min-h-[140px] w-full resize-y border-0 bg-muted/20 px-4 py-3 text-sm text-heading outline-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this student..."
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-heading">{label}</span>
      <input className="np-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function IconField({
  icon: Icon,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-heading">{label}</span>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
        <input
          className="np-input pl-9"
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  );
}

function ToolBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Bold;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      className="rounded p-1.5 text-body hover:bg-surface hover:text-heading"
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
