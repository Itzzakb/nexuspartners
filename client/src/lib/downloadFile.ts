import { toPublicAppUrl } from '@/lib/publicAppUrl';

/**
 * Prefer a same-origin `/api/...` path so Vite proxy / reverse proxy handles the file.
 * Falls back to rewriting localhost → current origin.
 */
export function resolveApiDownloadUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const absolute = new URL(url, window.location.origin);
    const apiIdx = absolute.pathname.indexOf('/api/');
    if (apiIdx >= 0) {
      return `${absolute.pathname.slice(apiIdx)}${absolute.search}${absolute.hash}`;
    }
    return toPublicAppUrl(url);
  } catch {
    return url.startsWith('/') ? url : toPublicAppUrl(url);
  }
}

function filenameFromContentDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1].trim().replace(/"/g, ''));
    } catch {
      return utf[1].trim().replace(/"/g, '');
    }
  }
  const plain = header.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i);
  if (plain) return (plain[1] || plain[2] || '').trim().replace(/"/g, '') || fallback;
  return fallback;
}

/** Fetch the download URL and save it as a file (avoids popup blockers / wrong host). */
export async function downloadFileFromUrl(
  url: string,
  fallbackFilename = 'resume.docx'
): Promise<void> {
  const resolved = resolveApiDownloadUrl(url);
  if (!resolved) throw new Error('Missing download URL');

  const res = await fetch(resolved, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Download link expired or invalid' : 'Download failed');
  }

  const blob = await res.blob();
  const filename = filenameFromContentDisposition(
    res.headers.get('Content-Disposition'),
    fallbackFilename
  );
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
