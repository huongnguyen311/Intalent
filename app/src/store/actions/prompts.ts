import type { DemoActions, Env, Get, Set } from './types';

/** Prompts and email templates are stored and edited only; nothing in the demo executes them. */
export function promptActions(set: Set, get: Get, env: Env): Pick<DemoActions, 'updatePrompt'> {
  return {
    updatePrompt(id, patch) {
      if (!get().prompts.some((p) => p.id === id)) return false;
      const updatedAt = env.now();
      set((s) => ({ prompts: s.prompts.map((p) => (p.id === id ? { ...p, ...patch, updatedAt } : p)) }));
      return true;
    },
  };
}
