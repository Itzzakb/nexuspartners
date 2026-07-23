/** Application / job-action statuses for recruiter Application Tracker. */
export const APPLICATION_STATUSES = [
  'saved',
  'applied',
  'interview_scheduled',
  'interview_completed',
  'offer_received',
  'hired',
  'rejected',
  'dropped',
];

export const APPLICATION_STATUS_LABELS = {
  saved: 'Saved',
  applied: 'Applied',
  interview_scheduled: 'Interview Scheduled',
  interview_completed: 'Interview Completed',
  offer_received: 'Offer Received',
  hired: 'Hired',
  rejected: 'Rejected',
  dropped: 'Dropped',
};

/** Statuses shown on Application Tracker by default (excludes dropped). */
export const APPLICATION_TRACKER_STATUSES = APPLICATION_STATUSES.filter((s) => s !== 'dropped');

export function isValidApplicationStatus(status) {
  return APPLICATION_STATUSES.includes(String(status || '').trim());
}
