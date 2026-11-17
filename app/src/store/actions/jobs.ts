import type { Job } from '../../domain/types';
import type { DemoActions, Env, Get, Set } from './types';

export function jobActions(
  set: Set,
  get: Get,
  env: Env,
): Pick<DemoActions, 'createJob' | 'updateJob' | 'setJobStatus'> {
  const touch = (id: string, change: (j: Job) => Partial<Job>): boolean => {
    if (!get().jobs.some((j) => j.id === id)) return false;
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...change(j) } : j)) }));
    return true;
  };

  return {
    createJob(input) {
      const job: Job = { ...input, id: env.id('job'), title: input.title.trim(), openedAt: env.now() };
      set((s) => ({ jobs: [job, ...s.jobs] }));
      return job;
    },

    updateJob: (id, patch) =>
      touch(id, () => ({ ...patch, ...(patch.title !== undefined ? { title: patch.title.trim() } : {}) })),

    setJobStatus: (id, status) =>
      touch(id, (j) => ({ status, ...(status === 'open' && j.status !== 'open' ? { openedAt: env.now() } : {}) })),
  };
}
