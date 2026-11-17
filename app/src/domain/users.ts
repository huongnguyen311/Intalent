import type { User } from './types';

/** The demo user is always Super Admin. */
export const CURRENT_USER_ID = 'u-admin';

/** Display name for a user id; falls back to the raw value (the mockup fixture stores a display name as owner). */
export function userName(users: User[], idOrName: string): string {
  return users.find((u) => u.id === idOrName)?.name ?? idOrName;
}

export const ROLES = ['Super Admin', 'Admin', 'User', 'Candidate'] as const;
export type Role = (typeof ROLES)[number];

/** Who can own a CV: active staff, not candidate accounts. */
export const assignableUsers = (users: User[]): User[] => users.filter((u) => u.status === 'Active' && u.role !== 'Candidate');
