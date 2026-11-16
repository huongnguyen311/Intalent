import { STAGES } from './stages';
import type { Candidate, DemoState, Stage } from './types';

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
    byStage: Record<Stage, number>;
    hires: number;
    topSources: { source: string; count: number }[];
  };
}

function tally(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

/** Entries by count descending; ties keep first-seen order (Array.sort is stable). */
const ranked = (counts: Map<string, number>) => [...counts].sort((a, b) => b[1] - a[1]);

const toRecord = (values: string[]): Record<string, number> => Object.fromEntries(tally(values));

function recruitment(state: DemoState): DashboardMetrics['recruitment'] {
  const byStage = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const a of state.applications) byStage[a.stage] += 1;
  return {
    openJobs: state.jobs.filter((j) => j.status === 'open').length,
    byStage,
    hires: byStage.hired,
    topSources: ranked(tally(state.applications.map((a) => a.source)))
      .slice(0, 5)
      .map(([source, count]) => ({ source, count })),
  };
}

function fromTotals(state: DemoState): DashboardMetrics | undefined {
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
    recruitment: recruitment(state),
  };
}

export function dashboardMetrics(state: DemoState, period: Period, now: Date): DashboardMetrics {
  const overrides = fromTotals(state);
  if (overrides) return overrides;

  let candidates: Candidate[] = state.candidates;
  if (period !== 'all') {
    const cutoff = now.getTime() - PERIOD_DAYS[period] * DAY_MS;
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
    recruitment: recruitment(state),
  };
}
