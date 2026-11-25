import { createJSONStorage, type PersistOptions } from 'zustand/middleware';
import { buildSeed } from '../data/seed';
import type { DemoState } from '../domain/types';

export const PERSIST_KEY = 'intalent-demo';
export const PERSIST_VERSION = 17;

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
    emails: s.emails,
    ui: s.ui,
    ...(s.company ? { company: s.company } : {}),
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
  // `emails` arrived later: older saves lack it (filled on merge) but it must be a list when present.
  if (o.emails !== undefined && !Array.isArray(o.emails)) return false;
  const ui = o.ui as Record<string, unknown> | null | undefined;
  return (
    typeof ui === 'object' && ui !== null &&
    isLang(ui.lang) && typeof ui.piiUnlocked === 'boolean' &&
    // careersLang is absent in older saves (filled from seed on merge) but must be valid when present.
    (ui.careersLang === undefined || isLang(ui.careersLang))
  );
}

/**
 * `name` is the active workspace's storage key; `fallback` builds its starting data when nothing valid is saved
 * (the demo seed for the original workspace, an empty workspace otherwise).
 */
export function persistOptions<T extends DemoState>(
  storage: Storage,
  name: string = PERSIST_KEY,
  fallback: () => DemoState = () => buildSeed(undefined, Date.now()),
): PersistOptions<T, DemoState> {
  return {
    // Same-version payloads skip migrate, so shape-validate here; invalid -> seed.
    merge: (persisted, current) => {
      if (!isValidState(persisted)) return { ...current, ...fallback() };
      const seed = buildSeed(undefined, Date.now());
      // Saves from before the hiring features get the email log and the new email templates added, keeping everything else.
      const missingTemplates = seed.prompts.filter((p) => /^(email|content)-/.test(p.id) && !persisted.prompts.some((x) => x.id === p.id));
      return {
        ...current,
        ...persisted,
        emails: persisted.emails ?? [],
        prompts: [...persisted.prompts, ...missingTemplates],
        ui: { ...seed.ui, ...persisted.ui },
      };
    },
    name,
    version: PERSIST_VERSION,
    storage: createJSONStorage(() => storage),
    partialize: (s) => pickData(s),
    // Any version mismatch (including a missing/garbled payload) resets to seed.
    migrate: () => fallback(),
  };
}
