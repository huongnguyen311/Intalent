import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildSeed } from '../data/seed';
import { applicationActions } from './actions/applications';
import { candidateActions } from './actions/candidates';
import { noteActions } from './actions/notes';
import type { DemoStore, Env } from './actions/types';
import { persistOptions } from './persist';

/** Fresh store instance; tests inject storage and a clock. */
export function createDemoStore(
  storage: Storage = localStorage,
  now: () => string = () => new Date().toISOString(),
) {
  const env: Env = { now, id: (prefix) => `${prefix}-${crypto.randomUUID()}` };
  return create<DemoStore>()(
    persist(
      (set, get) => ({
        ...buildSeed(),
        ...candidateActions(set, get, env),
        ...applicationActions(set, get, env),
        ...noteActions(set, get, env),
        resetDemo: () => set(buildSeed()),
      }),
      persistOptions<DemoStore>(storage),
    ),
  );
}

export const useStore = createDemoStore();
