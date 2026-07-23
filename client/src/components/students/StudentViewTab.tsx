import {
  Download,
  FileText,
  GraduationCap,
  Linkedin,
  Mail,
  MapPin,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatDateRange,
  formatMoney,
  formatShortDate,
  getAdditionalDetail,
  getEducationDates,
  parseStudentResume,
  RESUME_VIEW_TABS,
  type ResumeViewTab,
} from '@/lib/studentResume';
import type { StudentDetail as StudentDetailData } from '@/types/phase7';

interface StudentViewTabProps {
  student: StudentDetailData;
  notes: string;
  onNotesChange: (value: string) => void;
  onSaveNotes: () => void;
  savingNotes: boolean;
  subscription: Record<string, unknown> | null;
  resumeTab: ResumeViewTab;
  onResumeTabChange: (tab: ResumeViewTab) => void;
  onDownload: () => void;
  downloading: boolean;
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 py-2 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wide text-body">{label}</span>
      <span className="text-sm text-heading text-right">{value}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="py-10 text-center text-sm text-body">{message}</p>;
}

export function StudentViewTab({
  student,
  notes,
  onNotesChange,
  onSaveNotes,
  savingNotes,
  subscription,
  resumeTab,
  onResumeTabChange,
  onDownload,
  downloading,
}: StudentViewTabProps) {
  const details = student.details as Record<string, unknown>;
  const resume = parseStudentResume(details);
  const jobTitle = resume.jobtitle || String(details.role || '');

  const email = String(details.email || '');
  const phone = String(details.phone || details.mobile || student.phone || '');
  const city = String(details.city || '');
  const state = String(details.state || '');
  const zip = getAdditionalDetail(details, 'Zip', 'Zip Code', 'zipCode') || '';
  const location = [city, state, zip].filter(Boolean).join(', ') || getAdditionalDetail(details, 'Address');
  const linkedin = String(details.linkedin || '');

  const amount =
    formatMoney(details.subscription_amount) ||
    formatMoney(subscription?.amount) ||
    formatMoney(subscription?.subscriptionAmount);
  const joinDate = String(details.joindate || '') || formatShortDate(subscription?.startDate);
  const daysLeft =
    details.subscription_days != null && details.subscription_days !== ''
      ? `${details.subscription_days} Days`
      : subscription?.daysLeft != null
        ? `${subscription.daysLeft} Days`
        : '';
  const subDate = formatShortDate(details.subscription_date || subscription?.nextDueDate || subscription?.endDate);
  const recruiter = String(details.recruiterId || subscription?.recruiterUsername || '');

  const additionalRows: Array<{ label: string; value: string }> = [
    { label: 'Visa Status', value: getAdditionalDetail(details, 'Visa Status') || String(details.visa || '') },
    {
      label: 'Date of Arrival',
      value:
        getAdditionalDetail(details, 'Date of Arrival', 'Date of Arrival USA', 'USA Entry date') ||
        '',
    },
    { label: 'Date of Birth', value: getAdditionalDetail(details, 'Date of Birth') },
    { label: 'Password', value: getAdditionalDetail(details, 'Password') },
    { label: 'USA Entry date', value: getAdditionalDetail(details, 'USA Entry date', 'Date of Arrival USA') },
    {
      label: 'Vendor call',
      value: getAdditionalDetail(details, 'Vendor call', 'Vendor Call Time'),
    },
    { label: 'Contact No', value: getAdditionalDetail(details, 'Contact No', 'Contact Number') || phone },
    { label: 'Address', value: getAdditionalDetail(details, 'Address') || location },
  ].filter((r) => r.value);

  // Education rows for Additional Details (mirror design)
  const mastersUni = getAdditionalDetail(details, 'Masters University', "Master's University");
  const mastersField = getAdditionalDetail(details, 'Masters Field', "Master's Field");
  const mastersDates = getEducationDates(details, 'Masters');
  const bachUni = getAdditionalDetail(details, 'Bachelors University', "Bachelor's University");
  const bachField = getAdditionalDetail(details, 'Bachelors Field', "Bachelor's Field");
  const bachDates = getEducationDates(details, 'Bachelors');

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
      {/* Left column */}
      <div className="space-y-4">
        <section className="np-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-heading">Contact Information</h3>
          <ul className="space-y-3 text-sm">
            {email && (
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <a href={`mailto:${email}`} className="break-all text-primary hover:underline">
                  {email}
                </a>
              </li>
            )}
            {phone && (
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-heading">{phone}</span>
              </li>
            )}
            {location && (
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-heading capitalize">{location}</span>
              </li>
            )}
            {linkedin && (
              <li className="flex items-start gap-2.5">
                <Linkedin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <a
                  href={linkedin.startsWith('http') ? linkedin : `https://${linkedin}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  LinkedIn Profile
                </a>
              </li>
            )}
            {!email && !phone && !location && !linkedin && (
              <li className="text-body">No contact details</li>
            )}
          </ul>
        </section>

        <section className="np-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-heading">Subscription Details</h3>
          <div className="space-y-0">
            <DetailRow label="Company" value={student.companyLabel} />
            <DetailRow label="Recruiter" value={recruiter || undefined} />
            <DetailRow label="Join Date" value={joinDate || undefined} />
            {amount && (
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 py-2">
                <span className="text-xs font-medium uppercase tracking-wide text-body">Amount</span>
                <span className="rounded-pill bg-primary/10 px-2.5 py-0.5 text-sm font-medium text-primary">
                  {amount}
                </span>
              </div>
            )}
            <DetailRow label="Date" value={subDate || undefined} />
            <DetailRow label="Days Left" value={daysLeft || undefined} />
            {!recruiter && !joinDate && !amount && !daysLeft && (
              <p className="py-2 text-sm text-body">No subscription details</p>
            )}
          </div>
        </section>

        <section className="np-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-heading">Additional Details</h3>
          <div className="space-y-0">
            {additionalRows.map((row) => (
              <DetailRow key={row.label} label={row.label} value={row.value} />
            ))}
            {(mastersUni || mastersField || mastersDates.start || mastersDates.end) && (
              <>
                <p className="pt-3 text-xs font-semibold uppercase tracking-wide text-heading">
                  Masters Degree
                </p>
                <DetailRow label="University" value={mastersUni} />
                <DetailRow label="Field of Study" value={mastersField} />
                <DetailRow label="Start Date" value={mastersDates.start || undefined} />
                <DetailRow label="End Date" value={mastersDates.end || undefined} />
              </>
            )}
            {(bachUni || bachField || bachDates.start || bachDates.end) && (
              <>
                <p className="pt-3 text-xs font-semibold uppercase tracking-wide text-heading">
                  Bachelors Degree
                </p>
                <DetailRow label="University" value={bachUni} />
                <DetailRow label="Field of Study" value={bachField} />
                <DetailRow label="Start Date" value={bachDates.start || undefined} />
                <DetailRow label="End Date" value={bachDates.end || undefined} />
              </>
            )}
            {!additionalRows.length && !mastersUni && !bachUni && (
              <p className="py-2 text-sm text-body">No additional details</p>
            )}
          </div>
        </section>

        <section className="np-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-heading">Recruiter Notes</h3>
          <textarea
            className="np-input min-h-[88px] text-sm"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="No notes available."
          />
          <button
            type="button"
            className="np-btn-primary mt-3 !py-2 text-sm"
            onClick={onSaveNotes}
            disabled={savingNotes}
          >
            {savingNotes ? 'Saving…' : 'Save Notes'}
          </button>
        </section>
      </div>

      {/* Right column — resume + 6 sub-tabs */}
      <section className="np-card flex min-h-[420px] flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-heading">
              Resume{jobTitle ? ` – ${jobTitle}` : ''}
            </h2>
          </div>
          <button
            type="button"
            className="np-btn-primary !py-2 text-sm"
            onClick={onDownload}
            disabled={downloading}
          >
            <Download className="mr-1.5 h-4 w-4" />
            {downloading ? 'Building…' : 'Download'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-border px-2 pt-2">
          {RESUME_VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onResumeTabChange(tab.id)}
              className={cn(
                'rounded-t-md px-3 py-2 text-sm font-medium transition',
                resumeTab === tab.id
                  ? 'bg-muted text-heading'
                  : 'text-body hover:bg-muted/60 hover:text-heading'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 p-5">
          {resumeTab === 'summary' && (
            <>
              {resume.summary.length === 0 ? (
                <EmptyState message="No summary available." />
              ) : (
                <ul className="list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-heading">
                  {resume.summary.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
            </>
          )}

          {resumeTab === 'experience' && (
            <>
              {resume.experience.length === 0 ? (
                <EmptyState message="No experience available." />
              ) : (
                <div className="space-y-6">
                  {resume.experience.map((exp, i) => (
                    <article key={i} className="border-b border-border/70 pb-5 last:border-0 last:pb-0">
                      <h3 className="text-base font-semibold text-heading">
                        {exp.position || 'Role'}
                        {exp.company ? (
                          <span className="font-normal text-body"> at {exp.company}</span>
                        ) : null}
                      </h3>
                      {(exp.start || exp.end) && (
                        <p className="mt-0.5 text-sm text-body">
                          {formatDateRange(exp.start, exp.end || 'Present')}
                        </p>
                      )}
                      {exp.location && <p className="text-xs text-body">{exp.location}</p>}
                      {exp.points.length > 0 && (
                        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-heading">
                          {exp.points.map((p, j) => (
                            <li key={j}>{p.point}</li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {resumeTab === 'education' && (
            <>
              {resume.education.length === 0 ? (
                <EmptyState message="No education available." />
              ) : (
                <div className="space-y-3">
                  {resume.education.map((edu, i) => (
                    <article
                      key={i}
                      className="flex gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <GraduationCap className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-heading">
                          {edu.education_title || 'Degree'}
                        </h3>
                        {edu.university && <p className="text-sm text-body">{edu.university}</p>}
                        {edu.start_end && <p className="text-xs text-body">{edu.start_end}</p>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {resumeTab === 'skills' && (
            <>
              {resume.skills.length === 0 ? (
                <EmptyState message="No skills available." />
              ) : (
                <div className="space-y-5">
                  {resume.skills.map((group, i) => (
                    <div key={i}>
                      {group.skill_title && (
                        <h3 className="mb-2 text-sm font-semibold text-heading">{group.skill_title}</h3>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {group.skills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-pill bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {resumeTab === 'projects' && (
            <>
              {resume.projects.length === 0 ? (
                <EmptyState message="No projects available." />
              ) : (
                <div className="space-y-5">
                  {resume.projects.map((project, i) => (
                    <article key={i} className="border-b border-border/70 pb-4 last:border-0">
                      <h3 className="font-semibold text-heading">{project.name}</h3>
                      {project.role && <p className="text-sm text-body">{project.role}</p>}
                      {(project.start || project.end) && (
                        <p className="text-xs text-body">{formatDateRange(project.start, project.end)}</p>
                      )}
                      {project.tech && <p className="mt-1 text-xs text-body">Stack: {project.tech}</p>}
                      {project.description && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-heading">{project.description}</p>
                      )}
                      {project.link && (
                        <a
                          href={project.link.startsWith('http') ? project.link : `https://${project.link}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-sm text-primary hover:underline"
                        >
                          {project.link}
                        </a>
                      )}
                      {project.points.length > 0 && (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-heading">
                          {project.points.map((p, j) => (
                            <li key={j}>{p.point}</li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {resumeTab === 'certs' && (
            <>
              {resume.certifications.length === 0 ? (
                <EmptyState message="No certifications available." />
              ) : (
                <ul className="space-y-2">
                  {resume.certifications.map((cert, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-heading"
                    >
                      {cert.certification_title}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
