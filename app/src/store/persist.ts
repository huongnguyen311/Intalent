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

export function persistOptions<T extends DemoState>(storage: Storage): PersistOptions<T, DemoState> {
  return {
    name: PERSIST_KEY,
    version: PERSIST_VERSION,
    storage: createJSONStorage(() => storage),
    partialize: (s) => pickData(s),
    // Any version mismatch (including a missing/garbled payload) resets to seed.
    migrate: () => buildSeed(),
  };
}
