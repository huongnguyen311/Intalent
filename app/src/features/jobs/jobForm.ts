import type { Job, Stage } from '../../domain/types';

export const SLA_STAGES = ['new', 'screening', 'interview', 'offer'] as const satisfies readonly Stage[];
export const DEFAULT_SLA: Job['stageSla'] = { new: 2, screening: 5, interview: 7, offer: 5 };
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
