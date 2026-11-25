# Job Post Content on the Job — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Job owns its own copy of the six careers-page sections (About the role, What you'll do, Skills, Requirements, Nice to have, About the team), filled from the JD when a JD is picked and refreshable with "Load from JD".

**Architecture:** A small domain module (`domain/jobPost.ts`) defines the six-field `JobPost`, builds one from a JD, and resolves what the careers page shows (Job field, else JD). The job form holds the six fields, fills empty ones on JD pick, and overwrites all on "Load from JD". The careers page renders through the resolver. Seed jobs get their copy from their JD.

**Tech Stack:** React 18 + TypeScript, Zustand store, Vitest + Testing Library, Tailwind 3. Run commands from `app/`.

**Spec:** `docs/superpowers/specs/2026-11-25-job-post-content-design.md`

## Global Constraints

- AI evaluation / JD Matching keep reading the JD — do not touch `domain/aiEvaluation.ts`, `domain/jdExtract.ts#jdRequirements`.
- Editing a JD never changes an existing job's copy (no live link).
- JD editor and the `Jd` type are unchanged (except moving `TagField` out of the file, Task 4).
- User-facing copy: EN + VI in `i18n/en.ts` and `i18n/vi.ts`.
- `PERSIST_VERSION` bumps from 15 to 16.

## Review Focus

- Picking JD A, typing in one field, then picking JD B: typed field kept, other empty fields filled from B; fields filled from A are **not** replaced (they are no longer empty) — "Load from JD" is how to replace them. Test in Task 3.
- Editing an existing job whose six fields are empty (saved before this change): form shows them empty, careers page still shows the JD content via fallback. Tests in Tasks 2 and 3.
- "Load from JD" with no JD selected: button disabled. Test in Task 4.
- Whitespace-only text / empty list on the Job counts as empty → careers falls back to the JD. Test in Task 1.
- Duplicate a job: the copy travels with the duplicate (it is part of `collect()`/`fill()`). Test in Task 3.

---

### Task 1: Domain — `JobPost` fields and helpers

**Files:**
- Modify: `app/src/domain/types.ts` (interface `Job`, after `additionalInfo`)
- Create: `app/src/domain/jobPost.ts`
- Test: `app/src/domain/jobPost.test.ts`

**Interfaces:**
- Produces:
  - `Job` gains optional `summary?: string; responsibilities?: string[]; aboutTeam?: string; skills?: string[]; mustHave?: string[]; niceToHave?: string[];` (doc comment: "Careers-page copy, filled from the JD; the JD stays the source for AI matching").
  - `export const JOB_POST_KEYS = ['summary', 'responsibilities', 'skills', 'mustHave', 'niceToHave', 'aboutTeam'] as const;`
  - `export type JobPost = { summary: string; responsibilities: string[]; skills: string[]; mustHave: string[]; niceToHave: string[]; aboutTeam: string };`
  - `export function jobPostFromJd(jd: Jd): JobPost` — summary/aboutTeam trimmed or `''`; responsibilities = dedup(`responsibilities` + `dailyTasks`); skills = `jd.skills`; mustHave = `jdMustHave(jd)`; niceToHave = `jd.niceToHave` without blanks.
  - `export function jobPostOf(job: Job, jd?: Jd): JobPost` — per key, the Job's value if non-empty (string `.trim()` non-empty / array with a non-blank item), else `jobPostFromJd(jd)`'s value, else empty.

- [ ] **Step 1: Write failing tests** in `jobPost.test.ts`:
  - `jobPostFromJd` on seed `jd-2026-005` (from `buildShowcaseJd()`): `responsibilities` has 10 items (6 + 4 daily tasks), `mustHave[0] === '4+ years building backend services with Node.js and TypeScript'`, `niceToHave.length === 4`, `skills[0] === 'Node.js'`.
  - `jobPostOf` with job `{ summary: 'Own it', skills: ['Go'] }` + that JD → `summary === 'Own it'`, `skills` equal `['Go']`, `aboutTeam` equals the JD's.
  - `jobPostOf` with job `{ summary: '   ', mustHave: [] }` → both fall back to the JD.
  - `jobPostOf(job, undefined)` with an empty job → every string `''`, every array `[]`.
- [ ] **Step 2: Run** `npx vitest run src/domain/jobPost.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the type fields and `domain/jobPost.ts`.
- [ ] **Step 4: Run** the same command — Expected: PASS. Run `npx tsc --noEmit -p .` — no errors.
- [ ] **Step 5: Commit** `feat(app): job post content fields and resolver`

---

### Task 2: Careers page reads the Job's copy

**Files:**
- Modify: `app/src/features/careers/CareersJob.tsx` (the `reqs` / `niceToHave` / `overview` / `team` / skills locals)
- Test: `app/src/features/careers/ApplyForm.test.tsx`

**Interfaces:**
- Consumes: `jobPostOf(job, jd): JobPost` (Task 1).

- [ ] **Step 1: Write failing tests** in `ApplyForm.test.tsx`:
  - `'shows the job's own post content over the JD'`: patch `job-1` with `summary: 'Job-only summary'`, `skills: ['OnlyOnJob']`, `niceToHave: ['Job nice']`; render `/careers/job-1`; expect `getByText('Job-only summary')`, `getByText('OnlyOnJob')`, `getByText('Job nice')`, and the JD's summary text is **not** shown.
  - Existing tests (`builds the post from the JD overview…`, `orders the post…`) must keep passing — they cover the JD fallback.
- [ ] **Step 2: Run** `npx vitest run src/features/careers` — Expected: new test FAILS.
- [ ] **Step 3: Implement**: `const post = jobPostOf(job, jd)`; drive About/Duties/Skills/Requirements/Nice to have/Team from `post`. `hasOverview` = `post.summary || post.responsibilities.length || post.aboutTeam`. The `JdBody` fallback and its `skip` list stay, using `post.mustHave` / `post.niceToHave` / `post.skills` lengths.
- [ ] **Step 4: Run** `npx vitest run src/features/careers` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): careers page reads job post content`

---

### Task 3: Job form state — hold, fill on JD pick, load from JD, save

**Files:**
- Modify: `app/src/features/jobs/useJobForm.ts` (`JobFormValues`, `blank`, `fill`, `applyJd`, `collect`, returned API)
- Test: `app/src/features/jobs/JobEditorPage.test.tsx`

**Interfaces:**
- Consumes: `JobPost`, `jobPostFromJd`, `JOB_POST_KEYS` (Task 1).
- Produces (on the object `useJobForm` returns, used by Task 4):
  - `values` gains `summary: string; responsibilities: string /* one per line */; skills: string[]; mustHave: string /* one per line */; niceToHave: string /* one per line */; aboutTeam: string;` and `set.<key>` setters (generated from `blank()` as today).
  - `loadFromJd(): void` — overwrites all six from the selected JD; marks the form touched.
  - `hasPostContent: boolean` — any of the six non-empty (Task 4 uses it to decide whether to confirm).
- Behaviour:
  - `applyJd(id)` additionally fills each of the six fields **only if it is empty** in the current values.
  - `fill(src)` loads the six from the Job (arrays joined by `\n`).
  - `collect()` saves the six: strings trimmed (`|| undefined`), line fields split by line, trimmed, blanks dropped (`length ? arr : undefined`).

- [ ] **Step 1: Write failing tests** in a new `describe('JobEditorPage post content')`:
  - `'picking a JD fills the post content'`: `renderAt('/jobs/new?fromJd=jd-2026-002')`, go to the Job post & application section, expect `getByLabelText('About the role')` value equals that JD's `summary`, and `getByLabelText('Requirements')` (textarea) value equals `jdMustHave(jd).join('\n')`.
  - `'picking another JD keeps what was typed'`: create page, pick `jd-2026-002`, change About the role to `'Typed by HR'`, clear Nice to have, pick `jd-2026-003` → About the role stays `'Typed by HR'`; Nice to have equals jd-2026-003's `niceToHave.join('\n')`.
  - `'saves the post content on the job'`: edit `job-1`, set About the role to `'Edited summary'`, save → store `job-1.summary === 'Edited summary'`.
  - `'an older job shows empty post fields'`: `patchJob1({ summary: undefined, responsibilities: undefined, skills: undefined, mustHave: undefined, niceToHave: undefined, aboutTeam: undefined })`, edit `job-1` → About the role value `''`.
  - `'duplicate keeps the post content'`: duplicate `job-1` → About the role equals `job-1.summary` (after Task 5 seeds it; until then patch it in the test).
- [ ] **Step 2: Run** `npx vitest run src/features/jobs/JobEditorPage.test.tsx` — Expected: new tests FAIL (labels missing). They pass only after Task 4 adds the inputs; implement Tasks 3 and 4 back to back and run Step 4 after Task 4 Step 3.
- [ ] **Step 3: Implement** the form state above.
- [ ] **Step 4:** (run after Task 4 Step 3) — Expected: PASS.
- [ ] **Step 5: Commit** together with Task 4.

---

### Task 4: Job form UI — "Post content" block, Load from JD

**Files:**
- Create: `app/src/components/TagField.tsx` — move `TagField` and its `foldText` helper out of `app/src/features/jds/JdEditorPage.tsx` unchanged, exported; `JdEditorPage.tsx` imports it.
- Modify: `app/src/features/jobs/steps/PublishStep.tsx`
- Modify: `app/src/i18n/en.ts`, `app/src/i18n/vi.ts`
- Test: `app/src/features/jobs/JobEditorPage.test.tsx`

**Interfaces:**
- Consumes: `form.values.*`, `form.set.*`, `form.loadFromJd()`, `form.hasPostContent`, `form.values.jd` (Task 3); `Modal` from `components/Modal`.

- [ ] **Step 1: Write failing tests** (same describe as Task 3):
  - `'Load from JD replaces the post content after confirming'`: edit `job-1`, change About the role to `'X'`, click `Load from JD` → dialog `Replace post content?` shows; click `Replace` → About the role equals the JD's summary.
  - `'Load from JD is disabled without a JD'`: `/jobs/new` → button `Load from JD` is disabled.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement**. In `PublishStep`, inside the existing "Job post content" fieldset, **before** Why love / Additional info, in this order:
  - header row: legend + button `Load from JD` (`BTN_GHOST`, icon `sync`, `disabled={!v.jd}`); click → if `hasPostContent` open a `Modal` (title `Replace post content?`, body `This replaces About the role, What you'll do, Skills, Requirements, Nice to have and About the team with the JD's current content.`, buttons Cancel / `Replace`), else call `loadFromJd()` directly.
  - `About the role` textarea (`id="job-summary"`, rows 4, spans both columns)
  - `What you'll do` textarea (`job-duties`, rows 6, hint `One item per line`)
  - `Skills` `TagField` (`job-skills`, options = all JD skills in the store, deduped)
  - `Requirements` textarea (`job-must-have`, rows 5, one per line)
  - `Nice to have` textarea (`job-nice-to-have`, rows 4, one per line)
  - `About the team` textarea (`job-team`, rows 3)
  i18n keys (EN / VI): `jobs.post.loadFromJd` Load from JD / Lấy lại từ JD; `jobs.post.confirmTitle` Replace post content? / Thay nội dung bài đăng?; `jobs.post.confirmBody` (above) / Thao tác này thay About the role, What you'll do, Skills, Yêu cầu, Điểm cộng và Về đội ngũ bằng nội dung hiện tại của JD.; `jobs.post.replace` Replace / Thay; `jobs.post.summary` About the role / Về vị trí này; `jobs.post.duties` What you'll do / Bạn sẽ làm gì; `jobs.post.skills` Skills / Kỹ năng; `jobs.post.mustHave` Requirements / Yêu cầu; `jobs.post.niceToHave` Nice to have / Điểm cộng; `jobs.post.team` About the team / Về đội ngũ; `jobs.post.perLine` One item per line / Mỗi dòng một ý.
- [ ] **Step 4: Run** `npx vitest run src/features/jobs src/features/jds` — Expected: PASS (Tasks 3 + 4 tests, JD editor tests unchanged). `npx tsc --noEmit -p .` clean.
- [ ] **Step 5: Commit** `feat(app): job form post content with load from JD`

---

### Task 5: Seed copies and persist bump

**Files:**
- Modify: `app/src/data/jobPosts.ts` (`withJobPosts` takes `jds` and adds `jobPostFromJd(jd)` fields), `app/src/data/showcaseJob.ts` (`buildShowcaseJob` adds the copy from `buildShowcaseJd()`), `app/src/data/seed.ts` (pass the detailed JDs into `withJobPosts`)
- Modify: `app/src/store/persist.ts` — `PERSIST_VERSION = 16`
- Test: `app/src/data/seed.test.ts`

**Interfaces:**
- Consumes: `jobPostFromJd` (Task 1).
- Produces: `withJobPosts(jobs: Job[], jds: Jd[]): Job[]`.

- [ ] **Step 1: Write failing test** in `seed.test.ts`: `'every seeded job carries its post content from its JD'` — for each `s.jobs`, `job.summary` is non-empty and `job.mustHave` equals `jobPostFromJd(jd).mustHave` for its JD.
- [ ] **Step 2: Run** `npx vitest run src/data/seed.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**; in `buildSeed` build the detailed JD list first, then `withJobPosts(jobs, detailedJds)`.
- [ ] **Step 4: Run** full suite `npx vitest run` — Expected: all PASS. `npx tsc --noEmit -p .` clean. Open `http://localhost:5190/careers/job-7` and `/jobs/job-7/edit` to eyeball.
- [ ] **Step 5: Commit** `feat(app): seed jobs carry post content`
