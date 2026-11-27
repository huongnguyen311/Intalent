import { buildSeed } from '../data/seed';
import { createDemoStore } from '../store/store';
import type { Activity, DemoState, User } from './types';
import { taContribution, UNATTRIBUTED } from './taContribution';

const user = (id: string, name: string): User => ({ id, name, email: `${id}@x.demo`, role: 'User', status: 'Active', createdAt: '2026-01-01' });
const act = (type: Activity['type'], by: string, at: string, extra: Partial<Activity> = {}): Activity => ({ type, by, at, detail: '', ...extra });

const state: Pick<DemoState, 'users' | 'activities'> = {
  users: [user('a', 'Ann'), user('b', 'Bao')],
  activities: [
    act('candidate_created', 'a', '2026-11-01T00:00:00Z'),
    act('candidate_created', 'a', '2026-11-02T00:00:00Z'),
    act('candidate_created', 'b', '2026-11-03T00:00:00Z'),
    act('candidate_merged', 'b', '2026-11-04T00:00:00Z'),
    act('candidate_created', 'ghost', '2026-11-04T00:00:00Z'),
    act('owner_transferred', 'u-admin', '2026-11-05T00:00:00Z', { from: 'a', to: 'b' }),
  ],
};
const NOW = Date.parse('2026-11-16T00:00:00Z');

describe('taContribution', () => {
  it('ta totals equal sum of rows', () => {
    const { rows, totals } = taContribution(state, 'all', NOW);
    for (const k of ['newCv', 'duplicate', 'parseError', 'processing', 'transferIn', 'transferOut', 'total'] as const) {
      expect(totals[k]).toBe(rows.reduce((s, r) => s + r[k], 0));
    }
    const ann = rows.find((r) => r.ta === 'Ann')!;
    expect(ann).toMatchObject({ newCv: 2, transferOut: 1, total: 1 });
    const bao = rows.find((r) => r.ta === 'Bao')!;
    expect(bao).toMatchObject({ newCv: 1, duplicate: 1, transferIn: 1, total: 3 });
    expect(rows.find((r) => r.ta === UNATTRIBUTED)).toMatchObject({ newCv: 1 });
  });

  it('limits activity to the period', () => {
    const { rows } = taContribution(state, 'week', NOW);
    expect(rows).toEqual([]);
    const m3 = taContribution(state, '3m', NOW).rows.find((r) => r.ta === 'Ann');
    expect(m3?.newCv).toBe(2);
  });

  it('limits activity to a custom date range, either order', () => {
    const r = taContribution(state, { from: '2026-11-02', to: '2026-11-03' }, NOW).rows;
    expect(r.find((x) => x.ta === 'Ann')?.newCv).toBe(1);
    expect(r.find((x) => x.ta === 'Bao')?.newCv).toBe(1);
    expect(taContribution(state, { from: '2026-11-03', to: '2026-11-02' }, NOW).rows).toEqual(r);
  });

  it('transfer moves count from one TA to another', () => {
    const store = createDemoStore(
      { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 },
      () => '2026-11-16T10:00:00.000Z',
    );
    const s = store.getState();
    const cand = s.candidates[0];
    const from = cand.cvOwner;
    const to = s.users.find((u) => u.id !== from && u.role !== 'Candidate')!.id;
    const name = (id: string) => s.users.find((u) => u.id === id)!.name;
    const before = taContribution(store.getState(), 'all', NOW);
    const get = (r: typeof before, id: string) => r.rows.find((x) => x.ta === name(id));
    const fromBefore = get(before, from)!.total;
    const toBefore = get(before, to)?.total ?? 0;

    expect(store.getState().transferOwner(cand.id, to, 'u-admin')).toEqual({ ok: true });

    const after = taContribution(store.getState(), 'all', NOW);
    expect(get(after, from)!.total).toBe(fromBefore - 1);
    expect(get(after, to)!.total).toBe(toBefore + 1);
    expect(get(after, from)!.transferOut).toBe((get(before, from)?.transferOut ?? 0) + 1);
    expect(store.getState().candidates.find((c) => c.id === cand.id)!.cvOwner).toBe(to);
    const last = store.getState().activities.slice(-1)[0];
    expect(last).toMatchObject({ type: 'owner_transferred', candidateId: cand.id, from, to });
    expect(buildSeed().candidates[0].cvOwner).toBe(from);
  });

  it('refuses a no-op or unknown transfer', () => {
    const store = createDemoStore(
      { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 },
    );
    const c = store.getState().candidates[0];
    expect(store.getState().transferOwner(c.id, c.cvOwner, 'u-admin')).toEqual({ ok: false, reason: 'same_owner' });
    expect(store.getState().transferOwner('nope', 'u-thu', 'u-admin')).toEqual({ ok: false, reason: 'not_found' });
  });

  it('refuses an inactive or Candidate-role target', () => {
    const store = createDemoStore(
      { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 },
    );
    const s = store.getState();
    const c = s.candidates[0];
    const [a, b] = s.users.filter((u) => u.id !== c.cvOwner);
    store.setState({
      users: s.users.map((u) => (u.id === a.id ? { ...u, status: 'Inactive' } : u.id === b.id ? { ...u, role: 'Candidate' } : u)),
    });
    expect(store.getState().transferOwner(c.id, a.id, 'u-admin')).toEqual({ ok: false, reason: 'not_assignable' });
    expect(store.getState().transferOwner(c.id, b.id, 'u-admin')).toEqual({ ok: false, reason: 'not_assignable' });
    expect(store.getState().candidates[0].cvOwner).toBe(c.cvOwner);
    expect(store.getState().activities.some((x) => x.type === 'owner_transferred' && x.candidateId === c.id)).toBe(false);
  });
});
