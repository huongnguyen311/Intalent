import type { Application, HiringPriority, Job } from './types';

export const priorityOf = (job: Pick<Job, 'hiringPriority'>): HiringPriority => job.hiringPriority ?? 'normal';

export const isUrgent = (job: Pick<Job, 'hiringPriority'>): boolean => {
  const p = priorityOf(job);
  return p === 'urgent' || p === 'critical';
};

/** Hired applications for the job, from any source. */
export const jobHires = (jobId: string, applications: Application[]): number =>
  applications.filter((a) => a.jobId === jobId && a.stage === 'hired').length;

/** Open, past its target hiring date (`today` is YYYY-MM-DD) and still short of its headcount. */
export function isOverdue(job: Job, applications: Application[], today: string): boolean {
  if (job.status !== 'open' || !job.targetHiringDate) return false;
  if (job.targetHiringDate.slice(0, 10) >= today) return false;
  return jobHires(job.id, applications) < (job.headcount ?? 1);
}

/** Today as YYYY-MM-DD in local time. */
export const todayIso = (now = new Date()): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
};
