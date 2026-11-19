import type { Job, JobTemplate } from '../../domain/types';
import { actorOf, logAudit } from './audit';
import type { DemoActions, Env, Get, Set } from './types';

export function jobActions(
  set: Set,
  get: Get,
  env: Env,
): Pick<
  DemoActions,
  'createJob' | 'updateJob' | 'setJobStatus' | 'requestJobApproval' | 'approveJob' | 'rejectJob' | 'saveJobTemplate' | 'deleteJobTemplate'
> {
  const touch = (id: string, change: (j: Job) => Partial<Job>): boolean => {
    if (!get().jobs.some((j) => j.id === id)) return false;
    const updatedAt = env.now();
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...change(j), updatedAt } : j)) }));
    return true;
  };
  const statusOf = (id: string) => get().jobs.find((j) => j.id === id)?.status;

  const setJobStatus: DemoActions['setJobStatus'] = (id, status) => {
    const before = statusOf(id);
    const ok = touch(id, (j) => ({ status, ...(status === 'open' && j.status !== 'open' ? { openedAt: env.now() } : {}) }));
    if (ok && before !== status) logAudit(set, get, env.now(), { type: 'job_status_changed', jobId: id, detail: `${before} → ${status}` });
    return ok;
  };

  return {
    createJob(input) {
      const at = env.now();
      const job: Job = {
        ...input, id: env.id('job'), title: input.title.trim(), openedAt: at, updatedAt: at,
        ...(input.status === 'pending_approval' ? { approval: { requestedBy: actorOf(get), requestedAt: at } } : {}),
      };
      set((s) => ({ jobs: [job, ...s.jobs] }));
      logAudit(set, get, at, { type: 'job_created', jobId: job.id, detail: `Job created: ${job.title} (${job.status})` });
      if (job.status === 'pending_approval') logAudit(set, get, at, { type: 'job_approval_requested', jobId: job.id, detail: job.title });
      return job;
    },

    updateJob: (id, patch) =>
      touch(id, () => ({ ...patch, ...(patch.title !== undefined ? { title: patch.title.trim() } : {}) })),

    setJobStatus,

    requestJobApproval(id) {
      if (statusOf(id) !== 'draft') return false;
      const at = env.now();
      touch(id, () => ({ status: 'pending_approval', approval: { requestedBy: actorOf(get), requestedAt: at } }));
      logAudit(set, get, at, { type: 'job_approval_requested', jobId: id, detail: 'draft → pending_approval' });
      return true;
    },

    approveJob(id) {
      if (statusOf(id) !== 'pending_approval') return false;
      const at = env.now();
      touch(id, (j) => ({
        status: 'open', openedAt: at,
        approval: { requestedBy: j.approval?.requestedBy ?? actorOf(get), requestedAt: j.approval?.requestedAt ?? at, decidedBy: actorOf(get), decidedAt: at },
      }));
      logAudit(set, get, at, { type: 'job_approved', jobId: id, detail: 'pending_approval → open' });
      return true;
    },

    rejectJob(id, reason) {
      const why = reason.trim();
      if (!why || statusOf(id) !== 'pending_approval') return false;
      const at = env.now();
      touch(id, (j) => ({
        status: 'draft',
        approval: { requestedBy: j.approval?.requestedBy ?? actorOf(get), requestedAt: j.approval?.requestedAt ?? at, decidedBy: actorOf(get), decidedAt: at, rejectedReason: why },
      }));
      logAudit(set, get, at, { type: 'job_rejected', jobId: id, detail: why });
      return true;
    },

    saveJobTemplate(name, fields) {
      const template: JobTemplate = { id: env.id('jtpl'), name: name.trim(), fields, createdAt: env.now(), createdBy: actorOf(get) };
      set((s) => ({ jobTemplates: [template, ...(s.jobTemplates ?? [])] }));
      return template;
    },

    deleteJobTemplate(id) {
      if (!get().jobTemplates?.some((t) => t.id === id)) return false;
      set((s) => ({ jobTemplates: (s.jobTemplates ?? []).filter((t) => t.id !== id) }));
      return true;
    },
  };
}
