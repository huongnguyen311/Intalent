import { FORWARD_STAGES, isClosedOut, isEnded } from '../../domain/stages';
import { HANDOFF_TARGET, interviewTime, isLocked, offerFinal } from '../../domain/hiring';
import type { Activity, Application, Interview, Offer, Scorecard, SentEmail } from '../../domain/types';
import { criteriaOf, validScores } from '../../domain/scorecard';
import type { DemoActions, Env, Get, Set } from './types';

type Keys =
  | 'sendEmail'
  | 'scheduleInterview'
  | 'cancelInterview'
  | 'submitScorecard'
  | 'saveOffer'
  | 'markOfferSent'
  | 'respondOffer'
  | 'handOff';

/** Interviews, scorecards, offers, the (simulated) email log and the hand-off to the onboarding tool. */
export function hiringActions(set: Set, get: Get, env: Env): Pick<DemoActions, Keys> {
  const findApp = (id: string) => get().applications.find((a) => a.id === id);
  const patchApp = (id: string, fn: (a: Application) => Application, activity?: Omit<Activity, 'at' | 'candidateId' | 'jobId' | 'applicationId'>) => {
    const app = findApp(id);
    if (!app) return;
    const at = env.now();
    set((s) => ({
      applications: s.applications.map((a) => (a.id === id ? fn(a) : a)),
      ...(activity
        ? { activities: [...s.activities, { ...activity, at, candidateId: app.candidateId, applicationId: app.id, jobId: app.jobId }] }
        : {}),
    }));
  };
  /** Moves forward to `to` when the application is still before it (never backwards, never out of Rejected). */
  const advanceTo = (appId: string, to: 'interview' | 'offer' | 'hired', by: string, note: string) => {
    const order: string[] = FORWARD_STAGES;
    const app = findApp(appId);
    if (app && order.includes(app.stage) && order.indexOf(app.stage) < order.indexOf(to)) get().moveStage(appId, to, by, undefined, note);
  };

  return {
    sendEmail(input, by) {
      const candidate = get().candidates.find((c) => c.id === input.candidateId);
      const to = candidate?.email?.trim();
      if (!candidate || !to || !input.subject.trim() || !input.body.trim()) return null;
      const email: SentEmail = {
        id: env.id('mail'),
        candidateId: candidate.id,
        ...(input.applicationId ? { applicationId: input.applicationId } : {}),
        ...(input.templateId ? { templateId: input.templateId } : {}),
        to,
        subject: input.subject.trim(),
        body: input.body,
        by,
        at: env.now(),
      };
      const app = input.applicationId ? findApp(input.applicationId) : undefined;
      const activity: Activity = {
        type: 'email_sent', candidateId: candidate.id, by, at: email.at, detail: `Email sent: ${email.subject}`,
        ...(app ? { applicationId: app.id, jobId: app.jobId } : {}),
      };
      set((s) => ({ emails: [...s.emails, email], activities: [...s.activities, activity] }));
      return email;
    },

    scheduleInterview(appId, input, by) {
      const app = findApp(appId);
      if (!app || isLocked(app) || isEnded(app.stage)) return null;
      if (!input.round.trim() || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.at) || input.interviewers.length === 0) return null;
      if (!(input.durationMin > 0)) return null;
      const interview: Interview = {
        id: env.id('int'), ...input, round: input.round.trim(), place: input.place.trim(),
        status: 'scheduled', scorecards: [], createdBy: by,
      };
      patchApp(appId, (a) => ({ ...a, interviews: [...(a.interviews ?? []), interview] }), {
        type: 'interview_scheduled', by, detail: `${interview.round} scheduled for ${interviewTime(interview.at)}`,
      });
      advanceTo(appId, 'interview', by, `${interview.round}: ${interviewTime(interview.at)}`);
      return interview;
    },

    cancelInterview(appId, interviewId, by) {
      const app = findApp(appId);
      const iv = app?.interviews?.find((i) => i.id === interviewId);
      if (!app || !iv || isLocked(app) || iv.status !== 'scheduled') return false;
      patchApp(appId, (a) => ({ ...a, interviews: a.interviews?.map((i) => (i.id === interviewId ? { ...i, status: 'cancelled' } : i)) }), {
        type: 'interview_cancelled', by, detail: `${iv.round} cancelled`,
      });
      return true;
    },

    submitScorecard(appId, interviewId, input, by) {
      const app = findApp(appId);
      const iv = app?.interviews?.find((i) => i.id === interviewId);
      if (!app || !iv || isLocked(app) || iv.status === 'cancelled') return false;
      if (!validScores(input.scores, criteriaOf(input))) return false;
      // Unscored skills are dropped so the average only counts what was assessed.
      const scores = Object.fromEntries(Object.entries(input.scores).filter(([, n]) => n > 0));
      const card: Scorecard = { ...input, scores, note: input.note?.trim() || undefined, by, at: env.now() };
      const cards = iv.scorecards.some((c) => c.by === by) ? iv.scorecards.map((c) => (c.by === by ? card : c)) : [...iv.scorecards, card];
      patchApp(
        appId,
        (a) => ({ ...a, interviews: a.interviews?.map((i) => (i.id === interviewId ? { ...i, status: 'done', scorecards: cards } : i)) }),
        { type: 'scorecard_submitted', by, detail: `Scorecard for ${iv.round}: ${input.recommendation}` },
      );
      return true;
    },

    saveOffer(appId, input, by) {
      const app = findApp(appId);
      if (!app || isLocked(app) || isClosedOut(app.stage) || offerFinal(app)) return false;
      if (!(input.salary > 0) || !input.startDate || !input.validUntil || !input.contract.trim()) return false;
      const at = env.now();
      const offer: Offer = {
        ...input, note: input.note?.trim() || undefined, contract: input.contract.trim(),
        // Editing a sent or declined offer turns it back into a draft to be sent again.
        status: 'draft', createdBy: app.offer?.createdBy ?? by, updatedAt: at,
      };
      patchApp(appId, (a) => ({ ...a, offer }), { type: 'offer_updated', by, detail: app.offer ? 'Offer updated' : 'Offer created' });
      advanceTo(appId, 'offer', by, 'Offer drafted');
      return true;
    },

    markOfferSent(appId, by) {
      const app = findApp(appId);
      if (!app?.offer || isLocked(app) || offerFinal(app)) return false;
      const at = env.now();
      patchApp(appId, (a) => ({ ...a, offer: a.offer && { ...a.offer, status: 'sent', sentAt: at, declineReason: undefined, respondedAt: undefined } }), {
        type: 'offer_updated', by, detail: 'Offer sent',
      });
      return true;
    },

    respondOffer(appId, accepted, by, reason) {
      const app = findApp(appId);
      // A sent offer, a draft answered outside the system (phone, in person, no email on file), or an accepted
      // offer whose candidate has since left Hired (they backed out) can be recorded.
      if (!app?.offer || isLocked(app) || offerFinal(app) || app.offer.status === 'declined') return false;
      if (accepted && app.offer.status === 'accepted') return false;
      const why = reason?.trim();
      if (!accepted && !why) return false;
      const at = env.now();
      patchApp(
        appId,
        (a) => ({ ...a, offer: a.offer && { ...a.offer, status: accepted ? 'accepted' : 'declined', respondedAt: at, ...(why && !accepted ? { declineReason: why } : {}) } }),
        { type: 'offer_updated', by, detail: accepted ? 'Offer accepted' : `Offer declined: ${why}` },
      );
      if (accepted) advanceTo(appId, 'hired', by, 'Offer accepted');
      return true;
    },

    handOff(appId, by) {
      const app = findApp(appId);
      if (!app || app.stage !== 'hired' || isLocked(app)) return false;
      patchApp(appId, (a) => ({ ...a, handoff: { at: env.now(), by, target: HANDOFF_TARGET } }), {
        type: 'handed_off', by, detail: `Handed off to ${HANDOFF_TARGET}`,
      });
      return true;
    },
  };
}
