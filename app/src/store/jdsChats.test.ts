import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
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
const setup = () => createDemoStore(memoryStorage(), () => NOW);

describe('JD actions', () => {
  it('createJd numbers the next code of the year and starts as Draft', () => {
    const s = setup();
    const jd = s.getState().createJd({ title: ' Data Engineer ', domains: ['SaaS'], skills: ['Python'], body: 'x' });
    expect(jd).toMatchObject({ code: 'JD-2026-006', title: 'Data Engineer', status: 'Draft', createdAt: NOW });
    expect(s.getState().jds[0].id).toBe(jd.id);
  });

  it('updateJd edits fields and stamps updatedAt; unknown id is false', () => {
    const s = setup();
    expect(s.getState().updateJd('nope', { title: 'x' })).toBe(false);
    expect(s.getState().updateJd('jd-2026-001', { skills: ['Dart'] })).toBe(true);
    expect(s.getState().jds.find((j) => j.id === 'jd-2026-001')).toMatchObject({ skills: ['Dart'], updatedAt: NOW });
  });

  it('setJdStatus publishes and unpublishes', () => {
    const s = setup();
    s.getState().setJdStatus('jd-2026-001', 'Draft');
    expect(s.getState().jds.find((j) => j.id === 'jd-2026-001')!.status).toBe('Draft');
    s.getState().setJdStatus('jd-2026-001', 'Published');
    expect(s.getState().jds.find((j) => j.id === 'jd-2026-001')!.status).toBe('Published');
  });

  it('deleteJd removes an unused JD but refuses one a job points at', () => {
    const s = setup();
    const jd = s.getState().createJd({ title: 'Temp', domains: [], skills: [], body: '' });
    expect(s.getState().deleteJd(jd.id)).toEqual({ ok: true });
    expect(s.getState().jds.some((j) => j.id === jd.id)).toBe(false);
    const used = buildSeed().jobs[0].jdId;
    expect(s.getState().deleteJd(used)).toMatchObject({ ok: false, reason: 'in_use' });
    expect(s.getState().deleteJd('nope')).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('chat actions', () => {
  it('sendChat starts a session, ranks candidates and keeps the history', () => {
    const s = setup();
    s.setState({ chats: [] });
    const id = s.getState().sendChat(null, 'senior React');
    const msgs = s.getState().chats.filter((m) => m.sessionId === id);
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant']);
    const results = msgs[1].results!;
    expect(results.length).toBeGreaterThan(0);
    expect(results.map((r) => r.score)).toEqual([...results.map((r) => r.score)].sort((a, b) => b - a));
    expect(s.getState().sendChat(id, 'and Vue')).toBe(id);
    expect(s.getState().chats).toHaveLength(4);
  });

  it('answers a query without criteria with a hint and no results', () => {
    const s = setup();
    s.setState({ chats: [] });
    const id = s.getState().sendChat(null, 'hello');
    const reply = s.getState().chats.find((m) => m.sessionId === id && m.role === 'assistant')!;
    expect(reply.results).toEqual([]);
    expect(reply.text).toContain('could not find any search criteria');
  });

  it('deleteChat drops one session only', () => {
    const s = setup();
    s.setState({ chats: [] });
    const a = s.getState().sendChat(null, 'React');
    const b = s.getState().sendChat(null, 'Vue');
    s.getState().deleteChat(a);
    expect([...new Set(s.getState().chats.map((m) => m.sessionId))]).toEqual([b]);
  });
});
