import type { Candidate } from './types';

export type CandidateSort = 'newest' | 'name' | 'seniority';

export interface CandidateQuery {
  text?: string;
  seniority?: string;
  stack?: string;
  english?: string;
  /** Matched against the raw `cvOwner` value (a user id, or a display name in the mockup fixture). */
  owner?: string;
  /** Every listed tag must be present on the candidate. */
  tags?: string[];
}

export const PAGE_SIZE = 10;

/** Low to high; "Middle" is an alias of "Mid". */
const SENIORITY_RANK = ['intern', 'junior', 'mid', 'senior', 'lead', 'principal', 'architect'];

export function seniorityRank(s: string): number {
  const key = s.trim().toLowerCase();
  return SENIORITY_RANK.indexOf(key === 'middle' ? 'mid' : key);
}

const has = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.toLowerCase());

export function filterCandidates(cands: Candidate[], q: CandidateQuery, sort: CandidateSort): Candidate[] {
  const text = q.text?.trim();
  const stack = q.stack?.trim();
  const out = cands.filter((c) => {
    if (text && !(has(c.name, text) || has(c.email, text) || has(c.title, text))) return false;
    if (q.seniority && c.seniority !== q.seniority) return false;
    if (stack && !c.skills.some((s) => has(s, stack))) return false;
    if (q.english && c.english !== q.english) return false;
    if (q.owner && c.cvOwner !== q.owner) return false;
    if (q.tags?.length && !q.tags.every((t) => c.tags.includes(t))) return false;
    return true;
  });
  // Array.prototype.sort is stable, so equal keys keep their store order.
  return out.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'seniority') return seniorityRank(b.seniority) - seniorityRank(a.seniority);
    return b.createdAt.localeCompare(a.createdAt);
  });
}
