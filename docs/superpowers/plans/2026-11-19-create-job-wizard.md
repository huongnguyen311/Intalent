# Create Job Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-page Create/Edit Job pop-up into a 4-step wizard with a Hiring Team of Hiring Manager + Recruiter(s) + Interviewers, and drop Stage SLA from the form.

**Architecture:** `JobDrawer` keeps all form state (so values survive step changes) and renders one step body at a time inside the shared centred `Drawer`, which gains fixed `subheader` (stepper) and `footer` (buttons) slots. Pure validation / option helpers live in `jobForm.ts` so they are unit-tested apart from the UI. A new optional `Job.interviewers` prefills the interview panel.

**Tech Stack:** React 18 + TypeScript, Zustand store, Tailwind, Vitest + Testing Library. App lives in `app/`; run commands from `app/`.

**Spec:** `docs/superpowers/specs/2026-11-19-create-job-wizard-design.md`

## Global Constraints

- Every user-visible string goes through `t()` with keys in both `app/src/i18n/en.ts` and `app/src/i18n/vi.ts`.
- Steps (EN / VI): `Job details` / `Thông tin cơ bản` · `Requirements` / `Yêu cầu` · `Compensation & team` / `Lương & Team` · `Careers page & publishing` / `Trang tuyển dụng & Đăng tin`.
- Recruiter-type roles: `Super Admin`, `Recruitment Lead`, `Recruiter` (compare via `normalizeRole`).
- Recruiter(s) required only on Create and Duplicate; on Edit a missing recruiter shows an amber note and still saves.
- New blank job: `stageSla = DEFAULT_SLA`. Duplicate: copies source `stageSla`, `collaborators`, `interviewers`. Edit: never sends `stageSla`.
- Edit mode has no `Save draft`; `Save` on every step; status rule identical to today's `save()`.
- Recruiters are stored in the existing `job.collaborators` (no data migration, no persist version bump).
- Baseline is the current working tree (Job Templates already removed, uncommitted). Do not reintroduce templates.
- Commit at the end of each task only if the user has OK'd commits for this work; otherwise leave changes staged-free and report.

## Review Focus

1. Values typed on one step survive Back/Next and stepper jumps → Task 4 test `keeps values across steps`.
2. Picking a JD after the user typed their own Title does not overwrite it → Task 4 test `picking a JD keeps a typed title`.
3. Duplicate of a job with a custom SLA keeps that SLA → Task 5 test `duplicate keeps stage SLA, recruiters and interviewers`.
4. Editing an open job and pressing Save on step 1 leaves it open → Task 4 test `edit saves from step 1 without changing status`.
5. Escape with an unsaved change made via a checkbox on step 3 still asks to discard → Task 1 test `inputs in footer and body both mark dirty` + Task 5 test `escape after ticking an interviewer asks to discard`.

---

### Task 1: Drawer slots

**Files:**
- Modify: `app/src/components/Drawer.tsx`
- Test: `app/src/components/Drawer.test.tsx`

**Interfaces:**
- Produces: `Drawer` props `subheader?: ReactNode` (rendered fixed, under the title bar and the discard bar) and `footer?: ReactNode` (rendered fixed below the scrolling body, `shrink-0 border-t px-6 py-4`). Dirty tracking `onChange` moves from the body `div` to the `<aside>`.

- [ ] **Step 1: Write failing tests** in `Drawer.test.tsx`:
  - `renders subheader and footer outside the scrolling body`: render `<Drawer open title="F" onClose={fn} subheader={<p>steps</p>} footer={<button>Next</button>}><p>body</p></Drawer>`; expect `screen.getByText('steps')` and `getByRole('button',{name:'Next'})` to be in the document and `screen.getByText('body').parentElement` to not contain either.
  - `inputs in footer and body both mark dirty`: `guardUnsaved`, footer `<input aria-label="F" />`; `fireEvent.change` on it, then `fireEvent.keyDown(document,{key:'Escape'})`; expect `onClose` not called and `Discard unsaved changes?` shown.
- [ ] **Step 2:** `npx vitest run src/components/Drawer.test.tsx` → the two new tests FAIL.
- [ ] **Step 3: Implement** the two props; keep header + discard bar + subheader + footer `shrink-0` so only the body scrolls.
- [ ] **Step 4:** same command → all Drawer tests PASS.
- [ ] **Step 5: Commit** `feat(app): drawer subheader and footer slots`.

### Task 2: Job.interviewers and interview panel prefill

**Files:**
- Modify: `app/src/domain/types.ts` (`Job`), `app/src/features/hiring/InterviewDialog.tsx:57`
- Test: the existing InterviewDialog / hiring UI test file that renders `InterviewDialog` (find with `grep -rl "InterviewDialog" app/src --include=*.test.tsx`; if none renders it, add `app/src/features/hiring/InterviewDialog.test.tsx` following `ScorecardDialog.test.tsx` setup).

**Interfaces:**
- Produces: `Job.interviewers?: string[]` — "Default interview panel for this job (besides the hiring manager)."

- [ ] **Step 1: Write failing test** `prefills the panel with the hiring manager and the job interviewers`: set `job-1` `interviewers: ['u-chau', job.hiringManager]` in the store, open the dialog for an application of `job-1`; expect exactly the HM and `u-chau` checkboxes checked (deduped, HM first).
- [ ] **Step 2:** run that file → FAIL.
- [ ] **Step 3: Implement** add the field; `setPanel(job ? [...new Set([job.hiringManager, ...(job.interviewers ?? [])])] : [me()])`.
- [ ] **Step 4:** run → PASS; `npx tsc -b --noEmit` clean.
- [ ] **Step 5: Commit** `feat(app): job default interviewers prefill the interview panel`.

### Task 3: Form helpers (steps, validation, options)

**Files:**
- Modify: `app/src/features/jobs/jobForm.ts`
- Test: create `app/src/features/jobs/jobForm.test.ts`

**Interfaces:**
- Produces:
  - `export const JOB_STEPS = ['details', 'requirements', 'team', 'publish'] as const; export type JobStep = 0 | 1 | 2 | 3;`
  - `export type JobFormErrorKey = 'jd' | 'title' | 'salary' | 'recruiters';`
  - `export const ERROR_STEP: Record<JobFormErrorKey, JobStep> = { jd: 0, title: 0, salary: 2, recruiters: 2 };`
  - `export const ERROR_FIELD: Record<JobFormErrorKey, string> = { jd: 'job-jd', title: 'job-title', salary: 'job-salary-min', recruiters: 'job-recruiters' };` (DOM ids to focus)
  - `export function validateJobForm(f: { jd: string; title: string; salaryMin?: number; salaryMax?: number; recruiters: string[] }, requireRecruiter: boolean): Partial<Record<JobFormErrorKey, string>>` — values are i18n keys: `jobs.drawer.err.jd`, `jobs.drawer.err.title` (blank after trim), `jobs.drawer.err.salary` (both set and min > max), `jobs.drawer.err.recruiters` (requireRecruiter && recruiters.length === 0).
  - `export function firstErrorStep(errs: Partial<Record<JobFormErrorKey, string>>): JobStep | undefined` — lowest `ERROR_STEP` among present keys.
  - `export const isRecruiterRole = (role: string): boolean` — `normalizeRole(role)` ∈ Super Admin / Recruitment Lead / Recruiter.
  - `export function recruiterOptions(users: User[], selected: string[]): User[]` — `assignableUsers(users)` where `isRecruiterRole(u.role) || selected.includes(u.id)`.

- [ ] **Step 1: Write failing tests** in `jobForm.test.ts`:
  - `validateJobForm` returns `{ jd, title }` keys for `{ jd:'', title:'  ', recruiters:[] }, false`; adds `recruiters` when `true`; adds `salary` for `salaryMin: 50, salaryMax: 40`; returns `{}` for a valid form.
  - `firstErrorStep({ salary: 'x', title: 'y' })` → `0`; `firstErrorStep({})` → `undefined`.
  - `recruiterOptions` on the seed users (`buildSeed().users`) with `selected: []` contains no user whose normalized role is Hiring Manager / Interviewer / Candidate; with `selected: [<a Hiring Manager id>]` contains that user.
- [ ] **Step 2:** `npx vitest run src/features/jobs/jobForm.test.ts` → FAIL.
- [ ] **Step 3: Implement** the exports above. Remove `SLA_STAGES` only if no other importer remains (`grep -rn SLA_STAGES app/src`); keep `DEFAULT_SLA`.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat(app): job form steps and validation helpers`.

### Task 4: Wizard shell in JobDrawer (steps, stepper, footer, no SLA)

**Files:**
- Create: `app/src/features/jobs/JobStepper.tsx`
- Modify: `app/src/features/jobs/JobDrawer.tsx`, `app/src/i18n/en.ts`, `app/src/i18n/vi.ts`
- Test: `app/src/features/jobs/JobsPage.test.tsx`

**Interfaces:**
- Consumes: Task 1 `subheader` / `footer`; Task 3 `JOB_STEPS`, `JobStep`, `validateJobForm`, `firstErrorStep`, `ERROR_STEP`, `ERROR_FIELD`.
- Produces: `JobStepper({ step, reachable, onPick }: { step: JobStep; reachable: (s: JobStep) => boolean; onPick: (s: JobStep) => void })` — an `<ol aria-label={t('jobs.drawer.steps')}>` of 4 buttons named `"{n}. {label}"`, current one `aria-current="step"`, done ones show a check icon, unreachable ones `disabled`.

Step bodies (fields move, behaviour unchanged):
- 0 `details`: JD select (+ New JD), JD skills chips, Title, Department, Location, Level, Employment, Workplace, Openings.
- 1 `requirements`: Minimum years, Education, and a read-only "From the JD" (`jobs.drawer.fromJd`) block listing `selected.skills` and `selected.mustHave` (when present; hidden when no JD).
- 2 `team`: Salary block; Hiring manager; Collaborators block unchanged for now (Task 5 replaces it).
- 3 `publish`: Why you'll love, Additional information, Application questions, Publish / Submit checkbox.
- Rejected-approval banner + `JobStepper` go in `subheader`.

Footer (`footer` slot), `mode = job ? 'edit' : 'create'` (Duplicate counts as create):
- create: `Back` (step > 0) · `Cancel` · `Save draft` · `Next` (step < 3) or `Save` (step 3).
- edit: `Back` (step > 0) · `Cancel` · `Next` (step < 3) · `Save` (always).
- `Next`: run `validateJobForm`, keep only keys whose `ERROR_STEP === step`; if any → show them and focus `ERROR_FIELD`; else `step + 1`, `visited = max(visited, step + 1)`.
- `Save` / `Save draft`: validate all; if any → `setStep(firstErrorStep)`, show errors, focus first field after render (`requestAnimationFrame`, as today). `Save draft` forces publish off.
- Stepper reachable: edit → all; create → `s <= visited`.
- On open: `step = 0`, `visited = 0` (edit: `visited = 3`).
- Remove SLA state, inputs, `slaText`, SLA validation. Create: `stageSla: copyFrom?.stageSla ?? DEFAULT_SLA`. Edit: omit `stageSla` from the `updateJob` patch.

i18n (EN / VI): `jobs.drawer.steps` Steps / Các bước · `jobs.drawer.step.details|requirements|team|publish` (Global Constraints) · `jobs.drawer.back` Back / Quay lại · `jobs.drawer.next` Next / Tiếp · `jobs.drawer.saveDraft` Save draft / Lưu nháp · `jobs.drawer.fromJd` From the JD / Từ JD. Delete `jobs.drawer.sla`, `jobs.drawer.err.sla` (both files) once unused.

- [ ] **Step 1: Rewrite / add tests** in `JobsPage.test.tsx`. Add helpers `const next = (d: HTMLElement, n = 1) => { for (let i = 0; i < n; i++) fireEvent.click(within(d).getByRole('button', { name: 'Next' })); };`. Then:
  - Replace `blocks save for empty, fractional or sub-1 SLA values…` with `has no Stage SLA inputs and a new job gets the default SLA`: open from `?fromJd=jd-2026-002`, assert `queryByLabelText('HR Screening')` null, click `Save draft`, expect `jobs[0].stageSla` toEqual `{ new: 2, ai_screening: 1, screening: 5, interview: 7, assessment: 5, final_interview: 5, offer: 5 }`.
  - `shows the missing-JD error under the JD select`: click `Next` instead of `Save`; same assertions; and the step-1 stepper button still has `aria-current="step"`.
  - `Save draft jumps to the step that has the error`: from JD, `next(d, 2)`, set From `50` / To `40`, click `Back` (now step 2), click `Save draft` → the step-3 stepper button has `aria-current="step"`, `"From" must not be higher than "To"` is visible, job count unchanged.
  - `Save draft with a blank title stays on step 1`: from JD, clear Title, click `Save draft` → `Title is required` visible, job count unchanged.
  - `keeps values across steps`: type Department `Data`, `next(d, 2)`, click `Back` twice → Department still `Data`.
  - `picking a JD keeps a typed title`: New job, type Title `My role`, pick `jd-2026-002` → Title stays `My role`; Level is set to `Senior`.
  - `the stepper only reaches visited steps on create`: New job from JD; step 4 button disabled; after `next(d)` step 2 enabled, step 4 still disabled.
  - `edit saves from step 1 without changing status`: open edit on an `open` seed job (`renderAt('/jobs')`, click its Edit button), change Department, click `Save` on step 1 → job status still `open`, no `Save draft` button present, step 4 button enabled.
  - Update `prefills the company perks…`: `next(d, 3)` before using Why/Additional fields; final click `Save`.
  - Update `creating from JD prefills title and stack`: drop the `HR Screening` assertion.
  - Update `saves a new job as a draft unless publish is ticked`: click `Save draft`.
  - Update `publishing makes the job public` and `a recruiter submits for approval…`: `next(d, 3)` then tick checkbox, `Save`.
  - Update `duplicates a job…`: click `Save draft`.
- [ ] **Step 2:** `npx vitest run src/features/jobs` → new/updated tests FAIL.
- [ ] **Step 3: Implement** `JobStepper.tsx` and the JobDrawer restructure per the bullets above.
- [ ] **Step 4:** `npx vitest run src/features/jobs src/components` → PASS; `npx tsc -b --noEmit` clean.
- [ ] **Step 5: Commit** `feat(app): create job as a 4-step wizard without stage sla`.

### Task 5: Hiring Team (Recruiter(s) + Interviewers)

**Files:**
- Modify: `app/src/features/jobs/JobDrawer.tsx`, `app/src/i18n/en.ts`, `app/src/i18n/vi.ts`
- Test: `app/src/features/jobs/JobsPage.test.tsx`

**Interfaces:**
- Consumes: Task 2 `Job.interviewers`; Task 3 `recruiterOptions`, `isRecruiterRole`, `validateJobForm(…, requireRecruiter = !job)`.

Behaviour (step 2 `team`, under Hiring manager):
- `Recruiter(s)` fieldset (`id="job-recruiters"` on the fieldset or first checkbox for focus) — checkboxes from `recruiterOptions(users, collaborators)`, **including** the Hiring Manager. Error text `jobs.drawer.err.recruiters` under it.
- keepsMe rule unchanged (current user checked + disabled when `!seesAllJobs(user) && manager !== me()`); counts towards the requirement.
- New job default `collaborators = isRecruiterRole(user.role) ? [me()] : []`; edit/duplicate use the job's own list.
- `collect()` stops removing the manager from `collaborators`; still adds `me()` when keepsMe.
- Edit with zero recruiters: amber note `jobs.drawer.noRecruiter` on step 2; save still allowed.
- `Interviewers` fieldset: checkboxes from `assignableUsers(users)`; saved as `interviewers` (omit when empty); `fill()` loads `src.interviewers ?? []`.
- i18n (EN / VI): `jobs.drawer.recruiters` Recruiter(s) / Recruiter · `jobs.drawer.interviewers` Interviewers / Người phỏng vấn · `jobs.drawer.err.recruiters` Pick at least one recruiter / Chọn ít nhất một recruiter · `jobs.drawer.noRecruiter` No recruiter on this job yet. / Job này chưa có recruiter. · `jobs.drawer.keepsMe` → "You will be added as a recruiter so you keep seeing this job." / VI equivalent. Remove `jobs.drawer.collaborators` if unused elsewhere (`grep -rn "jobs.drawer.collaborators" app/src`).

- [ ] **Step 1: Write failing tests** in `JobsPage.test.tsx`:
  - `recruiter list holds only recruiter roles and defaults to the creator`: as default admin, New job from JD, `next(d, 2)`; within the `Recruiter(s)` group the current user is checked; no option label ends with `· Hiring Manager`-role users (assert a known Hiring Manager seed user's name is absent from the group).
  - `create is blocked without a recruiter`: uncheck self, click `Next` → `Pick at least one recruiter`; `Save draft` → stays on step 3 with the error, no job created.
  - `a recruiter creating a job passes step 3 by default`: `asUser('u-huy')`, New job, pick JD, `next(d, 2)`, `next(d)` succeeds (step 4 current).
  - `editing a job without recruiters warns but saves`: set `job-1.collaborators = []` in store, edit it, jump to step 3 via stepper → note `No recruiter on this job yet.` visible; `Save` → dialog closes.
  - `duplicate keeps stage SLA, recruiters and interviewers`: give `job-1` `stageSla.screening = 9`, `collaborators: ['u-huy']`, `interviewers: ['u-chau']`; Duplicate, `Save draft` → copy has `stageSla.screening === 9`, `collaborators` contains `u-huy`, `interviewers` equals `['u-chau']`.
  - `saves interviewers`: New job from JD, `next(d, 2)`, tick an interviewer, `Save draft` → `jobs[0].interviewers` contains that id.
  - `escape after ticking an interviewer asks to discard`: tick one, `keyDown Escape` → `Discard unsaved changes?` visible, dialog still open.
- [ ] **Step 2:** `npx vitest run src/features/jobs` → new tests FAIL.
- [ ] **Step 3: Implement** per the bullets above.
- [ ] **Step 4:** `npx vitest run` (full suite) → all PASS; `npx tsc -b --noEmit` clean.
- [ ] **Step 5: Commit** `feat(app): hiring team with recruiters and interviewers`.

### Task 6: Visual check in the running app

**Files:** none (fix-ups go back into the owning task's files).

- [ ] **Step 1:** With the dev server on `http://localhost:5190`, drive `/jobs` → New job with Playwright (`app/node_modules/playwright`, `chromium.launch({ channel: 'chrome' })`): walk steps 1→4, Back, Save draft; Edit an open job and jump to step 4. Screenshot each step at 1440×900 in EN and VI, light and dark (`ui.lang`, theme toggle), into the scratchpad.
- [ ] **Step 2:** Check: stepper and footer stay fixed while the body scrolls; nothing overflows at 768px dialog width; labels not truncated in VI.
- [ ] **Step 3:** Fix any issue in the owning file, rerun `npx vitest run`, report screenshots' paths.
