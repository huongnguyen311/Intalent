import { FORWARD_STAGES, isClosedOut } from './stages';
import type { Application, Job, Stage, User } from './types';

/** Roles from most to least access. "Admin" / "User" in older data map to Recruitment Lead / Recruiter. */
export const ROLES = ['Super Admin', 'Recruitment Lead', 'Recruiter', 'Hiring Manager', 'Interviewer', 'Candidate'] as const;
export type Role = (typeof ROLES)[number];

const LEGACY: Record<string, Role> = { Admin: 'Recruitment Lead', User: 'Recruiter' };

export function normalizeRole(role: string): Role {
  return (ROLES as readonly string[]).includes(role) ? (role as Role) : (LEGACY[role] ?? 'Recruiter');
}

export type Perm =
  | 'config' // System config, taxonomy, user management
  | 'reports' // Dashboard and CV-by-TA reports, CV owner transfer
  | 'jd.edit'
  | 'job.edit' // Create, edit, publish and close jobs
  | 'job.approve' // Approve or send back jobs waiting for approval (publishing skips the approval step)
  | 'campaign'
  | 'pool' // Talent Pool: list, upload, AI search, notes, JD matching
  | 'pii' // Candidate email and phone
  | 'pipeline' // See pipelines of the jobs in scope
  | 'pipeline.move' // Any stage move (Hiring Managers get a narrower rule, see canMoveTo)
  | 'interview.schedule'
  | 'email.send'
  | 'review' // Star ratings and comments
  | 'scorecard'
  | 'offer.view'
  | 'offer.manage'
  | 'handoff'
  | 'privacy' // Anonymize candidates, read the audit log

const STAFF_REVIEW: Perm[] = ['review', 'scorecard'];
const RECRUITER: Perm[] = [
  'jd.edit', 'job.edit', 'campaign', 'pool', 'pii', 'pipeline', 'pipeline.move', 'interview.schedule',
  'email.send', ...STAFF_REVIEW, 'offer.view', 'offer.manage', 'handoff',
];

export const PERMISSIONS: Record<Role, readonly Perm[]> = {
  'Super Admin': ['config', 'reports', 'privacy', 'job.approve', ...RECRUITER],
  'Recruitment Lead': ['reports', 'privacy', 'job.approve', ...RECRUITER],
  Recruiter: RECRUITER,
  'Hiring Manager': ['pipeline', 'pipeline.move', ...STAFF_REVIEW, 'offer.view'],
  Interviewer: STAFF_REVIEW,
  Candidate: [],
};

export function can(user: Pick<User, 'role'> | undefined, perm: Perm): boolean {
  // Signed-out visitors of a tenant workspace (session GUEST) have no permissions.
  if (!user || user.role === 'Guest') return false;
  return PERMISSIONS[normalizeRole(user.role)].includes(perm);
}

/** Super Admin / Recruitment Lead see every job (and can compare recruiters); everyone else only their own. */
export function seesAllJobs(user: User | undefined): boolean {
  const role = user && normalizeRole(user.role);
  return role === 'Super Admin' || role === 'Recruitment Lead';
}

/** Jobs a user works on: all for Super Admin / Lead; own or collaborating jobs for Recruiters; own jobs for Hiring Managers. */
export function jobsInScope(user: User | undefined, jobs: Job[]): Job[] {
  if (!user) return [];
  const role = normalizeRole(user.role);
  if (seesAllJobs(user)) return jobs;
  if (role === 'Recruiter') return jobs.filter((j) => j.hiringManager === user.id || j.collaborators?.includes(user.id));
  if (role === 'Hiring Manager') return jobs.filter((j) => j.hiringManager === user.id);
  return [];
}

/**
 * Whether a user may open a candidate's profile: anyone with Talent Pool access; Hiring Managers for candidates in
 * their jobs; Interviewers for candidates they interview.
 */
export function candidateInScope(user: User | undefined, candidateId: string, apps: Application[], jobs: Job[]): boolean {
  if (!user) return false;
  if (can(user, 'pool')) return true;
  const mine = apps.filter((a) => a.candidateId === candidateId);
  if (normalizeRole(user.role) === 'Interviewer') return mine.some((a) => a.interviews?.some((i) => i.interviewers.includes(user.id)));
  const scoped = new Set(jobsInScope(user, jobs).map((j) => j.id));
  return mine.some((a) => scoped.has(a.jobId));
}

const FORWARD: Stage[] = FORWARD_STAGES;

/**
 * Whether the user may move an application to `to`. Hiring Managers only decide: one step forward or Rejected
 * (never into Hired, which follows an accepted offer). `order` is the job's own columns: "one step forward" means
 * the next column that job actually runs, so a stage the job skips never blocks the Hiring Manager.
 */
export function canMoveTo(user: User | undefined, app: Pick<Application, 'stage'>, to: Stage, order?: Stage[]): boolean {
  if (!can(user, 'pipeline.move')) return false;
  if (normalizeRole(user!.role) !== 'Hiring Manager') return true;
  if (to === 'rejected') return !isClosedOut(app.stage);
  if (to === 'withdrawn') return false;
  const forward = order ? order.filter((s) => FORWARD.includes(s)) : FORWARD;
  const i = forward.indexOf(app.stage);
  return i >= 0 && forward[i + 1] === to && to !== 'hired';
}

/** Where a role lands after signing in. */
export function homeFor(user: User | undefined): string {
  const role = user ? normalizeRole(user.role) : 'Recruiter';
  if (role === 'Candidate') return '/me';
  if (role === 'Interviewer') return '/my-interviews';
  if (role === 'Hiring Manager') return '/jobs';
  return '/';
}
