import { extractSkills, ROLE_STACKS } from './techVocab';
import type { JdInput } from './types';
import type { Requirements } from './scoring';

/**
 * Simulated AI writing help for job posts. It runs on rules, not a model: "draft" builds text from
 * the JD / job fields, "rewrite" tidies whatever the user typed into clean bullet points.
 */

const BULLET = /^\s*(?:[-*•–·]|\d+[.)])\s*/;

/** Template ids (stored with the prompts) holding the company's default job-post sections. */
export const CONTENT_TEMPLATE = {
  whyLove: 'content-why-love',
  additionalInfo: 'content-additional-info',
} as const;

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** "Your skills and experience" from the JD's requirements. */
export function draftSkillsExperience(req: Requirements): string {
  const lines: string[] = [];
  const level = req.seniority ? `${req.seniority}-level` : '';
  if (req.years) lines.push(`${req.years}+ years of professional experience${level ? ` at ${level}` : ''}`);
  else if (level) lines.push(`Proven experience at ${level}`);
  if (req.stack.length) lines.push(`Strong hands-on skills in ${list(req.stack.slice(0, 4))}`);
  if (req.stack.length > 4) lines.push(`Good to have: ${list(req.stack.slice(4, 8))}`);
  if (req.domains?.length) lines.push(`Experience building products in ${list(req.domains)}`);
  lines.push(req.english ? `${req.english} English, able to work directly with international clients` : 'Good English communication skills');
  lines.push('Ownership mindset, clear communication and a habit of writing clean, tested code');
  return lines.map((l) => `- ${l}`).join('\n');
}

export interface JobFacts {
  location?: string;
  employment?: string;
  level?: string;
}

/** "Additional information": the job's practical facts, then the company default lines. */
export function draftAdditionalInfo(job: JobFacts, template = ''): string {
  const lines: string[] = [];
  if (job.location) lines.push(`Working location: ${job.location}`);
  if (job.employment) lines.push(`Employment type: ${job.employment}`);
  if (job.level) lines.push(`Level: ${job.level}`);
  const facts = lines.map((l) => `- ${l}`).join('\n');
  return [facts, template.trim()].filter(Boolean).join('\n');
}

const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Tidy free text into one bullet per point: splits run-on lines, trims filler, drops duplicates. */
export function rewritePoints(text: string): string {
  const seen = new Set<string>();
  return text
    .split(/\n|;\s+|(?<=[.!?])\s+(?=[A-Z])/)
    .map((l) => l.replace(BULLET, '').replace(/\s+/g, ' ').trim())
    .map((l) => l.replace(/^(?:we are looking for someone who|you should|you must|must have|candidates? should)\s+/i, ''))
    .map((l) => sentenceCase(l.replace(/[.;,]+$/, '')))
    .filter((l) => {
      const key = l.toLowerCase();
      if (!l || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((l) => `- ${l}`)
    .join('\n');
}

/** Split post text into paragraphs and bullet lists for display. */
export function textBlocks(text: string): Array<{ kind: 'p'; text: string } | { kind: 'ul'; items: string[] }> {
  const out: Array<{ kind: 'p'; text: string } | { kind: 'ul'; items: string[] }> = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (BULLET.test(line)) {
      const item = line.replace(BULLET, '');
      const last = out[out.length - 1];
      if (last?.kind === 'ul') last.items.push(item);
      else out.push({ kind: 'ul', items: [item] });
    } else out.push({ kind: 'p', text: line });
  }
  return out;
}

const ROLE_DUTIES: Array<[RegExp, string[]]> = [
  [/front|ui|web/i, ['Build responsive, accessible user interfaces', 'Turn designs into reusable components', 'Keep page performance and quality high']],
  [/back|api|server|data/i, ['Design and build reliable APIs and services', 'Model data and keep queries fast', 'Monitor, debug and improve production systems']],
  [/mobile|ios|android|flutter/i, ['Build and ship mobile app features', 'Keep the app fast, stable and well tested', 'Work with designers on smooth mobile UX']],
  [/qa|test/i, ['Plan and run manual and automated tests', 'Report and track defects clearly', 'Improve test coverage and release quality']],
  [/market|growth|seo/i, ['Plan and run acquisition campaigns', 'Track funnel metrics and report results', 'Run experiments to improve conversion']],
];
const YEARS_FOR = { intern: 0, fresher: 0, junior: 1, middle: 3, mid: 3, senior: 5, lead: 7, manager: 7, director: 10 } as const;

/** "Create with AI" from a job title alone: a first draft of the JD's structured fields for HR to review. */
export function generateJdFromTitle(title: string, seniority?: string): JdInput {
  const t = title.trim();
  // A level named in the title wins over the form's current seniority.
  const level = Object.keys(YEARS_FOR).find((k) => new RegExp(`\\b${k}\\b`, 'i').test(t)) ?? seniority;
  const years = level ? YEARS_FOR[level.toLowerCase() as keyof typeof YEARS_FOR] as number | undefined : undefined;
  const role = ROLE_STACKS.find(([words]) => words.some((w) => t.toLowerCase().includes(w)));
  const skills = [...new Set([...extractSkills(t), ...(role?.[1] ?? [])])];
  const duties = ROLE_DUTIES.find(([re]) => re.test(t))?.[1] ?? ['Deliver the core work of the role to a high standard', 'Work closely with the team and stakeholders', 'Share knowledge and improve how the team works'];
  const lead = /lead|manager|head|director/i.test(`${t} ${level ?? ''}`);
  return {
    title: t,
    domains: [],
    skills,
    body: '',
    summary: `We are looking for a ${t} to join our team. You will ${duties[0].charAt(0).toLowerCase()}${duties[0].slice(1)} and help the product grow.`,
    responsibilities: [...duties, ...(lead ? ['Lead, mentor and grow the team'] : [])],
    dailyTasks: ['Join the daily stand-up and plan the day', 'Work on assigned tasks and review teammates\' work', 'Update progress in the team tracker'],
    mustHave: [
      ...(years ? [`${years}+ years of experience as a ${t.replace(/^(senior|junior|lead|middle|mid)\s+/i, '')}`] : []),
      ...(skills.length ? [`Solid hands-on experience with ${list(skills.slice(0, 3))}`] : []),
      'Clear written and spoken communication',
    ],
    niceToHave: skills.length > 3 ? [`Experience with ${list(skills.slice(3, 6))}`] : [],
    ...(level ? { seniority: level.charAt(0).toUpperCase() + level.slice(1).toLowerCase() } : {}),
    ...(years !== undefined ? { minYears: years } : {}),
    education: 'bachelor',
  };
}
