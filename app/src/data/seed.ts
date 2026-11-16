import type { DemoState } from '../domain/types';

/** Stub until Task 3: empty collections plus default UI state. */
export function buildSeed(): DemoState {
  return {
    candidates: [],
    applications: [],
    jobs: [],
    campaigns: [],
    notes: [],
    activities: [],
    users: [],
    jds: [],
    taxonomy: [],
    prompts: [],
    chats: [],
    ui: { lang: 'en', piiUnlocked: false },
  };
}
