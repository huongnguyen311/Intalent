import type { Job, Stage } from '../../domain/types';

export const SLA_STAGES = ['new', 'ai_screening', 'screening', 'interview', 'assessment', 'final_interview', 'offer'] as const satisfies readonly Stage[];
export const DEFAULT_SLA: Job['stageSla'] = { new: 2, ai_screening: 1, screening: 5, interview: 7, assessment: 5, final_interview: 5, offer: 5 };
export const LEVELS = ['Junior', 'Middle', 'Senior', 'Lead'];
export const EMPLOYMENTS = ['Full-time', 'Part-time', 'Contract', 'Internship'];

/** Best-effort level from a JD title ("Senior Frontend Developer" -> Senior); empty when none is mentioned. */
export function inferLevel(title: string): string {
  const t = title.toLowerCase();
  if (/\b(lead|principal|head)\b/.test(t)) return 'Lead';
  if (/\b(senior|sr)\b/.test(t)) return 'Senior';
  if (/\b(junior|jr|fresher|intern)\b/.test(t)) return 'Junior';
  if (/\b(middle|mid|intermediate)\b/.test(t)) return 'Middle';
  return '';
}

export const daysOpen = (job: Job, now = Date.now()): number =>
  Math.max(0, Math.floor((now - new Date(job.openedAt).getTime()) / 86_400_000));

/** "5h ago" pieces for the Last Updated column; the caller translates `jobs.ago.<unit>`. */
export function ago(iso: string, now = Date.now()): { unit: 'now' | 'm' | 'h' | 'd' | 'mo'; n: number } {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return { unit: 'now', n: 0 };
  if (min < 60) return { unit: 'm', n: min };
  if (min < 1440) return { unit: 'h', n: Math.floor(min / 60) };
  const d = Math.floor(min / 1440);
  return d < 30 ? { unit: 'd', n: d } : { unit: 'mo', n: Math.floor(d / 30) };
}
