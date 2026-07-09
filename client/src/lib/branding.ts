export const SITE_NAME = 'Nexus Partners';
export const SITE_DOMAIN = 'nexuspartners.com';
export const DEFAULT_APP_TITLE = 'Nexus Partners Admin';
export const DEFAULT_LOGO = '/logo.png';

export function companyLogoUrl(logoUrl?: string | null) {
  return logoUrl?.trim() ? logoUrl : DEFAULT_LOGO;
}
