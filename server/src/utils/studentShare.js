import { getClientBaseUrl } from './publicUrls.js';

/** Public student share URL uses the student's phone (not a UUID). */
export function buildStudentShareLink(phone, req) {
  const base = getClientBaseUrl(req);
  const encoded = encodeURIComponent(String(phone || '').trim());
  return `${base}/student-share/${encoded}`;
}
