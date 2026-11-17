import type { Activity, Application, ApplicationRating } from '../../domain/types';
import type { DemoActions, Env, Get, Set } from './types';

export function applicationActions(
  set: Set,
  get: Get,
  env: Env,
): Pick<DemoActions, 'addToPipeline' | 'moveStage' | 'addComment' | 'rateApplication'> {
  return {
    addToPipeline(candidateId, jobId, ctx) {
      const dup = get().applications.find((a) => a.candidateId === candidateId && a.jobId === jobId);
      if (dup) return { ok: false, reason: 'duplicate', stage: dup.stage };
      const at = env.now();
      const application: Application = {
        id: env.id('app'),
        candidateId,
        jobId,
        stage: 'new',
        source: ctx.source,
        via: ctx.via,
        ...(ctx.campaignId ? { campaignId: ctx.campaignId } : {}),
        addedBy: ctx.by,
        addedAt: at,
        stageEnteredAt: at,
        history: [{ stage: 'new', at, by: ctx.by }],
        comments: [],
      };
      const activity: Activity = {
        type: 'added_to_pipeline',
        candidateId,
        applicationId: application.id,
        jobId,
        by: ctx.by,
        at,
        detail: `Added to pipeline via ${ctx.via} (${ctx.source})`,
      };
      set((s) => ({ applications: [...s.applications, application], activities: [...s.activities, activity] }));
      return { ok: true, application };
    },

    moveStage(appId, to, by, reason) {
      const app = get().applications.find((a) => a.id === appId);
      if (!app || app.stage === to) return false;
      const trimmed = reason?.trim();
      if (to === 'rejected' && !trimmed) return false;
      const at = env.now();
      const next: Application = {
        ...app,
        stage: to,
        stageEnteredAt: at,
        history: [...app.history, { stage: to, at, by }],
        ...(to === 'rejected' ? { rejectedReason: trimmed } : {}),
      };
      const activity: Activity = {
        type: 'stage_changed',
        candidateId: app.candidateId,
        applicationId: app.id,
        jobId: app.jobId,
        by,
        at,
        detail: `${app.stage} to ${to}${trimmed ? `: ${trimmed}` : ''}`,
      };
      set((s) => ({
        applications: s.applications.map((a) => (a.id === appId ? next : a)),
        activities: [...s.activities, activity],
      }));
      return true;
    },

    addComment(appId, text, by) {
      const trimmed = text.trim();
      if (!trimmed || !get().applications.some((a) => a.id === appId)) return false;
      const comment = { by, at: env.now(), text: trimmed };
      set((s) => ({
        applications: s.applications.map((a) => (a.id === appId ? { ...a, comments: [...a.comments, comment] } : a)),
      }));
      return true;
    },

    rateApplication(appId, by, stars) {
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) return false;
      if (!get().applications.some((a) => a.id === appId)) return false;
      const rating: ApplicationRating = { by, stars, at: env.now() };
      const upsert = (ratings: ApplicationRating[] = []) =>
        ratings.some((r) => r.by === by) ? ratings.map((r) => (r.by === by ? rating : r)) : [...ratings, rating];
      set((s) => ({
        applications: s.applications.map((a) => (a.id === appId ? { ...a, ratings: upsert(a.ratings) } : a)),
      }));
      return true;
    },
  };
}
