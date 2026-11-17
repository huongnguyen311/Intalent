import type { Application, Job } from './types';

const DAY = 86_400_000;

/** Whole days since the application entered its current stage. */
export const daysInStage = (app: Application, now: number = Date.now()): number =>
  Math.max(0, Math.floor((now - new Date(app.stageEnteredAt).getTime()) / DAY));

/** True when the card has sat in its stage longer than the job's SLA (hired/rejected have none). */
export function isOverSla(app: Application, job: Job, now: number = Date.now()): boolean {
  if (app.stage === 'hired' || app.stage === 'rejected') return false;
  const sla = job.stageSla[app.stage];
  return sla !== undefined && daysInStage(app, now) > sla;
}

/** Mean of the team's ratings to one decimal; undefined when nobody rated yet. */
export function averageRating(app: Application): number | undefined {
  const ratings = app.ratings ?? [];
  if (ratings.length === 0) return undefined;
  return Math.round((ratings.reduce((n, r) => n + r.stars, 0) / ratings.length) * 10) / 10;
}
