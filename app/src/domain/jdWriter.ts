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
