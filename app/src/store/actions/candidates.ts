import { findDuplicate } from '../../domain/dedupe';
import { normalizeEmail } from '../../domain/normalize';
import type { Activity, Candidate } from '../../domain/types';
import type { DemoActions, Env, Get, Set } from './types';

function union(a: string[], b: string[] = []): string[] {
  return [...new Set([...a, ...b])];
}

export function candidateActions(set: Set, get: Get, env: Env): Pick<DemoActions, 'upsertCandidate'> {
  return {
    upsertCandidate(input, ctx) {
      const at = env.now();
      const existing = findDuplicate(get().candidates, input);
      if (existing) {
        // Merge: fill blanks, union list fields; first-touch source and identity are kept.
        const merged: Candidate = {
          ...existing,
          title: existing.title || input.title || '',
          phone: existing.phone || input.phone || '',
          seniority: existing.seniority || input.seniority || '',
          english: existing.english || input.english || '',
          cvOwner: existing.cvOwner || input.cvOwner || '',
          cv: existing.cv || input.cv || '',
          skills: union(existing.skills, input.skills),
          domains: union(existing.domains, input.domains),
          tags: union(existing.tags, input.tags),
          groups: union(existing.groups, input.groups),
        };
        const activity: Activity = {
          type: 'candidate_merged',
          candidateId: existing.id,
          by: ctx.by,
          at,
          detail: `Existing profile updated via ${ctx.source}`,
        };
        set((s) => ({
          candidates: s.candidates.map((c) => (c.id === existing.id ? merged : c)),
          activities: [...s.activities, activity],
        }));
        return { candidate: merged, created: false };
      }
      const candidate: Candidate = {
        id: env.id('cand'),
        name: input.name,
        title: input.title ?? '',
        email: input.email ? normalizeEmail(input.email) : '',
        phone: input.phone ?? '',
        seniority: input.seniority ?? '',
        english: input.english ?? '',
        skills: input.skills ?? [],
        domains: input.domains ?? [],
        tags: input.tags ?? [],
        groups: input.groups ?? [],
        cvOwner: input.cvOwner ?? ctx.by,
        source: ctx.source,
        inTalentPool: true,
        createdAt: at,
        cv: input.cv ?? '',
      };
      const activity: Activity = {
        type: 'candidate_created',
        candidateId: candidate.id,
        by: ctx.by,
        at,
        detail: `Added to Talent Pool via ${ctx.source}`,
      };
      set((s) => ({ candidates: [...s.candidates, candidate], activities: [...s.activities, activity] }));
      return { candidate, created: true };
    },
  };
}
