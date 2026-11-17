import type { Activity, Application, ApplicationRating } from '../../domain/types';
import type { DemoActions, Env, Get, Set } from './types';

export function applicationActions(
  set: Set,
  get: Get,
  env: Env,
): Pick<DemoActions, 'addToPipeline' | 'moveStage' | 'addComment' | 'rateApplication'> {
  return {
    addToPipeline(candidateId, jobId, ctx) {
      const job = get().jobs.find((j) => j.id === jobId);
      if (!job || job.status !== 'open') return { ok: false, reason: 'job_not_open' };
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

    moveStage(appId, to, by, reason, note) {
      const app = get().applications.find((a) => a.id === appId);
      if (!app || app.stage === to) return false;
      const trimmedNote = note?.trim() || undefined;
      // Rejecting needs a reason; the move note doubles as that reason.
      const trimmed = reason?.trim() || (to === 'rejected' ? trimmedNote : undefined);
      if (to === 'rejected' && !trimmed) return false;
      const at = env.now();
      // A reason only belongs to the rejection it was given for.
      const { rejectedReason: _gone, ...kept } = app;
      const next: Application = {
        ...kept,
        stage: to,
        stageEnteredAt: at,
        history: [...app.history, { stage: to, at, by, ...(trimmedNote ? { note: trimmedNote } : {}) }],
        ...(to === 'rejected' ? { rejectedReason: trimmed } : {}),
      };
      const activity: Activity = {
        type: 'stage_changed',
        candidateId: app.candidateId,
        applicationId: app.id,
        jobId: app.jobId,
        by,
        at,
        detail: `${app.stage} to ${to}${trimmed || trimmedNote ? `: ${trimmed || trimmedNote}` : ''}`,
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
