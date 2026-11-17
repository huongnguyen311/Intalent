import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import { filterApplications, pipelineSummary } from './pipelineFilter';
import type { Application, Candidate, Job } from './types';

const DAY = 86_400_000;
const NOW = Date.parse('2026-06-30T00:00:00Z');
const at = (d: number) => new Date(NOW - d * DAY).toISOString();

const cand = (id: string, name: string, title: string) => ({ ...buildSeed().candidates[0], id, name, title }) as Candidate;
const app = (id: string, candidateId: string, stage: Application['stage'], days: number, source = 'Referral'): Application => ({
  id, candidateId, jobId: 'j', stage, source, via: 'manual', addedBy: 'u', addedAt: at(days),
  stageEnteredAt: at(days), history: [], comments: [],
});
const candidates = [cand('c1', 'Nguyễn Đức Anh', 'Backend Engineer'), cand('c2', 'Lê Hoa', 'Designer')];
const apps = [app('a1', 'c1', 'screening', 5, 'TopCV'), app('a2', 'c2', 'new', 0)];
const job = { id: 'j', stageSla: { screening: 3 }, openedAt: at(10) } as unknown as Job;

describe('pipelineFilter', () => {
  it('filterApplications matches name and title ignoring diacritics', () => {
    expect(filterApplications(apps, candidates, { text: 'duc anh' }).map((a) => a.id)).toEqual(['a1']);
    expect(filterApplications(apps, candidates, { text: 'DESIGN' }).map((a) => a.id)).toEqual(['a2']);
    expect(filterApplications(apps, candidates, { text: '  ' })).toHaveLength(2);
  });

  it('filterApplications filters by source', () => {
    expect(filterApplications(apps, candidates, { source: 'TopCV' }).map((a) => a.id)).toEqual(['a1']);
    expect(filterApplications(apps, candidates, { source: '' })).toHaveLength(2);
  });

  it('pipelineSummary counts overdue', () => {
    expect(pipelineSummary(apps, job, NOW)).toEqual({ total: 2, overdue: 1, daysOpen: 10 });
  });
});
