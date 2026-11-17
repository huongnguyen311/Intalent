import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import { publishedRows } from './published';

describe('publishedRows', () => {
  it('lists only open jobs newest first with applicant counts', () => {
    const s = buildSeed();
    const now = Date.now();
    const rows = publishedRows(s, now);
    const open = s.jobs.filter((j) => j.status === 'open');
    expect(rows).toHaveLength(open.length);
    expect(rows.every((r) => r.job.status === 'open')).toBe(true);
    const times = rows.map((r) => new Date(r.job.openedAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    for (const r of rows) {
      const apps = s.applications.filter((a) => a.jobId === r.job.id);
      expect(r.careersApplicants).toBe(apps.filter((a) => a.via === 'careers').length);
      expect(r.campaignApplicants).toBe(apps.filter((a) => a.via === 'campaign').length);
      expect(r.daysPublished).toBe(Math.floor((now - new Date(r.job.openedAt).getTime()) / 86_400_000));
    }
    expect(rows.some((r) => r.careersApplicants + r.campaignApplicants > 0)).toBe(true);
  });
});
