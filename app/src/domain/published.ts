import type { Application, Job } from './types';

const DAY = 86_400_000;

export interface PublishedRow {
  job: Job;
  daysPublished: number;
  careersApplicants: number;
  campaignApplicants: number;
}

/** Open jobs (what the public careers site shows), newest first, with applicant counts per inbound channel. */
export function publishedRows(
  state: { jobs: Job[]; applications: Application[] },
  now: number,
): PublishedRow[] {
  return state.jobs
    .filter((j) => j.status === 'open')
    .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())
    .map((job) => {
      const apps = state.applications.filter((a) => a.jobId === job.id);
      return {
        job,
        daysPublished: Math.max(0, Math.floor((now - new Date(job.openedAt).getTime()) / DAY)),
        careersApplicants: apps.filter((a) => a.via === 'careers').length,
        campaignApplicants: apps.filter((a) => a.via === 'campaign').length,
      };
    });
}
