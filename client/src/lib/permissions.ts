import type { User } from '@/lib/api';

export const MODULE_KEYS = [
  'tickets',
  'interviews',
  'placements',
  'teams',
  'recruiters',
  'payments',
  'salaries',
  'billing',
  'chat',
  'users',
  'students',
  'ats',
  'prompts',
  'job_scrap',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export function canAccessModule(user: User | null, module: ModuleKey): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin || user.isCompanyAdmin) return true;
  const perms = user.modulePermissions || {};
  const hasAny = Object.values(perms).some(Boolean);
  if (!hasAny) {
    return ['tickets', 'chat', 'interviews', 'placements', 'students'].includes(module);
  }
  return !!perms[module];
}

export function canAccessAnyAdmin(user: User | null): boolean {
  return !!(user?.isPlatformAdmin || user?.isCompanyAdmin);
}
