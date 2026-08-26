const DOWNLOAD_TOKEN_RE = /\/api\/resume\/download\/([a-f0-9]{32,64})/i;

export function tokenFromDownloadUrl(url = '') {
  const m = String(url || '').match(DOWNLOAD_TOKEN_RE);
  return m ? m[1].toLowerCase() : '';
}

export function normalizeDownloadToken(token) {
  return String(token || '').trim().toLowerCase();
}

export const DOWNLOAD_TOKEN_FORMAT = /^[a-f0-9]{32,64}$/i;
