import { describe, expect, it } from 'vitest';
import { createDemoStore } from './store';

const memoryStorage = (): Storage => {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
};

let clock = '2026-11-16T10:00:00.000Z';
const setup = () => createDemoStore(memoryStorage(), () => clock);
const input = { jdId: 'jd-2026-002', title: ' QA Engineer ', department: 'Engineering', location: 'Hanoi', level: 'Middle', employment: 'Full-time', status: 'draft' as const, stageSla: { new: 2 }, hiringManager: 'u-admin' };

describe('job actions', () => {
  it('createJob trims the title, stamps openedAt and prepends', () => {
    const s = setup();
    const job = s.getState().createJob(input);
    expect(job).toMatchObject({ title: 'QA Engineer', openedAt: clock, status: 'draft' });
    expect(job.id).toMatch(/^job-/);
    expect(s.getState().jobs[0].id).toBe(job.id);
  });

  it('updateJob edits fields; unknown id is false', () => {
    const s = setup();
    expect(s.getState().updateJob('nope', { title: 'x' })).toBe(false);
    expect(s.getState().updateJob('job-1', { location: 'Da Nang' })).toBe(true);
    expect(s.getState().jobs.find((j) => j.id === 'job-1')!.location).toBe('Da Nang');
  });

  it('setJobStatus restarts days-open only when (re)opening', () => {
    const s = setup();
    const before = s.getState().jobs.find((j) => j.id === 'job-5')!.openedAt;
    clock = '2026-11-17T09:00:00.000Z';
    s.getState().setJobStatus('job-5', 'open');
    expect(s.getState().jobs.find((j) => j.id === 'job-5')).toMatchObject({ status: 'open', openedAt: clock });
    expect(before).not.toBe(clock);
    const opened = s.getState().jobs.find((j) => j.id === 'job-1')!.openedAt;
    s.getState().setJobStatus('job-1', 'closed');
    expect(s.getState().jobs.find((j) => j.id === 'job-1')).toMatchObject({ status: 'closed', openedAt: opened });
    expect(s.getState().setJobStatus('nope', 'open')).toBe(false);
  });
});
