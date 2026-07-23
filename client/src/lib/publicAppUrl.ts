/** Rewrite loopback share links to the current web origin (production safety net). */
export function toPublicAppUrl(link: string | null | undefined): string {
  if (!link) return '';
  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return `${window.location.origin}${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // keep original
  }
  return link;
}
