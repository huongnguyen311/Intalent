import { isEnded } from './stages';
import type { Application, Job, Stage } from './types';

const DAY = 86_400_000;

/** Whole days since the application entered its current stage. */
export const daysInStage = (app: Application, now: number = Date.now()): number =>
  Math.max(0, Math.floor((now - new Date(app.stageEnteredAt).getTime()) / DAY));

/** True when the card has sat in its stage longer than the job's SLA (end stages have none). */
export function isOverSla(app: Application, job: Job, now: number = Date.now()): boolean {
  if (isEnded(app.stage)) return false;
  const sla = job.stageSla[app.stage];
  return sla !== undefined && daysInStage(app, now) > sla;
}

/** Mean of the team's ratings to one decimal; undefined when nobody rated yet. */
export function averageRating(app: Application): number | undefined {
  const ratings = app.ratings ?? [];
  if (ratings.length === 0) return undefined;
  return Math.round((ratings.reduce((n, r) => n + r.stars, 0) / ratings.length) * 10) / 10;
}

export type StageMetrics = { sla?: number; overdue: number; share: number };

/** Header numbers for one stage, from ALL of the job's applications (a filter never changes them). */
export function stageMetrics(jobApps: Application[], job: Job, stage: Stage, now: number = Date.now()): StageMetrics {
  const inStage = jobApps.filter((a) => a.stage === stage);
  const ended = isEnded(stage);
  return {
    sla: ended ? undefined : job.stageSla[stage],
    overdue: inStage.filter((a) => isOverSla(a, job, now)).length,
    share: jobApps.length === 0 ? 0 : Math.round((100 * inStage.length) / jobApps.length),
  };
}
