import { findDuplicate } from '../../domain/dedupe';
import { CHANNEL_SOURCE, parseSrc } from '../../domain/campaigns';
import type { DemoActions, Env, Get, Set } from './types';

/** Activity `by` for applications that arrive without a signed-in user. */
export const CAREERS_ACTOR = 'Careers site';
export const CAREERS_SOURCE = 'Careers page';

export function careersActions(_set: Set, get: Get, _env: Env): Pick<DemoActions, 'applyFromCareers'> {
  return {
    applyFromCareers(input, jobId, src) {
      const job = get().jobs.find((j) => j.id === jobId);
      if (!job || job.status !== 'open') return { ok: false, reason: 'unavailable' };
      // Unknown or stale tracking codes count as plain careers-page traffic.
      const hit = src ? parseSrc(src, get().campaigns) : null;
      const source = hit ? CHANNEL_SOURCE[hit.channel] : CAREERS_SOURCE;
      // Already applied: report it before touching the candidate or the activity log.
      const known = findDuplicate(get().candidates, input);
      const prior = known && get().applications.find((a) => a.candidateId === known.id && a.jobId === jobId);
      if (prior) return { ok: false, reason: 'duplicate', stage: prior.stage };
      const { candidate, created } = get().upsertCandidate(input, { source, by: CAREERS_ACTOR });
      const r = get().addToPipeline(candidate.id, jobId, {
        via: hit ? 'campaign' : 'careers',
        source,
        ...(hit ? { campaignId: hit.campaignId } : {}),
        by: CAREERS_ACTOR,
      });
      return r.ok ? { ok: true, application: r.application, created } : r;
    },
  };
}
