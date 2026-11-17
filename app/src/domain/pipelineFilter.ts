import { isOverSla } from './pipeline';
import { fold } from './techVocab';
import type { Application, Candidate, Job } from './types';

const DAY = 86_400_000;

/** Search by candidate name/title (case + diacritic insensitive) and exact source; empty query keeps everything. */
export function filterApplications(
  apps: Application[],
  candidates: Candidate[],
  q: { text?: string; source?: string },
): Application[] {
  const text = fold((q.text ?? '').trim());
  if (!text && !q.source) return apps;
  const byId = new Map(candidates.map((c) => [c.id, c]));
  return apps.filter((a) => {
    if (q.source && a.source !== q.source) return false;
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
