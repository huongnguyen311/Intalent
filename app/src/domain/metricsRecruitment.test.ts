import { buildSeed } from '../data/seed';
import { localStamp } from './hiring';
import { dashboardMetrics } from './metrics';
import type { Application, Stage } from './types';

const NOW = new Date('2026-11-16T09:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

function stateWith(apps: Array<Partial<Application> & { path?: Stage[] }>) {
  const s = buildSeed();
  const base = s.applications[0];
  const job = { ...s.jobs[0], stageSla: { screening: 3 } };
  return {
    ...s,
    jobs: [job],
    applications: apps.map(({ path = ['new'], ...o }, i) => {
      const addedAt = o.addedAt ?? daysAgo(5);
      return {
        ...base,
        id: `a${i}`,
        jobId: job.id,
        source: 'LinkedIn',
        addedAt,
        stage: path[path.length - 1],
        stageEnteredAt: addedAt,
        history: path.map((stage) => ({ stage, at: addedAt, by: 'u-admin' })),
        interviews: [],
        offer: undefined,
        aiEvaluations: undefined,
        rejectedReason: undefined,
        ...o,
      } as Application;
    }),
  };
}

describe('dashboardMetrics recruitment KPIs', () => {
  it('builds the funnel from the furthest stage reached, counting skipped stages as passed', () => {
    const s = stateWith([
      { path: ['new'] },
      { path: ['new', 'screening'] },
      { path: ['new', 'screening', 'interview', 'rejected'], rejectedReason: 'Thiếu kinh nghiệm' },
      { path: ['new', 'screening', 'interview', 'offer', 'hired'] },
      { path: ['new', 'withdrawn'] },
    ]);
    const r = dashboardMetrics(s, 'all', NOW).recruitment;
    const reached = Object.fromEntries(r.funnel.map((f) => [f.stage, f.reached]));
    expect(reached).toMatchObject({ new: 5, ai_screening: 3, screening: 3, interview: 2, offer: 1, hired: 1 });
    expect(r.closedOut).toEqual({ rejected: 1, withdrawn: 1 });
    expect(r.topRejectReasons).toEqual([{ reason: 'Thiếu kinh nghiệm', count: 1 }]);
    expect(r.inProgress).toBe(1); // only the one sitting in Screening
    expect(r.topSources[0]).toEqual({ source: 'LinkedIn', count: 5, hires: 1 });
  });

  it('time to hire averages applying → offer accepted; offer acceptance counts answers in the period', () => {
    const s = stateWith([
      {
        path: ['new', 'offer'], addedAt: daysAgo(30),
        offer: { status: 'accepted', respondedAt: daysAgo(10) } as Application['offer'],
      },
      {
        path: ['new', 'offer'], addedAt: daysAgo(40),
        offer: { status: 'accepted', respondedAt: daysAgo(20) } as Application['offer'],
      },
      {
        path: ['new', 'offer'], addedAt: daysAgo(40),
        offer: { status: 'declined', respondedAt: daysAgo(3) } as Application['offer'],
      },
    ]);
    const r = dashboardMetrics(s, 'all', NOW).recruitment;
    expect(r.timeToHireDays).toBe(20);
    expect(r.offers).toEqual({ accepted: 2, declined: 1 });
    expect(dashboardMetrics(s, 'week', NOW).recruitment.timeToHireDays).toBeUndefined();
    expect(dashboardMetrics(s, 'week', NOW).recruitment.offers).toEqual({ accepted: 0, declined: 1 });
  });

  it('AI match uses the latest evaluation and skips runs with no criteria', () => {
    const ev = (score: number, noCriteria = false) => ({ id: "e", score, noCriteria }) as NonNullable<Application['aiEvaluations']>[number];
    const s = stateWith([
      { aiEvaluations: [ev(40), ev(65)] },
      { aiEvaluations: [ev(55)] },
      { aiEvaluations: [ev(0, true)] },
      {},
    ]);
    expect(dashboardMetrics(s, 'all', NOW).recruitment.aiMatch).toEqual({ matched: 1, scored: 2 });
  });

  it('lists this week\'s interviews by time, Monday to Sunday, skipping cancelled ones', () => {
    // Thursday 19 Nov 2026, local noon: the week runs Mon 16 – Sun 22.
    const now = new Date(2026, 10, 19, 12);
    const iv = (id: string, at: string, status: 'scheduled' | 'cancelled' = 'scheduled') =>
      ({ id, round: 'Tech', at, status, place: 'meet.example/abc', interviewers: [], durationMin: 60, mode: 'online' }) as unknown as NonNullable<Application['interviews']>[number];
    const s = stateWith([
      { interviews: [iv('late', '2026-11-19T15:00'), iv('x', '2026-11-19T09:00', 'cancelled'), iv('lastWeek', '2026-11-15T10:00')] },
      { interviews: [iv('early', '2026-11-19T09:30'), iv('mon', '2026-11-16T08:00'), iv('sun', '2026-11-22T18:00')] },
    ]);
    const { week } = dashboardMetrics(s, 'all', now).recruitment;
    expect(week.today).toBe(localStamp(now).slice(0, 10));
    expect(week.days).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
    expect(week.interviews.map((i) => i.id)).toEqual(['mon', 'early', 'late', 'sun']);
    expect(week.interviews[0]).toMatchObject({ durationMin: 60, mode: 'online', place: 'meet.example/abc' });
  });

  it('recent activity is the newest stage moves; open jobs carry applicant counts', () => {
    const s = stateWith([
      { path: ['new', 'screening'], addedAt: daysAgo(2) },
      { path: ['new', 'screening', 'interview'], addedAt: daysAgo(20) },
    ]);
    // Spread the moves in time so the order is defined.
    s.applications[0].history[1].at = daysAgo(1);
    s.applications[1].history[1].at = daysAgo(10);
    s.applications[1].history[2].at = daysAgo(3);
    s.jobs[0].status = 'open';
    const r = dashboardMetrics(s, 'all', NOW).recruitment;
    expect(r.recentActivity.map((x) => x.stage)).toEqual(['screening', 'interview', 'screening']);
    expect(r.openJobsList[0]).toMatchObject({ id: s.jobs[0].id, applicants: 2, newThisWeek: 1 });
  });
});
