import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import {
  campaignJobIds, campaignJobRows, campaignPerformance, campaignPickable, campaignStats, canEdit, creditedCampaign, effectiveStatus,
  filledHires, launchStatus, nextCampaignCode, pastEnd, targetHires,
} from './campaigns';
import type { Application, Campaign, Job } from './types';

const seed = buildSeed();

const campaign = (over: Partial<Campaign> = {}): Campaign => ({
  id: 'c1', code: 'CMP-2026-001', name: 'Q1 Tech', owner: 'u-huy',
  start: '2026-11-01', end: '2026-12-31', status: 'active',
  goals: {}, stats: { views: 0 }, createdAt: '2026-11-01T00:00:00.000Z',
  ...over,
});
const app = (id: string, over: Partial<Application>): Application => ({
  ...seed.applications[0], id, campaignId: 'c1', jobId: 'job-1', stage: 'new', history: [], interviews: undefined,
  offer: undefined, aiEvaluations: undefined, addedAt: '2026-11-01T00:00:00.000Z', ...over,
});

describe('job attachment and crediting', () => {
  const jobs: Job[] = seed.jobs.map((j) => ({ ...j, campaignId: j.id === 'job-1' || j.id === 'job-3' ? 'c1' : undefined }));

  it('campaign jobs are the jobs pointing at it, then jobs it already credited applicants to', () => {
    const applications = [app('a1', { jobId: 'job-4' }), app('a2', { jobId: 'job-1' }), app('a3', { jobId: 'job-2', campaignId: 'other' })];
    expect(campaignJobIds(campaign(), { jobs, applications })).toEqual(['job-1', 'job-3', 'job-4']);
  });

  it("credits the job's campaign only while it is active", () => {
    const job = jobs[0];
    for (const [status, start, credited] of [
      ['active', '2026-11-01', true], ['scheduled', '2026-11-01', true], ['scheduled', '2026-12-01', false],
      ['draft', '2026-11-01', false], ['paused', '2026-11-01', false], ['completed', '2026-11-01', false], ['cancelled', '2026-11-01', false],
    ] as const) {
      const c = campaign({ status, start });
      expect(creditedCampaign(job, [c], '2026-11-20')?.id).toBe(credited ? 'c1' : undefined);
    }
  });

  it('a job with no campaign, or a missing one, credits nothing', () => {
    expect(creditedCampaign({ ...jobs[0], campaignId: undefined }, [campaign()], '2026-11-20')).toBeUndefined();
    expect(creditedCampaign({ ...jobs[0], campaignId: 'gone' }, [campaign()], '2026-11-20')).toBeUndefined();
  });

  it('a campaign can be picked on a job while it is not finished', () => {
    expect(campaignPickable(campaign({ status: 'draft' }))).toBe(true);
    expect(campaignPickable(campaign({ status: 'paused' }))).toBe(true);
    expect(campaignPickable(campaign({ status: 'completed' }))).toBe(false);
    expect(campaignPickable(campaign({ status: 'cancelled' }))).toBe(false);
  });
});

describe('campaign codes and lifecycle', () => {
  it('numbers codes per year of creation', () => {
    expect(nextCampaignCode([], '2026-11-20T08:00:00.000Z')).toBe('CMP-2026-001');
    expect(nextCampaignCode([campaign({ code: 'CMP-2026-007' })], '2026-11-20T08:00:00.000Z')).toBe('CMP-2026-008');
    expect(nextCampaignCode([campaign({ code: 'CMP-2025-010' })], '2026-11-20T08:00:00.000Z')).toBe('CMP-2026-001');
  });

  it('a scheduled campaign reads as active from its start date', () => {
    const c = campaign({ status: 'scheduled', start: '2026-12-01' });
    expect(effectiveStatus(c, '2026-11-20')).toBe('scheduled');
    expect(effectiveStatus(c, '2026-12-01')).toBe('active');
  });

  it('an unknown stored status reads as completed', () => {
    expect(effectiveStatus(campaign({ status: 'ended' as Campaign['status'] }), '2026-11-20')).toBe('completed');
  });

  it('launch gives scheduled for a future start, else active', () => {
    expect(launchStatus('2026-12-01', '2026-11-20')).toBe('scheduled');
    expect(launchStatus('2026-11-20', '2026-11-20')).toBe('active');
  });

  it('is past its end only while effectively active', () => {
    expect(pastEnd(campaign({ end: '2026-11-10' }), '2026-11-20')).toBe(true);
    expect(pastEnd(campaign({ end: '2026-11-20' }), '2026-11-20')).toBe(false);
    expect(pastEnd(campaign({ end: '2026-11-10', status: 'paused' }), '2026-11-20')).toBe(false);
  });

  it('an unknown stored status is read-only too', () => {
    expect(canEdit(campaign({ status: 'ended' as Campaign['status'] }))).toBe(false);
  });

  it('completed and cancelled campaigns are read-only', () => {
    expect(canEdit(campaign({ status: 'completed' }))).toBe(false);
    expect(canEdit(campaign({ status: 'cancelled' }))).toBe(false);
    expect(canEdit(campaign({ status: 'draft' }))).toBe(true);
  });
});

describe('campaign numbers', () => {
  // job-1 (2 openings), job-2 (1) and job-3 (3) run in c1.
  const jobs: Job[] = seed.jobs.map((j) => ({ ...j, campaignId: ['job-1', 'job-2', 'job-3'].includes(j.id) ? 'c1' : undefined }));

  it('target hires is the sum of the openings of its jobs', () => {
    expect(targetHires({ jobs, applications: [] }, campaign())).toBe(6);
  });

  it('job rows give target from openings, hired and remaining from campaign applicants, plus totals', () => {
    const applications = [
      app('a1', { jobId: 'job-1', stage: 'hired' }),
      app('a2', { jobId: 'job-3', stage: 'hired' }),
      app('a3', { jobId: 'job-1', stage: 'hired', campaignId: 'other' }),
    ];
    const { rows, totals } = campaignJobRows({ applications, jobs }, campaign());
    expect(rows.map((r) => [r.jobId, r.target, r.hired, r.remaining])).toEqual([
      ['job-1', 2, 1, 1], ['job-2', 1, 0, 1], ['job-3', 3, 1, 2],
    ]);
    expect(totals).toEqual({ target: 6, hired: 2, remaining: 4 });
    expect(rows[0]).toMatchObject({ title: 'Senior Frontend Developer', jobStatus: 'open', priority: 'critical', attached: true });
  });

  it('a job moved to another campaign stays listed for the applicants it brought', () => {
    const moved = jobs.map((j) => (j.id === 'job-4' ? { ...j, campaignId: 'c2' } : j));
    const { rows } = campaignJobRows({ applications: [app('a1', { jobId: 'job-4' })], jobs: moved }, campaign());
    expect(rows[rows.length - 1]).toMatchObject({ jobId: 'job-4', attached: false, target: 1 });
  });

  it('filled counts each job only up to its target, so extra hires never hide a shortfall', () => {
    const applications = [1, 2, 3].map((i) => app(`h${i}`, { jobId: 'job-2', stage: 'hired' }));
    expect(filledHires({ applications, jobs }, campaign())).toBe(1);
  });

  it('remaining never goes below zero', () => {
    const applications = [1, 2, 3, 4].map((i) => app(`h${i}`, { jobId: 'job-1', stage: 'hired' }));
    const { rows } = campaignJobRows({ applications, jobs }, campaign());
    expect(rows[0]).toMatchObject({ hired: 4, remaining: 0 });
  });

  it('a deleted job shows its id, no status and no target', () => {
    const { rows } = campaignJobRows({ applications: [app('a1', { jobId: 'job-gone' })], jobs }, campaign());
    expect(rows[rows.length - 1]).toMatchObject({ title: 'job-gone', jobStatus: undefined, priority: 'normal', target: 0 });
  });
});

describe('campaignPerformance', () => {
  const now = new Date('2026-11-20T12:00:00.000Z');
  const offer = (status: 'draft' | 'sent' | 'accepted' | 'declined') =>
    ({ salary: 1, currency: 'VND', startDate: '', contract: '', validUntil: '', status, createdBy: 'x' }) as Application['offer'];
  const interview = (status: 'scheduled' | 'done' | 'cancelled') => [{ status } as NonNullable<Application['interviews']>[number]];
  const applications = [
    app('n1', { addedAt: '2026-11-18T00:00:00.000Z' }),
    app('ai', { aiEvaluations: [{} as NonNullable<Application['aiEvaluations']>[number]] }),
    app('rj', { stage: 'rejected', history: [{ stage: 'interview', at: '', by: '' }, { stage: 'rejected', at: '', by: '' }] }),
    app('iv', { stage: 'interview', interviews: interview('done') }),
    app('iv2', { stage: 'interview', interviews: interview('scheduled') }),
    app('od', { stage: 'offer', offer: offer('draft') }),
    app('os', { stage: 'offer', offer: offer('sent') }),
    app('hi', { stage: 'hired', offer: offer('accepted'), interviews: interview('done') }),
    app('x', { campaignId: 'other', stage: 'hired' }),
  ];
  const c = campaign({ goals: { budget: 3000 } });

  it('counts each funnel metric by the spec rules', () => {
    const p = campaignPerformance({ applications, campaigns: [c] }, 'c1', now);
    expect(p).toMatchObject({ total: 8, new: 1, aiScreened: 1, shortlisted: 6, interviewed: 2, offers: 2, hired: 1, rejected: 1 });
  });

  it('step rates divide by the step before, undefined after a zero', () => {
    const p = campaignPerformance({ applications, campaigns: [c] }, 'c1', now);
    expect(p.steps.map((s) => s.key)).toEqual(['total', 'aiScreened', 'shortlisted', 'interviewed', 'offers', 'hired']);
    expect(p.steps[0].rate).toBeUndefined();
    expect(p.steps[2].rate).toBe(6 / 1);
    expect(p.steps[5].rate).toBe(1 / 2);
    const empty = campaignPerformance({ applications: [], campaigns: [c] }, 'c1', now);
    expect(empty.steps.every((s) => s.rate === undefined)).toBe(true);
  });

  it('cost per hire needs both a budget and a hire', () => {
    expect(campaignPerformance({ applications, campaigns: [c] }, 'c1', now).costPerHire).toBe(3000);
    expect(campaignPerformance({ applications: [], campaigns: [c] }, 'c1', now).costPerHire).toBeUndefined();
    expect(campaignPerformance({ applications, campaigns: [campaign()] }, 'c1', now).costPerHire).toBeUndefined();
  });
});

describe('campaignStats', () => {
  it('keeps views, conversion and per-job counts', () => {
    const c = campaign({ stats: { views: 1000 } });
    const jobs = seed.jobs.map((j) => ({ ...j, campaignId: ['job-1', 'job-2', 'job-3'].includes(j.id) ? 'c1' : undefined }));
    const s = campaignStats({ campaigns: [c], jobs, applications: [app('a1', {}), app('a2', { stage: 'hired', jobId: 'job-2' })] }, 'c1');
    expect(s).toMatchObject({ views: 1000, applicants: 2, hires: 1, conversion: 2 / 1000 });
    expect(s.byJob).toMatchObject({ 'job-1': { applicants: 1, hires: 0 }, 'job-2': { applicants: 1, hires: 1 }, 'job-3': { applicants: 0, hires: 0 } });
  });
});
