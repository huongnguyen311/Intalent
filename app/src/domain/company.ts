import type { DemoState, Lang } from './types';

/** Workspace / company profile (PRD 3.1 "Company workspace" + "Company settings", entity `tenants`). */
export interface CompanySettings {
  /** Tenant id: every record in this demo belongs to this one workspace. */
  workspaceId: string;
  name: string;
  /** Up to 3 letters shown as the logo until a file is uploaded. */
  logoText: string;
  country: string;
  language: Lang;
  /** IANA zone; interview times and reports default to it. */
  timezone: string;
  /** Public careers URL: /c/<slug>. */
  careersSlug: string;
}

export const DEFAULT_COMPANY: CompanySettings = {
  workspaceId: 'ws-inapps',
  name: 'InApps Technology',
  logoText: 'IA',
  country: 'VN',
  language: 'vi',
  timezone: 'Asia/Ho_Chi_Minh',
  careersSlug: 'inapps',
};

export const COUNTRIES: [code: string, name: string][] = [
  ['VN', 'Vietnam'], ['SG', 'Singapore'], ['US', 'United States'], ['GB', 'United Kingdom'], ['AU', 'Australia'],
  ['JP', 'Japan'], ['DE', 'Germany'], ['FR', 'France'],
];

export const TIMEZONES = [
  'Asia/Ho_Chi_Minh', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Europe/London', 'Europe/Berlin',
  'America/New_York', 'America/Los_Angeles', 'UTC',
];

/** Older saves have no company yet. */
export const companyOf = (state: Pick<DemoState, 'company'>): CompanySettings => ({ ...DEFAULT_COMPANY, ...state.company });

/** Lowercase letters, digits and single dashes, 3-40 characters. */
export const isValidSlug = (slug: string): boolean => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 40;

/** "InApps Technology" -> "inapps-technology". */
export function slugify(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
