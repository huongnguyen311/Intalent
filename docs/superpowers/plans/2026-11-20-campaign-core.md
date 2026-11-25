# Campaign Core (round 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Campaign into a hiring-drive manager (info, 6-state lifecycle, per-job targets, basic budget, automatic performance) and add job-level hiring urgency with Urgent/Overdue on the Dashboard.

**Architecture:** Pure logic lives in `domain/` (`jobUrgency.ts`, `campaigns.ts`), with unit tests. The zustand store actions in `store/actions/campaigns.ts` own the lifecycle. The UI follows existing pages:
- the editor copies `features/jobs/JobEditorPage.tsx` (full page, numbered section cards, sticky footer, "Discard?" bar, `beforeunload` warning);
- list and detail reuse Campaigns styling.

**Tech Stack:** React 18 + TypeScript, react-router v6, zustand (persisted), Tailwind, Vitest + Testing Library. Run all commands from `app/`.

**Spec:** `docs/superpowers/specs/2026-11-20-campaign-core-design.md`

## Global Constraints

- Channels stay removed: no channel picker, UTM, channel budget or channel status.
- Recruitment only: nothing after Hired.
- Every new UI string goes in both `src/i18n/en.ts` and `src/i18n/vi.ts`. `vi.ts` is typed against `en.ts` keys.
- Campaign statuses, exactly: `draft | scheduled | active | paused | completed | cancelled`.
- Campaign types, exactly: `recruitment | internship | graduate | mass_hiring | other`. Campaign priority: `low | medium | high | urgent`.
- Job hiring priority, exactly: `normal | high | urgent | critical`. Urgent means `urgent` or `critical`.
- Hired, Remaining, Target Hires and all performance numbers are computed, never stored or typed.
- Bump `PERSIST_VERSION` in `src/store/persist.ts` from 11 to 12, once, in Task 3.
- **Layout deviation from the spec:** the spec says "horizontal step bar". The current `JobEditorPage` uses numbered section cards on one page, and the user asked for "like Create Job", so follow the current page.
- **No git commits** unless the user asks. The branch holds a lot of unrelated uncommitted work. Each task ends with a green-suite checkpoint instead.

## Review Focus

1. A campaign whose job was later closed or deleted: the jobs table, links and editor must not crash. Show the job id as the title and "—" for status. (Task 6 test)
2. A campaign with Target Hires 0 is impossible, but if `hired > target` the result is Remaining 0, never negative, and progress capped at 100%. (Task 3 test)
3. A legacy saved campaign with `status: 'ended'` cannot occur, because the persist bump resets data. Even so, `effectiveStatus` must map an unknown status to `completed` rather than crash the badge. (Task 3 test)
4. Budget given but 0 hires: Cost per hire shows "—", not `Infinity`/`NaN`. (Task 3 test)
5. A Recruiter editing a campaign that already holds a job outside their scope: that job stays listed and keeps its target. Today's wizard has the same rule. (Task 5 test)

---

### Task 1: Job hiring urgency (data, domain, job editor)

**Files:**
- Modify: `src/domain/types.ts` (Job interface)
- Create: `src/domain/jobUrgency.ts`, `src/domain/jobUrgency.test.ts`
- Create: `src/components/PriorityBadge.tsx`
- Modify: `src/features/jobs/useJobForm.ts`, `src/features/jobs/steps/DetailsStep.tsx`, `src/features/jobs/JobEditorPage.test.tsx`
- Modify: `src/data/seed.ts` (job priorities and dates), `src/i18n/en.ts`, `src/i18n/vi.ts`

**Interfaces:**
- Produces:
  - `type HiringPriority = 'normal' | 'high' | 'urgent' | 'critical'` and `HIRING_PRIORITIES: HiringPriority[]`, in `types.ts`.
  - New `Job` fields: `hiringPriority?: HiringPriority; targetHiringDate?: string; urgencyReason?: string; priorityNotes?: string`.
  - In `jobUrgency.ts`:
    - `priorityOf(job: Job): HiringPriority` (undefined → `'normal'`)
    - `isUrgent(job: Job): boolean`
    - `jobHires(jobId: string, applications: Application[]): number`
    - `isOverdue(job: Job, applications: Application[], today: string): boolean`, where `today` is `YYYY-MM-DD`
  - `<PriorityBadge priority={HiringPriority | CampaignPriority} />`. It renders nothing for `'normal'`. It uses i18n keys `priority.<value>`.

- [ ] **Step 1: Write failing tests** in `jobUrgency.test.ts`:
  - `priorityOf({}) === 'normal'`.
  - `isUrgent` is true only for `urgent` and `critical`.
  - `isOverdue` is true for: open job, `targetHiringDate: '2026-11-01'`, today `'2026-11-20'`, `headcount: 2`, 1 hired application.
  - `isOverdue` is false when the job has 2 hired, when the status is `on_hold`, when there is no `targetHiringDate`, and when the date equals today.
  - `jobHires` counts stage `hired` from any source.
- [ ] **Step 2:** Run `npx vitest run src/domain/jobUrgency.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the types and `jobUrgency.ts`.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Write failing editor tests** in `JobEditorPage.test.tsx`:
  - The create page shows a "Hiring urgency" group with a Priority select (default `Normal`) and a "Target hiring date" input, prefilled with today + 60 days.
  - Clearing the date and pressing Save shows the error `Pick a target hiring date` and does not save.
  - Saving with priority `Critical` and reason `Project needs devs now` stores `hiringPriority: 'critical'`, `urgencyReason`, `targetHiringDate`.
  - Editing a seeded job that has no date prefills today + 60.
- [ ] **Step 6: Implement.**
  - Add `hiringPriority`, `targetHiringDate`, `urgencyReason` and `priorityNotes` to `JobFormValues`. Map them in load and save.
  - Add `targetHiringDate` validation to the existing validation (same `form.err` mechanism).
  - Add the group to `DetailsStep` under the headcount grid: Priority select, Target hiring date (`type="date"`), Urgency reason (input), Priority notes (textarea).
  - i18n:
    - `jobs.drawer.urgency` = "Hiring urgency" / "Mức độ ưu tiên tuyển"
    - `jobs.drawer.priority`, `jobs.drawer.targetDate`, `jobs.drawer.urgencyReason`, `jobs.drawer.priorityNotes`, `jobs.err.targetDate`
    - `priority.normal|high|urgent|critical|low|medium`
- [ ] **Step 7: Seed.** Give seeded jobs priorities and target dates: at least 2 with `urgent`/`critical`, and at least 1 open job overdue (date in the past and hires < headcount). Use `clock.daysAgo(...)`. Add no new `rng()` draws, so the rest of the seed is unchanged.
- [ ] **Step 8: Checkpoint.** Run `npx tsc --noEmit -p . && npx vitest run`. Expected: all pass.

### Task 2: Jobs page priority, Overdue filter, Dashboard tiles

**Files:**
- Modify: `src/features/jobs/JobsPage.tsx`, `src/features/jobs/JobsPage.test.tsx`
- Modify: `src/features/dashboard/DashboardPage.tsx` (and `DashboardWidgets.tsx` for the tile component), `src/features/dashboard/DashboardPage.test.tsx`
- Modify: i18n

**Interfaces:**
- Consumes: Task 1 `priorityOf`, `isUrgent`, `isOverdue`, `PriorityBadge`.
- Produces: URL params on `/jobs`:
  - `priority=<comma list of HiringPriority>`
  - `overdue=1`

- [ ] **Step 1: Write failing tests.**
  - `/jobs?priority=urgent,critical` lists exactly the in-scope jobs where `isUrgent` holds.
  - `/jobs?overdue=1` lists exactly the overdue jobs.
  - A row of a `critical` job shows the text `Critical`.
  - On the dashboard, tiles `data-testid="tile-urgent-jobs"` and `tile-overdue-jobs` show the counts of open in-scope urgent/overdue jobs, and link to `/jobs?priority=urgent,critical` and `/jobs?overdue=1`.
  - Signed in as `u-huy`, the counts use `jobsInScope`.
- [ ] **Step 2:** Run `npx vitest run src/features/jobs/JobsPage.test.tsx src/features/dashboard`. Expected: FAIL.
- [ ] **Step 3: Implement the Jobs page.**
  - Add a Priority popover filter: multi-select, initialised from `?priority=`.
  - Add an "Overdue" toggle chip, initialised from `?overdue=1`.
  - Render `PriorityBadge` beside the title.
  - Also update `campaignsByJob`'s status rank: `active 0, scheduled 1, paused 2, draft 3, completed 4, cancelled 5`. Task 3 changes the type, so this must type-check after Task 3; do it now, typed as `Record<string, number>`.
- [ ] **Step 4: Implement the dashboard.** Add the two tiles next to the existing open-jobs block. They ignore the dashboard period filter.
- [ ] **Step 5: Checkpoint.** Run `npx tsc --noEmit -p . && npx vitest run`. Expected: all pass.

### Task 3: Campaign model, domain logic, store lifecycle, seed

**Files:**
- Modify: `src/domain/types.ts`, `src/domain/campaigns.ts`, `src/domain/campaigns.test.ts`
- Modify: `src/store/actions/campaigns.ts`, `src/store/actions/types.ts`, `src/store/campaigns.test.ts`
- Modify: `src/store/actions/careers.ts`, `src/store/careers.test.ts`
- Modify: `src/data/seed.ts`, `src/data/seed.test.ts`, `src/store/persist.ts` (11 → 12)
- Modify (compile fixes only): `features/jobs/JobTabs.tsx`, `features/jobs/JobsPage.tsx`, and existing campaign pages, just enough to compile. Tasks 4–6 rebuild those pages.

**Interfaces:**
- Produces, in `types.ts`:
  - The `Campaign` type exactly as in the spec "Campaign (replaces the current shape)" section, plus `links: CampaignLink[]` and `createdAt: string`.
  - `CampaignJob`, `CampaignType`, `CampaignPriority`, `CampaignStatus` (6 values), `CAMPAIGN_TYPES`, `CAMPAIGN_STATUSES`.
  - `CampaignInput = Omit<Campaign, 'id' | 'code' | 'status' | 'links' | 'stats' | 'createdAt'>`, `CampaignPatch = Partial<CampaignInput>`.
- Produces, in `campaigns.ts` (keep `trackingLink`, `parseSrc`, `DEMO_ORIGIN`):
  - `campaignJobIds(c): string[]`
  - `campaignLinks(c: Pick<Campaign,'id'|'jobs'>, origin): CampaignLink[]`
  - `nextCampaignCode(existing: Campaign[], createdAt: string): string`. Format `CMP-<YYYY>-<NNN>`, 3-digit zero-padded, max+1 within that year.
  - `effectiveStatus(c, today: string): CampaignStatus`. `scheduled` with `today >= start` gives `active`. An unknown value gives `completed`.
  - `targetHires(c): number`
  - `pastEnd(c, today): boolean`, true when the effective status is `active` and `today > end`.
  - `launchStatus(start: string, today: string): 'scheduled' | 'active'`
  - `canEdit(c): boolean`, false for completed and cancelled.
  - `campaignPerformance(state, campaignId, now: Date): CampaignPerformance`, with `{ total, new, aiScreened, shortlisted, interviewed, offers, hired, rejected, steps: Array<{ key, count, rate?: number }>, costPerHire?: number }`, using the rules in the spec table:
    - "new" is `addedAt` within 7 days of `now`.
    - "shortlisted" means `interview` or any later `FORWARD_STAGES` entry, in `history` or as the current stage.
    - "offers" means `offer.status` is `sent`, `accepted` or `declined`.
  - `campaignJobRows(state, campaign): Array<{ jobId, title, target, hired, remaining, jobStatus?: Job['status'], priority: HiringPriority, targetHiringDate?: string }>` plus `totals: { target, hired, remaining }`.
  - `campaignStats` stays: views, applicants, conversion, hires, byJob.
- Produces, as store actions (replacing the current ones):
  - `createCampaign(input: CampaignInput, opts: { launch: boolean; today: string; id?: string }): Campaign`. Status is `draft`, or `launchStatus(start, today)`. Sets `code` and `createdAt`.
  - `updateCampaign(id, patch): boolean`. Returns false when `!canEdit`.
  - `launchCampaign(id, today): boolean`. Draft only. False when `end < today`.
  - `setCampaignStatus(id, status): boolean`. It enforces exactly these transitions:
    - active → paused, completed, cancelled
    - paused → active, completed, cancelled
    - draft → cancelled
    - scheduled → cancelled
    - Anything else returns false.
  - `jobHasCampaignApplicants(campaignId, jobId): boolean`

- [ ] **Step 1: Write failing domain tests.**
  - `nextCampaignCode([], '2026-11-20T..')` gives `CMP-2026-001`. With existing `CMP-2026-007` it gives `CMP-2026-008`. With only `CMP-2025-010` it gives `CMP-2026-001`.
  - `effectiveStatus`: scheduled with start `2026-12-01` on `2026-11-20` stays `scheduled`, and becomes `active` on `2026-12-01`. `{status:'ended'}` gives `completed`.
  - `targetHires` of targets 3, 2, 2 is 7.
  - Job rows for targets 3/2/2 and hired 1/0/1 give remaining 2/2/1 and totals 7/2/5. Hired 4 against target 3 gives remaining 0.
  - A row for a deleted job id has title equal to the id and `jobStatus` undefined.
  - `campaignPerformance`, built from synthetic applications, covers each metric. One application rejected after reaching `interview` counts as shortlisted and rejected. An offer with status `draft` does not count. `rate` is `count / previous count`, and undefined when the previous count is 0.
  - `costPerHire` is `budget/hired`, and undefined with 0 hires or no budget.
- [ ] **Step 2:** Run `npx vitest run src/domain/campaigns.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the types and domain functions.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Write failing store and careers tests.**
  - `createCampaign(…, { launch:false })` gives `draft`. Launch with start > today gives `scheduled`; otherwise `active`. Codes are sequential.
  - `launchCampaign` fails when `end < today`.
  - The transition table: every allowed pair is true and one disallowed pair (`completed → active`) is false.
  - `updateCampaign` on a completed campaign is false.
  - Careers apply through `?src=<draft campaign id>` gives `via: 'careers'`, with no `campaignId`. The same holds for cancelled. Active, paused, scheduled and completed still attribute.
- [ ] **Step 6: Implement** the store actions and the attribution rule. Then rewrite the seed campaigns:
  - 5–6 campaigns covering every status.
  - Mixed types, owners as user ids, one with budget + currency + cost-per-hire target.
  - One `active` past its end date.
  - Seeded campaign applicants only on campaigns that are not draft or cancelled.
  - Keep `rng()` draw counts unchanged where campaigns feed the application loop. If a draw count must change, update `seed.test.ts` expectations deliberately and say so in the checkpoint.
- [ ] **Step 7: Compile fixes.** Bump `PERSIST_VERSION` to 12. Minimally adapt the existing campaign pages, `JobTabs` and `JobsPage` to `campaignJobIds(c)`. The old drawer wizard may be stubbed to the new input; Task 4 deletes it.
- [ ] **Step 8: Checkpoint.** Run `npx tsc --noEmit -p . && npx vitest run`. Expected: all pass. Old UI campaign tests that assert removed behaviour may be marked `it.todo` with a pointer to Tasks 4–6. List them in the checkpoint note.

### Task 4: Campaign editor page (`/campaigns/new`, `/campaigns/:id/edit`)

**Files:**
- Create: `src/features/campaigns/useCampaignForm.ts`, `src/features/campaigns/CampaignEditorPage.tsx`, `src/features/campaigns/CampaignEditorPage.test.tsx`
- Delete: `src/features/campaigns/CampaignWizard.tsx`
- Modify: `src/routes.tsx` (both routes, `Guard perms={['campaign']}`), `CampaignsPage.tsx` (New button navigates to `/campaigns/new`), i18n

**Interfaces:**
- Consumes: Task 3 actions and domain functions, `jobsInScope`, `PriorityBadge`.
- Produces: `useCampaignForm({ campaign?: Campaign })`, which returns `{ values, set, err(field), touched, saveDraft(): Campaign|null, launch(): Campaign|null, save(): boolean }`.

Page sections, in order, as numbered cards (the same markup pattern as `JobEditorPage`):

1. **Details:**
   - Name\*, Type\* (select), Description (textarea)
   - Owner\* (user select; default = current user id; empty for the demo Super Admin), Department (input + datalist of job departments), Hiring manager (user select), Priority (select, optional)
   - Start\*, End\*, Application deadline
2. **Jobs & targets:** a checklist of `selectableJobs` (open in-scope jobs, plus jobs already on the campaign). Each checked row shows:
   - `PriorityBadge`
   - the target hiring date, red when `isOverdue`
   - the job status
   - a Target number input (default `job.headcount ?? 1`)
   - A job with campaign applicants is checked and disabled, with the hint `Has applicants from this campaign`.
   - A Total row shows `Target hires: N`.
3. **Goals & budget:** Target applicants, Target shortlisted, Budget + Currency (`CURRENCIES`, default `VND`), Cost-per-hire target.
4. **Review:** the campaign link per job via `LinkRow`. `copyable` only in edit mode, with the hint `campaigns.wizard.linksLater` on create.

**Footer:**
- Create: Cancel · Save as draft · Launch
- Edit: Cancel · Save

The Discard bar and the `beforeunload` behaviour are the same as `JobEditorPage`. `/campaigns/:id/edit` for a completed or cancelled campaign, or an unknown id, renders `NotFoundState`, with the message `campaigns.detail.readOnly` or `notFound`.

**Validation errors** (exact English copy):
- `Enter a campaign name`, `Pick a campaign type`, `Pick an owner`
- `Pick start and end dates`, `End date must be on or after the start date`
- `Application deadline must be between start and end`
- `Select at least one job`, `Target must be a whole number of 1 or more`
- `Enter 0 or more`, for the goal and budget numbers
- On Launch only: `End date has passed; change it before launching`

- [ ] **Step 1: Write failing tests** in `CampaignEditorPage.test.tsx`:
  1. Launch with empty fields shows the name, type, owner and job errors, and saves nothing.
  2. Fill all fields, pick 2 jobs, set targets 3 and 2: the total reads `Target hires: 5`. Launch with start = today stores `status: 'active'`, `jobs: [{jobId,target:3},{…,2}]`, `code` matching `/^CMP-\d{4}-\d{3}$/`, and navigates to `/campaigns/<id>`.
  3. Save as draft stores `draft`.
  4. Start in the future and Launch gives `scheduled`.
  5. Launch with an end in the past shows the launch error.
  6. Deadline outside start..end shows the error.
  7. In edit mode for `camp-1`, the job with campaign applicants has a disabled checkbox.
  8. Review focus #5: signed in as `u-huy`, editing a seeded campaign that holds an out-of-scope job keeps that job listed and its target unchanged after Save.
  9. Edit of a completed campaign shows the read-only message.
  10. Cancel after typing shows the Discard bar.
- [ ] **Step 2:** Run `npx vitest run src/features/campaigns/CampaignEditorPage.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the hook, the page and the routes. Delete the wizard. Remove its tests from `Campaigns.test.tsx`.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Checkpoint.** Run `npx tsc --noEmit -p . && npx vitest run`. Expected: all pass.

### Task 5: Campaigns list page

**Files:** Modify `src/features/campaigns/CampaignsPage.tsx`, `src/features/campaigns/CampaignBits.tsx` (6 status styles), `src/features/campaigns/Campaigns.test.tsx`, i18n.

**Interfaces:**
- Consumes: `effectiveStatus`, `targetHires`, `campaignStats`, `campaignJobIds`, `userName`.
- Produces: `CampaignStatusBadge` for all 6 statuses.
  - draft: gray outline
  - scheduled: blue
  - active: green (current)
  - paused: amber (current)
  - completed: gray (current "ended")
  - cancelled: red

- [ ] **Step 1: Write failing tests.**
  - The columns are exactly: Name, Type, Owner, Jobs, Period, Status, Progress, Priority.
  - The Name cell shows the code under the name.
  - Progress reads `<hires>/<targetHires> hired`, with the bar capped at 100%.
  - Search matches the code (`CMP-2026-001`).
  - The Status filter offers 6 statuses and filters by effective status: a scheduled campaign past its start appears under Active.
  - The Type filter works.
  - The New campaign button (still in the filter row) navigates to `/campaigns/new`.
- [ ] **Step 2:** Run `npx vitest run src/features/campaigns/Campaigns.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Checkpoint.** Run `npx tsc --noEmit -p . && npx vitest run`. Expected: all pass.

### Task 6: Campaign detail page

**Files:** Modify `src/features/campaigns/CampaignDetailPage.tsx`, `src/features/campaigns/Campaigns.test.tsx`. Create `src/features/campaigns/CampaignFunnel.tsx`. Modify i18n.

**Interfaces:**
- Consumes: Task 3 `campaignPerformance`, `campaignJobRows`, `effectiveStatus`, `pastEnd`, `canEdit`, `launchCampaign`, `setCampaignStatus`.
- Produces: `<CampaignFunnel perf={CampaignPerformance} />`. It renders 8 rows: Total, AI screened, Shortlisted, Interviewed, Offers sent, Hired, plus New and Rejected shown apart from the chain. Each chain row shows its count and its rate as a percentage.

**Layout:**
- **Header:**
  - name, `code`, status badge (effective), type, owner name, period, deadline
  - actions by effective status:
    - draft: Edit, Launch, Cancel
    - scheduled: Edit, Cancel
    - active: Edit, Pause, Complete, Cancel
    - paused: Edit, Resume, Complete, Cancel
    - completed / cancelled: none
  - Cancel asks for confirmation through the existing confirm pattern.
- **Past-end hint:** shown when `pastEnd`. The banner reads `Ended on <date>. Mark completed?` with a Complete button.
- **KPIs:**
  - Views
  - Applicants (hint: `Target <n>` when set)
  - Hires (hint: `of <targetHires>`)
  - Cost per hire (formatted in the campaign currency, "—" when undefined, hint: `Target <x>` when set)
- **Funnel.**
- **Jobs table** (`data-testid="campaign-jobs"`):
  - columns: Job (link `/pipeline/<id>`), Priority, Target date (red when overdue), Job status, Target, Hired, Remaining
  - a Total row
  - It replaces the "Applicants by job" table.
- **Applicants table:** unchanged.
- **Campaign links.**

- [ ] **Step 1: Write failing tests.**
  - The header shows the code.
  - For an active campaign, Pause sets `paused`; Complete sets `completed` and hides every action.
  - Draft shows Launch, and Launch sets the status via `launchStatus`.
  - Cancel needs confirmation, then sets `cancelled`.
  - The past-end seeded campaign shows the banner, and its Complete button works.
  - The jobs table total row equals `campaignJobRows(...).totals`.
  - Review focus #1: a campaign with a job id missing from `jobs` renders that row with the id and `—`.
  - The funnel row counts equal `campaignPerformance(...)`.
  - Cost per hire shows `—` with 0 hires.
- [ ] **Step 2:** Run `npx vitest run src/features/campaigns/Campaigns.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Final checkpoint.**
  - Run `npx tsc --noEmit -p . && npx vitest run`. Expected: all pass.
  - Then use the `run` skill to open `/campaigns`, `/campaigns/new` and one detail page at 1440px and 1024px. Fix overflow if any.
  - Report the screenshots to the user.
