import { create, type StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildMockupFixture, isFixtureMode } from '../data/fixtureMockup';
import { buildSeed } from '../data/seed';
import { applicationActions } from './actions/applications';
import { candidateActions } from './actions/candidates';
import { chatActions } from './actions/chats';
import { jdActions } from './actions/jds';
import { noteActions } from './actions/notes';
import type { DemoStore, Env } from './actions/types';
import { persistOptions } from './persist';

/**
 * Fresh store instance; tests inject storage and a clock.
 * Fixture mode seeds the mockup data and skips persistence entirely (storage is never read or written).
 */
export function createDemoStore(
  storage: Storage = localStorage,
  now: () => string = () => new Date().toISOString(),
  opts: { fixture?: boolean } = {},
) {
  const initial = opts.fixture ? buildMockupFixture : buildSeed;
  const env: Env = { now, id: (prefix) => `${prefix}-${crypto.randomUUID()}` };
  const creator: StateCreator<DemoStore> = (set, get) => ({
    ...initial(),
    ...candidateActions(set, get, env),
    ...applicationActions(set, get, env),
    ...noteActions(set, get, env),
    ...jdActions(set, get, env),
    ...chatActions(set, get, env),
    resetDemo: () => set(initial()),
  });
  return opts.fixture
    ? create<DemoStore>()(creator)
    : create<DemoStore>()(persist(creator, persistOptions<DemoStore>(storage)));
}

export const useStore = isFixtureMode() ? createDemoStore(undefined, undefined, { fixture: true }) : createDemoStore();
