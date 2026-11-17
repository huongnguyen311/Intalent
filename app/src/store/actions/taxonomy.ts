import type { Candidate, TaxonomyItem } from '../../domain/types';
import type { DemoActions, Env, Get, Set } from './types';

const sameLabel = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Candidates carry the label as free text, so a rename rewrites it to keep usage counts honest. */
function relabel(kind: TaxonomyItem['kind'], from: string, to: string, c: Candidate): Candidate {
  if (kind === 'english') return c.english === from ? { ...c, english: to } : c;
  if (kind === 'seniority') return c.seniority === from ? { ...c, seniority: to } : c;
  return c.domains.includes(from) ? { ...c, domains: c.domains.map((d) => (d === from ? to : d)) } : c;
}

export function taxonomyActions(
  set: Set,
  get: Get,
  env: Env,
): Pick<DemoActions, 'addTaxonomy' | 'renameTaxonomy' | 'setTaxonomyActive'> {
  return {
    addTaxonomy(kind, label) {
      const clean = label.trim();
      if (!clean) return { ok: false, reason: 'empty' };
      if (get().taxonomy.some((t) => t.kind === kind && sameLabel(t.label, clean))) return { ok: false, reason: 'duplicate' };
      const item: TaxonomyItem = { id: env.id('tax'), kind, label: clean, active: true, usage: 0, updatedAt: env.now() };
      set((s) => ({ taxonomy: [...s.taxonomy, item] }));
      return { ok: true, item };
    },

    renameTaxonomy(id, label) {
      const item = get().taxonomy.find((t) => t.id === id);
      if (!item) return { ok: false, reason: 'not_found' };
      const clean = label.trim();
      if (!clean) return { ok: false, reason: 'empty' };
      if (get().taxonomy.some((t) => t.id !== id && t.kind === item.kind && sameLabel(t.label, clean))) {
        return { ok: false, reason: 'duplicate' };
      }
      const updated = { ...item, label: clean, updatedAt: env.now() };
      set((s) => ({
        taxonomy: s.taxonomy.map((t) => (t.id === id ? updated : t)),
        candidates: s.candidates.map((c) => relabel(item.kind, item.label, clean, c)),
      }));
      return { ok: true, item: updated };
    },

    setTaxonomyActive(id, active) {
      if (!get().taxonomy.some((t) => t.id === id)) return false;
      const updatedAt = env.now();
      set((s) => ({ taxonomy: s.taxonomy.map((t) => (t.id === id ? { ...t, active, updatedAt } : t)) }));
      return true;
    },
  };
}
