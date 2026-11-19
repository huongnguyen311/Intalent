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
  const candidate = store.getState().candidates.find((c) => c.email)!;
  const r = store.getState().addToPipeline(candidate.id, 'job-1', { via: 'manual', source: 'Manual', by: 'u-admin' });
  if (!r.ok) throw new Error('expected ok');
  const find = () => store.getState().applications.find((a) => a.id === r.application.id)!;
  return { store, id: r.application.id, find, s: () => store.getState() };
}

describe('AI evaluation in the store', () => {
  it('new application starts pending', () => {
    const { find } = withApp();
    expect(find().aiPending).toBe(true);
    expect(find().aiEvaluations).toBeUndefined();
  });

  it('runAiEvaluation clears pending and re-run appends a version without moving the card', () => {
    const { id, find, s } = withApp();
    const first = s().runAiEvaluation(id, 'ai');
    expect(first).toBeDefined();
    expect(find().aiPending).toBeFalsy();
    expect(find().aiEvaluations).toHaveLength(1);
    s().runAiEvaluation(id, 'u-admin');
    expect(find().aiEvaluations).toHaveLength(2);
    expect(find().aiEvaluations![1].model).toBe('intalent-match-v1');
    expect(find().stage).toBe('new');
    expect(find().history).toHaveLength(1);
  });

  it('logs an ai_evaluated activity', () => {
    const { id, s } = withApp();
    const e = s().runAiEvaluation(id, 'ai')!;
    const log = s().activities.find((a) => a.type === 'ai_evaluated');
    expect(log).toMatchObject({ applicationId: id, by: 'ai', jobId: 'job-1' });
    expect(log!.detail).toContain(String(e.score));
  });

  it('a refused pending application stops showing as pending', () => {
    const { id, find, s, store } = withApp();
    store.setState({ applications: s().applications.map((a) => (a.id === id ? { ...a, handoff: { at: NOW, by: 'u-admin', target: 'x' } } : a)) });
    expect(s().runAiEvaluation(id, 'ai')).toBeUndefined();
    expect(find().aiPending).toBe(false);
  });

  it('refuses unknown and handed-off applications', () => {
    const { id, find, s, store } = withApp();
    expect(s().runAiEvaluation('nope', 'ai')).toBeUndefined();
    store.setState({ applications: s().applications.map((a) => (a.id === id ? { ...a, handoff: { at: NOW, by: 'u-admin', target: 'x' } } : a)) });
    expect(s().runAiEvaluation(id, 'ai')).toBeUndefined();
    expect(find().aiEvaluations).toBeUndefined();
  });
});
