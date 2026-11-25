import { detectDomains } from './scoring';
import { extractSkills, ROLE_STACKS, skillKey, VOCAB } from './techVocab';
import type { Candidate, Jd, TaxonomyItem } from './types';

/**
 * Suggestions for the JD editor's tag fields. Rule-based, from what the app already knows:
 * the skill vocabulary, the Talent Pool's skills, other JDs and the domain taxonomy.
 */

const has = (list: string[], v: string) => list.some((x) => skillKey(x) === skillKey(v));
const fresh = (picked: string[]) => (v: string) => !has(picked, v);

/** How often each skill appears across the pool, most common first (vocabulary skills fill the tail). */
export function skillOptions(candidates: Candidate[], jds: Jd[]): string[] {
  const count = new Map<string, { name: string; n: number }>();
  const bump = (s: string, n = 1) => {
    const k = skillKey(s);
    const e = count.get(k);
    if (e) e.n += n; else count.set(k, { name: s, n });
  };
  for (const c of candidates) for (const s of new Set([...c.skills, ...(c.techStack ?? [])])) bump(s);
  for (const j of jds) for (const s of j.skills) bump(s);
  for (const s of VOCAB) bump(s, 0);
  return [...count.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).map((e) => e.name);
}

/** Skills to add next: the role's usual stack, then skills that pool candidates have alongside the picked ones. */
export function suggestSkills(title: string, picked: string[], candidates: Candidate[], options: string[], max = 6): string[] {
  const t = title.toLowerCase();
  const role = ROLE_STACKS.filter(([words]) => words.some((w) => t.includes(w))).flatMap(([, stack]) => stack);
  const fromTitle = extractSkills(title);
  // Co-occurrence: among candidates who have any picked skill, which other skills are most common?
  const together = new Map<string, number>();
  if (picked.length) {
    for (const c of candidates) {
      const mine = [...c.skills, ...(c.techStack ?? [])];
      if (!picked.some((p) => has(mine, p))) continue;
      for (const s of mine) together.set(s, (together.get(s) ?? 0) + 1);
    }
  }
  const coSkills = [...together.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  const out: string[] = [];
  for (const s of [...fromTitle, ...role, ...coSkills, ...(picked.length ? [] : options)]) {
    if (!has(picked, s) && !has(out, s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** Active taxonomy domains, most used first. */
export function domainOptions(taxonomy: TaxonomyItem[]): string[] {
  return taxonomy.filter((x) => x.kind === 'domain' && x.active).sort((a, b) => b.usage - a.usage).map((x) => x.label);
}

/** Domains the text points at first, then the most used ones. */
export function suggestDomains(text: string, picked: string[], taxonomy: TaxonomyItem[], max = 5): string[] {
  const out: string[] = [];
  for (const d of [...detectDomains(text, taxonomy), ...domainOptions(taxonomy)]) {
    if (!picked.includes(d) && !out.includes(d)) out.push(d);
    if (out.length >= max) break;
  }
  return out;
}

export interface MustHaveFacts {
  title: string;
  skills: string[];
  critical: string[];
  minYears?: number;
  english?: string;
  domains: string[];
  seniority?: string;
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const roleOf = (title: string) => title.replace(/^(senior|junior|lead|middle|mid|principal|staff)\s+/i, '').trim();

/** Ready-made must-have lines built from the other fields, plus lines other JDs use; ones already listed are left out. */
export function suggestMustHave(f: MustHaveFacts, picked: string[], jds: Jd[], max = 5): string[] {
  const role = roleOf(f.title);
  const main = f.critical.length ? f.critical : f.skills.slice(0, 3);
  const lines = [
    f.minYears ? `${f.minYears}+ years of experience${role ? ` as a ${role}` : ''}` : '',
    main.length ? `Hands-on production experience with ${list(main)}` : '',
    ...f.critical.map((s) => `Strong ${s} skills, able to work without close guidance`),
    f.english ? `${f.english} English, able to work with international teams` : '',
    f.domains.length ? `Experience building products in ${list(f.domains.slice(0, 2))}` : '',
    /lead|senior|principal|staff|manager/i.test(`${f.title} ${f.seniority ?? ''}`) ? 'Experience mentoring other engineers and reviewing code' : '',
    ...jds.flatMap((j) => j.mustHave ?? []),
  ];
  const seen = new Set(picked.map((x) => x.toLowerCase()));
  const out: string[] = [];
  for (const l of lines) {
    if (!l || seen.has(l.toLowerCase())) continue;
    seen.add(l.toLowerCase());
    out.push(l);
    if (out.length >= max) break;
  }
  return out;
}

/** Nice-to-have lines: role skills not yet in the stack. */
export function suggestNiceToHave(title: string, skills: string[], picked: string[], options: string[], max = 4): string[] {
  const extra = suggestSkills(title, skills, [], options, 8).filter(fresh(skills));
  return extra.map((s) => `Experience with ${s}`).filter((l) => !picked.some((p) => p.toLowerCase() === l.toLowerCase())).slice(0, max);
}

export const LANGUAGE_OPTIONS = ['Japanese - N2', 'Japanese - N3', 'Korean - TOPIK 4', 'Chinese - HSK 4', 'French - B2', 'German - B2'];
export const CERT_OPTIONS = [
  'AWS Certified Solutions Architect', 'AWS Certified Developer', 'Google Cloud Professional', 'Microsoft Azure Fundamentals',
  'Certified Kubernetes Administrator (CKA)', 'ISTQB Foundation', 'PMP', 'Professional Scrum Master (PSM I)', 'Google Analytics Certification',
];
