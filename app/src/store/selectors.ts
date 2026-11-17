import { STAGES } from '../domain/stages';
import type { Application, DemoState, Job, Stage } from '../domain/types';

/** Jobs visible on the public careers site: open only (draft and closed are hidden). */
export const publicJobs = (state: Pick<DemoState, 'jobs'>): Job[] => state.jobs.filter((j) => j.status === 'open');

/** Applications of one job grouped into a count per stage (every stage present). */
export function stageCounts(applications: Application[], jobId: string): Record<Stage, number> {
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const a of applications) if (a.jobId === jobId) counts[a.stage] += 1;
  return counts;
}
