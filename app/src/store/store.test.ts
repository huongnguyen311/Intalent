import { createDemoStore } from './store';
import { buildSeed } from '../data/seed';
import { PERSIST_KEY } from './persist';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(initial));
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

const ctx = { source: 'Manual', by: 'u-admin' };
const NOW = '2026-11-16T10:00:00.000Z';

function setup() {
  const store = createDemoStore(memoryStorage(), () => NOW);
  // These tests exercise actions from an empty slate, not the demo seed.
  store.setState({ candidates: [], applications: [], notes: [], activities: [] });
  const a = store
    .getState()
    .upsertCandidate({ name: 'Khoa Pham', email: 'khoa.pham@example.com', phone: '0901234567' }, ctx);
  return { store, candidate: a.candidate };
}
type Store = ReturnType<typeof setup>['store'];

describe('upsertCandidate', () => {
  it('upsertCandidate merges into existing profile', () => {
    const { store, candidate } = setup();
    const again = store
      .getState()
      .upsertCandidate(
        { name: 'Khoa P.', email: ' KHOA.PHAM@example.com', skills: ['React'] },
        { source: 'Careers', by: 'u-admin' },
      );
    expect(again.created).toBe(false);
    expect(again.candidate.id).toBe(candidate.id);
    expect(again.candidate.skills).toEqual(['React']);
    expect(again.candidate.source).toBe('Manual');
    expect(store.getState().candidates).toHaveLength(1);
    expect(store.getState().activities.map((a) => a.type)).toEqual(['candidate_created', 'candidate_merged']);
  });
});

describe('addToPipeline', () => {
  it('addToPipeline blocks duplicate application', () => {
    const { store, candidate } = setup();
    const pc = { via: 'manual' as const, source: 'Manual', by: 'u-admin' };
    expect(store.getState().addToPipeline(candidate.id, 'job-1', pc).ok).toBe(true);
    const second = store.getState().addToPipeline(candidate.id, 'job-1', pc);
    expect(second).toEqual({ ok: false, reason: 'duplicate', stage: 'new' });
    expect(store.getState().applications).toHaveLength(1);
  });

  it('addToPipeline records job, source, time, by', () => {
    const { store, candidate } = setup();
    const r = store
      .getState()
      .addToPipeline(candidate.id, 'job-1', { via: 'campaign', source: 'LinkedIn', campaignId: 'cmp-1', by: 'u-ta' });
    if (!r.ok) throw new Error('expected ok');
    expect(r.application).toMatchObject({
      candidateId: candidate.id,
      jobId: 'job-1',
      stage: 'new',
      source: 'LinkedIn',
      via: 'campaign',
      campaignId: 'cmp-1',
      addedBy: 'u-ta',
      addedAt: NOW,
      stageEnteredAt: NOW,
    });
    expect(r.application.history).toEqual([{ stage: 'new', at: NOW, by: 'u-ta' }]);
    const acts = store.getState().activities.filter((a) => a.type === 'added_to_pipeline');
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({
      candidateId: candidate.id,
      jobId: 'job-1',
      applicationId: r.application.id,
      by: 'u-ta',
    });
  });
});

describe('moveStage', () => {
  function withApp() {
    const { store, candidate } = setup();
    const r = store
      .getState()
      .addToPipeline(candidate.id, 'job-1', { via: 'manual', source: 'Manual', by: 'u-admin' });
    if (!r.ok) throw new Error('expected ok');
    return { store, app: r.application };
  }
  const find = (s: Store, id: string) => s.getState().applications.find((a) => a.id === id)!;

  it('moveStage to rejected requires reason', () => {
    const { store, app } = withApp();
    expect(store.getState().moveStage(app.id, 'rejected', 'u-admin')).toBe(false);
    expect(find(store, app.id).stage).toBe('new');
    expect(store.getState().moveStage(app.id, 'rejected', 'u-admin', 'Salary mismatch')).toBe(true);
    expect(find(store, app.id)).toMatchObject({ stage: 'rejected', rejectedReason: 'Salary mismatch' });
  });

  it('moveStage same stage is no-op', () => {
    const { store, app } = withApp();
    expect(store.getState().moveStage(app.id, 'new', 'u-admin')).toBe(false);
    expect(find(store, app.id).history).toHaveLength(1);
    expect(store.getState().moveStage(app.id, 'screening', 'u-admin')).toBe(true);
    const moved = find(store, app.id);
    expect(moved.history).toHaveLength(2);
    expect(moved.stage).toBe('screening');
    expect(store.getState().activities.filter((a) => a.type === 'stage_changed')).toHaveLength(1);
  });
});

describe('notes', () => {
  it('addNote never creates a candidate', () => {
    const { store } = setup();
    const note = store
      .getState()
      .addNote({ name: 'Mai Le', contact: 'mai@example.com', text: 'Met at meetup' }, 'u-admin');
    expect(store.getState().candidates).toHaveLength(1);
    expect(store.getState().notes).toEqual([note]);
    expect(note.convertedToCandidateId).toBeUndefined();
    expect(store.getState().activities.some((a) => a.type === 'note_added')).toBe(true);
  });

  it('convertNote dedupes', () => {
    const { store, candidate } = setup();
    const dup = store
      .getState()
      .addNote({ name: 'Khoa', contact: 'khoa.pham@EXAMPLE.com', text: 'again' }, 'u-admin');
    const r1 = store.getState().convertNote(dup.id, 'u-admin');
    expect(r1.created).toBe(false);
    expect(r1.candidate.id).toBe(candidate.id);
    expect(store.getState().candidates).toHaveLength(1);
    expect(store.getState().notes[0].convertedToCandidateId).toBe(candidate.id);

    const fresh = store.getState().addNote({ name: 'Mai Le', contact: 'mai@example.com', text: 'x' }, 'u-admin');
    const r2 = store.getState().convertNote(fresh.id, 'u-admin');
    expect(r2.created).toBe(true);
    expect(r2.candidate.email).toBe('mai@example.com');
    expect(store.getState().candidates).toHaveLength(2);
    expect(store.getState().activities.filter((a) => a.type === 'note_converted')).toHaveLength(2);
  });
});

describe('persistence', () => {
  it('loads seed when persisted state is invalid or version mismatches', () => {
    const seed = buildSeed();
    const stale = JSON.stringify({ version: 0, state: { ...seed, candidates: [{ id: 'stale' }] } });
    for (const raw of ['{bad', JSON.stringify({ version: 0 }), stale]) {
      const s = createDemoStore(memoryStorage({ [PERSIST_KEY]: raw })).getState();
      expect(s.candidates).toEqual(seed.candidates);
      expect(s.applications).toEqual(seed.applications);
      expect(s.notes).toEqual(seed.notes);
      expect(s.ui).toEqual(seed.ui);
    }
  });

  it('loads seed when version matches but state shape is invalid', () => {
    const seed = buildSeed();
    const { ui: _ui, ...noUi } = seed;
    const bad = [
      { candidates: 'x' },
      { candidates: null },
      noUi,
      { ...seed, ui: 'x' },
      null,
    ];
    for (const state of bad) {
      const raw = JSON.stringify({ version: 1, state });
      const s = createDemoStore(memoryStorage({ [PERSIST_KEY]: raw })).getState();
      expect(s.candidates).toEqual(seed.candidates);
      expect(s.ui).toEqual(seed.ui);
      expect(() => s.candidates.map((c) => c.id)).not.toThrow();
    }
  });

  it('keeps valid persisted state of the current version', () => {
    const seed = buildSeed();
    const good = { ...seed, ui: { lang: 'vi', piiUnlocked: false } };
    const raw = JSON.stringify({ version: 1, state: good });
    const s = createDemoStore(memoryStorage({ [PERSIST_KEY]: raw })).getState();
    expect(s.ui.lang).toBe('vi');
  });

  it('persists under intalent-demo with version 1 and resetDemo restores seed', () => {
    const storage = memoryStorage();
    const store = createDemoStore(storage);
    store.getState().upsertCandidate({ name: 'A', email: 'a@example.com' }, ctx);
    const saved = JSON.parse(storage.getItem('intalent-demo')!);
    expect(saved.version).toBe(1);
    expect(saved.state.candidates).toHaveLength(buildSeed().candidates.length + 1);
    store.getState().resetDemo();
    expect(store.getState().candidates).toEqual(buildSeed().candidates);
  });
});
