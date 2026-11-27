import type { Application, Recommendation } from '../../domain/types';

/** Applications that are still moving (not hired, rejected or withdrawn). */
export const isActiveApplication = (a: Pick<Application, 'stage'>) => !['hired', 'rejected', 'withdrawn'].includes(a.stage);

/** Ratings, scorecards, comments and rejections of one candidate, across every job they were in. */
export function feedbackSummary(apps: Application[]) {
  const stars = apps.flatMap((a) => (a.ratings ?? []).map((r) => r.stars));
  const cards = apps.flatMap((a) => (a.interviews ?? []).flatMap((iv) => iv.scorecards));
  const recs = cards.reduce<Partial<Record<Recommendation, number>>>((m, c) => ({ ...m, [c.recommendation]: (m[c.recommendation] ?? 0) + 1 }), {});
  return {
    avgStars: stars.length ? Math.round((stars.reduce((s, x) => s + x, 0) / stars.length) * 10) / 10 : undefined,
    ratingCount: stars.length,
    scorecardCount: cards.length,
    recs,
    commentCount: apps.reduce((n, a) => n + a.comments.length, 0),
    rejections: apps.filter((a) => a.stage === 'rejected').length,
  };
}
