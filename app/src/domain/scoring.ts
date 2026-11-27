import { seniorityRank } from './filters';
import { extractSkills, fold, hasToken, ROLE_STACKS, skillKey, tokenIndex } from './techVocab';
import type { Candidate, TaxonomyItem } from './types';

export interface Requirements {
  stack: string[];
  seniority?: string;
  years?: number;
  domains?: string[];
  english?: string;
  /** Stack skills that count double (HR-marked "critical"). */
  critical?: string[];
}

export interface ScoreResult {
  score: number;
  /** Points per criterion (rounded); they sum to `score`. */
  breakdown: { stack: number; experience: number; domain: number; english: number };
  have: string[];
  miss: string[];
  /** Wanted domains the candidate has / lacks. */
  domainHave: string[];
  domainMiss: string[];
  reason: string;
}

/** Shown on the JD Matching screen. Experience & seniority split evenly. */
export const WEIGHTS = { stack: 40, experience: 30, domain: 20, english: 10 } as const;

/** none < basic (= beginner) < intermediate < upper-intermediate < advanced < fluent (= native). */
export function englishRank(s: string): number {
  switch (s.trim().toLowerCase().replace(/[\s_]+/g, '-')) {
    case 'basic': case 'beginner': return 1;
    case 'intermediate': return 2;
    case 'upper-intermediate': return 2.5;
    case 'advanced': return 3;
    case 'fluent': case 'native': return 4;
    default: return 0;
  }
}

/** Typical years per seniority, indexed by `seniorityRank`. */
const YEARS_BY_SENIORITY = [0, 1, 3, 6, 9, 12, 14];

const monthIndex = (ym: string): number | undefined => {
  const m = /^(\d{4})-(\d{2})/.exec(ym);
  return m ? Number(m[1]) * 12 + Number(m[2]) : undefined;
};

/** Years of experience: summed from listed jobs when the profile has them, else a typical figure for the seniority. */
export function estimateYears(c: Candidate): number {
  if (c.experience?.length) {
    const now = new Date();
    const nowIdx = now.getFullYear() * 12 + now.getMonth() + 1;
    const months = c.experience.reduce((sum, e) => {
      const start = monthIndex(e.start);
      return start === undefined ? sum : sum + Math.max(0, (monthIndex(e.end) ?? nowIdx) - start);
    }, 0);
    return Math.round(months / 12);
  }
  const r = seniorityRank(c.seniority);
  return r < 0 ? 0 : YEARS_BY_SENIORITY[r];
}

const candidateSkillKeys = (c: Candidate) =>
  new Set([...c.skills, ...(c.primarySkills ?? []), ...(c.secondarySkills ?? []), ...(c.techStack ?? [])].map(skillKey));

/** Credit for being 0, 1, 2 seniority levels below the requirement. */
const SENIORITY_FRACTION = [1, 0.6, 0.3];

export function scoreCandidate(c: Candidate, req: Requirements): ScoreResult {
  const owned = candidateSkillKeys(c);
  const have = req.stack.filter((s) => owned.has(skillKey(s)));
  const miss = req.stack.filter((s) => !owned.has(skillKey(s)));
  // Critical skills weigh 2, the rest 1.
  const crit = new Set((req.critical ?? []).map(skillKey));
  const weight = (s: string) => (crit.has(skillKey(s)) ? 2 : 1);
  const total = req.stack.reduce((n, s) => n + weight(s), 0);
  const stack = total ? have.reduce((n, s) => n + weight(s), 0) / total : 1;

  const need = req.seniority ? seniorityRank(req.seniority) : -1;
  const gap = need < 0 ? 0 : Math.max(0, need - seniorityRank(c.seniority));
  const seniority = SENIORITY_FRACTION[gap] ?? 0;
  const years = req.years ? Math.min(1, estimateYears(c) / req.years) : 1;

  const wanted = req.domains ?? [];
  const mine = new Set(c.domains.map(fold));
  const domainHits = wanted.filter((d) => mine.has(fold(d)));
  const domain = wanted.length ? domainHits.length / wanted.length : 1;

  const lack = req.english ? englishRank(req.english) - englishRank(c.english) : 0;
  const english = lack <= 0 ? 1 : lack <= 1 ? 0.5 : 0;

  const breakdown = {
    stack: Math.round(stack * WEIGHTS.stack),
    experience: Math.round((seniority + years) * (WEIGHTS.experience / 2)),
    domain: Math.round(domain * WEIGHTS.domain),
    english: Math.round(english * WEIGHTS.english),
  };
  const score = breakdown.stack + breakdown.experience + breakdown.domain + breakdown.english;

  const parts: string[] = [];
  if (req.stack.length) {
    parts.push(have.length ? `Matches ${have.join(', ')}` : 'None of the requested skills');
    if (miss.length) parts.push(`missing ${miss.join(', ')}`);
  }
  const facts = [c.seniority, `${estimateYears(c)} yrs`, c.english && `English ${c.english}`].filter(Boolean);
  if (domainHits.length) facts.push(domainHits.join(', '));
  return { score, breakdown, have, miss, domainHave: domainHits, domainMiss: wanted.filter((d) => !mine.has(fold(d))), reason: `${parts.join('; ')}${parts.length ? '. ' : ''}${facts.join(' · ')}` };
}

const SENIORITY_WORDS: Array<[canon: string, words: string[]]> = [
  ['Intern', ['intern', 'thuc tap']],
  ['Junior', ['junior', 'fresher', 'jr']],
  ['Middle', ['middle', 'mid', 'mid-level', 'trung cap']],
  ['Senior', ['senior', 'sr', 'cao cap']],
  ['Lead', ['lead', 'team lead', 'tech lead', 'truong nhom']],
  ['Principal', ['principal', 'staff']],
  ['Architect', ['architect']],
];

const DOMAIN_ALIASES: Array<[domain: string, words: string[]]> = [
  ['Healthcare', ['healthcare', 'health', 'y te', 'benh vien']],
  ['Fintech', ['fintech', 'ngan hang', 'tai chinh', 'banking']],
  ['E-commerce', ['e-commerce', 'ecommerce', 'thuong mai dien tu']],
  ['SaaS', ['saas']],
  ['Education', ['education', 'giao duc', 'edtech']],
  ['Logistics', ['logistics', 'van tai']],
  ['Robotics', ['robotics']],
];

const ENGLISH_GOOD = ['good', 'tot', 'gioi', 'fluent', 'advanced', 'excellent', 'strong', 'thanh thao'];
const ENGLISH_LOW = ['basic', 'co ban', 'beginner'];

/** Label as the taxonomy spells it, else the canonical word. */
function taxonomyLabel(kind: TaxonomyItem['kind'], canon: string, taxonomy: TaxonomyItem[]): string {
  const hit = taxonomy.find((t) => t.kind === kind && t.active && fold(t.label) === fold(canon));
  return hit?.label ?? canon;
}

/** First seniority word in the text ("Tech Lead / Senior Engineer" -> Lead). */
export function detectSeniority(text: string, taxonomy: TaxonomyItem[] = []): string | undefined {
  const t = fold(text);
  let best: { pos: number; canon: string } | undefined;
  for (const [canon, words] of SENIORITY_WORDS) {
    for (const w of words) {
      const pos = tokenIndex(t, w);
      if (pos >= 0 && (!best || pos < best.pos)) best = { pos, canon };
    }
  }
  return best && taxonomyLabel('seniority', best.canon, taxonomy);
}

export function detectDomains(text: string, taxonomy: TaxonomyItem[] = []): string[] {
  const t = fold(text);
  const out = new Set<string>();
  for (const [domain, words] of DOMAIN_ALIASES) {
    if (words.some((w) => hasToken(t, w))) out.add(taxonomyLabel('domain', domain, taxonomy));
  }
  // Any other domain the taxonomy knows by name.
  for (const item of taxonomy) {
    if (item.kind === 'domain' && item.active && hasToken(t, fold(item.label))) out.add(item.label);
  }
  return [...out];
}

export function detectYears(text: string): number | undefined {
  const m = /(\d{1,2})\s*\+?\s*(?:years?|yrs?|nam)\b/.exec(fold(text));
  return m ? Number(m[1]) : undefined;
}

function detectEnglish(text: string, taxonomy: TaxonomyItem[]): string | undefined {
  const t = fold(text);
  if (!/english|tieng anh/.test(t)) return undefined;
  const any = (words: string[]) => words.some((w) => hasToken(t, w));
  const level = any(ENGLISH_GOOD) ? 'Advanced' : any(ENGLISH_LOW) ? 'Basic' : 'Intermediate';
  return taxonomyLabel('english', level, taxonomy);
}

/** Keywords in an AI Search sentence (EN or VI) -> structured requirements. Only found criteria are set. */
export function parseQuery(text: string, taxonomy: TaxonomyItem[] = []): Requirements {
  const t = fold(text);
  const stack = extractSkills(text);
  for (const [words, bundle] of ROLE_STACKS) {
    if (words.some((w) => hasToken(t, w))) for (const s of bundle) if (!stack.includes(s)) stack.push(s);
  }
  const req: Requirements = { stack };
  const seniority = detectSeniority(text, taxonomy);
  if (seniority) req.seniority = seniority;
  const years = detectYears(text);
  if (years !== undefined) req.years = years;
  const domains = detectDomains(text, taxonomy);
  if (domains.length) req.domains = domains;
  const english = detectEnglish(text, taxonomy);
  if (english) req.english = english;
  return req;
}

export const hasCriteria = (req: Requirements): boolean =>
  req.stack.length > 0 || Boolean(req.seniority || req.years || req.domains?.length || req.english);

export interface SearchHit extends ScoreResult {
  candidate: Candidate;
}

/** Ranked matches: highest score first; when skills were requested a candidate needs at least one of them. */
export function searchCandidates(candidates: Candidate[], req: Requirements, limit = 8): SearchHit[] {
  return candidates
    .map((candidate) => ({ candidate, ...scoreCandidate(candidate, req) }))
    .filter((h) => req.stack.length === 0 || h.have.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
