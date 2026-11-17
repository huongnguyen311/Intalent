import type { Activity } from '../../domain/types';
import { assignableUsers, userName } from '../../domain/users';
import type { DemoActions, Env, Get, Set } from './types';

export function ownerActions(set: Set, get: Get, env: Env): Pick<DemoActions, 'transferOwner'> {
  return {
    transferOwner(candidateId, toUserId, by) {
      const { candidates, users } = get();
      const candidate = candidates.find((c) => c.id === candidateId);
      if (!candidate) return { ok: false, reason: 'not_found' };
      if (candidate.cvOwner === toUserId) return { ok: false, reason: 'same_owner' };
      // Only active staff can own a CV; the UI list is a convenience, this is the boundary.
      if (!assignableUsers(users).some((u) => u.id === toUserId)) return { ok: false, reason: 'not_assignable' };
      const activity: Activity = {
        type: 'owner_transferred',
        candidateId,
        by,
        at: env.now(),
        detail: `CV owner changed from ${userName(users, candidate.cvOwner) || 'nobody'} to ${userName(users, toUserId)}`,
        from: candidate.cvOwner,
        to: toUserId,
      };
      set((s) => ({
        candidates: s.candidates.map((c) => (c.id === candidateId ? { ...c, cvOwner: toUserId } : c)),
        activities: [...s.activities, activity],
      }));
      return { ok: true };
    },
  };
}
