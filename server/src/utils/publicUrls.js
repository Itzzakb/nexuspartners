/**
 * Resolve the public web app base URL for share links (resume form, interviews, etc.).
 * Prefer CLIENT_URL when it is a real non-loopback URL; otherwise derive from the
 * incoming request (Origin / Referer / forwarded host) so production misconfig
 * does not emit http://localhost:5173 links.
 */
export function isLoopbackUrl(value = '') {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    const lower = String(value).toLowerCase();
    return lower.includes('localhost') || lower.includes('127.0.0.1');
  }
}

function trimBase(url = '') {
  return String(url || '').trim().replace(/\/$/, '');
}

function originFromReferer(referer = '') {
  try {
    return new URL(referer).origin;
  } catch {
    return '';
  }
}

function originFromRequest(req) {
  if (!req?.get) return '';

  const origin = trimBase(req.get('origin') || '');
  if (origin && !isLoopbackUrl(origin)) return origin;

  const refererOrigin = trimBase(originFromReferer(req.get('referer') || ''));
  if (refererOrigin && !isLoopbackUrl(refererOrigin)) return refererOrigin;

  const forwardedHost = (req.get('x-forwarded-host') || req.get('host') || '')
    .split(',')[0]
    .trim();
  if (!forwardedHost || isLoopbackUrl(`http://${forwardedHost}`)) return '';

  const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  return trimBase(`${proto}://${forwardedHost}`);
}

export function getClientBaseUrl(req) {
  const configured = trimBase(process.env.CLIENT_URL || '');
  if (configured && !isLoopbackUrl(configured)) return configured;

  const fromRequest = originFromRequest(req);
  if (fromRequest) return fromRequest;

  // Local development fallback (also used when CLIENT_URL is explicitly localhost)
  return configured || 'http://localhost:5173';
}

export function getServerBaseUrl(req) {
  const configured = trimBase(process.env.SERVER_URL || '');
  if (configured && !isLoopbackUrl(configured)) return configured;

  const fromRequest = originFromRequest(req);
  if (fromRequest) return fromRequest;

  return configured || `http://localhost:${process.env.PORT || 5000}`;
}
