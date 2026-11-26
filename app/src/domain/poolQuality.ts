import type { Candidate } from './types';

/** A CV-quality problem a recruiter can filter the pool by (`/candidates?gap=…`). */
export type Gap = 'email' | 'phone' | 'seniority' | 'english' | 'skills' | 'stale' | 'parse' | 'consent';
export const GAPS: Gap[] = ['email', 'phone', 'seniority', 'english', 'skills', 'stale', 'parse', 'consent'];
type FieldGap = 'email' | 'phone' | 'seniority' | 'english' | 'skills';
const FIELD_GAPS: FieldGap[] = ['email', 'phone', 'seniority', 'english', 'skills'];

/** An AI-parsed field below this confidence needs HR review. */
export const LOW_CONFIDENCE = 0.6;
/** CVs older than this are "aging"; older than STALE_MONTHS are "stale". */
export const AGING_MONTHS = 6;
export const STALE_MONTHS = 12;

export function isGap(v: string | null | undefined): v is Gap {
  return !!v && (GAPS as string[]).includes(v);
}

/** When the CV was last refreshed: the newest uploaded version, else when the profile was created. */
export function lastCvAt(c: Candidate): string {
  return (c.cvVersions ?? []).reduce((latest, v) => (v.at > latest ? v.at : latest), c.createdAt);
}

function monthsBefore(now: Date, months: number): number {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d.getTime();
}

/** Freshness band of the last CV refresh (see AGING_MONTHS / STALE_MONTHS). */
export function cvFreshness(c: Candidate, now: Date): 'fresh' | 'aging' | 'stale' {
  const at = Date.parse(lastCvAt(c));
  if (at < monthsBefore(now, STALE_MONTHS)) return 'stale';
  return at < monthsBefore(now, AGING_MONTHS) ? 'aging' : 'fresh';
}

const blank = (s: string | undefined) => !s?.trim();

export function matchesGap(c: Candidate, gap: Gap, now: Date): boolean {
  if (c.anonymizedAt) return false;
  switch (gap) {
    case 'skills':
      return c.skills.length === 0;
    case 'stale':
      return Date.parse(lastCvAt(c)) < monthsBefore(now, STALE_MONTHS);
    case 'parse':
      return !!c.parse && !c.parse.reviewedAt && Object.values(c.parse.confidence).some((v) => v !== undefined && v < LOW_CONFIDENCE);
    case 'consent':
      return !(c.consents ?? []).some((x) => !x.withdrawnAt);
    default:
      return blank(c[gap]);
  }
}

export interface PoolQuality {
  /** Candidates measured (anonymized records are left out). */
  total: number;
  /** Has email, phone, seniority, English and at least one skill. */
  complete: number;
  missing: Record<FieldGap, number>;
  /** By last CV refresh: under AGING_MONTHS, AGING–STALE months, over STALE_MONTHS. */
  freshness: { fresh: number; aging: number; stale: number };
  parseReview: number;
  noConsent: number;
}

export function poolQuality(cands: Candidate[], now: Date): PoolQuality {
  const live = cands.filter((c) => !c.anonymizedAt);
  const count = (g: Gap) => live.filter((c) => matchesGap(c, g, now)).length;
  const agingCutoff = monthsBefore(now, AGING_MONTHS);
  const stale = count('stale');
  const fresh = live.filter((c) => Date.parse(lastCvAt(c)) >= agingCutoff).length;
  return {
    total: live.length,
    complete: live.filter((c) => FIELD_GAPS.every((g) => !matchesGap(c, g, now))).length,
    missing: Object.fromEntries(FIELD_GAPS.map((g) => [g, count(g)])) as Record<FieldGap, number>,
    freshness: { fresh, aging: live.length - fresh - stale, stale },
    parseReview: count('parse'),
    noConsent: count('consent'),
  };
}
