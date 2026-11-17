import { createJSONStorage, type PersistOptions } from 'zustand/middleware';
import { buildSeed } from '../data/seed';
import type { DemoState } from '../domain/types';

export const PERSIST_KEY = 'intalent-demo';
export const PERSIST_VERSION = 1;

/** Only data is persisted; actions are re-attached by the store. */
export function pickData(s: DemoState): DemoState {
  return {
    candidates: s.candidates,
    applications: s.applications,
    jobs: s.jobs,
    campaigns: s.campaigns,
    notes: s.notes,
    activities: s.activities,
    users: s.users,
    jds: s.jds,
    taxonomy: s.taxonomy,
    prompts: s.prompts,
    chats: s.chats,
    ui: s.ui,
  };
}

const COLLECTIONS = [
  'candidates', 'applications', 'jobs', 'campaigns', 'notes',
  'activities', 'users', 'jds', 'taxonomy', 'prompts', 'chats',
] as const;

const isLang = (v: unknown) => v === 'en' || v === 'vi';

/** True when every collection is an array and ui is an object with the expected fields. */
export function isValidState(s: unknown): s is DemoState {
  if (typeof s !== 'object' || s === null) return false;
  const o = s as Record<string, unknown>;
  if (!COLLECTIONS.every((k) => Array.isArray(o[k]))) return false;
  const ui = o.ui as Record<string, unknown> | null | undefined;
  return (
    typeof ui === 'object' && ui !== null &&
    isLang(ui.lang) && typeof ui.piiUnlocked === 'boolean' &&
    // careersLang is absent in older saves (filled from seed on merge) but must be valid when present.
    (ui.careersLang === undefined || isLang(ui.careersLang))
  );
}

export function persistOptions<T extends DemoState>(storage: Storage): PersistOptions<T, DemoState> {
  return {
    // Same-version payloads skip migrate, so shape-validate here; invalid -> seed.
    merge: (persisted, current) =>
      isValidState(persisted)
        ? { ...current, ...persisted, ui: { ...buildSeed(undefined, Date.now()).ui, ...persisted.ui } }
        : { ...current, ...buildSeed(undefined, Date.now()) },
    name: PERSIST_KEY,
    version: PERSIST_VERSION,
    storage: createJSONStorage(() => storage),
    partialize: (s) => pickData(s),
    // Any version mismatch (including a missing/garbled payload) resets to seed.
    migrate: () => buildSeed(undefined, Date.now()),
  };
}
