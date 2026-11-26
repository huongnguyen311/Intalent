import { evaluateApplication, requirementsForJob } from '../domain/aiEvaluation';
import { jobPostFromJd } from '../domain/jobPost';
import type { Activity, Application, DemoState, Job, Stage } from '../domain/types';

/**
 * Ten more jobs so the Jobs list shows every state it can draw: each status, each priority,
 * overdue, a sent-back draft, with and without a campaign, 0 to many applicants, and a second page.
 * Added after the rest of the seed and draws no rng, so the existing jobs, applicants and scores stay the same.
 */
const SLA: Job['stageSla'] = { new: 2, ai_screening: 1, screening: 5, interview: 7, assessment: 5, final_interview: 5, offer: 3 };
const MIL = 1_000_000;

type Plan = {
  job: Omit<Job, 'stageSla' | 'openedAt' | 'targetHiringDate' | 'employment'> & { openedDaysAgo: number; dueInDays?: number; updatedDaysAgo?: number };
  /** Stages of the applicants to add; `pick` takes the best- or worst-matching candidates for the JD. */
  apps?: { stages: Stage[]; pick: 'best' | 'worst' | 'any' };
};

const PLANS: Plan[] = [
  {
    job: { id: 'job-8', jdId: 'jd-2026-002', title: 'Junior Frontend Developer', status: 'open', department: 'Engineering', location: 'Hanoi', level: 'Junior',
      workplace: 'onsite', headcount: 3, hiringPriority: 'normal', salaryMin: 15 * MIL, salaryMax: 25 * MIL, currency: 'VND', showSalary: true,
      hiringManager: 'u-thu', collaborators: ['u-huy'], campaignId: 'camp-1', minYears: 1, openedDaysAgo: 12, dueInDays: 50 },
    apps: { stages: ['new', 'screening', 'interview', 'interview', 'offer', 'hired'], pick: 'best' },
  },
  {
    job: { id: 'job-9', jdId: 'jd-2026-005', title: 'Backend Engineer (Node.js)', status: 'open', department: 'Engineering', location: 'Da Nang', level: 'Middle',
      workplace: 'hybrid', headcount: 2, hiringPriority: 'critical', urgencyReason: 'Payments launch in 3 weeks; two backend seats still empty.',
      salaryMin: 30 * MIL, salaryMax: 45 * MIL, currency: 'VND', showSalary: true, hiringManager: 'u-nam', collaborators: ['u-linh', 'u-tien'],
      minYears: 3, openedDaysAgo: 40, dueInDays: -3 },
    apps: { stages: ['new', 'new', 'ai_screening', 'screening', 'interview', 'interview', 'final_interview', 'rejected'], pick: 'any' },
  },
  {
    job: { id: 'job-10', jdId: 'jd-2026-003', title: 'Engineering Manager', status: 'on_hold', department: 'Engineering', location: 'Ho Chi Minh City', level: 'Manager',
      workplace: 'hybrid', headcount: 1, hiringPriority: 'high', urgencyReason: 'Paused until the Q1 budget is signed off.',
      salaryMin: 4000, salaryMax: 6000, currency: 'USD', showSalary: false, hiringManager: 'u-nam', collaborators: ['u-huy'],
      openedDaysAgo: 55, dueInDays: 30, updatedDaysAgo: 6 },
    apps: { stages: ['screening', 'interview', 'rejected'], pick: 'any' },
  },
  {
    job: { id: 'job-11', jdId: 'jd-2026-004', title: 'Content Marketing Specialist', status: 'draft', department: 'Marketing', location: 'Ho Chi Minh City', level: 'Middle',
      workplace: 'onsite', headcount: 1, hiringPriority: 'normal', hiringManager: 'u-thu', collaborators: ['u-chau'],
      openedDaysAgo: 2, dueInDays: 75, updatedDaysAgo: 0 },
  },
  {
    job: { id: 'job-12', jdId: 'jd-2026-001', title: 'Flutter Developer Intern', status: 'draft', department: 'Engineering', location: 'Hanoi', level: 'Intern',
      workplace: 'onsite', headcount: 4, hiringPriority: 'normal', salaryMin: 5 * MIL, salaryMax: 7 * MIL, currency: 'VND', showSalary: true,
      hiringManager: 'u-thu', collaborators: ['u-linh'], campaignId: 'camp-4', openedDaysAgo: 8, dueInDays: 90, updatedDaysAgo: 1,
      approval: { requestedBy: 'u-linh', requestedAt: '', decidedBy: 'u-nam', decidedAt: '', rejectedReason: 'Allowance is below the intern policy; raise it to at least 6M VND.' } },
  },
  {
    job: { id: 'job-13', jdId: 'jd-2026-004', title: 'Performance Marketing Executive', status: 'open', department: 'Marketing', location: 'Ho Chi Minh City', level: 'Junior',
      workplace: 'onsite', headcount: 1, hiringPriority: 'normal', salaryMin: 14 * MIL, salaryMax: 20 * MIL, currency: 'VND', showSalary: false,
      hiringManager: 'u-thu', collaborators: ['u-chau'], openedDaysAgo: 45, dueInDays: 20 },
    apps: { stages: ['screening', 'rejected'], pick: 'any' },
  },
  {
    job: { id: 'job-14', jdId: 'jd-2026-001', title: 'Senior Mobile Engineer (Flutter)', status: 'open', department: 'Engineering', location: 'Remote', level: 'Senior',
      workplace: 'remote', headcount: 1, hiringPriority: 'urgent', urgencyReason: 'Replacing the mobile lead who leaves next month.',
      salaryMin: 2500, salaryMax: 3500, currency: 'USD', showSalary: true, hiringManager: 'u-nam', collaborators: ['u-linh'],
      campaignId: 'camp-2', minYears: 5, openedDaysAgo: 18, dueInDays: 10 },
    apps: { stages: ['new', 'ai_screening', 'screening', 'rejected'], pick: 'worst' },
  },
  {
    job: { id: 'job-15', jdId: 'jd-2026-003', title: 'Solution Architect', status: 'closed', department: 'Engineering', location: 'Hanoi', level: 'Lead',
      workplace: 'onsite', headcount: 1, hiringPriority: 'high', salaryMin: 60 * MIL, salaryMax: 90 * MIL, currency: 'VND', showSalary: false,
      hiringManager: 'u-nam', collaborators: ['u-huy'], openedDaysAgo: 120, dueInDays: -30, updatedDaysAgo: 25 },
    apps: { stages: ['hired', 'rejected', 'rejected', 'withdrawn'], pick: 'any' },
  },
  {
    job: { id: 'job-16', jdId: 'jd-2026-002', title: 'Frontend Team Lead', status: 'pending_approval', department: 'Engineering', location: 'Ho Chi Minh City', level: 'Lead',
      workplace: 'hybrid', headcount: 1, hiringPriority: 'high', salaryMin: 55 * MIL, salaryMax: 75 * MIL, currency: 'VND', showSalary: true,
      hiringManager: 'u-thu', collaborators: ['u-huy', 'u-hoa'], campaignId: 'camp-1', openedDaysAgo: 3, dueInDays: 60, updatedDaysAgo: 3,
      approval: { requestedBy: 'u-huy', requestedAt: '' } },
  },
  {
    job: { id: 'job-17', jdId: 'jd-2026-005', title: 'Backend Engineer – Payments', status: 'open', department: 'Engineering', location: 'Ho Chi Minh City', level: 'Senior',
      workplace: 'hybrid', headcount: 1, hiringPriority: 'normal', salaryMin: 40 * MIL, salaryMax: 60 * MIL, currency: 'VND', showSalary: true,
      hiringManager: 'u-nam', collaborators: ['u-tien'], minYears: 4, openedDaysAgo: 1, dueInDays: 60 },
  },
];

export const DEMO_JOB_IDS = new Set(PLANS.map((p) => p.job.id));

/** The seed without the demo jobs, for tests written against the 7 core jobs (all on the list's first page). */
export const withoutDemoJobs = (s: DemoState): DemoState => ({
  ...s,
  jobs: s.jobs.filter((j) => !DEMO_JOB_IDS.has(j.id)),
  applications: s.applications.filter((a) => !DEMO_JOB_IDS.has(a.jobId)),
});

const STAFF = ['u-huy', 'u-linh', 'u-tien', 'u-chau'];

/**
 * Applicants for open seeded jobs that would otherwise show an empty bar (the showcase job and the newest demo job).
 * Draft / pending / closed jobs stay empty: candidates can only be added to open jobs.
 */
const EXTRA_APPS: Record<string, NonNullable<Plan['apps']>> = {
  'job-7': { stages: ['new', 'new', 'ai_screening', 'screening', 'interview', 'rejected'], pick: 'best' },
  'job-17': { stages: ['new', 'new', 'ai_screening'], pick: 'any' },
};

/** `records` adds the interview / offer records the seed gives every application at those stages. */
export function withDemoJobs(s: DemoState, now: number, records: (apps: Application[]) => Application[] = (a) => a): DemoState {
  const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
  const jobs: Job[] = [];
  const apps: Application[] = [];
  const activities: Activity[] = [];
  const used = new Set<string>();
  let n = 0;

  for (const { job: { openedDaysAgo, dueInDays, updatedDaysAgo, ...j } } of PLANS) {
    const jd = s.jds.find((x) => x.id === j.jdId)!;
    const job: Job = {
      ...jobPostFromJd(jd),
      ...j,
      employment: 'Full-time',
      stageSla: SLA,
      openedAt: daysAgo(openedDaysAgo),
      ...(dueInDays !== undefined ? { targetHiringDate: daysAgo(-dueInDays).slice(0, 10) } : {}),
      ...(updatedDaysAgo !== undefined ? { updatedAt: daysAgo(updatedDaysAgo) } : {}),
      ...(j.approval ? { approval: { ...j.approval, requestedAt: daysAgo(openedDaysAgo), ...(j.approval.decidedBy ? { decidedAt: daysAgo(1) } : {}) } } : {}),
    };
    jobs.push(job);
  }

  // New jobs first, then the extras, so the candidates each job gets stay the same as more plans are added.
  const planned = [
    ...PLANS.flatMap((p) => (p.apps ? [[jobs.find((j) => j.id === p.job.id)!, p.apps] as const] : [])),
    ...Object.entries(EXTRA_APPS).map(([id, plan]) => [[...s.jobs, ...jobs].find((j) => j.id === id)!, plan] as const),
  ];
  for (const [job, plan] of planned) {
    const openedDaysAgo = Math.max(0, Math.floor((now - Date.parse(job.openedAt)) / 86_400_000));

    // Score every candidate against the JD so the "best"/"worst" picks really are high or low matches.
    const req = requirementsForJob(job, s.jds, s.taxonomy);
    const ranked = s.candidates
      .filter((c) => !used.has(c.id))
      .map((c) => ({ c, e: evaluateApplication(c, req, daysAgo(1), '') }))
      .sort((a, b) => (plan.pick === 'worst' ? a.e.score - b.e.score : b.e.score - a.e.score));
    const chosen = plan.pick === 'any' ? ranked.filter((_, i) => i % 7 === 3) : ranked;

    plan.stages.forEach((stage, i) => {
      const { c } = chosen[i];
      used.add(c.id);
      n += 1;
      const id = `app-demo-${String(n).padStart(2, '0')}`;
      const by = STAFF[n % STAFF.length];
      // Recent applicants first; later stages entered the pipeline earlier. Each reached its stage half a day ago, inside every SLA.
      const added = Math.min(openedDaysAgo, 1 + i * 2);
      const entered = Math.min(added, 0.5);
      const history = stage === 'new'
        ? [{ stage, at: daysAgo(added), by }]
        : [{ stage: 'new' as Stage, at: daysAgo(added), by }, { stage, at: daysAgo(entered), by }];
      apps.push({
        id, candidateId: c.id, jobId: job.id, stage, source: 'Careers page', via: 'careers',
        addedBy: by, addedAt: history[0].at, stageEnteredAt: history[history.length - 1].at, history,
        ratings: [], comments: [],
        ...(stage === 'rejected' ? { rejectedReason: 'Not a fit for this role', rejectedCode: 'skills' as const } : {}),
        aiEvaluations: [evaluateApplication(c, req, daysAgo(entered), `ai-${id}`)],
      });
      activities.push({ type: 'added_to_pipeline', candidateId: c.id, applicationId: id, jobId: job.id, by, at: history[0].at, detail: `Added to ${job.title}` });
    });
  }

  return {
    ...s,
    jobs: [...s.jobs, ...jobs],
    applications: [...s.applications, ...records(apps)],
    activities: [...s.activities, ...activities].sort((a, b) => a.at.localeCompare(b.at)),
  };
}
