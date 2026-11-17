import { describe, expect, it } from 'vitest';
import { createDemoStore } from './store';

const memoryStorage = (): Storage => {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
};

const NOW = '2026-11-16T10:00:00.000Z';

function withApp() {
  const store = createDemoStore(memoryStorage(), () => NOW);
  store.setState({ applications: [], activities: [] });
  const candidateId = store.getState().candidates[0].id;
  const r = store.getState().addToPipeline(candidateId, 'job-1', { via: 'manual', source: 'Manual', by: 'u-admin' });
  if (!r.ok) throw new Error('expected ok');
  const find = () => store.getState().applications.find((a) => a.id === r.application.id)!;
  return { store, id: r.application.id, find };
}

describe('addComment', () => {
  it('appends a trimmed comment with author and time', () => {
    const { store, id, find } = withApp();
    expect(store.getState().addComment(id, '  Strong portfolio ', 'u-thu')).toBe(true);
    expect(find().comments).toEqual([{ by: 'u-thu', at: NOW, text: 'Strong portfolio' }]);
  });

  it('refuses empty text and unknown applications', () => {
    const { store, id, find } = withApp();
    expect(store.getState().addComment(id, '   ', 'u-thu')).toBe(false);
    expect(store.getState().addComment('nope', 'Hi', 'u-thu')).toBe(false);
    expect(find().comments).toEqual([]);
  });
});

describe('rateApplication', () => {
  it('keeps one rating per reviewer, replacing their earlier score', () => {
    const { store, id, find } = withApp();
    expect(store.getState().rateApplication(id, 'u-thu', 4)).toBe(true);
    expect(store.getState().rateApplication(id, 'u-huy', 2)).toBe(true);
    expect(store.getState().rateApplication(id, 'u-thu', 5)).toBe(true);
    expect(find().ratings).toEqual([
      { by: 'u-thu', stars: 5, at: NOW },
      { by: 'u-huy', stars: 2, at: NOW },
    ]);
  });

  it('refuses stars outside 1-5 or non-integers', () => {
    const { store, id, find } = withApp();
    for (const stars of [0, 6, 2.5]) expect(store.getState().rateApplication(id, 'u-thu', stars)).toBe(false);
    expect(store.getState().rateApplication('nope', 'u-thu', 3)).toBe(false);
    expect(find().ratings ?? []).toEqual([]);
  });
});
