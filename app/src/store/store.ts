import { create, type StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildMockupFixture, isFixtureMode } from '../data/fixtureMockup';
import { buildSeed } from '../data/seed';
import { applicationActions } from './actions/applications';
import { careersActions } from './actions/careers';
import { campaignActions } from './actions/campaigns';
import { candidateActions } from './actions/candidates';
import { chatActions } from './actions/chats';
import { hiringActions } from './actions/hiring';
import { jdActions } from './actions/jds';
import { jobActions } from './actions/jobs';
import { noteActions } from './actions/notes';
import { ownerActions } from './actions/owners';
import { promptActions } from './actions/prompts';
import { selfServiceActions } from './actions/selfService';
import { taxonomyActions } from './actions/taxonomy';
import { userActions } from './actions/users';
import type { DemoStore, Env } from './actions/types';
import { persistOptions } from './persist';
import { activeWorkspaceId, DEFAULT_WS, listWorkspaces, workspaceKey } from './platform';
import { blankWorkspace } from '../data/workspace';
import { DEFAULT_COMPANY } from '../domain/company';

/**
 * Fresh store instance; tests inject storage and a clock.
 * Fixture mode seeds the mockup data and skips persistence entirely (storage is never read or written).
 */
export function createDemoStore(
  storage: Storage = localStorage,
  now: () => string = () => new Date().toISOString(),
  opts: { fixture?: boolean } = {},
) {
  // Seed timestamps are relative to load time (store creation / resetDemo) so SLA badges look the same on any day.
  const initial = opts.fixture ? buildMockupFixture : () => buildSeed(undefined, Date.parse(now()));
  const env: Env = { now, id: (prefix) => `${prefix}-${crypto.randomUUID()}` };
  const creator: StateCreator<DemoStore> = (set, get) => ({
    ...initial(),
    ...candidateActions(set, get, env),
    ...applicationActions(set, get, env),
    ...careersActions(set, get, env),
    ...noteActions(set, get, env),
    ...jdActions(set, get, env),
    ...jobActions(set, get, env),
    ...campaignActions(set, get, env),
    ...chatActions(set, get, env),
    ...taxonomyActions(set, get, env),
    ...userActions(set, get, env),
    ...promptActions(set, get, env),
    ...ownerActions(set, get, env),
    ...hiringActions(set, get, env),
    ...selfServiceActions(set, get, env),
    resetDemo: () => set(initial()),
  });
  if (opts.fixture) return create<DemoStore>()(creator);
  // Each workspace (tenant) keeps its data under its own key; only the active one is ever loaded.
  const ws = activeWorkspaceId(storage);
  if (ws === DEFAULT_WS) return create<DemoStore>()(persist(creator, persistOptions<DemoStore>(storage)));
  const entry = listWorkspaces(storage).find((w) => w.id === ws)!;
  const fallback = () => blankWorkspace({ ...DEFAULT_COMPANY, workspaceId: ws, name: entry.name, careersSlug: entry.slug, logoText: entry.name.slice(0, 2).toUpperCase() });
  const tenantCreator: StateCreator<DemoStore> = (set, get, api) => ({ ...creator(set, get, api), ...fallback(), resetDemo: () => set(fallback()) });
  return create<DemoStore>()(persist(tenantCreator, persistOptions<DemoStore>(storage, workspaceKey(ws), fallback)));
}

export const useStore = isFixtureMode() ? createDemoStore(undefined, undefined, { fixture: true }) : createDemoStore();
