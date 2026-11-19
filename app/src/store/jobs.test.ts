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

describe('job approval', () => {
  it('draft -> pending -> approved publishes the job and logs each step', () => {
    const s = setup();
    const job = s.getState().createJob(input);
    expect(s.getState().approveJob(job.id)).toBe(false);
    expect(s.getState().requestJobApproval(job.id)).toBe(true);
    expect(s.getState().jobs[0]).toMatchObject({ status: 'pending_approval', approval: { requestedBy: 'u-admin' } });
    clock = '2026-11-18T08:00:00.000Z';
    expect(s.getState().approveJob(job.id)).toBe(true);
    expect(s.getState().jobs[0]).toMatchObject({ status: 'open', openedAt: clock, updatedAt: clock, approval: { decidedAt: clock } });
    const types = s.getState().activities.filter((a) => a.jobId === job.id).map((a) => a.type);
    expect(types).toEqual(['job_created', 'job_approval_requested', 'job_approved']);
  });

  it('sending back needs a reason and returns the job to draft with it', () => {
    const s = setup();
    expect(s.getState().rejectJob('job-5', '  ')).toBe(false);
    expect(s.getState().rejectJob('job-5', 'Salary band missing')).toBe(true);
    expect(s.getState().jobs.find((j) => j.id === 'job-5')).toMatchObject({ status: 'draft', approval: { rejectedReason: 'Salary band missing' } });
    expect(s.getState().rejectJob('job-5', 'again')).toBe(false);
  });

  it('a job created straight into pending approval is stamped with the requester', () => {
    const s = setup();
    const job = s.getState().createJob({ ...input, status: 'pending_approval' });
    expect(job.approval).toMatchObject({ requestedBy: 'u-admin', requestedAt: clock });
  });
});

describe('job templates', () => {
  it('saves and deletes templates', () => {
    const s = setup();
    const before = s.getState().jobTemplates!.length;
    const tpl = s.getState().saveJobTemplate(' Data · Middle ', { department: 'Data', location: 'Hanoi', level: 'Middle', employment: 'Full-time', stageSla: {}, hiringManager: 'u-thu', minYears: 3 });
    expect(tpl).toMatchObject({ name: 'Data · Middle', createdBy: 'u-admin' });
    expect(s.getState().jobTemplates).toHaveLength(before + 1);
    expect(s.getState().deleteJobTemplate(tpl.id)).toBe(true);
    expect(s.getState().deleteJobTemplate(tpl.id)).toBe(false);
  });
});
