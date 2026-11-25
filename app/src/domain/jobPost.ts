import { jdMustHave } from './jdExtract';
import type { Jd, Job } from './types';

/** The careers-page sections a job carries its own copy of, in page order. */
export const JOB_POST_KEYS = ['summary', 'responsibilities', 'skills', 'mustHave', 'niceToHave', 'aboutTeam'] as const;

export type JobPost = {
  summary: string;
  responsibilities: string[];
  skills: string[];
  mustHave: string[];
  niceToHave: string[];
  aboutTeam: string;
};

const EMPTY: JobPost = { summary: '', responsibilities: [], skills: [], mustHave: [], niceToHave: [], aboutTeam: '' };

const clean = (xs?: string[]) => [...new Set((xs ?? []).map((x) => x.trim()).filter(Boolean))];

/** What a job's post starts from when this JD is picked; older JDs keep daily tasks apart, so they join the duties. */
export function jobPostFromJd(jd: Jd): JobPost {
  return {
    summary: jd.summary?.trim() ?? '',
    responsibilities: clean([...(jd.responsibilities ?? []), ...(jd.dailyTasks ?? [])]),
    skills: clean(jd.skills),
    mustHave: clean(jdMustHave(jd)),
    niceToHave: clean(jd.niceToHave),
    aboutTeam: jd.aboutTeam?.trim() ?? '',
  };
}

/**
 * What the careers page shows: each section from the job's copy. Only a section the job never had (a job saved before
 * jobs carried a copy) falls back to its JD; a section HR cleared stays empty.
 */
export function jobPostOf(job: Job, jd?: Jd): JobPost {
  const fromJd = jd ? jobPostFromJd(jd) : EMPTY;
  const text = (v: string | undefined, fallback: string) => (v === undefined ? fallback : v.trim());
  const list = (v: string[] | undefined, fallback: string[]) => (v === undefined ? fallback : clean(v));
  return {
    summary: text(job.summary, fromJd.summary),
    responsibilities: list(job.responsibilities, fromJd.responsibilities),
    skills: list(job.skills, fromJd.skills),
    mustHave: list(job.mustHave, fromJd.mustHave),
    niceToHave: list(job.niceToHave, fromJd.niceToHave),
    aboutTeam: text(job.aboutTeam, fromJd.aboutTeam),
  };
}
