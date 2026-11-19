import { evaluateApplication, requirementsForJob } from '../../domain/aiEvaluation';
import { matchRule } from '../../domain/pipelineConfig';
import type { Activity, Application, ApplicationRating } from '../../domain/types';
import type { DemoActions, Env, Get, Set } from './types';

/** `by` on history entries and activities written by pipeline automation rules. */
export const AUTOMATION_ACTOR = 'InTalent Automation';

export function applicationActions(
  set: Set,
  get: Get,
  env: Env,
): Pick<DemoActions, 'addToPipeline' | 'moveStage' | 'addComment' | 'rateApplication' | 'runAiEvaluation' | 'runAutomations'> {
  return {
    runAiEvaluation(appId, by) {
      const s = get();
      const app = s.applications.find((a) => a.id === appId);
      const candidate = app && s.candidates.find((c) => c.id === app.candidateId);
      const job = app && s.jobs.find((j) => j.id === app.jobId);
      if (!app) return undefined;
      if (!candidate || !job || app.handoff) {
        // Nothing to score: drop it from the queue so the card does not say "scoring" forever.
        if (app.aiPending) set((st) => ({ applications: st.applications.map((a) => (a.id === appId ? { ...a, aiPending: false } : a)) }));
        return undefined;
      }
      const at = env.now();
      const version = (app.aiEvaluations?.length ?? 0) + 1;
      const evaluation = evaluateApplication(candidate, requirementsForJob(job, s.jds, s.taxonomy), at, env.id('ai'));
      const activity: Activity = {
        type: 'ai_evaluated',
        candidateId: app.candidateId,
        applicationId: app.id,
        jobId: app.jobId,
        by,
        at,
        detail: `AI evaluation v${version}: ${evaluation.score}`,
      };
      set((st) => ({
        applications: st.applications.map((a) =>
          a.id === appId ? { ...a, aiPending: false, aiEvaluations: [...(a.aiEvaluations ?? []), evaluation] } : a),
        activities: [...st.activities, activity],
      }));
      get().runAutomations(appId);
      return evaluation;
    },

    runAutomations(appId) {
      let moves = 0;
      // A few hops at most, so a badly configured rule loop can never spin.
      for (let hop = 0; hop < 4; hop++) {
        const s = get();
        const app = s.applications.find((a) => a.id === appId);
        const job = app && s.jobs.find((j) => j.id === app.jobId);
        const rule = app && job && matchRule(app, job);
        if (!rule) break;
        const note = `Automation: ${rule.when === 'on_enter' ? 'on entry' : `AI score ${rule.when === 'score_gte' ? '≥' : '<'} ${rule.score}`}`;
        if (!get().moveStage(appId, rule.to, AUTOMATION_ACTOR, undefined, note, { code: rule.rejectCode ?? (rule.to === 'rejected' ? 'other' : undefined), ruleId: rule.id })) break;
        moves++;
      }
      return moves;
    },

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
        aiPending: true,
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
      // "On entry" rules (e.g. New -> AI Screening) fire right away; score rules wait for the AI.
      if (get().runAutomations(application.id) > 0) {
        return { ok: true, application: get().applications.find((a) => a.id === application.id) ?? application };
      }
      return { ok: true, application };
    },

    moveStage(appId, to, by, reason, note, opts) {
      const app = get().applications.find((a) => a.id === appId);
      // Handed-off hires belong to the onboarding tool now.
      if (!app || app.stage === to || app.handoff) return false;
      const trimmedNote = note?.trim() || undefined;
      // Rejecting needs a reason; the move note doubles as that reason.
      const trimmed = reason?.trim() || (to === 'rejected' ? trimmedNote : undefined);
      const code = to === 'rejected' ? opts?.code : undefined;
      if (to === 'rejected' && !trimmed && !code) return false;
      const at = env.now();
      // A reason only belongs to the rejection it was given for.
      const { rejectedReason: _gone, rejectedCode: _code, ...kept } = app;
      const next: Application = {
        ...kept,
        stage: to,
        stageEnteredAt: at,
        history: [...app.history, { stage: to, at, by, ...(trimmedNote ? { note: trimmedNote } : {}), ...(opts?.ruleId ? { ruleId: opts.ruleId } : {}) }],
        ...(to === 'rejected' && trimmed ? { rejectedReason: trimmed } : {}),
        ...(code ? { rejectedCode: code } : {}),
      };
      const activity: Activity = {
        type: 'stage_changed',
        candidateId: app.candidateId,
        applicationId: app.id,
        jobId: app.jobId,
        by,
        at,
        detail: `${app.stage} to ${to}${code ? ` [${code}]` : ''}${trimmed || trimmedNote ? `: ${trimmed || trimmedNote}` : ''}`,
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
