import { inPeriod, isPeriod, type Period } from './metrics';
import { isGap, lastCvAt, matchesGap, type Gap } from './poolQuality';
import { isEnded } from './stages';
import type { Application, Candidate } from './types';

export type CandidateSort = 'newest' | 'updated' | 'name' | 'seniority';
export const CANDIDATE_SORTS: CandidateSort[] = ['newest', 'updated', 'name', 'seniority'];

export interface CandidateQuery {
  /** Name, email, phone, title or a skill. */
  text?: string;
  /** Any of these seniorities. */
  seniorities?: string[];
  /** Comma-separated; every term must match one of the candidate's skills. */
  stack?: string;
  english?: string;
  /** Matched against the raw `cvOwner` value (a user id, or a display name in the mockup fixture). */
  owner?: string;
  /** Every listed tag must be present on the candidate. */
  tags?: string[];
  openToWork?: boolean;
  /** Has (true) or has no (false) application still in progress. Needs `activeIds`. */
  inPipeline?: boolean;
  location?: string;
  domain?: string;
  /** A CV-quality gap (drill-down from the pool overview). */
  gap?: Gap;
  /** Only candidates created within this period (drill-down keeps the overview's period). */
  since?: Exclude<Period, 'all'>;
}

export const PAGE_SIZE = 10;

/** Low to high; "Middle" is an alias of "Mid". */
const SENIORITY_RANK = ['intern', 'junior', 'mid', 'senior', 'lead', 'principal', 'architect'];

export function seniorityRank(s: string): number {
  const key = s.trim().toLowerCase();
  return SENIORITY_RANK.indexOf(key === 'middle' ? 'mid' : key);
}

const has = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.toLowerCase());
const digits = (s: string) => s.replace(/\D/g, '');

export function stackTerms(stack: string | undefined): string[] {
  return (stack ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

function matchesText(c: Candidate, text: string): boolean {
  if (has(c.name, text) || has(c.email, text) || has(c.title, text)) return true;
  if (c.skills.some((s) => has(s, text))) return true;
  const d = digits(text);
  // A phone match needs a few digits, so a stray digit in a name search does not match every phone.
  return d.length >= 3 && digits(c.phone).includes(d);
}

/** Applications still in progress (not hired, rejected or withdrawn), newest first, per candidate. */
export function activeApplicationsByCandidate(apps: Application[]): Map<string, Application[]> {
  const out = new Map<string, Application[]>();
  for (const a of apps) {
    if (isEnded(a.stage)) continue;
    out.set(a.candidateId, [...(out.get(a.candidateId) ?? []), a]);
  }
  for (const l of out.values()) l.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  return out;
}

export function filterCandidates(
  cands: Candidate[],
  q: CandidateQuery,
  sort: CandidateSort,
  now: Date = new Date(),
  activeIds: ReadonlySet<string> = new Set(),
): Candidate[] {
  const text = q.text?.trim();
  const terms = stackTerms(q.stack);
  const out = cands.filter((c) => {
    if (text && !matchesText(c, text)) return false;
    if (q.seniorities?.length && !q.seniorities.includes(c.seniority)) return false;
    if (terms.length && !terms.every((term) => c.skills.some((s) => has(s, term)))) return false;
    if (q.english && c.english !== q.english) return false;
    if (q.owner && c.cvOwner !== q.owner) return false;
    if (q.tags?.length && !q.tags.every((t) => c.tags.includes(t))) return false;
    if (q.openToWork !== undefined && Boolean(c.openToWork) !== q.openToWork) return false;
    if (q.inPipeline !== undefined && activeIds.has(c.id) !== q.inPipeline) return false;
    if (q.location && c.location !== q.location) return false;
    if (q.domain && !c.domains.includes(q.domain)) return false;
    if (q.gap && !matchesGap(c, q.gap, now)) return false;
    if (q.since && !inPeriod(c, q.since, now)) return false;
    return true;
  });
  // Array.prototype.sort is stable, so equal keys keep their store order.
  return out.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'seniority') return seniorityRank(b.seniority) - seniorityRank(a.seniority);
    if (sort === 'updated') return lastCvAt(b).localeCompare(lastCvAt(a));
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function isQueryActive(q: CandidateQuery): boolean {
  return Object.values(q).some((v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== ''));
}

/* URL codec: the pool's filters, sort and page live in the query string, so Back from a profile restores them. */

const list = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);
const bool = (v: string | null) => (v === '1' ? true : v === '0' ? false : undefined);
const str = (v: string | null) => v || undefined;

export interface PoolState {
  q: CandidateQuery;
  sort: CandidateSort;
  page: number;
}

export function poolStateFromParams(p: URLSearchParams): PoolState {
  const gap = p.get('gap');
  const since = p.get('since');
  const sort = p.get('sort') as CandidateSort | null;
  const page = Number(p.get('page'));
  const q: CandidateQuery = {
    text: str(p.get('q')),
    seniorities: list(p.get('seniority')),
    stack: str(p.get('stack')),
    english: str(p.get('english')),
    owner: str(p.get('owner')),
    tags: list(p.get('tags')),
    openToWork: bool(p.get('open')),
    inPipeline: bool(p.get('pipeline')),
    location: str(p.get('location')),
    domain: str(p.get('domain')),
    gap: isGap(gap) ? gap : undefined,
    // The period only narrows a quality drill-down.
    since: isGap(gap) && isPeriod(since) && since !== 'all' ? since : undefined,
  };
  for (const k of Object.keys(q) as (keyof CandidateQuery)[]) if (q[k] === undefined) delete q[k];
  return {
    q,
    sort: sort && CANDIDATE_SORTS.includes(sort) ? sort : 'newest',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

const POOL_KEYS = ['q', 'seniority', 'stack', 'english', 'owner', 'tags', 'open', 'pipeline', 'location', 'domain', 'gap', 'since', 'sort', 'page'];

/** Writes the pool state over `base`, keeping params the pool does not own (fixture, tab). */
export function poolStateToParams({ q, sort, page }: PoolState, base: URLSearchParams = new URLSearchParams()): URLSearchParams {
  const out = new URLSearchParams(base);
  for (const k of POOL_KEYS) out.delete(k);
  const put = (k: string, v: string | undefined) => {
    if (v) out.set(k, v);
  };
  const flag = (v: boolean | undefined) => (v === undefined ? undefined : v ? '1' : '0');
  put('q', q.text);
  put('seniority', q.seniorities?.join(','));
  put('stack', q.stack);
  put('english', q.english);
  put('owner', q.owner);
  put('tags', q.tags?.join(','));
  put('open', flag(q.openToWork));
  put('pipeline', flag(q.inPipeline));
  put('location', q.location);
  put('domain', q.domain);
  put('gap', q.gap);
  put('since', q.gap ? q.since : undefined);
  put('sort', sort === 'newest' ? undefined : sort);
  put('page', page > 1 ? String(page) : undefined);
  return out;
}
