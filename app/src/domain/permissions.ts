import { FORWARD_STAGES, isClosedOut } from './stages';
import type { Activity, Application, Campaign, Candidate, Jd, Job, Stage, User } from './types';

/** Roles from most to least access. "Admin" / "User" in older data map to Recruitment Lead / Recruiter. */
export const ROLES = ['Super Admin', 'Recruitment Lead', 'Recruiter', 'Hiring Manager', 'Interviewer', 'Candidate'] as const;
export type Role = (typeof ROLES)[number];

const LEGACY: Record<string, Role> = { Admin: 'Recruitment Lead', User: 'Recruiter' };

/** The role a stored string stands for; undefined for anything unknown (a typo, a bad import, the signed-out Guest). */
export function roleOf(role: string | undefined): Role | undefined {
  if (!role) return undefined;
  return (ROLES as readonly string[]).includes(role) ? (role as Role) : LEGACY[role];
}

/** Role for display and grouping. Unknown strings show as Recruiter, but they get no permissions (see roleOf). */
export function normalizeRole(role: string): Role {
  return roleOf(role) ?? 'Recruiter';
}

export type Perm =
  | 'config' // System config, company settings
  | 'users.manage' // User management; Recruitment Leads only for the roles below them (see manageableRoles)
  | 'taxonomy'
  | 'reports' // Dashboard and CV-by-TA reports, CV owner transfer
  | 'jd.edit'
  | 'job.edit' // Create, edit, publish and close jobs
  | 'job.approve' // Approve or send back jobs waiting for approval (publishing skips the approval step)
  | 'campaign'
  | 'pool' // Talent Pool: list, upload, AI search, notes, JD matching
  | 'pii' // Candidate email and phone (outside the user's own jobs revealed one at a time, see contactAccess)
  | 'pii.export' // CSV export with email and phone
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
  'Super Admin': ['config', 'users.manage', 'taxonomy', 'reports', 'privacy', 'job.approve', 'pii.export', ...RECRUITER],
  'Recruitment Lead': ['users.manage', 'taxonomy', 'reports', 'privacy', 'job.approve', 'pii.export', ...RECRUITER],
  Recruiter: RECRUITER,
  'Hiring Manager': ['pipeline', 'pipeline.move', ...STAFF_REVIEW, 'offer.view'],
  Interviewer: STAFF_REVIEW,
  Candidate: [],
};

export function can(user: Pick<User, 'role'> | undefined, perm: Perm): boolean {
  // Signed-out visitors of a tenant workspace (session GUEST) have no permissions.
  // Unknown role strings get nothing (fail closed) instead of falling back to Recruiter.
  const role = roleOf(user?.role);
  return !!role && PERMISSIONS[role].includes(perm);
}

/** Roles a user may invite, switch people to and from, and deactivate: everything for Super Admin, the hiring team for Leads. */
export function manageableRoles(user: Pick<User, 'role'> | undefined): readonly Role[] {
  const role = roleOf(user?.role);
  if (role === 'Super Admin') return ROLES;
  if (role === 'Recruitment Lead') return ['Recruiter', 'Hiring Manager', 'Interviewer'];
  return [];
}

/** Whether `actor` may edit, re-role or deactivate `target` (never someone at or above a Lead's own level). */
export function canManageUser(actor: Pick<User, 'role'> | undefined, target: Pick<User, 'role'>): boolean {
  const role = roleOf(target.role) ?? normalizeRole(target.role);
  return can(actor, 'users.manage') && manageableRoles(actor).includes(role);
}

/** Active Super Admins; the last one can never be demoted or deactivated, so a workspace always keeps an admin. */
export const activeSuperAdmins = (users: User[]): User[] => users.filter((u) => u.status === 'Active' && roleOf(u.role) === 'Super Admin');

/** Super Admin / Recruitment Lead see every job (and can compare recruiters); everyone else only their own. */
export function seesAllJobs(user: User | undefined): boolean {
  const role = roleOf(user?.role);
  return role === 'Super Admin' || role === 'Recruitment Lead';
}

/** Jobs a user works on: all for Super Admin / Lead; own or collaborating jobs for Recruiters; own jobs for Hiring Managers. */
export function jobsInScope(user: User | undefined, jobs: Job[]): Job[] {
  const role = roleOf(user?.role);
  if (!user || !role) return [];
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
  if (roleOf(user.role) === 'Interviewer') return mine.some((a) => a.interviews?.some((i) => i.interviewers.includes(user.id)));
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
  if (roleOf(user!.role) !== 'Hiring Manager') return true;
  if (to === 'rejected') return !isClosedOut(app.stage);
  if (to === 'withdrawn') return false;
  const forward = order ? order.filter((s) => FORWARD.includes(s)) : FORWARD;
  const i = forward.indexOf(app.stage);
  return i >= 0 && forward[i + 1] === to && to !== 'hired';
}

/**
 * JDs are a shared library: everyone with JD access reads them, but only Super Admin / Lead, the JD's author, or a
 * recruiter whose own job uses it may change or delete one (editing it changes other people's jobs too).
 */
export function canEditJd(user: User | undefined, jd: Pick<Jd, 'id' | 'createdBy'>, jobs: Job[]): boolean {
  if (!user || !can(user, 'jd.edit')) return false;
  if (seesAllJobs(user) || jd.createdBy === user.id) return true;
  return jobsInScope(user, jobs).some((j) => j.jdId === jd.id);
}

/** Campaigns: everyone with campaign access reads them; the owner and Super Admin / Lead change them. */
export function canEditCampaign(user: User | undefined, campaign: Pick<Campaign, 'owner'>): boolean {
  if (!user || !can(user, 'campaign')) return false;
  return seesAllJobs(user) || campaign.owner === user.id;
}

/**
 * Contact data (email, phone, original CV file) for one candidate:
 * - 'full': Super Admin / Lead, CVs the user owns, candidates in the user's own jobs, or ones already revealed (logged);
 * - 'reveal': the rest of the Talent Pool for Recruiters, shown after a logged "show contact";
 * - 'none': roles without contact-data permission.
 */
export type ContactAccess = 'full' | 'reveal' | 'none';

export function contactAccess(
  user: User | undefined, candidate: Pick<Candidate, 'id' | 'cvOwner'>, apps: Application[], jobs: Job[], activities: Activity[],
): ContactAccess {
  if (!user || !can(user, 'pii')) return 'none';
  if (seesAllJobs(user) || candidate.cvOwner === user.id) return 'full';
  const candidateId = candidate.id;
  const scoped = new Set(jobsInScope(user, jobs).map((j) => j.id));
  if (apps.some((a) => a.candidateId === candidateId && scoped.has(a.jobId))) return 'full';
  if (activities.some((a) => a.type === 'pii_revealed' && a.candidateId === candidateId && a.by === user.id)) return 'full';
  return 'reveal';
}

/** Where a role lands after signing in. */
export function homeFor(user: User | undefined): string {
  const role = roleOf(user?.role);
  if (role === 'Candidate') return '/me';
  if (role === 'Interviewer') return '/my-interviews';
  if (role === 'Hiring Manager') return '/jobs';
  return '/';
}
