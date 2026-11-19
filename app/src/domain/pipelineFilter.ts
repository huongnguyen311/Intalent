import { aiRank } from './aiEvaluation';
import { isOverSla } from './pipeline';
import { fold } from './techVocab';
import type { Application, Candidate, Job, Stage } from './types';

const DAY = 86_400_000;

export type ApplicationQuery = {
  text?: string;
  source?: string;
  /** PRD 3.5 filters: one stage, the recruiter who added the application, applied within N days. */
  stage?: Stage | '';
  recruiter?: string;
  sinceDays?: number;
  /** Latest AI score at least this; applications without a score are left out while it is set. */
  minScore?: number;
};

/** True when any narrowing field is set. */
export const hasFilter = (q: ApplicationQuery): boolean =>
  !!(q.text?.trim() || q.source || q.stage || q.recruiter || q.sinceDays || q.minScore);

/**
 * Search by candidate name/title (case + diacritic insensitive), exact source, stage, recruiter (`addedBy`)
 * and "applied in the last N days"; an empty query keeps everything.
 */
export function filterApplications(
  apps: Application[],
  candidates: Candidate[],
  q: ApplicationQuery,
  now: number = Date.now(),
): Application[] {
  const text = fold((q.text ?? '').trim());
  if (!hasFilter(q)) return apps;
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const since = q.sinceDays ? now - q.sinceDays * DAY : -Infinity;
  return apps.filter((a) => {
    if (q.source && a.source !== q.source) return false;
    if (q.stage && a.stage !== q.stage) return false;
    if (q.recruiter && a.addedBy !== q.recruiter) return false;
    if (Date.parse(a.addedAt) < since) return false;
    if (q.minScore && aiRank(a) < q.minScore) return false;
    if (!text) return true;
    const c = byId.get(a.candidateId);
    return !!c && fold(`${c.name} ${c.title ?? ''}`).includes(text);
  });
}

export function pipelineSummary(apps: Application[], job: Job, now: number): { total: number; overdue: number; daysOpen: number } {
  return {
    total: apps.length,
    overdue: apps.filter((a) => isOverSla(a, job, now)).length,
    daysOpen: Math.max(0, Math.floor((now - new Date(job.openedAt).getTime()) / DAY)),
  };
}
