import type { Activity, Application, Job } from './types';

const DAY = 86_400_000;

/** Per-job numbers the Jobs list shows and sorts by. */
export interface JobStats {
  applicants: number;
  /** Average of each application's latest AI score; undefined until 1+ application has a real score. */
  aiAvg?: number;
  /** Applications whose latest AI run had criteria to score against. */
  evaluated: number;
  updatedAt: string;
}

export function jobStats(job: Job, apps: Application[], activities: Activity[], _now: number): JobStats {
  const mine = apps.filter((a) => a.jobId === job.id);
  const scores = mine
    .map((a) => a.aiEvaluations?.[a.aiEvaluations.length - 1])
    .filter((e): e is NonNullable<typeof e> => !!e && !e.noCriteria)
    .map((e) => e.score);
  const aiAvg = scores.length ? Math.round(scores.reduce((n, s) => n + s, 0) / scores.length) : undefined;
  return { applicants: mine.length, aiAvg, evaluated: scores.length, updatedAt: jobUpdatedAt(job, mine, activities) };
}

/** The job's own edit stamp, else the latest thing that happened on it (seeded jobs carry no stamp). */
export function jobUpdatedAt(job: Job, apps: Application[], activities: Activity[]): string {
  if (job.updatedAt) return job.updatedAt;
  let latest = job.openedAt;
  for (const a of apps) if (a.jobId === job.id && a.stageEnteredAt > latest) latest = a.stageEnteredAt;
  for (const e of activities) if (e.jobId === job.id && e.at > latest) latest = e.at;
  return latest;
}

const LOW_MATCH = 30;
const FEW_APPLICANTS = 5;
const SLOW_DAYS = 30;

const daysSince = (iso: string, now: number) => Math.floor((now - Date.parse(iso)) / DAY);

export type OptimizationKind = 'pending_approval' | 'low_match' | 'few_applicants' | 'hidden_salary';

export interface Optimization {
  jobId: string;
  kind: OptimizationKind;
  params: Record<string, string | number>;
}

const ORDER: OptimizationKind[] = ['pending_approval', 'low_match', 'few_applicants', 'hidden_salary'];

/** Rule-based "AI Optimization" tips for the jobs in view, most urgent first. */
export function jobOptimizations(jobs: Job[], stats: Map<string, JobStats>, now: number): Optimization[] {
  const out: Optimization[] = [];
  for (const job of jobs) {
    const s = stats.get(job.id);
    if (!s) continue;
    const base = { jobId: job.id };
    if (job.status === 'pending_approval') out.push({ ...base, kind: 'pending_approval', params: { title: job.title } });
    if (job.status !== 'open') continue;
    if (s.evaluated >= 3 && (s.aiAvg ?? 100) < LOW_MATCH) out.push({ ...base, kind: 'low_match', params: { title: job.title, score: s.aiAvg ?? 0 } });
    const days = daysSince(job.openedAt, now);
    if (days > SLOW_DAYS && s.applicants < FEW_APPLICANTS) out.push({ ...base, kind: 'few_applicants', params: { title: job.title, days, n: s.applicants } });
    if ((job.salaryMin || job.salaryMax) && !job.showSalary) out.push({ ...base, kind: 'hidden_salary', params: { title: job.title } });
  }
  return out.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

export const JOB_SORTS = ['newest', 'oldest', 'updated', 'applicants'] as const;
export type JobSort = (typeof JOB_SORTS)[number];

export function sortJobs(jobs: Job[], by: JobSort, stats: Map<string, JobStats>): Job[] {
  const st = (j: Job) => stats.get(j.id);
  const cmp: Record<JobSort, (a: Job, b: Job) => number> = {
    newest: (a, b) => b.openedAt.localeCompare(a.openedAt),
    oldest: (a, b) => a.openedAt.localeCompare(b.openedAt),
    updated: (a, b) => (st(b)?.updatedAt ?? '').localeCompare(st(a)?.updatedAt ?? ''),
    applicants: (a, b) => (st(b)?.applicants ?? 0) - (st(a)?.applicants ?? 0),
  };
  return [...jobs].sort(cmp[by]);
}
