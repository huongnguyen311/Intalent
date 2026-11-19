import { PRIVACY_POLICY_VERSION } from '../../domain/privacy';
import { findDuplicate } from '../../domain/dedupe';
import { fillTemplate, TEMPLATE } from '../../domain/hiring';
import { CHANNEL_SOURCE, parseSrc } from '../../domain/campaigns';
import { CAREERS_ACTOR, SOURCE_CAREERS } from '../../domain/sources';
import type { DemoActions, Env, Get, Set } from './types';

/** Activity `by` for applications that arrive without a signed-in user. */
export { CAREERS_ACTOR };
export const CAREERS_SOURCE = SOURCE_CAREERS;

export function careersActions(set: Set, get: Get, _env: Env): Pick<DemoActions, 'applyFromCareers'> {
  return {
    applyFromCareers(input, jobId, src, answers) {
      const job = get().jobs.find((j) => j.id === jobId);
      if (!job || job.status !== 'open') return { ok: false, reason: 'unavailable' };
      // Unknown or stale tracking codes, and campaigns that do not cover this job, count as plain careers-page traffic.
      const parsed = src ? parseSrc(src, get().campaigns) : null;
      const hit = parsed && get().campaigns.find((c) => c.id === parsed.campaignId)?.jobIds.includes(jobId) ? parsed : null;
      const source = hit ? CHANNEL_SOURCE[hit.channel] : CAREERS_SOURCE;
      // Already applied: report it before touching the candidate or the activity log.
      const known = findDuplicate(get().candidates, input);
      const prior = known && get().applications.find((a) => a.candidateId === known.id && a.jobId === jobId);
      if (prior) return { ok: false, reason: 'duplicate', stage: prior.stage };
      const { candidate, created } = get().upsertCandidate({ ...input, cvOwner: '' }, { source, by: CAREERS_ACTOR });
      // PRD AC-04 / 6: the privacy consent ticked on the form is stored with the policy version and time.
      const consentAt = new Date().toISOString();
      set((s) => ({
        candidates: s.candidates.map((c) => (c.id === candidate.id
          ? { ...c, consents: [...(c.consents ?? []), { purpose: 'recruitment' as const, policyVersion: PRIVACY_POLICY_VERSION, at: consentAt }] }
          : c)),
        activities: [...s.activities, { type: 'consent_captured' as const, candidateId: candidate.id, jobId, by: CAREERS_ACTOR, at: consentAt, detail: `Privacy consent (policy ${PRIVACY_POLICY_VERSION})` }],
      }));
      const r = get().addToPipeline(candidate.id, jobId, {
        via: hit ? 'campaign' : 'careers',
        source,
        ...(hit ? { campaignId: hit.campaignId } : {}),
        by: CAREERS_ACTOR,
      });
      if (!r.ok) return r.reason === 'duplicate' ? r : { ok: false, reason: 'unavailable' };
      let application = r.application;
      if (answers?.length) {
        application = { ...application, answers };
        set((s) => ({ applications: s.applications.map((a) => (a.id === application.id ? application : a)) }));
      }
      // Automatic acknowledgement (simulated), logged so HR can see it went out.
      const tpl = get().prompts.find((p) => p.id === TEMPLATE.received);
      if (tpl) {
        get().sendEmail({
          candidateId: candidate.id, applicationId: application.id, templateId: tpl.id,
          subject: `${tpl.name} – ${job.title}`, body: fillTemplate(tpl.text, { name: candidate.name, job: job.title }),
        }, CAREERS_ACTOR);
      }
      return { ok: true, application, created };
    },
  };
}
