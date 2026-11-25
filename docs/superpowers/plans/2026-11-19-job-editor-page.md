# Job Editor Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Create/Edit/Duplicate Job pop-up with a full-screen page (`/jobs/new`, `/jobs/:id/edit`, `/jobs/:id/duplicate`) that keeps the 4-step wizard and adds a live careers-page preview.

**Architecture:** Lift all form state/validation/save out of `JobDrawer` into `useJobForm`; move the four step bodies into `steps/*`; `JobEditorPage` composes hook + layout (sticky header with actions, stepper, form, preview), an unsaved-changes guard and a sessionStorage draft. Callers navigate instead of opening a pop-up; `JobDrawer` is deleted.

**Tech Stack:** React 18 + TypeScript, react-router-dom v6 (`BrowserRouter`), Zustand, Tailwind, Vitest + Testing Library. Commands run from `app/`.

**Spec:** `docs/superpowers/specs/2026-11-19-job-editor-page-design.md` (builds on `2026-11-19-create-job-wizard-design.md`)

## Global Constraints

- All wizard behaviour from the previous spec is unchanged (steps, reachability, ticks + "(completed)", focus on step change, recruiters required on Create/Duplicate only, edit has no Save draft and Save on every step, Duplicate keeps stageSla/recruiters/interviewers, new job gets `DEFAULT_SLA`, Publish step stays mounted for AI Undo, `touched` edits count as unsaved).
- Routes: `/jobs/new`, `/jobs/new?fromJd=<jdId>`, `/jobs/:id/edit`, `/jobs/:id/duplicate`; `/jobs?new=1` and `/jobs?fromJd=…` redirect (replace) to `/jobs/new[?fromJd=…]`.
- Access: `Guard perms={['pipeline']}` + `can(user,'job.edit')` else `NoAccess`; job looked up via `jobsInScope`; exists-but-out-of-scope → `NotFoundState icon="lock"` `jobs.detail.noAccess`; unknown → `search_off` `jobs.detail.notFound` (same as `JobDetailPage`).
- Back target: `location.state.from` if present, else create → `/jobs`, edit/duplicate → `/jobs/:id`. Cancel / Discard go there. After Save → `/jobs/:savedId`.
- Draft key: `job-editor-draft:new`, `job-editor-draft:new:fromJd=<jdId>`, `job-editor-draft:edit:<id>`, `job-editor-draft:duplicate:<id>`; edit drafts carry the job's `updatedAt` and are dropped if it differs. All `sessionStorage`/`localStorage` access wrapped in try/catch.
- Preview: shown inline from `xl` (≥1280px) by default; toggle remembered in `localStorage` key `job-editor-preview` (`'0'` hidden / `'1'` shown); below `xl` a header "Preview" button opens it in a side `Drawer`. Stepper vertical only from `2xl` (≥1536px), horizontal above the form otherwise.
- i18n EN + VI for every new string. No commits unless the user OKs them.

## Review Focus

1. Opening `/jobs/new?fromJd=X` after a blank-create draft exists must not offer that draft → Task 4 test `a draft is only offered at the same starting point`.
2. An edit draft for a job changed elsewhere since must not be offered → Task 4 test `drops an edit draft when the job changed since`.
3. Saving clears the draft so the next visit starts clean → Task 4 test `saving clears the stored draft`.
4. A Recruiter opening `/jobs/<out-of-scope id>/edit` sees the lock, not the form → Task 3 test `out-of-scope job shows no access`.
5. Typing in the form updates the preview immediately, including JD body/skills after picking a JD → Task 5 test `preview follows the form`.

---

### Task 1: Extract `useJobForm` and step components (no behaviour change)

**Files:**
- Create: `app/src/features/jobs/useJobForm.ts`, `app/src/features/jobs/steps/DetailsStep.tsx`, `RequirementsStep.tsx`, `TeamStep.tsx`, `PublishStep.tsx`, `app/src/features/jobs/steps/ui.tsx` (shared `FIELD`, `LEGEND`, `Field`, button classes)
- Modify: `app/src/features/jobs/JobDrawer.tsx` (becomes a thin shell over the hook + steps, still a pop-up)
- Test: existing `app/src/features/jobs/JobsPage.test.tsx` (unchanged, must stay green)

**Interfaces:**
- Produces:
  - `type JobFormMode = 'create' | 'edit' | 'duplicate'`
  - `useJobForm(opts: { open: boolean; mode: JobFormMode; job?: Job; jdId?: string; onSaved: (job: Job) => void }): JobForm` — for `duplicate`, `job` is the source.
  - `JobForm` exposes: `step: JobStep`, `visited: JobStep`, `goTo(s)`, `next()`, `back()`, `save(asDraft?: boolean)`, `errors`, `err(k): string | undefined`, `touched: boolean`, `touch()`, `editing: boolean`, `approvalFree: boolean`, `rejected?: string`, `selected?: Jd`, `values` (every field) and `set` (setter per field, e.g. `set.title(v)`), `pickJd(id)`, `recruiters: string[]`, `keepsMe: boolean`, `toggleRecruiter(id)`, `toggleInterviewer(id)`, `draftJob(): Job` (current form as a `Job` for the preview: `collect()` + `id: job?.id ?? 'draft'`, `status` the save would produce, `openedAt`/`stageSla` from source or defaults), `snapshot(): JobFormSnapshot`, `restore(s: JobFormSnapshot)`.
  - `type JobFormSnapshot = { values: <values type>; step: JobStep; visited: JobStep }`.
  - Step components: `DetailsStep({ form }: { form: JobForm; onNewJd: () => void })`, `RequirementsStep({ form })`, `TeamStep({ form })`, `PublishStep({ form })`.

- [ ] **Step 1:** Run `npx vitest run src/features/jobs` → record the passing count (baseline; this task is a refactor, the existing tests are its tests).
- [ ] **Step 2:** Move state/logic into `useJobForm` and JSX into the step components; `JobDrawer` renders `Drawer` + `JobStepper` + the steps + footer from `form`. `useJobForm` resets on `open` becoming true exactly as `JobDrawer`'s effect does today.
- [ ] **Step 3:** `npx vitest run src/features/jobs src/components` → same count, all PASS; `npx tsc -b --noEmit` clean.
- [ ] **Step 4: Commit** (only if OK'd) `refactor(app): job form hook and step components`.

### Task 2: `JobStepper` orientation + compact `CareersPreviewTab`

**Files:**
- Modify: `app/src/features/jobs/JobStepper.tsx`, `app/src/features/jobs/JobTabs.tsx`
- Test: create `app/src/features/jobs/JobStepper.test.tsx`; extend `JobsPage.test.tsx` only if a careers-tab test needs it

**Interfaces:**
- Produces: `JobStepper` prop `orientation?: 'horizontal' | 'vertical'` (default horizontal; vertical = `flex-col` list, bar on the left of each item). `CareersPreviewTab` prop `compact?: boolean`.

- [ ] **Step 1: Failing tests** in `JobStepper.test.tsx`: `vertical stepper lists the steps top to bottom` — render with `orientation="vertical"`, `step={1} visited={2}`; expect the `<ol>` to have class `flex-col`, button 1 accessible name `1. Job details (completed)`, button 2 `aria-current="step"`. And `compact preview drops the wide card` — render `CareersPreviewTab` with `compact` → `getByTestId('careers-preview')` lacks `max-w-3xl` and `p-10`; without `compact` it has both.
- [ ] **Step 2:** `npx vitest run src/features/jobs/JobStepper.test.tsx` → FAIL.
- [ ] **Step 3: Implement** both props (compact: `p-6 rounded-2xl`, title `text-xl`, no `max-w-3xl`).
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat(app): vertical job stepper and compact careers preview`.

### Task 3: `JobEditorPage`, routes, access, callers

**Files:**
- Create: `app/src/features/jobs/JobEditorPage.tsx`, `app/src/features/jobs/JobEditorPage.test.tsx`
- Modify: `app/src/routes.tsx`, `app/src/features/jobs/JobsPage.tsx`, `app/src/features/jobs/JobDetailPage.tsx`, `app/src/features/jds/JdDetailPage.tsx`, `app/src/features/dashboard/DashboardPage.tsx`, `app/src/features/jds/Jds.test.tsx`, `app/src/features/jobs/JobsPage.test.tsx`, i18n
- Delete: `app/src/features/jobs/JobDrawer.tsx`

**Interfaces:**
- Consumes: Task 1 `useJobForm`, steps; Task 2 `JobStepper orientation`.
- Produces: `JobEditorPage({ mode }: { mode: JobFormMode })`; routes `<Route path="/jobs/new" …mode="create">`, `/jobs/:id/edit` (`edit`), `/jobs/:id/duplicate` (`duplicate`), each in `Guard perms={['pipeline']}`; `editorPath(mode, id?, fromJd?)` helper in `jobForm.ts` returning the URL.

Page behaviour: `AppLayout` with `title` = `jobs.drawer.create|edit|duplicate`; sticky header row inside the page: back link (`← {label}`), actions with the wizard's button rules; approval banner; stepper (horizontal below `2xl`, vertical in a left column from `2xl`); the step body. Save → `navigate('/jobs/' + saved.id)`. `JdEditor` ("+ Create a new JD") is rendered by the page as today's pop-up; on save it picks the JD and calls `touch()`. Back target per Global Constraints; label `jobs.editor.backJobs` "Jobs" / job title / JD title.

i18n: `jobs.editor.backJobs` Jobs / Danh sách job.

- [ ] **Step 1: Failing tests** in `JobEditorPage.test.tsx` (render with `MemoryRouter` + the real `<Routes>` from `routes.tsx` or the three routes + `/jobs` + `/jobs/:id` stubs that print `where`):
  - `opens create, edit and duplicate at their URLs` — `/jobs/new` shows heading `Create Job` and empty Title; `/jobs/job-1/edit` shows `Edit Job` with Title `Senior Frontend Developer`; `/jobs/job-1/duplicate` shows `Duplicate job` with Title `Senior Frontend Developer (Copy)`.
  - `fromJd prefills the JD` — `/jobs/new?fromJd=jd-2026-002` → JD select value `jd-2026-002`, Title = that JD's title.
  - `old links redirect` — `/jobs?new=1` → location `/jobs/new`; `/jobs?fromJd=jd-2026-002` → `/jobs/new?fromJd=jd-2026-002`.
  - `out-of-scope job shows no access` — act as `u-linh` (Recruiter), make `job-1` `hiringManager: 'u-nam', collaborators: []`, open `/jobs/job-1/edit` → text of `jobs.detail.noAccess`, no `Title` field.
  - `unknown job shows not found` — `/jobs/nope/edit` → `jobs.detail.notFound` text.
  - `no job.edit permission shows NoAccess` — act as `u-quang` (Interviewer) on `/jobs/new` → no `Title` field.
  - `saving goes to the job page` — `/jobs/new?fromJd=jd-2026-002`, click `Save draft` → location `/jobs/<new id>` (id = `useStore.getState().jobs[0].id`).
  - `cancel goes back where you came from` — `/jobs/job-1/edit` with no changes, click `Cancel` → `/jobs/job-1`; `/jobs/new` with `state: { from: '/jobs' }` → `/jobs`.
  - Jobs list buttons: `New job` → `/jobs/new`; `Edit Senior Frontend Developer` → `/jobs/job-1/edit`; `Duplicate …` → `/jobs/job-1/duplicate`.
  - Update `Jds.test.tsx` "Create Job from this JD" expectation to `/jobs/new?fromJd=jd-2026-002`.
- [ ] **Step 2:** run `npx vitest run src/features/jobs/JobEditorPage.test.tsx src/features/jds` → FAIL.
- [ ] **Step 3: Implement** page, routes (declare `/jobs/new` before `/jobs/:id`), redirects in `JobsPage` (replace the `editor` state + `JobDrawer` with `navigate(editorPath(...), { state: { from } })`; `?new=1`/`?fromJd` → `<Navigate replace>`), `JobDetailPage` Edit/Duplicate navigate with `state.from = /jobs/:id`, `JdDetailPage` → `/jobs/new?fromJd=…` with `state.from = /jds/:id`, Dashboard link → `/jobs/new`. Delete `JobDrawer.tsx`.
- [ ] **Step 4: Port** every `JobsPage.test.tsx` test that opened the pop-up to render the page URL instead (`renderAt('/jobs/new?fromJd=jd-2026-002')`; `screen.getByRole('dialog')` → `screen.getByRole('main')` or a `data-testid="job-editor"` wrapper; same assertions). Escape-to-discard tests become Cancel-to-discard (next task adds the bar) — mark them `.todo` here and fill them in Task 4.
- [ ] **Step 5:** `npx vitest run` → PASS (except `.todo`); `npx tsc -b --noEmit` clean.
- [ ] **Step 6: Commit** `feat(app): job editor as a full page with routes`.

### Task 4: Unsaved guard and session draft

**Files:**
- Create: `app/src/features/jobs/editorDraft.ts`, `app/src/features/jobs/editorDraft.test.ts`
- Modify: `app/src/features/jobs/JobEditorPage.tsx`, `JobEditorPage.test.tsx`, `JobsPage.test.tsx` (fill the `.todo`s), i18n

**Interfaces:**
- Consumes: Task 1 `snapshot/restore`, `touched`.
- Produces: `draftKey(mode: JobFormMode, id?: string, fromJd?: string): string`; `saveDraft(key: string, snap: JobFormSnapshot, jobUpdatedAt?: string): void`; `loadDraft(key: string, jobUpdatedAt?: string): JobFormSnapshot | null` (null when missing, unparsable, or `jobUpdatedAt` differs); `clearDraft(key: string): void`.

Page: `dirty = touched || any field change since open` (track with a flag set from the form's change handlers / an `onChange` on the page form wrapper, like `Drawer`). While dirty: `beforeunload` handler set; `saveDraft` on every change (debounce not needed). Cancel / back link while dirty → amber bar `drawer.discard.title` with `drawer.discard.keep` / `drawer.discard.confirm` (reuse keys); Discard clears the draft then navigates. On open, if `loadDraft` returns a snapshot → info banner `jobs.editor.draftFound` "You have unsaved changes from earlier." with `jobs.editor.restore` "Restore" / `jobs.editor.discardDraft` "Discard" (VI: "Bạn có thay đổi chưa lưu từ lần trước." / "Khôi phục" / "Bỏ"). Save clears the draft.

- [ ] **Step 1: Failing tests**
  - `editorDraft.test.ts`: `draftKey('create')` → `job-editor-draft:new`; `draftKey('create', undefined, 'jd-1')` → `job-editor-draft:new:fromJd=jd-1`; `draftKey('edit','job-1')` → `job-editor-draft:edit:job-1`; `drops an edit draft when the job changed since` — save with `'2026-01-01'`, load with `'2026-02-01'` → `null`; load with same → snapshot; corrupt JSON → `null`.
  - `JobEditorPage.test.tsx`: `cancel with changes asks before leaving` — `/jobs/new`, type Title, click `Cancel` → `Discard unsaved changes?`; `Keep editing` → stays; `Cancel` → `Discard` → location `/jobs`. `cancel without changes leaves at once`. `adding a question counts as a change` (step 4, Add question, Cancel → bar). `offers to restore a draft after leaving` — render `/jobs/new`, type Title `Kept`, unmount, render `/jobs/new` again → banner visible; `Restore` → Title `Kept`. `a draft is only offered at the same starting point` — leave a draft on `/jobs/new`, open `/jobs/new?fromJd=jd-2026-002` → no banner. `saving clears the stored draft` — type, Save draft, open `/jobs/new` → no banner. `drops an edit draft when the job changed since` — leave a draft on `/jobs/job-1/edit`, update job-1 via `updateJob` (changes `updatedAt`), reopen → no banner. `warns before the tab closes with unsaved changes` — type, dispatch `new Event('beforeunload', { cancelable: true })` on `window` → `defaultPrevented` true.
- [ ] **Step 2:** `npx vitest run src/features/jobs` → FAIL.
- [ ] **Step 3: Implement.** `sessionStorage` cleared in tests' `beforeEach`.
- [ ] **Step 4:** run → PASS; full `npx vitest run` PASS; tsc clean.
- [ ] **Step 5: Commit** `feat(app): unsaved guard and restorable draft for the job editor`.

### Task 5: Live preview column

**Files:**
- Modify: `app/src/features/jobs/JobEditorPage.tsx`, `JobEditorPage.test.tsx`, i18n

**Interfaces:**
- Consumes: Task 1 `draftJob()`, `selected`; Task 2 `CareersPreviewTab compact`; `Drawer` (side) for small screens.

Behaviour: preview `<aside aria-label={t('jobs.editor.preview')}>` rendered as a sticky right column (`hidden xl:block` when shown); header buttons `jobs.editor.hidePreview` "Hide preview" / `jobs.editor.showPreview` "Show preview" (visible from `xl`) and `jobs.editor.preview` "Preview" (below `xl`, opens a side `Drawer` titled the same). Toggle stored per Global Constraints. VI: "Xem trước" / "Ẩn xem trước" / "Hiện xem trước".

- [ ] **Step 1: Failing tests**: `preview follows the form` — `/jobs/new?fromJd=jd-2026-002`, within the `Preview` complementary region: JD title text visible; change Title to `Data Lead` → region shows `Data Lead`; go to step 4, type Why love `Free lunch` → region shows `Free lunch`. `preview can be hidden and remembers it` — click `Hide preview` → region gone, `localStorage['job-editor-preview'] === '0'`; re-render → still hidden; `Show preview` → back. `small screens open the preview in a panel` — click `Preview` → a dialog named `Preview` contains the title.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** (jsdom ignores media queries: both the inline column and the "Preview" button exist in the DOM; tests target them by name.)
- [ ] **Step 4:** run → PASS; full suite PASS; tsc clean.
- [ ] **Step 5: Commit** `feat(app): live careers preview in the job editor`.

### Task 6: Visual check

- [ ] **Step 1:** Update the scratchpad Playwright script to drive `/jobs/new` (button "New job" now navigates): screenshot every step at 1440×900 and 1280×800 (sidebar expanded) and 1600×900 (vertical stepper), EN light + VI dark; Edit `job-1` step 3; preview hidden/shown; Cancel-with-changes bar.
- [ ] **Step 2:** Check: nothing overflows horizontally at 1280; form ≥ ~520px; header actions always visible while scrolling; preview sticky; VI labels not truncated badly.
- [ ] **Step 3:** Fix in the owning file, rerun `npx vitest run`, report.
