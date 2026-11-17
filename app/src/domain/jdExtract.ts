import { detectDomains, detectSeniority, detectYears, type Requirements } from './scoring';
import { extractSkills } from './techVocab';
import type { Jd, JdInput, TaxonomyItem } from './types';

const BULLET = /^\s*(?:[-•*]|\d+[.)])\s+(.*\S)\s*$/;

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s/&(-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

/** Bullet lines from the body, preferring the ones under a "must have / requirements" heading. */
export function bulletsOf(body: string): string[] {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => /must[- ]?have|requirements?/i.test(l) && !BULLET.test(l));
  const scoped = start >= 0 ? lines.slice(start + 1) : lines;
  const found = scoped.map((l) => BULLET.exec(l)?.[1]).filter((b): b is string => Boolean(b));
  return (found.length ? found : lines.map((l) => BULLET.exec(l)?.[1]).filter((b): b is string => Boolean(b))).slice(0, 8);
}

/** Simple keyword extractor behind "Create JD from pasted text". */
export function extractJd(text: string, taxonomy: TaxonomyItem[] = []): JdInput {
  const body = text.trim();
  const first = body.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? '';
  const heading = first.replace(/[:.\s]+$/, '').slice(0, 80);
  const letters = heading.replace(/[^A-Za-z]/g, '');
  const title = letters && letters === letters.toUpperCase() ? titleCase(heading) : heading;
  return {
    title,
    domains: detectDomains(body, taxonomy),
    skills: extractSkills(body),
    body,
    mustHave: bulletsOf(body),
  };
}

export const jdMustHave = (jd: Jd): string[] => jd.mustHave ?? bulletsOf(jd.body);

const ENGLISH_IN_BODY = /\b(basic|intermediate|advanced|fluent)\b[^\n]{0,12}english|english[^\n]{0,12}\b(basic|intermediate|advanced|fluent)\b/i;

/** What a JD asks for, in the shape the scorer takes. Fields the text never mentions stay undefined. */
export function jdRequirements(jd: Jd, taxonomy: TaxonomyItem[] = []): Requirements {
  const stated = /seniority:\s*([A-Za-z]+)/i.exec(jd.body)?.[1];
  const level = ENGLISH_IN_BODY.exec(jd.body);
  const req: Requirements = { stack: jd.skills, domains: jd.domains };
  const seniority = (stated && detectSeniority(stated, taxonomy)) || detectSeniority(jd.title, taxonomy);
  if (seniority) req.seniority = seniority;
  const years = detectYears(jd.body);
  if (years !== undefined) req.years = years;
  const english = level?.[1] ?? level?.[2];
  if (english) req.english = english[0].toUpperCase() + english.slice(1).toLowerCase();
  return req;
}
