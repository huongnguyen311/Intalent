import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import { stageMetrics } from './pipeline';
import type { Application, Job, Stage } from './types';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-17T12:00:00Z');
const mk = (id: string, stage: Stage, days: number): Application => {
  const at = new Date(NOW - days * DAY - 60_000).toISOString();
  return { id, candidateId: id, jobId: 'j', stage, source: 'Referral', via: 'manual', addedBy: 'u', addedAt: at, stageEnteredAt: at, history: [], comments: [] };
};
const job = { ...buildSeed().jobs[0], stageSla: { new: 2, screening: 3 } } as Job;

describe('stageMetrics', () => {
  const apps = [mk('a', 'screening', 4), mk('b', 'screening', 1), mk('c', 'new', 0), mk('d', 'hired', 30)];

  it('counts overdue and share', () => {
    expect(stageMetrics(apps, job, 'screening', NOW)).toEqual({ sla: 3, overdue: 1, share: 50 });
    expect(stageMetrics(apps, job, 'new', NOW)).toEqual({ sla: 2, overdue: 0, share: 25 });
  });

  it('share is 0 when job has no applications', () => {
    expect(stageMetrics([], job, 'new', NOW)).toEqual({ sla: 2, overdue: 0, share: 0 });
  });

  it('hired and rejected have no sla', () => {
    expect(stageMetrics(apps, job, 'hired', NOW)).toEqual({ sla: undefined, overdue: 0, share: 25 });
    expect(stageMetrics(apps, job, 'rejected', NOW).sla).toBeUndefined();
  });
});
