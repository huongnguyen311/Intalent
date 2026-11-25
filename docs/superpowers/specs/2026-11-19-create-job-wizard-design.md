# Create Job wizard (4 steps)

Date: 2026-11-19 · Branch: `feat/recruitment-app` · Step 1 of the Create Job roadmap

## Intent

The PM spec ("Create New Job – 8 sections") asks for a multi-step Create Job instead of one long form. Today
`JobDrawer` (app/src/features/jobs/JobDrawer.tsx) is a single scrolling form inside a centred `Drawer`. The goal
is a shorter-feeling, guided form that matches the spec's structure, without losing any capability the app
already has (memory: keep strong features vs PRD — add, never cut).

This step only restructures the form and settles the Hiring Team. Later roadmap steps (separate specs):
Required/Preferred skills + AI weights, "Create with AI" entry, salary type/period + deadline/featured,
application-form toggles.

## Decisions made by the user

- Keep the separate **JD library**; the job picks a JD (no JD body inside the job).
- **Hiring Team = Hiring Manager + Recruiter(s) + Interviewers.** No Job Owner / Department Manager / Reporting To.
- **Stage SLA leaves the form.** New jobs get `DEFAULT_SLA`; SLA stays editable in Pipeline (PipelineConfigDrawer).
- **JD picker sits at the top of step 1** (approach A), so picking a JD still fills Title and Level.
- **Wizard inside the existing centred pop-up** (approach 1).

## Approaches considered

1. **Steps inside the existing pop-up — chosen.** Reuses `Drawer` (unsaved guard, X, Escape), every caller
   (Jobs list New/Edit/Duplicate, JD → create job, Job detail Edit/Duplicate) and most tests. Limit: 768px width.
2. Dedicated page `/jobs/new`, `/jobs/:id/edit` — roomier, deep-linkable, but ~2× the work (routing, page-level
   unsaved guard, three callers, more tests). Still reachable later because each step becomes its own component.
3. One long form + section nav — rejected: not the multi-step form the spec asks for.

## Steps

| # | Step (EN / VI) | Fields (`*` = required) |
|---|---|---|
| 1 | Job details / Thông tin cơ bản | JD* (picker + "New JD"), JD skills chips, Title*, Department, Location, Level, Employment, Workplace, Openings |
| 2 | Requirements / Yêu cầu | Minimum years, Education (plus read-only "from the JD" summary: skills / must-have, so the step is not near-empty) |
| 3 | Compensation & team / Lương & Team | Salary min/max/currency, show salary; Hiring Manager*, Recruiter(s)*, Interviewers |
| 4 | Careers page & publishing / Trang tuyển dụng & Đăng tin | Why you'll love, Additional info, Application questions, Publish / Submit for approval checkbox |

Approval banner (job sent back with a reason) stays above the stepper on every step.

## Behaviour

- **Stepper** at the top: 4 numbered items with labels; current one highlighted, completed ones ticked.
  - Create / Duplicate: can click back to any earlier or already-visited step; forward only via **Next**.
  - Edit: every step is clickable.
- **Footer:** `Back` (hidden on step 1) · `Cancel` · `Save draft` · `Next →`; on step 4 `Next` becomes `Save`
  (label unchanged from today: Save; publish intent comes from the checkbox, as now).
  - Edit mode: `Save` is available on every step (no need to walk to step 4 to fix one field), and there is **no
    `Save draft` button** — status keeps following the publish checkbox exactly as today's `save()` does, so an
    open or pending job is never unpublished by accident. *(Claude's call.)*
  - Create / Duplicate: `Save draft` saves with the publish checkbox treated as off → status `draft`.
- **Validation:** `Next` validates only the current step's required fields and stays put on error (error text under
  the field, focus first invalid). `Save` / `Save draft` validates all steps; on error jump to the first step with an
  error and focus the field.
- Step content scrolls inside the pop-up; header + stepper + footer stay fixed.
- Opening the form always starts at step 1 and resets state (as today's `useEffect` does).

## Hiring Team

- **Hiring Manager*** — unchanged (default = current user; options as today, Hiring Managers first).
- **Recruiter(s)*** — replaces the "Collaborators" UI; stored in the existing `job.collaborators` field, so
  permissions (`permissions.ts:66`), Dashboard filters and seed data keep working with no migration.
  - Options: active users with role Recruiter, Recruitment Lead or Super Admin — **including** whoever is Hiring
    Manager (a recruiter can be both); any user already in `collaborators` stays listed and checked even if their
    role differs. `collect()` no longer strips the manager out of `collaborators`. *(Claude's call: otherwise a
    Recruiter creating a job — HM defaults to themselves — could never pass step 3.)*
  - At least one required (see "Required when" below). The existing "keepsMe" rule stays: a Recruiter who names
    someone else as manager is kept on (checked, disabled).
  - Default for a new job: the current user if their role is Recruiter / Recruitment Lead / Super Admin; otherwise
    empty.
  - Required when (user decision): **only on Create and Duplicate.** Editing a job with no recruiter shows an amber
    note on step 3 ("No recruiter yet") but still saves, so a typo fix or status change is never blocked.
- **Interviewers** — new optional `job.interviewers?: string[]` (any active staff user, multi-select checkboxes).
  - `InterviewDialog` prefills the panel with `[hiringManager, ...interviewers]` (deduped) instead of just the HM.
  - Does not change permissions (Interviewer access still comes from being on an interview round).

## Data & removals

- `Job.interviewers?: string[]` added; persisted with jobs (no persist version bump needed — optional field).
- Stage SLA inputs, `slaErrors`, `slaText` and SLA validation removed from `JobDrawer`. A new blank job gets
  `stageSla: DEFAULT_SLA`; **Duplicate copies the source's `stageSla`, recruiters and interviewers** (as it copies
  everything else today); edit leaves the job's existing `stageSla` untouched (not sent in the patch).
  *(Claude's call, per "add, never cut".)*
- Baseline: the uncommitted removal of Job Templates (user asked for it on 2026-11-19) stays; this work builds on
  top of it.
- `Drawer` gets two optional slots — `subheader` (under the title bar, fixed) and `footer` (fixed at the bottom) —
  while the body keeps scrolling; the unsaved-changes `onChange` listener moves from the body to the whole
  `<aside>` so inputs in any slot count. Other `Drawer` users are unaffected (slots default to nothing).
  *(Claude's call.)*
- i18n: new keys for step names, Back/Next/Save draft, Recruiter(s), Interviewers, recruiter-required error (EN + VI);
  remove `jobs.drawer.sla` and `jobs.drawer.err.sla` if unused elsewhere; "Collaborators" label key replaced.

## Non-goals

- No new spec fields beyond `interviewers` (category, job code, salary type, deadline… are later steps).
- No change to JD Editor, Pipeline config, careers page, or the apply form.
- No full-page route.

## Anti-goals

- Losing data typed on another step when moving between steps.
- Forcing an edit to walk through all 4 steps to change one field.
- Breaking existing callers (JD → create job prefill, Duplicate, approval flow) or role-based job visibility.

## Testing

- Update JobsPage / JobDrawer tests that target SLA fields or the single-page layout.
- New tests: Next blocked by missing JD/Title (step 1) and missing recruiter (step 3); Save from step 1 jumps to the
  first invalid step; Edit can jump to step 4 directly and save from step 1; data kept across Back/Next; picking a JD
  on step 1 fills Title/Level; new job gets DEFAULT_SLA; edit keeps custom stageSla; InterviewDialog prefills
  HM + job interviewers.
- Visual check in the running app (port 5190), both EN and VI, light and dark.

## Left to the builder

Component split (e.g. `JobDrawer` keeps state, `steps/*.tsx` render), stepper styling (follow existing brand
tokens / `Drawer` look), exact copy.
