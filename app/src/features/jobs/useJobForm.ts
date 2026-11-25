import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '../../components/Toast';
import { CONTENT_TEMPLATE } from '../../domain/jdWriter';
import { JOB_POST_KEYS, jobPostFromJd, type JobPost } from '../../domain/jobPost';
import { can, seesAllJobs } from '../../domain/permissions';
import { todayIso } from '../../domain/jobUrgency';
import type { Currency, Education, HiringPriority, Job, JobQuestion, Workplace } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { me, useMe } from '../../store/session';
import { useStore } from '../../store/store';
import {
  DEFAULT_SLA, EMPLOYMENTS, ERROR_FIELD, ERROR_STEP, firstErrorStep, inferLevel, isRecruiterRole, validateJobForm,
  type JobFormErrorKey, type JobFormErrors, type JobStep,
} from './jobForm';

export type JobFormMode = 'create' | 'edit' | 'duplicate';

/** Everything the wizard's inputs hold, as typed (numbers stay strings until saved). */
export type JobFormValues = {
  jd: string; title: string; department: string; location: string; level: string; employment: string;
  workplace: Workplace; headcount: string; manager: string; publish: boolean;
  salaryMin: string; salaryMax: string; currency: Currency; showSalary: boolean;
  /** Recruiter(s), stored in `job.collaborators`. */
  collaborators: string[]; interviewers: string[]; questions: JobQuestion[];
  whyLove: string; additionalInfo: string; minYears: string; education: Education | '';
  hiringPriority: HiringPriority; targetHiringDate: string; urgencyReason: string; priorityNotes: string;
  /** '' = no campaign. */
  campaignId: string;
  /** Careers-page copy, filled from the JD; list sections hold one item per line. */
  summary: string; responsibilities: string; skills: string[]; mustHave: string; niceToHave: string; aboutTeam: string;
};

type PostValues = Pick<JobFormValues, 'summary' | 'responsibilities' | 'skills' | 'mustHave' | 'niceToHave' | 'aboutTeam'>;
const postValues = (p: Partial<JobPost>): PostValues => ({
  summary: p.summary ?? '', responsibilities: (p.responsibilities ?? []).join('\n'), skills: p.skills ?? [],
  mustHave: (p.mustHave ?? []).join('\n'), niceToHave: (p.niceToHave ?? []).join('\n'), aboutTeam: p.aboutTeam ?? '',
});
const isEmptyValue = (x: string | string[]) => (Array.isArray(x) ? x.length === 0 : !x.trim());
/** One item per line; a bullet typed at the start ("- ", "• ", "1. ") is dropped, since the careers page adds its own. */
const lines = (s: string) => s.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*•–·]|\d+[.)])\s+/, '').trim()).filter(Boolean);
const sameValue = (a: string | string[], b: string | string[]) => JSON.stringify(a) === JSON.stringify(b);

type Setters = { [K in keyof JobFormValues]: (v: JobFormValues[K]) => void };

const blank = (): JobFormValues => ({
  jd: '', title: '', department: '', location: '', level: '', employment: EMPLOYMENTS[0], workplace: 'onsite', headcount: '1',
  manager: me(), publish: false, salaryMin: '', salaryMax: '', currency: 'VND', showSalary: false,
  collaborators: [], interviewers: [], questions: [], whyLove: '', additionalInfo: '', minYears: '', education: '',
  hiringPriority: 'normal', targetHiringDate: todayIso(new Date(Date.now() + 60 * 86_400_000)), urgencyReason: '', priorityNotes: '',
  campaignId: '',
  ...postValues({}),
});

const template = (id: string) => useStore.getState().prompts.find((p) => p.id === id)?.text ?? '';
const num = (v: string) => Number(v.replace(/[^\d]/g, '')) || undefined;

type Opts = {
  /** Resets the form each time this turns true (the pop-up opening, or the page mounting). */
  open: boolean;
  mode: JobFormMode;
  /** The job being edited, or the source of a duplicate. */
  job?: Job;
  /** JD picked on open (create from a JD, or one just created via "+ Create a new JD"). */
  jdId?: string;
  onSaved: (job: Job) => void;
};

/** State, validation and saving of the Create / Edit / Duplicate Job wizard, shared by every layout. */
export function useJobForm({ open, mode, job: source, jdId, onSaved }: Opts) {
  const t = useT();
  const user = useMe();
  const canApprove = can(user, 'job.approve');
  const editing = mode === 'edit';
  const job = editing ? source : undefined;
  const copyFrom = mode === 'duplicate' ? source : undefined;
  const [values, setValues] = useState<JobFormValues>(blank);
  const [step, setStep] = useState<JobStep>(0);
  /** Furthest step reached; on create the stepper only jumps back to steps already seen. */
  const [visited, setVisited] = useState<JobStep>(0);
  const [errors, setErrors] = useState<JobFormErrors>({});
  /** Any edit since the form was (re)filled, including ones that fire no DOM change event. */
  const [touched, setTouched] = useState(false);
  const touch = () => setTouched(true);
  /** Title the last picked JD filled in, so picking another JD only replaces a title the user did not type. */
  const jdTitle = useRef('');
  /** Post sections as the last picked JD filled them, so picking another JD only replaces sections the user left alone. */
  const jdPost = useRef<PostValues | null>(null);

  const patch = (p: Partial<JobFormValues> | ((v: JobFormValues) => Partial<JobFormValues>)) =>
    setValues((v) => ({ ...v, ...(typeof p === 'function' ? p(v) : p) }));
  const clearError = (...ks: JobFormErrorKey[]) =>
    setErrors((e) => (ks.some((k) => e[k]) ? { ...e, ...Object.fromEntries(ks.map((k) => [k, undefined])) } : e));

  /** Field setters; each counts as an edit and clears the error it could fix. */
  const set = useMemo(() => {
    const clears: Partial<Record<keyof JobFormValues, JobFormErrorKey>> = { title: 'title', targetHiringDate: 'targetDate', salaryMin: 'salary', salaryMax: 'salary', collaborators: 'recruiters' };
    return Object.fromEntries(
      (Object.keys(blank()) as (keyof JobFormValues)[]).map((k) => [k, (v: unknown) => {
        patch({ [k]: v } as Partial<JobFormValues>);
        setTouched(true);
        const c = clears[k];
        if (c) clearError(c);
      }]),
    ) as Setters;
  }, []);

  const applyJd = (id: string) => {
    patch({ jd: id });
    // Read the store directly: a JD created a moment ago is not in this render's `jds` yet.
    const picked = useStore.getState().jds.find((j) => j.id === id);
    if (!picked) return;
    // Only replace a title the user has not typed themselves (blank, or the previous JD's title).
    const prev = jdTitle.current;
    patch((v) => ({ title: !v.title.trim() || v.title === prev ? picked.title : v.title, level: v.level || inferLevel(picked.title) }));
    jdTitle.current = picked.title;
    // Like the title: a post section is replaced when empty or still as the previous JD filled it; anything HR typed stays.
    // Load from JD replaces them all.
    const fromJd = postValues(jobPostFromJd(picked));
    const prevPost = jdPost.current;
    patch((v) => Object.fromEntries(
      (Object.keys(fromJd) as (keyof PostValues)[])
        .filter((k) => isEmptyValue(v[k]) || (prevPost && sameValue(v[k], prevPost[k])))
        .map((k) => [k, fromJd[k]]),
    ) as Partial<JobFormValues>);
    jdPost.current = fromJd;
    clearError('jd', 'title');
  };
  const pickJd = (id: string) => { applyJd(id); touch(); };

  /** Loads a job or a duplicate source into the form (missing fields keep their blank defaults). */
  const fill = (src: Partial<Job>, publish = false) => {
    jdTitle.current = '';
    jdPost.current = null;
    // A job saved before jobs carried their own copy shows its JD's sections (what its careers page shows), so saving keeps them.
    const srcJd = src.jdId ? useStore.getState().jds.find((j) => j.id === src.jdId) : undefined;
    const post = src.jdId && JOB_POST_KEYS.every((k) => src[k] === undefined) && srcJd ? jobPostFromJd(srcJd) : src;
    setValues({
      ...blank(),
      jd: src.jdId ?? '', title: src.title ?? '', department: src.department ?? '', location: src.location ?? '',
      level: src.level ?? '', employment: src.employment ?? EMPLOYMENTS[0], manager: src.hiringManager ?? me(),
      workplace: src.workplace ?? 'onsite', headcount: String(src.headcount ?? 1),
      salaryMin: src.salaryMin ? String(src.salaryMin) : '', salaryMax: src.salaryMax ? String(src.salaryMax) : '',
      currency: src.currency ?? 'VND', showSalary: !!src.showSalary, publish,
      collaborators: src.collaborators ?? [], interviewers: src.interviewers ?? [],
      // Fresh ids so a duplicate's answers never collide with the source job's.
      questions: (src.questions ?? []).map((q) => (job ? q : { ...q, id: `q-${crypto.randomUUID().slice(0, 8)}` })),
      // New jobs start from the company's default perks; additional info is drafted on demand.
      whyLove: src.whyLove ?? (job ? '' : template(CONTENT_TEMPLATE.whyLove)), additionalInfo: src.additionalInfo ?? '',
      minYears: src.minYears ? String(src.minYears) : '', education: src.education ?? '',
      // A job saved before urgency existed gets the same 60-day default as a new one.
      hiringPriority: src.hiringPriority ?? 'normal', targetHiringDate: src.targetHiringDate?.slice(0, 10) || blank().targetHiringDate,
      urgencyReason: src.urgencyReason ?? '', priorityNotes: src.priorityNotes ?? '',
      campaignId: src.campaignId ?? '',
      ...postValues(post),
    });
  };

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setTouched(false);
    setStep(0);
    setVisited(job ? 3 : 0);
    if (job || copyFrom) {
      if (job) fill(job, job.status === 'open' || job.status === 'pending_approval');
      else if (copyFrom) fill({ ...copyFrom, title: `${copyFrom.title} ${t('jobs.drawer.copySuffix')}` });
      // A JD just created from this form: pick it, as an unsaved change (the title the user had stays).
      if (jdId) pickJd(jdId);
      return;
    }
    fill({});
    // Whoever recruits creates the job they will run.
    if (user && isRecruiterRole(user.role)) patch({ collaborators: [me()] });
    if (jdId) applyJd(jdId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, source?.id, jdId]);

  const v = values;
  // A Recruiter only sees jobs they manage or collaborate on: naming someone else as manager keeps them on as recruiter.
  const keepsMe = !seesAllJobs(user) && v.manager !== me();
  const recruiters = [...new Set([...v.collaborators, ...(keepsMe ? [me()] : [])])];
  const selected = useStore((s) => s.jds).find((j) => j.id === v.jd);
  const approvalFree = canApprove || job?.status === 'open' || job?.status === 'on_hold' || job?.status === 'closed';
  const rejected = job?.status === 'draft' ? job.approval?.rejectedReason : undefined;

  /** Everything the form holds except identity/status (and stage SLA, which lives in Pipeline). */
  const collect = () => {
    const lo = num(v.salaryMin);
    const hi = num(v.salaryMax);
    return {
      jdId: v.jd, title: v.title, department: v.department, location: v.location, level: v.level, employment: v.employment,
      workplace: v.workplace, headcount: Math.max(1, Math.floor(Number(v.headcount)) || 1), hiringManager: v.manager,
      salaryMin: lo, salaryMax: hi, currency: v.currency, showSalary: v.showSalary && !!(lo || hi),
      // A recruiter may also be the hiring manager, so the manager is not stripped out.
      collaborators: recruiters,
      interviewers: v.interviewers.length ? v.interviewers : undefined,
      questions: v.questions.filter((q) => q.label.trim()).map((q) => ({ ...q, label: q.label.trim() })),
      whyLove: v.whyLove.trim(), additionalInfo: v.additionalInfo.trim(),
      minYears: num(v.minYears), education: v.education || undefined,
      hiringPriority: v.hiringPriority, targetHiringDate: v.targetHiringDate,
      urgencyReason: v.urgencyReason.trim() || undefined, priorityNotes: v.priorityNotes.trim() || undefined,
      campaignId: v.campaignId || undefined,
      // Saved even when empty: a cleared section means "none on this job", not "use the JD's".
      summary: v.summary.trim(), responsibilities: lines(v.responsibilities),
      skills: v.skills.map((x) => x.trim()).filter(Boolean), mustHave: lines(v.mustHave),
      niceToHave: lines(v.niceToHave), aboutTeam: v.aboutTeam.trim(),
    };
  };

  /** Replaces every post section with the selected JD's current content. */
  const loadFromJd = () => {
    const picked = useStore.getState().jds.find((j) => j.id === v.jd);
    if (!picked) return;
    jdPost.current = postValues(jobPostFromJd(picked));
    patch(jdPost.current);
    touch();
  };
  const hasPostContent = (Object.keys(postValues({})) as (keyof PostValues)[]).some((k) => !isEmptyValue(v[k]));

  /** The status a save would give the job; `asDraft` (create only) saves without publishing. */
  const statusFor = (asDraft = false): Job['status'] => {
    const wantsPublish = v.publish && !asDraft;
    return wantsPublish
      ? (job?.status === 'open' || job?.status === 'pending_approval' ? job.status : approvalFree ? 'open' : 'pending_approval')
      : job?.status === 'open' || job?.status === 'pending_approval' ? 'draft' : (job?.status ?? 'draft');
  };

  const validate = () =>
    // Recruiter(s) are required on Create / Duplicate only: an old job missing one still saves (with a note on step 3).
    validateJobForm({ jd: v.jd, title: v.title, targetHiringDate: v.targetHiringDate, salaryMin: num(v.salaryMin), salaryMax: num(v.salaryMax), recruiters }, !editing);

  /** Shows `errs` and brings the first one into view (after the step it lives on has rendered). */
  const reveal = (errs: JobFormErrors) => {
    setErrors(errs);
    const key = (Object.keys(errs) as JobFormErrorKey[]).sort((a, b) => ERROR_STEP[a] - ERROR_STEP[b])[0];
    if (!key) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(ERROR_FIELD[key]);
      el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      el?.focus({ preventScroll: true });
    });
  };

  const goTo = (s: JobStep) => {
    setStep(s);
    setVisited((cur) => (s > cur ? s : cur));
  };

  const next = () => {
    const here = Object.fromEntries(Object.entries(validate()).filter(([k]) => ERROR_STEP[k as JobFormErrorKey] === step)) as JobFormErrors;
    if (Object.keys(here).length) return reveal(here);
    setErrors({});
    goTo((step + 1) as JobStep);
  };

  const back = () => goTo((step - 1) as JobStep);

  const save = (asDraft = false) => {
    const errs = validate();
    const first = firstErrorStep(errs);
    if (first !== undefined) {
      goTo(first);
      return reveal(errs);
    }
    const fields = collect();
    const status = statusFor(asDraft);
    const { createJob, updateJob, setJobStatus, requestJobApproval } = useStore.getState();
    if (job) {
      updateJob(job.id, fields);
      if (status === 'pending_approval' && job.status === 'draft') requestJobApproval(job.id);
      else if (status !== job.status) setJobStatus(job.id, status);
      toast(t('jobs.toast.saved'));
      onSaved({ ...job, ...fields, status });
    } else {
      // A duplicate keeps the source's stage SLA; a blank job starts from the defaults (edited later in Pipeline).
      const created = createJob({ ...fields, stageSla: copyFrom?.stageSla ?? DEFAULT_SLA, status });
      // A draft is not on the careers site yet: say what publishes it.
      toast(t(status === 'draft' ? 'jobs.toast.createdDraft' : 'jobs.toast.created', { title: created.title }));
      onSaved(created);
    }
  };

  /** The form as the job it would save, for the live careers preview. */
  const draftJob = (): Job => ({
    ...collect(),
    id: job?.id ?? 'draft',
    status: statusFor(),
    openedAt: job?.openedAt ?? new Date().toISOString(),
    stageSla: (job ?? copyFrom)?.stageSla ?? DEFAULT_SLA,
  });

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return {
    mode, job, editing, step, visited, errors, touched, touch, values: v, set, pickJd, selected, approvalFree, rejected,
    keepsMe, recruiters, goTo, next, back, save, draftJob, loadFromJd, hasPostContent,
    err: (k: JobFormErrorKey) => (errors[k] ? t(errors[k] as Parameters<typeof t>[0]) : undefined),
    toggleRecruiter: (id: string) => set.collaborators(toggle(v.collaborators, id)),
    toggleInterviewer: (id: string) => set.interviewers(toggle(v.interviewers, id)),
  };
}

export type JobForm = ReturnType<typeof useJobForm>;
