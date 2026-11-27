import { seniorityRank } from './filters';
import { englishRank } from './scoring';
import type { MatchRow, WorkMode } from './types';

/** Extra filters on JD Matching. Unknown data (no work mode, no start date) never hides a candidate. */
export interface MatchFilters {
  /** Minimum seniority. */
  seniority?: string;
  /** Minimum English level. */
  english?: string;
  mode?: WorkMode;
  /** Can start within this many days of today. */
  withinDays?: number;
  /** Hide candidates marked not open to work. */
  openOnly?: boolean;
  /** Exact location (case-insensitive). */
  location?: string;
}

export const MATCH_SORTS = ['score', 'rate', 'available', 'experience'] as const;
export type MatchSort = (typeof MATCH_SORTS)[number];

export const MATCH_SENIORITIES = ['Junior', 'Middle', 'Senior', 'Lead', 'Principal'] as const;
export const MATCH_ENGLISH = ['Basic', 'Intermediate', 'Upper-Intermediate', 'Advanced', 'Fluent'] as const;
export const MATCH_WITHIN_DAYS = [14, 30, 60] as const;

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function filterMatches(rows: MatchRow[], f: MatchFilters, today: string): MatchRow[] {
  const minSen = f.seniority ? seniorityRank(f.seniority) : -1;
  const minEn = f.english ? englishRank(f.english) : 0;
  const by = f.withinDays ? addDays(today, f.withinDays) : undefined;
  return rows.filter(
    (r) =>
      seniorityRank(r.seniority) >= minSen &&
      englishRank(r.english) >= minEn &&
      (!f.mode || !r.workModes?.length || r.workModes.includes(f.mode)) &&
      (!by || !r.availableFrom || r.availableFrom <= by) &&
      (!f.openOnly || r.openToWork !== false) &&
      (!f.location || !r.location || r.location.toLowerCase() === f.location.toLowerCase()),
  );
}

export function sortMatches(rows: MatchRow[], sort: MatchSort): MatchRow[] {
  const last = (v: number | string | undefined, high: number | string) => v ?? high;
  const out = [...rows];
  if (sort === 'rate') out.sort((a, b) => Number(last(a.rate, Infinity)) - Number(last(b.rate, Infinity)) || b.score - a.score);
  else if (sort === 'available') out.sort((a, b) => String(last(a.availableFrom, '9999')).localeCompare(String(last(b.availableFrom, '9999'))) || b.score - a.score);
  else if (sort === 'experience') out.sort((a, b) => b.years - a.years || b.score - a.score);
  else out.sort((a, b) => b.score - a.score);
  return out;
}
