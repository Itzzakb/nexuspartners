import { useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  ChevronDown,
  Code2,
  FileText,
  GripVertical,
  GraduationCap,
  Pencil,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Toggle } from '@/components/ui/Toggle';
import { resumeParseApi, resumeTemplateApi } from '@/lib/api';
import {
  detailsToEditableDraft,
  editableDraftToResumeData,
  emptyCertification,
  emptyEducation,
  emptyExperience,
  emptyProject,
  emptySkillGroup,
  emptySummaryPoint,
  moveItem,
  parsedPayloadToEditableDraft,
  RESUME_VIEW_TABS,
  type EditableResumeDraft,
  type ResumeViewTab,
} from '@/lib/studentResume';
import { cn } from '@/lib/utils';
import type { ResumeTemplate, StudentDetail } from '@/types/phase7';

interface StudentResumeEditorProps {
  student: StudentDetail;
  onSaved: (resumeData: Record<string, unknown>) => void;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}

export function StudentResumeEditor({
  student,
  onSaved,
  onError,
  onMessage,
}: StudentResumeEditorProps) {
  const details = student.details as Record<string, unknown>;
  const [draft, setDraft] = useState<EditableResumeDraft>(() => detailsToEditableDraft(details));
  const [subTab, setSubTab] = useState<ResumeViewTab>('summary');
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expandedExp, setExpandedExp] = useState<string | null>(null);
  const [expandedEdu, setExpandedEdu] = useState<string | null>(null);
  const [expandedCert, setExpandedCert] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(detailsToEditableDraft(student.details as Record<string, unknown>));
    // Re-hydrate when switching students or after parent replaces resume payload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.phone, (student.details as { resume?: unknown })?.resume]);

  useEffect(() => {
    resumeTemplateApi
      .list(student.companyId)
      .then((d) => {
        setTemplates(d.templates);
        const def = d.templates.find((t) => t.isDefault);
        if (def) setTemplateId(def.id);
      })
      .catch(() => {});
  }, [student.companyId]);

  const updateDraft = (updater: (prev: EditableResumeDraft) => EditableResumeDraft) => {
    setDraft(updater);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const resumeData = editableDraftToResumeData(draft);
      await resumeParseApi.updateStudent({
        phone: student.phone,
        resumeData,
        companyId: student.companyId,
      });
      onSaved(resumeData);
      onMessage('Resume saved successfully');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save resume');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    setUploading(true);
    try {
      // Server: extract PDF/DOCX/TXT → parse → auto-save student.resume
      const result = await resumeParseApi.importStudent({
        phone: student.phone,
        file,
        companyId: student.companyId,
      });
      const next = parsedPayloadToEditableDraft(result.resume);
      setDraft(next);
      setExpandedExp(next.experience[0]?.id || null);
      onSaved(result.resume);
      onMessage(result.message || `Resume imported and saved from ${file.name}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to import uploaded resume');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const reorderSummary = (from: number, to: number) => {
    updateDraft((prev) => ({ ...prev, summary: moveItem(prev.summary, from, to) }));
  };

  const reorderProjects = (from: number, to: number) => {
    updateDraft((prev) => ({ ...prev, projects: moveItem(prev.projects, from, to) }));
  };

  const reorderCerts = (from: number, to: number) => {
    updateDraft((prev) => ({ ...prev, certifications: moveItem(prev.certifications, from, to) }));
  };

  return (
    <div className="np-card overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Pencil className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-heading">Resume Editor</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.md,.json,.text"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadFile(file);
            }}
          />
          <button
            type="button"
            className="np-btn-secondary !py-2 text-sm"
            disabled={uploading || saving}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {uploading ? 'Importing…' : 'Upload Resume'}
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

      <div className="space-y-5 p-5">
        {/* Job title + template */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-heading">Job Title</span>
            <input
              className="np-input"
              value={draft.jobtitle}
              onChange={(e) => updateDraft((prev) => ({ ...prev, jobtitle: e.target.value }))}
              placeholder="e.g. Data Analyst"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-heading">Resume Template</span>
            <select
              className="np-input"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">No template selected</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Sub-tabs */}
        <div className="flex flex-wrap gap-1 border-b border-border">
          {RESUME_VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
                onClick={() => {
                  setSubTab(tab.id);
                  setDragIndex(null);
                }}
              className={cn(
                'rounded-t-md px-3 py-2 text-sm font-medium transition',
                subTab === tab.id
                  ? 'bg-muted text-heading'
                  : 'text-body hover:bg-muted/60 hover:text-heading'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Summary */}
        {subTab === 'summary' && (
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-heading">
                  Professional Summary (drag to reorder)
                </h3>
              </div>
              <button
                type="button"
                className="np-btn-secondary !py-1.5 text-xs"
                onClick={() =>
                  updateDraft((prev) => ({
                    ...prev,
                    summary: [...prev.summary, emptySummaryPoint()],
                  }))
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Point
              </button>
            </div>
            <div className="space-y-2">
              {draft.summary.length === 0 && (
                <p className="py-6 text-center text-sm text-body">No summary points yet.</p>
              )}
              {draft.summary.map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex != null) reorderSummary(dragIndex, index);
                    setDragIndex(null);
                  }}
                  className="flex items-start gap-2 rounded-lg border border-border bg-surface p-2"
                >
                  <GripVertical className="mt-2.5 h-4 w-4 shrink-0 cursor-grab text-body" />
                  <button
                    type="button"
                    className="mt-2 shrink-0 text-body hover:text-amber-500"
                    title="Star point"
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        summary: prev.summary.map((s) =>
                          s.id === item.id ? { ...s, starred: !s.starred } : s
                        ),
                      }))
                    }
                  >
                    <Star
                      className={cn('h-4 w-4', item.starred && 'fill-amber-400 text-amber-500')}
                    />
                  </button>
                  <textarea
                    className="np-input min-h-[72px] flex-1"
                    value={item.point}
                    onChange={(e) =>
                      updateDraft((prev) => ({
                        ...prev,
                        summary: prev.summary.map((s) =>
                          s.id === item.id ? { ...s, point: e.target.value } : s
                        ),
                      }))
                    }
                    placeholder="Summary bullet…"
                  />
                  <button
                    type="button"
                    className="mt-2 shrink-0 text-red-500 hover:text-red-700"
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        summary: prev.summary.filter((s) => s.id !== item.id),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Experience */}
        {subTab === 'experience' && (
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-heading">Work Experience</h3>
              </div>
              <button
                type="button"
                className="np-btn-secondary !py-1.5 text-xs"
                onClick={() => {
                  const row = emptyExperience();
                  updateDraft((prev) => ({ ...prev, experience: [...prev.experience, row] }));
                  setExpandedExp(row.id);
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Experience
              </button>
            </div>
            <div className="space-y-3">
              {draft.experience.length === 0 && (
                <p className="py-6 text-center text-sm text-body">No experience entries yet.</p>
              )}
              {draft.experience.map((exp) => {
                const open = expandedExp === exp.id;
                const pointCount = exp.points.filter((p) => p.point.trim()).length;
                return (
                  <div key={exp.id} className="rounded-lg border border-border">
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <Toggle
                        size="sm"
                        checked={exp.visible}
                        aria-label="Show experience"
                        onChange={(checked) =>
                          updateDraft((prev) => ({
                            ...prev,
                            experience: prev.experience.map((e) =>
                              e.id === exp.id ? { ...e, visible: checked } : e
                            ),
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left"
                        onClick={() => setExpandedExp(open ? null : exp.id)}
                      >
                        <span className="font-semibold text-heading">
                          {exp.position || 'Untitled role'}
                        </span>
                        {exp.company && (
                          <span className="text-sm text-body">| {exp.company}</span>
                        )}
                        <span className="rounded-pill bg-muted px-2 py-0.5 text-xs text-body">
                          {pointCount} points
                        </span>
                      </button>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-body transition',
                          open && 'rotate-180'
                        )}
                      />
                    </div>
                    {open && (
                      <div className="space-y-4 border-t border-border px-4 py-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field
                            label="Position"
                            value={exp.position}
                            onChange={(v) =>
                              updateDraft((prev) => ({
                                ...prev,
                                experience: prev.experience.map((e) =>
                                  e.id === exp.id ? { ...e, position: v } : e
                                ),
                              }))
                            }
                          />
                          <Field
                            label="Company"
                            value={exp.company}
                            onChange={(v) =>
                              updateDraft((prev) => ({
                                ...prev,
                                experience: prev.experience.map((e) =>
                                  e.id === exp.id ? { ...e, company: v } : e
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field
                            label="Location"
                            value={exp.location}
                            onChange={(v) =>
                              updateDraft((prev) => ({
                                ...prev,
                                experience: prev.experience.map((e) =>
                                  e.id === exp.id ? { ...e, location: v } : e
                                ),
                              }))
                            }
                          />
                          <Field
                            label="Start"
                            value={exp.start}
                            onChange={(v) =>
                              updateDraft((prev) => ({
                                ...prev,
                                experience: prev.experience.map((e) =>
                                  e.id === exp.id ? { ...e, start: v } : e
                                ),
                              }))
                            }
                          />
                          <Field
                            label="End"
                            value={exp.end}
                            onChange={(v) =>
                              updateDraft((prev) => ({
                                ...prev,
                                experience: prev.experience.map((e) =>
                                  e.id === exp.id ? { ...e, end: v } : e
                                ),
                              }))
                            }
                          />
                        </div>

                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-medium text-heading">Bullet Points</p>
                            <button
                              type="button"
                              className="np-btn-secondary !py-1 text-xs"
                              onClick={() =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  experience: prev.experience.map((e) =>
                                    e.id === exp.id
                                      ? { ...e, points: [...e.points, emptySummaryPoint()] }
                                      : e
                                  ),
                                }))
                              }
                            >
                              <Plus className="mr-1 h-3.5 w-3.5" />
                              Add Point
                            </button>
                          </div>
                          <div className="space-y-2">
                            {exp.points.map((pt) => (
                              <div key={pt.id} className="flex items-start gap-2">
                                <GripVertical className="mt-2.5 h-4 w-4 shrink-0 text-body" />
                                <button
                                  type="button"
                                  className="mt-2 shrink-0 text-body hover:text-amber-500"
                                  onClick={() =>
                                    updateDraft((prev) => ({
                                      ...prev,
                                      experience: prev.experience.map((e) =>
                                        e.id === exp.id
                                          ? {
                                              ...e,
                                              points: e.points.map((p) =>
                                                p.id === pt.id ? { ...p, starred: !p.starred } : p
                                              ),
                                            }
                                          : e
                                      ),
                                    }))
                                  }
                                >
                                  <Star
                                    className={cn(
                                      'h-4 w-4',
                                      pt.starred && 'fill-amber-400 text-amber-500'
                                    )}
                                  />
                                </button>
                                <textarea
                                  className="np-input min-h-[64px] flex-1"
                                  value={pt.point}
                                  onChange={(e) =>
                                    updateDraft((prev) => ({
                                      ...prev,
                                      experience: prev.experience.map((row) =>
                                        row.id === exp.id
                                          ? {
                                              ...row,
                                              points: row.points.map((p) =>
                                                p.id === pt.id
                                                  ? { ...p, point: e.target.value }
                                                  : p
                                              ),
                                            }
                                          : row
                                      ),
                                    }))
                                  }
                                />
                                <button
                                  type="button"
                                  className="mt-2 shrink-0 text-red-500 hover:text-red-700"
                                  onClick={() =>
                                    updateDraft((prev) => ({
                                      ...prev,
                                      experience: prev.experience.map((row) =>
                                        row.id === exp.id
                                          ? {
                                              ...row,
                                              points: row.points.filter((p) => p.id !== pt.id),
                                            }
                                          : row
                                      ),
                                    }))
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="rounded-pill border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                            onClick={() =>
                              updateDraft((prev) => ({
                                ...prev,
                                experience: prev.experience.filter((e) => e.id !== exp.id),
                              }))
                            }
                          >
                            Remove Experience
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Education */}
        {subTab === 'education' && (
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-heading">Education</h3>
              </div>
              <button
                type="button"
                className="np-btn-secondary !py-1.5 text-xs"
                onClick={() => {
                  const row = emptyEducation();
                  updateDraft((prev) => ({ ...prev, education: [...prev.education, row] }));
                  setExpandedEdu(row.id);
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Education
              </button>
            </div>
            <div className="space-y-3">
              {draft.education.length === 0 && (
                <p className="py-6 text-center text-sm text-body">No education entries yet.</p>
              )}
              {draft.education.map((edu) => {
                const open = expandedEdu === edu.id;
                return (
                  <div key={edu.id} className="rounded-lg border border-border">
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <Toggle
                        size="sm"
                        checked={edu.visible}
                        aria-label="Show education"
                        onChange={(checked) =>
                          updateDraft((prev) => ({
                            ...prev,
                            education: prev.education.map((e) =>
                              e.id === edu.id ? { ...e, visible: checked } : e
                            ),
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setExpandedEdu(open ? null : edu.id)}
                      >
                        <span className="font-semibold text-heading">
                          {edu.education_title || 'Untitled degree'}
                        </span>
                        {edu.university && (
                          <span className="ml-2 text-sm text-body">at {edu.university}</span>
                        )}
                      </button>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-body transition',
                          open && 'rotate-180'
                        )}
                      />
                    </div>
                    {open && (
                      <div className="space-y-3 border-t border-border px-4 py-4">
                        <Field
                          label="Degree / Title"
                          value={edu.education_title}
                          onChange={(v) =>
                            updateDraft((prev) => ({
                              ...prev,
                              education: prev.education.map((e) =>
                                e.id === edu.id ? { ...e, education_title: v } : e
                              ),
                            }))
                          }
                        />
                        <Field
                          label="University"
                          value={edu.university}
                          onChange={(v) =>
                            updateDraft((prev) => ({
                              ...prev,
                              education: prev.education.map((e) =>
                                e.id === edu.id ? { ...e, university: v } : e
                              ),
                            }))
                          }
                        />
                        <Field
                          label="Duration"
                          value={edu.start_end}
                          onChange={(v) =>
                            updateDraft((prev) => ({
                              ...prev,
                              education: prev.education.map((e) =>
                                e.id === edu.id ? { ...e, start_end: v } : e
                              ),
                            }))
                          }
                        />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="rounded-pill border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                            onClick={() =>
                              updateDraft((prev) => ({
                                ...prev,
                                education: prev.education.filter((e) => e.id !== edu.id),
                              }))
                            }
                          >
                            Remove Education
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Skills */}
        {subTab === 'skills' && (
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-heading">Technical Skills</h3>
              </div>
              <button
                type="button"
                className="np-btn-secondary !py-1.5 text-xs"
                onClick={() =>
                  updateDraft((prev) => ({
                    ...prev,
                    skills: [...prev.skills, emptySkillGroup()],
                  }))
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Skill Group
              </button>
            </div>
            <div className="space-y-3">
              {draft.skills.length === 0 && (
                <p className="py-6 text-center text-sm text-body">No skill groups yet.</p>
              )}
              {draft.skills.map((group) => (
                <div key={group.id} className="rounded-lg border border-border p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <input
                      className="np-input max-w-md font-semibold"
                      value={group.skill_title}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          skills: prev.skills.map((g) =>
                            g.id === group.id ? { ...g, skill_title: e.target.value } : g
                          ),
                        }))
                      }
                      placeholder="Category name"
                    />
                    <button
                      type="button"
                      className="shrink-0 text-red-500 hover:text-red-700"
                      onClick={() =>
                        updateDraft((prev) => ({
                          ...prev,
                          skills: prev.skills.filter((g) => g.id !== group.id),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    className="np-input min-h-[72px]"
                    value={group.skills}
                    onChange={(e) =>
                      updateDraft((prev) => ({
                        ...prev,
                        skills: prev.skills.map((g) =>
                          g.id === group.id ? { ...g, skills: e.target.value } : g
                        ),
                      }))
                    }
                    placeholder="SQL, Python, R…"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Projects */}
        {subTab === 'projects' && (
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-heading">
                Projects (optional, drag to reorder)
              </h3>
              <button
                type="button"
                className="np-btn-secondary !py-1.5 text-xs"
                onClick={() =>
                  updateDraft((prev) => ({
                    ...prev,
                    projects: [...prev.projects, emptyProject()],
                  }))
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Project
              </button>
            </div>
            <div className="space-y-3">
              {draft.projects.length === 0 && (
                <p className="py-6 text-center text-sm text-body">No projects yet.</p>
              )}
              {draft.projects.map((project, index) => (
                <div
                  key={project.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex != null) reorderProjects(dragIndex, index);
                    setDragIndex(null);
                  }}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <GripVertical className="h-4 w-4 cursor-grab text-body" />
                    <span className="text-sm font-medium text-heading">
                      {project.title || 'New Project'}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <Field
                      label="Project Title"
                      value={project.title}
                      onChange={(v) =>
                        updateDraft((prev) => ({
                          ...prev,
                          projects: prev.projects.map((p) =>
                            p.id === project.id ? { ...p, title: v } : p
                          ),
                        }))
                      }
                    />
                    <label className="block text-sm">
                      <span className="mb-1.5 block font-medium text-heading">Description</span>
                      <textarea
                        className="np-input min-h-[100px]"
                        value={project.description}
                        onChange={(e) =>
                          updateDraft((prev) => ({
                            ...prev,
                            projects: prev.projects.map((p) =>
                              p.id === project.id ? { ...p, description: e.target.value } : p
                            ),
                          }))
                        }
                        placeholder="Describe your project, technologies used, and your role..."
                      />
                    </label>
                    <Field
                      label="Link (optional)"
                      value={project.link}
                      onChange={(v) =>
                        updateDraft((prev) => ({
                          ...prev,
                          projects: prev.projects.map((p) =>
                            p.id === project.id ? { ...p, link: v } : p
                          ),
                        }))
                      }
                      placeholder="https://github.com/username/project"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="rounded-pill border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                        onClick={() =>
                          updateDraft((prev) => ({
                            ...prev,
                            projects: prev.projects.filter((p) => p.id !== project.id),
                          }))
                        }
                      >
                        Remove Project
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Certs */}
        {subTab === 'certs' && (
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-heading">
                Certifications (optional, drag to reorder)
              </h3>
              <button
                type="button"
                className="np-btn-secondary !py-1.5 text-xs"
                onClick={() => {
                  const row = emptyCertification();
                  updateDraft((prev) => ({
                    ...prev,
                    certifications: [...prev.certifications, row],
                  }));
                  setExpandedCert(row.id);
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Certification
              </button>
            </div>
            <div className="space-y-3">
              {draft.certifications.length === 0 && (
                <p className="py-6 text-center text-sm text-body">No certifications yet.</p>
              )}
              {draft.certifications.map((cert, index) => {
                const open = expandedCert === cert.id || !cert.title;
                return (
                  <div
                    key={cert.id}
                    draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIndex != null) reorderCerts(dragIndex, index);
                      setDragIndex(null);
                    }}
                    className="rounded-lg border border-border"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-3 text-left"
                      onClick={() => setExpandedCert(open ? null : cert.id)}
                    >
                      <GripVertical className="h-4 w-4 cursor-grab text-body" />
                      <span className="flex-1 font-medium text-heading">
                        {cert.title || 'New Certification'}
                      </span>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 text-body transition',
                          open && 'rotate-180'
                        )}
                      />
                    </button>
                    {open && (
                      <div className="space-y-3 border-t border-border px-4 py-4">
                        <Field
                          label="Certification Title"
                          value={cert.title}
                          onChange={(v) =>
                            updateDraft((prev) => ({
                              ...prev,
                              certifications: prev.certifications.map((c) =>
                                c.id === cert.id ? { ...c, title: v } : c
                              ),
                            }))
                          }
                          placeholder="AWS Solutions Architect"
                        />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="rounded-pill border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                            onClick={() =>
                              updateDraft((prev) => ({
                                ...prev,
                                certifications: prev.certifications.filter((c) => c.id !== cert.id),
                              }))
                            }
                          >
                            Remove Certification
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-heading">{label}</span>
      <input
        className="np-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
