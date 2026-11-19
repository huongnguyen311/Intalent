import { describe, expect, it } from 'vitest';
import { actionItems } from './actionItems';
import type { Application, Interview, Job, User } from './types';

const NOW = Date.parse('2026-11-18T10:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const job = (id: string, hm = 'u-hm', extra: Partial<Job> = {}): Job => ({
  id, jdId: 'jd', title: id, department: '', location: '', level: '', employment: '', status: 'open',
  stageSla: { new: 2, screening: 5, interview: 7, offer: 5 }, openedAt: daysAgo(30), hiringManager: hm, collaborators: ['u-rec'], ...extra,
});
const app = (id: string, extra: Partial<Application> = {}): Application => ({
  id, candidateId: `c-${id}`, jobId: 'job-1', stage: 'new', source: 'x', via: 'careers', addedBy: 'x',
  addedAt: daysAgo(0), stageEnteredAt: daysAgo(0), history: [], comments: [], ...extra,
});
const user = (id: string, role: string): User => ({ id, name: id, email: '', role, status: 'Active', createdAt: '' });
const iv = (extra: Partial<Interview>): Interview => ({
  id: 'iv', round: 'Tech', at: '2026-11-17T09:00', durationMin: 60, mode: 'online', place: '', interviewers: ['u-int'],
  status: 'scheduled', scorecards: [], createdBy: 'u-rec', ...extra,
} as Interview);

describe('actionItems', () => {
  const jobs = [job('job-1'), job('job-2', 'someone-else', { collaborators: [] })];

  it('lists new, overdue, missing scorecards and offers without an offer for a recruiter', () => {
    const apps = [
      app('a-new'),
      app('a-late', { stage: 'screening', addedAt: daysAgo(20), stageEnteredAt: daysAgo(9) }),
      app('a-score', { stage: 'interview', addedAt: daysAgo(20), stageEnteredAt: daysAgo(1), interviews: [iv({})] }),
      app('a-offer', { stage: 'offer', addedAt: daysAgo(20), stageEnteredAt: daysAgo(1) }),
      app('a-other-job', { jobId: 'job-2' }),
    ];
    const kinds = actionItems(apps, jobs, user('u-rec', 'Recruiter'), NOW).map((i) => [i.kind, i.appId]);
    expect(kinds).toEqual([['offer', 'a-offer'], ['scorecard', 'a-score'], ['overdue', 'a-late'], ['new', 'a-new']]);
  });

  it('within the same kind, puts whatever has waited longest in its stage first', () => {
    const apps = [
      app('late-3d', { stage: 'screening', addedAt: daysAgo(20), stageEnteredAt: daysAgo(8) }),
      app('late-9d', { stage: 'screening', addedAt: daysAgo(20), stageEnteredAt: daysAgo(14) }),
      app('new-today', { addedAt: daysAgo(0), stageEnteredAt: daysAgo(0) }),
      app('new-2d', { addedAt: daysAgo(2), stageEnteredAt: daysAgo(2) }),
    ];
    const order = actionItems(apps, jobs, user('u-rec', 'Recruiter'), NOW).map((i) => i.appId);
    expect(order).toEqual(['late-9d', 'late-3d', 'new-2d', 'new-today']);
  });

  it('skips handed-off applications and old applications in New', () => {
    const apps = [app('a-old', { addedAt: daysAgo(10), stageEnteredAt: daysAgo(1) }), app('a-done', { stage: 'hired', handoff: { at: '', by: '', target: '' } })];
    expect(actionItems(apps, jobs, user('u-rec', 'Recruiter'), NOW)).toEqual([]);
  });

  it('gives an interviewer only their own missing scorecards', () => {
    const apps = [app('a-score', { stage: 'interview', interviews: [iv({})] }), app('a-new')];
    const items = actionItems(apps, jobs, user('u-int', 'Interviewer'), NOW);
    expect(items.map((i) => [i.kind, i.appId])).toEqual([['scorecard', 'a-score']]);
  });

  it('does not ask for scorecards before the interview has happened', () => {
    const apps = [app('a-soon', { stage: 'interview', interviews: [iv({ at: '2026-11-25T09:00' })] })];
    expect(actionItems(apps, jobs, user('u-rec', 'Recruiter'), NOW)).toEqual([]);
  });
});
