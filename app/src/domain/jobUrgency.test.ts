import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import { isOverdue, isUrgent, jobHires, priorityOf } from './jobUrgency';
import type { Application, Job } from './types';

const seed = buildSeed();
const baseJob: Job = { ...seed.jobs[0], status: 'open', headcount: 2, targetHiringDate: '2026-11-01', hiringPriority: 'normal' };
const app = (id: string, over: Partial<Application>): Application => ({ ...seed.applications[0], id, jobId: baseJob.id, ...over });

describe('job urgency', () => {
  it('reads a missing priority as normal', () => {
    expect(priorityOf({ ...baseJob, hiringPriority: undefined })).toBe('normal');
  });

  it('counts only urgent and critical as urgent', () => {
    expect(isUrgent({ ...baseJob, hiringPriority: 'normal' })).toBe(false);
    expect(isUrgent({ ...baseJob, hiringPriority: 'high' })).toBe(false);
    expect(isUrgent({ ...baseJob, hiringPriority: 'urgent' })).toBe(true);
    expect(isUrgent({ ...baseJob, hiringPriority: 'critical' })).toBe(true);
  });

  it('jobHires counts hired applications of the job from any source', () => {
    const apps = [
      app('a1', { stage: 'hired', source: 'Campaign' }),
      app('a2', { stage: 'hired', source: 'Manual' }),
      app('a3', { stage: 'offer' }),
      app('a4', { stage: 'hired', jobId: 'other' }),
    ];
    expect(jobHires(baseJob.id, apps)).toBe(2);
  });

  it('an open job past its target date with hires below headcount is overdue', () => {
    expect(isOverdue(baseJob, [app('a1', { stage: 'hired' })], '2026-11-20')).toBe(true);
  });

  it('is not overdue once filled, when not open, without a date, or on the date itself', () => {
    const filled = [app('a1', { stage: 'hired' }), app('a2', { stage: 'hired' })];
    expect(isOverdue(baseJob, filled, '2026-11-20')).toBe(false);
    expect(isOverdue({ ...baseJob, status: 'on_hold' }, [], '2026-11-20')).toBe(false);
    expect(isOverdue({ ...baseJob, targetHiringDate: undefined }, [], '2026-11-20')).toBe(false);
    expect(isOverdue(baseJob, [], '2026-11-01')).toBe(false);
  });
});
