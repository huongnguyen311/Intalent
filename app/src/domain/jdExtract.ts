import { detectDomains, detectSeniority, detectYears, type Requirements } from './scoring';
import { extractSkills } from './techVocab';
import type { Education, Jd, JdInput, TaxonomyItem } from './types';

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

/** Bullet lines under the first heading matching `heading`, up to the next non-bullet line. */
export function sectionBullets(body: string, heading: RegExp): string[] {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => heading.test(l) && !BULLET.test(l));
  if (start < 0) return [];
  const out: string[] = [];
  for (const l of lines.slice(start + 1)) {
    const b = BULLET.exec(l)?.[1];
    if (b) out.push(b);
    else if (l.trim() && out.length) break;
  }
  return out;
}

const NICE = /nice[- ]?to[- ]?have|bonus|preferred|a plus/i;
const DUTIES = /responsibilit|what you.?ll do|duties|your role/i;
const PERKS = /benefit|perks|what we offer|why join/i;
const ENGLISH_IN_BODY = /\b(basic|intermediate|advanced|fluent)\b[^\n]{0,12}english|english[^\n]{0,12}\b(basic|intermediate|advanced|fluent)\b/i;

const englishIn = (body: string): string | undefined => {
  const m = ENGLISH_IN_BODY.exec(body);
  const w = m?.[1] ?? m?.[2];
  return w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : undefined;
};

/** Simple keyword extractor behind "Standardize JD" (pasted text or an uploaded text file). */
export function extractJd(text: string, taxonomy: TaxonomyItem[] = []): JdInput {
  const body = text.trim();
  const first = body.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? '';
  const heading = first.replace(/[:.\s]+$/, '').slice(0, 80);
  const letters = heading.replace(/[^A-Za-z]/g, '');
  const title = letters && letters === letters.toUpperCase() ? titleCase(heading) : heading;
  const niceToHave = sectionBullets(body, NICE);
  const responsibilities = sectionBullets(body, DUTIES);
  // Pay and perks belong to the Job; their bullets are only kept out of the must-haves.
  const perks = sectionBullets(body, PERKS);
  const dailyTasks = sectionBullets(body, DAILY);
  const certifications = sectionBullets(body, CERTS);
  // Must-haves are the remaining requirement bullets, not the duties, perks, certificates or nice-to-haves.
  const other = new Set([...niceToHave, ...responsibilities, ...perks, ...dailyTasks, ...certifications]);
  const major = /degree in ([A-Z][A-Za-z ]{2,40}?)(?:[,.;\n]| or )/.exec(body)?.[1]?.trim();
  return {
    title,
    domains: detectDomains(body, taxonomy),
    skills: extractSkills(body),
    body,
    mustHave: bulletsOf(body).filter((b) => !other.has(b)),
    niceToHave,
    seniority: detectSeniority(body.slice(0, 300), taxonomy) ?? detectSeniority(body, taxonomy),
    minYears: detectYears(body),
    english: englishIn(body),
    responsibilities,
    workingModel: /\bremote\b/i.test(body) ? 'Remote' : /\bhybrid\b/i.test(body) ? 'Hybrid' : /\bon-?site\b/i.test(body) ? 'Onsite' : undefined,
    summary: summaryOf(body),
    aboutTeam: paragraphUnder(body, /about the team|the team|our team/i),
    dailyTasks,
    certifications,
    education: educationIn(body),
    ...(major ? { major } : {}),
  };
}

const DAILY = /daily|day[- ]to[- ]day|typical day/i;
const CERTS = /certificat/i;

/** First plain paragraph after the title: the role's pitch. */
function summaryOf(body: string): string | undefined {
  const rest = body.split(/\r?\n/).slice(1).map((l) => l.trim());
  const line = rest.find((l) => l.length > 40 && !BULLET.test(l) && /[.!]$/.test(l));
  return line;
}

/** Plain text right under a heading, until a blank line or bullet. */
function paragraphUnder(body: string, heading: RegExp): string | undefined {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => heading.test(l) && l.trim().length < 40 && !BULLET.test(l));
  if (start < 0) return undefined;
  const out: string[] = [];
  for (const l of lines.slice(start + 1)) {
    if (!l.trim()) { if (out.length) break; continue; }
    if (BULLET.test(l)) break;
    out.push(l.trim());
  }
  return out.join(' ') || undefined;
}

function educationIn(body: string): Education | undefined {
  if (/\bph\.?d\b|doctorate/i.test(body)) return 'phd';
  if (/master'?s? degree|\bmsc\b|\bmba\b/i.test(body)) return 'master';
  if (/bachelor|university degree|\bbsc\b|\bb\.?s\.?\b degree/i.test(body)) return 'bachelor';
  if (/college|diploma/i.test(body)) return 'college';
  return undefined;
}

export const jdMustHave = (jd: Jd): string[] => jd.mustHave ?? bulletsOf(jd.body);

/** What a JD asks for, in the shape the scorer takes. Fields the text never mentions stay undefined. */
export function jdRequirements(jd: Jd, taxonomy: TaxonomyItem[] = []): Requirements {
  const stated = /seniority:\s*([A-Za-z]+)/i.exec(jd.body)?.[1];
  const req: Requirements = { stack: jd.skills, domains: jd.domains };
  // Fields set in the editor win over what the free text says.
  const seniority = jd.seniority || (stated && detectSeniority(stated, taxonomy)) || detectSeniority(jd.title, taxonomy);
  if (seniority) req.seniority = seniority;
  const years = jd.minYears ?? detectYears(jd.body);
  if (years !== undefined) req.years = years;
  const english = jd.english || englishIn(jd.body);
  if (english) req.english = english;
  const keys = new Set(jd.skills.map((s) => s.toLowerCase()));
  const critical = (jd.criticalSkills ?? []).filter((s) => keys.has(s.toLowerCase()));
  if (critical.length) req.critical = critical;
  return req;
}
