import { normalizeRole } from './permissions';
import type { Application, Currency, Interview, Job, Scorecard, Stage, User } from './types';
import { averageOf } from './scorecard';

/** Name of the internal onboarding tool hires are handed to (placeholder until it has a product name). */
export const HANDOFF_TARGET = 'HR Onboarding (internal)';

/** Email template ids (the `email-` prefixed prompts in the store). */
export const TEMPLATE = {
  received: 'email-application-received',
  interview: 'email-interview-invite',
  offer: 'email-offer',
  rejection: 'email-rejection',
  update: 'email-stage-update',
} as const;

/** Template suggested when a card moves to a stage; stages without one send nothing by default. */
export function stageTemplate(stage: Stage): string | undefined {
  if (stage === 'rejected') return TEMPLATE.rejection;
  if (stage === 'screening' || stage === 'interview' || stage === 'offer') return TEMPLATE.update;
  return undefined;
}

/** Replaces `{{key}}` with vars[key]; unknown keys stay as written so a missing value is visible. */
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (vars[k] !== undefined && vars[k] !== '' ? vars[k] : m));
}

export function formatMoney(n: number, currency: Currency = 'VND'): string {
  if (currency === 'VND') return `${new Intl.NumberFormat('vi-VN').format(n)} ₫`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

/** "40.000.000 ₫ – 60.000.000 ₫"; undefined when the job has no salary. */
export function salaryRange(job: Pick<Job, 'salaryMin' | 'salaryMax' | 'currency'>): string | undefined {
  const { salaryMin: lo, salaryMax: hi, currency } = job;
  if (!lo && !hi) return undefined;
  if (lo && hi) return `${formatMoney(lo, currency)} – ${formatMoney(hi, currency)}`;
  return formatMoney((lo || hi) as number, currency);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local "YYYY-MM-DDTHH:mm" for a Date. */
export function localStamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Thu 20/11/2026 · 10:00" ("Th 5 …" in Vietnamese) from a local stamp. */
export function interviewTime(at: string, lang: 'en' | 'vi' = 'en'): string {
  const [date, time = ''] = at.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y, m - 1, d).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'short' });
  return `${day} ${pad(d)}/${pad(m)}/${y} · ${time.slice(0, 5)}`;
}

/** "20/11/2026" from YYYY-MM-DD. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Earliest scheduled interview that has not started yet. */
export function nextInterview(app: Pick<Application, 'interviews'>, now: Date = new Date()): Interview | undefined {
  const stamp = localStamp(now);
  return (app.interviews ?? [])
    .filter((i) => i.status === 'scheduled' && i.at >= stamp)
    .sort((a, b) => a.at.localeCompare(b.at))[0];
}

export function scorecardAverage(sc: Pick<Scorecard, 'scores'>): number {
  return averageOf(sc.scores);
}

/** Handed-off applications are read-only: no moves, interviews or offer changes. */
export const isLocked = (app: Pick<Application, 'handoff'>): boolean => !!app.handoff;

/**
 * An accepted offer is final only while the candidate stays Hired. Moved back out of Hired (they backed out, or
 * the move was a mistake), the offer can be edited, sent again or recorded as declined.
 */
export const offerFinal = (app: Pick<Application, 'offer' | 'stage'>): boolean => app.offer?.status === 'accepted' && app.stage === 'hired';

/** Whether `userId` sits on a (not cancelled) round of this application and has not sent a scorecard for it yet. */
export function awaitsScorecardFrom(app: Pick<Application, 'interviews'>, userId: string): boolean {
  return (app.interviews ?? []).some((iv) => iv.status !== 'cancelled' && iv.interviewers.includes(userId) && !iv.scorecards.some((c) => c.by === userId));
}

/**
 * Independent feedback: an Interviewer on this round sees the other scorecards only after sending theirs.
 * Recruiters, leads and hiring managers decide on the feedback, so it is never hidden from them.
 */
export function scorecardsHiddenFrom(iv: Pick<Interview, 'interviewers' | 'scorecards'>, user: Pick<User, 'id' | 'role'>): boolean {
  return normalizeRole(user.role) === 'Interviewer' && iv.interviewers.includes(user.id) && !iv.scorecards.some((c) => c.by === user.id);
}

/** The browser's IANA zone, recorded on new interviews. */
export function localTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** "GMT+7" for a zone on that date (handles summer time); empty when the zone is unknown. */
export function zoneLabel(timeZone: string | undefined, at: string): string {
  if (!timeZone) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(new Date(`${at}:00Z`));
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}
