import { describe, expect, it } from 'vitest';
import { jobOptimizations, jobStats, jobUpdatedAt, sortJobs, type JobStats } from './jobInsights';
import type { Activity, AiEvaluation, Application, Job } from './types';

const NOW = Date.parse('2026-11-19T12:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

const job = (over: Partial<Job> = {}): Job => ({
  id: 'j1', jdId: 'jd', title: 'Dev', department: 'Eng', location: 'Hanoi', level: 'Senior', employment: 'Full-time',
  status: 'open', stageSla: {}, openedAt: daysAgo(10), hiringManager: 'u', ...over,
});
const ev = (score: number, noCriteria = false): AiEvaluation => ({
  id: 'e', score, noCriteria, breakdown: [], strengths: [], gaps: [], questions: [], model: 'intalent-match-v1', at: daysAgo(1),
});
const app = (id: string, over: Partial<Application> = {}): Application =>
  ({ id, candidateId: id, jobId: 'j1', stage: 'new', addedAt: daysAgo(20), stageEnteredAt: daysAgo(20), ...over }) as Application;

describe('jobStats', () => {
  it('averages each application\'s latest real AI score and skips runs with no criteria', () => {
    const apps = [
      app('a', { aiEvaluations: [ev(10), ev(80)] }),
      app('b', { aiEvaluations: [ev(60)] }),
      app('c', { aiEvaluations: [ev(0, true)] }),
      app('d'),
      app('x', { jobId: 'other', aiEvaluations: [ev(5)] }),
    ];
    expect(jobStats(job(), apps, [], NOW)).toMatchObject({ applicants: 4, aiAvg: 70, evaluated: 2 });
  });

  it('has no average before anything is scored', () => {
    const s = jobStats(job(), [app('a', { addedAt: daysAgo(2) }), app('b', { addedAt: daysAgo(9) })], [], NOW);
    expect(s.aiAvg).toBeUndefined();
  });
});

describe('jobUpdatedAt', () => {
  it('prefers the job stamp, else the latest stage move or job activity', () => {
    expect(jobUpdatedAt(job({ updatedAt: daysAgo(0) }), [], [])).toBe(daysAgo(0));
    const acts = [{ type: 'job_status_changed', jobId: 'j1', at: daysAgo(3), by: 'u', detail: '' }] as Activity[];
    expect(jobUpdatedAt(job(), [app('a', { stageEnteredAt: daysAgo(5) })], acts)).toBe(daysAgo(3));
    expect(jobUpdatedAt(job(), [], [])).toBe(daysAgo(10));
  });
});

const stats = (over: Partial<JobStats> = {}): JobStats => ({ applicants: 10, evaluated: 5, updatedAt: daysAgo(1), aiAvg: 65, ...over });

describe('jobOptimizations', () => {
  it('lists the most urgent tips first', () => {
    const jobs = [
      job({ id: 'a', salaryMin: 1, showSalary: false, minYears: 3 }),
      job({ id: 'b', status: 'pending_approval' }),
      job({ id: 'c', minYears: 2 }),
    ];
    const m = new Map([['a', stats()], ['b', stats()], ['c', stats({ aiAvg: 20 })]]);
    expect(jobOptimizations(jobs, m, NOW).map((o) => `${o.jobId}:${o.kind}`)).toEqual(['b:pending_approval', 'c:low_match', 'a:hidden_salary']);
  });
});

describe('sortJobs', () => {
  it('sorts by applicants', () => {
    const jobs = [job({ id: 'a' }), job({ id: 'b' }), job({ id: 'c' })];
    const m = new Map([['a', stats({ applicants: 2 })], ['b', stats({ applicants: 9 })], ['c', stats({ applicants: 5 })]]);
    expect(sortJobs(jobs, 'applicants', m).map((j) => j.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('requirementsForJob', () => {
  it('takes the minimum years from the JD, never the job', async () => {
    const { requirementsForJob } = await import('./aiEvaluation');
    const jd = { id: 'jd', code: 'JD-1', title: 'Dev', client: '', domains: [], body: '5+ years of experience', skills: ['React'], status: 'Published', createdAt: '', updatedAt: '' };
    expect(requirementsForJob(job({ minYears: 8 }), [jd], []).years).toBe(5);
  });
});
