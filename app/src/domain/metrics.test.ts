import { buildMockupFixture } from '../data/fixtureMockup';
import { buildSeed } from '../data/seed';
import { dashboardMetrics } from './metrics';
import { STAGES } from './stages';
import type { Candidate } from './types';

const NOW = new Date('2026-11-16T09:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

function withCandidates(overrides: Array<Partial<Candidate>>) {
  const s = buildSeed();
  const base = s.candidates[0];
  return {
    ...s,
    candidates: overrides.map((o, i) => ({ ...base, id: `c${i}`, ...o })),
  };
}

describe('dashboardMetrics', () => {
  it('computes totals from candidates', () => {
    const s = withCandidates([
      { email: 'a@x.demo', seniority: 'Senior', english: 'Advanced', skills: ['Docker', 'Go'], domains: ['SaaS'], cvOwner: 'u-admin' },
      { email: '', seniority: 'Senior', english: 'Basic', skills: ['Docker'], domains: ['SaaS'], cvOwner: 'u-admin' },
      { email: 'c@x.demo', seniority: 'Junior', english: 'Advanced', skills: [], domains: ['Fintech'], cvOwner: 'Someone Else' },
    ].map((c) => ({ ...c, createdAt: daysAgo(1) })));
    const m = dashboardMetrics(s, 'all', NOW);
    expect(m.total).toBe(3);
    expect(m.active).toBe(3);
    expect(m.missingEmail).toBe(1);
    expect(m.parsingSuccess).toEqual({ ok: 2, total: 3 });
    expect(m.seniority).toEqual({ Senior: 2, Junior: 1 });
    expect(m.english).toEqual({ Advanced: 2, Basic: 1 });
    expect(m.topStacks[0].name).toBe('Docker');
    expect(m.domains[0]).toEqual({ name: 'SaaS', pct: 67 });
    const adminName = s.users.find((u) => u.id === 'u-admin')!.name;
    expect(m.topTa[0]).toMatchObject({ name: adminName, files: 2 });
    expect(m.topTa.map((t) => t.name)).toContain('Someone Else');
  });

  it('period filter excludes older candidates', () => {
    const s = withCandidates([{ createdAt: daysAgo(0.5) }, { createdAt: daysAgo(5) }, { createdAt: daysAgo(60) }, { createdAt: daysAgo(400) }]);
    expect(dashboardMetrics(s, 'day', NOW).total).toBe(1);
    expect(dashboardMetrics(s, 'week', NOW).total).toBe(2);
    expect(dashboardMetrics(s, '3m', NOW).total).toBe(3);
    expect(dashboardMetrics(s, '6m', NOW).total).toBe(3);
    expect(dashboardMetrics(s, 'all', NOW).total).toBe(4);
  });

  it('period filter scopes hires and top sources', () => {
    const s = buildSeed();
    const app = s.applications[0];
    const hire = (id: string, at: string, source: string, addedAt: string) => ({
      ...app, id, stage: 'hired' as const, source, addedAt,
      history: [{ stage: 'new' as const, at: addedAt, by: 'u-admin' }, { stage: 'hired' as const, at, by: 'u-admin' }],
    });
    const state = {
      ...s,
      applications: [
        hire('recent', daysAgo(2), 'Fresh Source', daysAgo(10)),
        hire('old', daysAgo(200), 'Old Source', daysAgo(220)),
      ],
    };
    expect(dashboardMetrics(state, 'week', NOW).recruitment.hires).toBe(1);
    expect(dashboardMetrics(state, 'all', NOW).recruitment.hires).toBe(2);
    expect(dashboardMetrics(state, '3m', NOW).recruitment.topSources.map((x) => x.source)).toEqual(['Fresh Source']);
    expect(dashboardMetrics(state, 'all', NOW).recruitment.topSources).toHaveLength(2);
  });

  it('recruitment byStage counts applications', () => {
    const s = buildSeed();
    const m = dashboardMetrics(s, 'all', NOW);
    expect(Object.keys(m.recruitment.byStage)).toEqual(STAGES);
    for (const st of STAGES) {
      expect(m.recruitment.byStage[st]).toBe(s.applications.filter((a) => a.stage === st).length);
    }
    expect(m.recruitment.openJobs).toBe(s.jobs.filter((j) => j.status === 'open').length);
    expect(m.recruitment.hires).toBe(m.recruitment.byStage.hired);
    expect(m.recruitment.topSources.length).toBeGreaterThan(0);
  });

  it('available counts only open-to-work candidates', () => {
    const s = withCandidates([
      { openToWork: true, skills: ['Rust', 'Go'], createdAt: daysAgo(1) },
      { openToWork: false, skills: ['Java', 'Java2'], createdAt: daysAgo(1) },
      { openToWork: undefined, skills: ['Java'], createdAt: daysAgo(1) },
    ]);
    const m = dashboardMetrics(s, 'all', NOW);
    expect(m.available).toBe(1);
    expect(m.availableStacks.map((x) => x.name)).toEqual(['Rust', 'Go']);
  });

  it('returns the mockup totals in fixture mode', () => {
    const m = dashboardMetrics(buildMockupFixture(), 'all', NOW);
    expect(m.total).toBe(781);
    expect(m.parsingSuccess).toEqual({ ok: 891, total: 1000 });
    expect(m.missingEmail).toBe(95);
    expect(m.available).toBe(781);
    expect(m.topStacks[0]).toMatchObject({ name: 'Docker', pct: 18.12 });
    expect(m.seniority.Senior).toBe(411);
    expect(m.topTa[0]).toMatchObject({ name: 'Lê Minh Châu', files: 170 });
  });
});

describe('rangeBounds', () => {
  it('starts today at local midnight, the week on Monday, the month on the 1st; custom is inclusive of both days', async () => {
    const { rangeBounds } = await import('./metrics');
    const now = new Date(2026, 10, 26, 15, 30); // Thursday 26 Nov 2026
    expect(rangeBounds({ kind: 'all' }, now)).toEqual({ from: -Infinity, until: Infinity });
    expect(rangeBounds({ kind: 'today' }, now).from).toBe(new Date(2026, 10, 26).getTime());
    expect(rangeBounds({ kind: 'week' }, now).from).toBe(new Date(2026, 10, 23).getTime());
    expect(rangeBounds({ kind: 'month' }, now).from).toBe(new Date(2026, 10, 1).getTime());
    const c = rangeBounds({ kind: 'custom', from: '2026-11-10', to: '2026-11-12' }, now);
    expect(c.from).toBe(new Date(2026, 10, 10).getTime());
    expect(c.until).toBe(new Date(2026, 10, 12, 23, 59, 59, 999).getTime());
    // A reversed pair is read in order.
    expect(rangeBounds({ kind: 'custom', from: '2026-11-12', to: '2026-11-10' }, now)).toEqual(c);
  });
});
