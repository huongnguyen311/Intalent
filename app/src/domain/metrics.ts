import { FORWARD_STAGES, isCustomStage, isEnded, STAGES } from './stages';
import { localStamp, salaryRange } from './hiring';
import type { Application, Candidate, DemoState, Stage } from './types';

export type Period = 'day' | 'week' | '3m' | '6m' | 'all';

const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = { day: 1, week: 7, '3m': 90, '6m': 180 };
const DAY_MS = 86_400_000;

export interface DashboardMetrics {
  total: number;
  active: number;
  parsingSuccess: { ok: number; total: number };
  missingEmail: number;
  topStacks: { name: string; pct: number; color?: string }[];
  seniority: Record<string, number>;
  topTa: { name: string; files: number; newCv?: number }[];
  availableStacks: { name: string; count: number; pct: number }[];
  english: Record<string, number>;
  domains: { name: string; pct: number }[];
  recruitment: {
    openJobs: number;
    /** Applications added in the period (PRD 3.8 "New Applications"). */
    newApplications: number;
    /** Interviews (not cancelled) scheduled to take place in the period. */
    interviews: number;
    byStage: Record<Stage, number>;
    hires: number;
    /** Hires per source too: the source that brings most CVs is not always the one that hires. */
    topSources: { source: string; count: number; hires: number }[];
    /** Open applications past New: AI Screening through Offer. */
    inProgress: number;
    /** Mean days from applying to accepting the offer (or reaching Hired), for hires in the period. */
    timeToHireDays?: number;
    /** Applications added in the period that reached each forward stage (skipped optional stages count as passed). */
    funnel: { stage: Stage; reached: number }[];
    /** Of the funnel cohort, how many ended Rejected / Withdrawn. */
    closedOut: { rejected: number; withdrawn: number };
    topRejectReasons: { reason: string; count: number }[];
    /** Latest AI evaluation per application added in the period: scored, and how many scored >= AI_MATCH_THRESHOLD. */
    aiMatch: { matched: number; scored: number };
    /** Offers answered in the period. */
    offers: { accepted: number; declined: number };
    /** This week's (local Monday–Sunday) interviews, not cancelled, by start time; `days` lists the week's dates. */
    week: { today: string; days: string[]; interviews: WeekInterview[] };
    /** Latest stage moves on the scoped applications, newest first. */
    recentActivity: { id: string; appId: string; jobId: string; candidate: string; job: string; stage: Stage; at: string }[];
    /** Open jobs, most recently opened first, with how many applied (in total and in the last 7 days). */
    openJobsList: OpenJobRow[];
  };
}

export interface WeekInterview {
  id: string;
  appId: string;
  jobId: string;
  candidate: string;
  job: string;
  /** Local "YYYY-MM-DDTHH:mm". */
  at: string;
  durationMin: number;
  mode: 'onsite' | 'online' | 'phone';
  round: string;
  place: string;
}

export interface OpenJobRow {
  id: string;
  title: string;
  department: string;
  location: string;
  employment: string;
  workplace?: string;
  /** Formatted range ("VND 20,000,000 – 35,000,000"), when the job has one. */
  salary?: string;
  applicants: number;
  newThisWeek: number;
  openedAt: string;
}

function tally(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

/** Entries by count descending; ties keep first-seen order (Array.sort is stable). */
const ranked = (counts: Map<string, number>) => [...counts].sort((a, b) => b[1] - a[1]);

const toRecord = (values: string[]): Record<string, number> => Object.fromEntries(tally(values));

/** Same bar as JD Matching's "partial match" tier (60–79; 80+ is strong). */
export const AI_MATCH_THRESHOLD = 60;




/** When the application was won: offer accepted (scope ends there), else first entry into Hired. */
function hiredAt(a: Application): number | undefined {
  if (a.offer?.status === 'accepted' && a.offer.respondedAt) return Date.parse(a.offer.respondedAt);
  const h = a.history.find((e) => e.stage === 'hired');
  return h ? Date.parse(h.at) : undefined;
}

/** Index in FORWARD_STAGES of the furthest stage the application ever reached. */
function furthest(a: Application): number {
  return Math.max(0, ...[a.stage, ...a.history.map((h) => h.stage)].map((s) => FORWARD_STAGES.indexOf(s)));
}

/**
 * `cutoff` (epoch ms) scopes the period: hires and offers by when they happened, cohort figures
 * (new applications, funnel, sources, AI match, reject reasons) by when the application was added.
 * Stage counts and in-progress stay current.
 */
function recruitment(state: DemoState, cutoff = -Infinity, now = Date.now()): DashboardMetrics['recruitment'] {
  const byStage = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const a of state.applications) byStage[a.stage] += 1;
  const cohort = state.applications.filter((a) => Date.parse(a.addedAt) >= cutoff);
  const hiredInPeriod = state.applications.filter((a) => {
    const at = hiredAt(a);
    return at !== undefined && at >= cutoff && (a.stage === 'hired' || a.offer?.status === 'accepted');
  });
  const isHire = (a: Application) => a.stage === 'hired' || a.offer?.status === 'accepted';

  const reach = cohort.map(furthest);
  // Custom columns are job-specific, so the cross-job funnel leaves them out.
  const funnel = FORWARD_STAGES.map((stage, i) => ({ stage, reached: reach.filter((r) => r >= i).length })).filter((f) => !isCustomStage(f.stage));

  const sourceHires = tally(cohort.filter(isHire).map((a) => a.source));
  const latestAi = cohort
    .map((a) => a.aiEvaluations?.[a.aiEvaluations.length - 1])
    .filter((e) => e && !e.noCriteria);
  const answered = state.applications
    .map((a) => a.offer)
    .filter((o) => o?.respondedAt && Date.parse(o.respondedAt) >= cutoff);
  const jobById = new Map(state.jobs.map((j) => [j.id, j]));
  const today = localStamp(new Date(now)).slice(0, 10);
  // Local Monday-start week around `now`.
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return localStamp(d).slice(0, 10);
  });
  const nameOf = new Map(state.candidates.map((c) => [c.id, c.name]));

  const days = hiredInPeriod.map((a) => (hiredAt(a)! - Date.parse(a.addedAt)) / DAY_MS);
  return {
    openJobs: state.jobs.filter((j) => j.status === 'open').length,
    newApplications: cohort.length,
    interviews: state.applications
      .flatMap((a) => a.interviews ?? [])
      .filter((i) => i.status !== 'cancelled' && Date.parse(i.at) >= cutoff).length,
    byStage,
    hires: state.applications.filter((a) => a.history.some((h) => h.stage === 'hired' && Date.parse(h.at) >= cutoff)).length,
    topSources: ranked(tally(cohort.map((a) => a.source)))
      .slice(0, 5)
      .map(([source, count]) => ({ source, count, hires: sourceHires.get(source) ?? 0 })),
    inProgress: state.applications.filter((a) => a.stage !== 'new' && !isEnded(a.stage)).length,
    timeToHireDays: days.length ? Math.round(days.reduce((n, d) => n + d, 0) / days.length) : undefined,
    funnel,
    closedOut: {
      rejected: cohort.filter((a) => a.stage === 'rejected').length,
      withdrawn: cohort.filter((a) => a.stage === 'withdrawn').length,
    },
    topRejectReasons: ranked(tally(cohort.filter((a) => a.stage === 'rejected' && a.rejectedReason?.trim()).map((a) => a.rejectedReason!.trim())))
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count })),
    aiMatch: { matched: latestAi.filter((e) => e!.score >= AI_MATCH_THRESHOLD).length, scored: latestAi.length },
    offers: {
      accepted: answered.filter((o) => o!.status === 'accepted').length,
      declined: answered.filter((o) => o!.status === 'declined').length,
    },
    week: {
      today,
      days: weekDays,
      interviews: state.applications
        .flatMap((a) =>
          (a.interviews ?? [])
            .filter((i) => i.status !== 'cancelled' && weekDays.includes(i.at.slice(0, 10)))
            .map((i) => ({
              id: i.id,
              appId: a.id,
              jobId: a.jobId,
              candidate: nameOf.get(a.candidateId) ?? '',
              job: jobById.get(a.jobId)?.title ?? '',
              at: i.at,
              durationMin: i.durationMin,
              mode: i.mode,
              round: i.round,
              place: i.place,
            })),
        )
        .sort((x, y) => x.at.localeCompare(y.at)),
    },
    recentActivity: state.applications
      .flatMap((a) => a.history.slice(1).map((h, i) => ({ a, h, i })))
      .sort((x, y) => Date.parse(y.h.at) - Date.parse(x.h.at))
      .slice(0, 8)
      .map(({ a, h, i }) => ({
        id: `${a.id}-${i}`,
        appId: a.id,
        jobId: a.jobId,
        candidate: nameOf.get(a.candidateId) ?? '',
        job: jobById.get(a.jobId)?.title ?? '',
        stage: h.stage,
        at: h.at,
      })),
    openJobsList: state.jobs
      .filter((j) => j.status === 'open')
      .sort((x, y) => Date.parse(y.openedAt) - Date.parse(x.openedAt))
      .map((j) => {
        const apps = state.applications.filter((a) => a.jobId === j.id);
        return {
          id: j.id,
          title: j.title,
          department: j.department,
          location: j.location,
          employment: j.employment,
          workplace: j.workplace,
          salary: salaryRange(j),
          applicants: apps.length,
          newThisWeek: apps.filter((a) => Date.parse(a.addedAt) >= now - 7 * DAY_MS).length,
          openedAt: j.openedAt,
        };
      }),
  };
}

function fromTotals(state: DemoState, cutoff: number, now: number): DashboardMetrics | undefined {
  const d = state.meta?.totals?.dashboard;
  if (!d) return undefined;
  return {
    total: d.totalCandidates,
    active: d.activeCandidates,
    parsingSuccess: { ok: d.parsing.ok, total: d.parsing.of },
    missingEmail: d.missingEmail,
    topStacks: d.topStacks.map((s) => ({ name: s.label, pct: s.pct, color: s.color })),
    seniority: Object.fromEntries(d.seniority.map((s) => [s.label, s.count])),
    topTa: d.contributors.map((c) => ({ name: c.name, files: c.total, newCv: c.newCv })),
    availableStacks: d.availableStacks.map((s) => ({ name: s.label, count: s.count, pct: s.pct })),
    english: Object.fromEntries(d.english.map((e) => [e.label, e.count])),
    domains: d.domains.map((x) => ({ name: x.label, pct: x.pct })),
    recruitment: recruitment(state, cutoff, now),
  };
}

export function dashboardMetrics(state: DemoState, period: Period, now: Date): DashboardMetrics {
  const cutoff = period === 'all' ? -Infinity : now.getTime() - PERIOD_DAYS[period] * DAY_MS;
  const overrides = fromTotals(state, cutoff, now.getTime());
  if (overrides) return overrides;

  let candidates: Candidate[] = state.candidates;
  if (period !== 'all') {
    candidates = candidates.filter((c) => Date.parse(c.createdAt) >= cutoff);
  }
  const total = candidates.length;
  const pct = (n: number, of: number) => (of ? (n / of) * 100 : 0);

  const topSkills = ranked(tally(candidates.flatMap((c) => c.skills))).slice(0, 6);
  const topSkillsSum = topSkills.reduce((n, [, c]) => n + c, 0);
  const userName = (id: string) => state.users.find((u) => u.id === id)?.name ?? id;

  return {
    total,
    active: total,
    parsingSuccess: { ok: candidates.filter((c) => c.skills.length > 0).length, total },
    missingEmail: candidates.filter((c) => !c.email.trim()).length,
    topStacks: topSkills.map(([name, n]) => ({ name, pct: Math.round(pct(n, topSkillsSum) * 100) / 100 })),
    seniority: toRecord(candidates.map((c) => c.seniority).filter(Boolean)),
    topTa: ranked(tally(candidates.map((c) => userName(c.cvOwner)).filter(Boolean)))
      .slice(0, 3)
      .map(([name, files]) => ({ name, files })),
    availableStacks: topSkills.slice(0, 2).map(([name, count]) => ({ name, count, pct: Math.round(pct(count, total) * 100) / 100 })),
    english: toRecord(candidates.map((c) => c.english).filter(Boolean)),
    domains: ranked(tally(candidates.flatMap((c) => c.domains)))
      .slice(0, 5)
      .map(([name, n]) => ({ name, pct: Math.round(pct(n, total)) })),
    recruitment: recruitment(state, cutoff, now.getTime()),
  };
}
