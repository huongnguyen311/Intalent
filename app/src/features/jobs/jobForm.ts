import { normalizeRole } from '../../domain/permissions';
import type { Job, User } from '../../domain/types';
import { assignableUsers } from '../../domain/users';

/** The Create / Edit Job wizard steps, in order. */
export const JOB_STEPS = ['details', 'requirements', 'team', 'publish'] as const;
export type JobStep = 0 | 1 | 2 | 3;

export type JobFormErrorKey = 'jd' | 'title' | 'targetDate' | 'salary' | 'recruiters';
export type JobFormErrors = Partial<Record<JobFormErrorKey, string>>;
/** Which step shows each error. */
export const ERROR_STEP: Record<JobFormErrorKey, JobStep> = { jd: 0, title: 0, targetDate: 0, salary: 2, recruiters: 2 };
/** DOM id to focus for each error. */
export const ERROR_FIELD: Record<JobFormErrorKey, string> = { jd: 'job-jd', title: 'job-title', targetDate: 'job-target-date', salary: 'job-salary-min', recruiters: 'job-recruiters' };

/** Errors as i18n keys; `requireRecruiter` is true on Create / Duplicate only. */
export function validateJobForm(
  f: { jd: string; title: string; targetHiringDate?: string; salaryMin?: number; salaryMax?: number; recruiters: string[] },
  requireRecruiter: boolean,
): JobFormErrors {
  const errs: JobFormErrors = {};
  if (!f.jd) errs.jd = 'jobs.drawer.err.jd';
  if (!f.title.trim()) errs.title = 'jobs.drawer.err.title';
  // Optional on the type (older jobs have none) but required whenever the form saves.
  if (f.targetHiringDate !== undefined && !f.targetHiringDate) errs.targetDate = 'jobs.drawer.err.targetDate';
  if (f.salaryMin && f.salaryMax && f.salaryMin > f.salaryMax) errs.salary = 'jobs.drawer.err.salary';
  if (requireRecruiter && f.recruiters.length === 0) errs.recruiters = 'jobs.drawer.err.recruiters';
  return errs;
}

/** Earliest step holding an error, or undefined when the form is valid. */
export function firstErrorStep(errs: JobFormErrors): JobStep | undefined {
  const steps = (Object.keys(errs) as JobFormErrorKey[]).map((k) => ERROR_STEP[k]);
  return steps.length ? (Math.min(...steps) as JobStep) : undefined;
}

const RECRUITER_ROLES = ['Super Admin', 'Recruitment Lead', 'Recruiter'];
export const isRecruiterRole = (role: string): boolean => RECRUITER_ROLES.includes(normalizeRole(role));

/**
 * Users offered as Recruiter(s): active recruiter roles, plus anyone already on the job whatever their role or
 * status — so a recruiter who has since left still shows (ticked) and can be swapped out instead of counting unseen.
 */
export const recruiterOptions = (users: User[], selected: string[]): User[] => {
  const active = new Set(assignableUsers(users).map((u) => u.id));
  return users.filter((u) => selected.includes(u.id) || (active.has(u.id) && isRecruiterRole(u.role)));
};

export const DEFAULT_SLA: Job['stageSla'] = { new: 2, ai_screening: 1, screening: 5, interview: 7, assessment: 5, final_interview: 5, offer: 5 };
export const LEVELS = ['Junior', 'Middle', 'Senior', 'Lead'];
export const EMPLOYMENTS = ['Full-time', 'Part-time', 'Contract', 'Internship'];

/** Best-effort level from a JD title ("Senior Frontend Developer" -> Senior); empty when none is mentioned. */
export function inferLevel(title: string): string {
  const t = title.toLowerCase();
  if (/\b(lead|principal|head)\b/.test(t)) return 'Lead';
  if (/\b(senior|sr)\b/.test(t)) return 'Senior';
  if (/\b(junior|jr|fresher|intern)\b/.test(t)) return 'Junior';
  if (/\b(middle|mid|intermediate)\b/.test(t)) return 'Middle';
  return '';
}

export const daysOpen = (job: Job, now = Date.now()): number =>
  Math.max(0, Math.floor((now - new Date(job.openedAt).getTime()) / 86_400_000));

/** "5h ago" pieces for the Last Updated column; the caller translates `jobs.ago.<unit>`. */
export function ago(iso: string, now = Date.now()): { unit: 'now' | 'm' | 'h' | 'd' | 'mo'; n: number } {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return { unit: 'now', n: 0 };
  if (min < 60) return { unit: 'm', n: min };
  if (min < 1440) return { unit: 'h', n: Math.floor(min / 60) };
  const d = Math.floor(min / 1440);
  return d < 30 ? { unit: 'd', n: d } : { unit: 'mo', n: Math.floor(d / 30) };
}

/** URL of the job editor page: `/jobs/new[?fromJd=]`, `/jobs/:id/edit`, `/jobs/:id/duplicate`. */
export function editorPath(mode: 'create' | 'edit' | 'duplicate', id?: string, fromJd?: string): string {
  if (mode === 'create') return fromJd ? `/jobs/new?fromJd=${encodeURIComponent(fromJd)}` : '/jobs/new';
  return `/jobs/${id}/${mode}`;
}
