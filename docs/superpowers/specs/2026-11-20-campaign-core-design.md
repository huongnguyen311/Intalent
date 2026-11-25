# Campaign core (round 1): design

Date: 2026-11-20 · Branch: `feat/recruitment-app` · App: `app/` (React prototype, zustand store, persisted demo data)

## Intent

HR asked for a Campaign module that manages a hiring drive: who owns it, which jobs it covers and how many people each job needs, how urgent each job is, the budget, and automatic performance numbers. Today's campaign (`features/campaigns/*`, `domain/campaigns.ts`) is mostly about tracking links per channel. This round makes it a hiring-drive manager.

**Already done (2026-11-20, before this plan):** channels are removed from the code. `channels` is gone from the Campaign type, there is one link per job (`?src=<campaignId>`), legacy `-<channel>` links are still parsed, applicants from campaign links get `source: 'Campaign'` (`SOURCE_CAMPAIGN`), `campaignStats` returns `byJob`, the drawer wizard has 2 steps, and `PERSIST_VERSION` = 11. Status: approved by the user, including the full-page editor.

The user's spec covers more than this round. Referral (program, rewards, tracking, payout workflow, referral metrics) is **round 2** and gets its own design. Nothing here should block it.

## Decisions made by the user

- **Channels are removed completely.** This covers: channel picker, channel list, channel icons and column, per-channel post previews, the by-channel chart, UTM, channel budget and channel status. Each job in a campaign has **one** campaign link.
- **Hiring Priority belongs to the Job**, not to campaign × job. The campaign only displays it.
- **Recruitment-only scope.** Nothing in this round tracks a candidate after Hired. Round 2's referral payout stage is capped at Hired.
- **Keep what already works well:** the wizard/editor behaviour patterns, tracking attribution of applicants to a campaign, Views/Conversion KPIs and the applicants table.

## Goals

1. Campaign information: Name, auto Code, Description, Type, Department, Hiring Manager, Owner, Priority.
2. Timeline and the 6-state lifecycle: Draft, Scheduled, Active, Paused, Completed, Cancelled. Plus an Application Deadline.
3. Jobs with a per-job **Target headcount**. Hired, Remaining and Job status are computed. A total row is shown.
4. Basic Goals & Budget: Target Applicants, Target Shortlisted, Target Hires (computed), Budget, Currency, Cost-per-Hire target.
5. Automatic Performance: Total, New, AI Screened, Shortlisted, Interviewed, Offers Sent, Hired, Rejected, step conversion, Cost per Hire.
6. Job-level Hiring Urgency. Urgent and Overdue job counts on the Dashboard.
7. Create/Edit as a full-screen page with a step bar, in place of today's 3-step drawer.

## Non-goals (this round)

- Referral anything (round 2), including the "Referral & Rewards" wizard step.
- Auto-posting to job boards, UTM, attribution/ROI beyond Cost per Hire.
- Anything after Hired: probation, onboarding, payouts.

## Anti-goals

- Reintroducing channels in any form.
- Making HR type numbers the system can count. Hired, Remaining, Target Hires and every Performance metric are computed.

## Data model

### Job (`domain/types.ts`): new optional fields

| Field | Type | Notes |
|---|---|---|
| `hiringPriority` | `'normal' \| 'high' \| 'urgent' \| 'critical'` | Default `normal`. Undefined reads as normal. |
| `targetHiringDate` | ISO date | Required in the job editor. Prefilled with today + 60 days for new jobs and when an existing job without one is edited. |
| `urgencyReason` | string | Optional. |
| `priorityNotes` | string | Optional. |

- "Urgent Hiring Yes/No" from the spec is **derived**: `urgent = hiringPriority ∈ {urgent, critical}`. There is no separate toggle, because a separate toggle could contradict the priority. *(builder's call, flagged to user)*
- "Approval Required" from the spec maps to the existing job approval flow (`pending_approval`). Nothing new is added for it.

**Overdue job:** status `open`, `targetHiringDate < today`, and hires for the job < `headcount ?? 1`. Here "hires" means applications for that job at stage `hired`, from any source. A job with no `targetHiringDate` (duplicates, JD → job, older data) is never overdue, and a missing date never blocks publishing. *(builder's call)*

Editor placement: a "Hiring urgency" group in `features/jobs/steps/DetailsStep.tsx`, together with headcount. Jobs list (`JobsPage.tsx`) shows a priority badge for jobs that are not normal. The priority badge component is shared between Jobs and Campaigns.

### Campaign (replaces the current shape)

```ts
type CampaignType = 'recruitment' | 'internship' | 'graduate' | 'mass_hiring' | 'other';
type CampaignPriority = 'low' | 'medium' | 'high' | 'urgent';
type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';

interface CampaignJob { jobId: string; target: number }   // target ≥ 1 integer

interface Campaign {
  id: string;
  code: string;               // auto, e.g. CMP-2026-007: year of creation + running number, never edited
  name: string;
  description?: string;
  type: CampaignType;
  department?: string;        // free text with suggestions from existing Job.department values
  hiringManager?: string;     // user id, same picker and storage as Job.hiringManager
  owner: string;              // user id, required; defaults to the current user's id. The demo Super Admin has no id, so for them the field starts empty and must be picked (builder's call)
  priority?: CampaignPriority;
  start: string; end: string; // ISO dates, end ≥ start
  applicationDeadline?: string; // within start..end
  status: CampaignStatus;     // stored; see effectiveStatus
  jobs: CampaignJob[];        // ≥ 1
  goals: {
    targetApplicants?: number;
    targetShortlisted?: number;
    budget?: number;
    currency?: Currency;      // default from company settings / VND
    costPerHireTarget?: number;
  };
  stats: { views: number };   // unchanged
}
```

- Removed: `channels`, `goal`, `jobIds`, `links`, `CampaignLink`, `CHANNELS`/`CHANNEL_ICON`/`CHANNEL_SOURCE`, `ChannelIcons`, the post previews and the by-channel chart.
- **Target Hires** = Σ `jobs[].target`. It is computed and never stored.
- **Campaign link** for a job: `${origin}/careers/${jobId}?src=${campaignId}`. `parseSrc` accepts the exact campaign id. For old saved links it also tries the text before the last `-` (the old `campaignId-channel` form).
- **Attribution** (`store/actions/careers.ts`): unchanged in spirit. A matching campaign that covers the job gives `via: 'campaign'`, `campaignId`, and `source: 'Campaign'` (a new constant, previously the channel name). Status `draft` or `cancelled` does not attribute; the applicant then counts as plain careers traffic. *(builder's call)*

### Status lifecycle

- **Create page:** "Save as draft" → `draft`. "Launch" → `scheduled` if start > today, otherwise `active`.
- **Detail page actions:**
  - Pause (active → paused)
  - Resume (paused → active)
  - Complete (active/paused → completed)
  - Cancel (draft/scheduled/active/paused → cancelled, with a confirm)
  - Launch (draft → scheduled/active)
- **`effectiveStatus(c, today)`** is used everywhere status is shown or filtered: `scheduled` with today ≥ start shows as `active`. Nothing auto-completes; HR completes a campaign by hand. If an `active` campaign is past `end`, the detail page shows an "Ended on …, mark completed?" hint.
- **Editing:** allowed in every status except `completed` and `cancelled`, which are read-only.
- **Status changes only through Launch and the explicit actions, never on save.** Moving the start date of an `active` campaign into the future leaves it `active`. Launch is blocked with a field error when end < today. *(builder's call)*
- **Removing a job from a campaign is blocked once that job has applicants attributed to the campaign.** The row shows a lock with the reason, so campaign totals always equal the sum of the job rows. *(builder's call)*

## Computed numbers (`domain/campaigns.ts`)

All counts use the applications attributed to the campaign (`application.campaignId === c.id`). Per job, also filter on `jobId`. *(Builder's call: attributed only, so two overlapping campaigns never double-count.)*

| Metric | Rule |
|---|---|
| Total applicants | count |
| New | `addedAt` within the last 7 days |
| AI Screened | `aiEvaluations?.length > 0` |
| Shortlisted | ever reached `interview` or a later stage, by `history` or current stage |
| Interviewed | has an interview with status `done` |
| Offers sent | has an `offer` whose status is past draft (sent or later) |
| Hired | stage `hired` |
| Rejected | stage `rejected` |
| Conversion | each funnel step ÷ the step before it (Total → AI Screened → Shortlisted → Interviewed → Offers → Hired) |
| Cost per Hire | `budget / hired` when both > 0, otherwise "—". Compared against `costPerHireTarget` when it is set. |
| Per job | Target, Hired, Remaining = max(0, target − hired), Job status (the job's own status) |
| Views, Conversion (views → applicants) | kept as today |

## Screens

### Campaigns list (`CampaignsPage.tsx`)

- Columns: Name (with the code under it), Type, Owner, Jobs, Period, Status (effective), Progress, Priority.
- Progress = hires / Target Hires.
- Filters: search (name or code), Status (6), Type.
- The New campaign button stays in the filter row, right side (already done).

### Create / Edit page: `/campaigns/new`, `/campaigns/:id/edit`

This follows `JobEditorPage` patterns: full screen, horizontal step bar, ← Campaigns link, leave-page warning, draft restore for new campaigns. The `CampaignWizard` drawer is deleted.

1. **Details:**
   - Name\*, Type\*, Description
   - Owner\* (default: me), Department, Hiring Manager, Priority
   - Start\*, End\*, Application deadline
2. **Jobs & Targets:**
   - Pick jobs (open jobs in the user's scope, plus the ones already on the campaign).
   - Each picked job row shows: title, job priority badge, target hiring date (red if overdue), job status, and a **Target** input. Target defaults to `job.headcount ?? 1`.
   - A total row shows Target Hires.
   - Below the jobs: **Goals & budget**, with Target applicants, Target shortlisted, Budget + Currency, and Cost-per-hire target.
3. **Review & Launch:**
   - Read-only summary of steps 1–2 and the campaign link for each job (copy enabled only after save, as today).
   - Buttons: Save as draft, Launch.
   - In edit mode the single button is Save.

Validation runs on Next and points at the field:

- the required fields
- end ≥ start
- deadline within start..end
- at least 1 job
- each target a positive integer
- numbers ≥ 0

### Campaign detail (`CampaignDetailPage.tsx`)

- **Header:**
  - name, code, status badge, type, owner, period, deadline
  - status actions (see lifecycle) and Edit
- **KPI row:**
  - Views
  - Applicants (vs target applicants)
  - Hires (vs Target Hires)
  - Cost per hire (vs target)
- **Funnel** of the 8 metrics, with step conversion. Reuse or adapt `features/dashboard/Funnel.tsx`.
- **Jobs table:**
  - Job (links to its pipeline), Priority, Target date, Job status, Target, Hired, Remaining
  - a Total row
  - This takes the place of the by-channel chart.
- **Applicants table:** kept as today. The Source column becomes "Job · applied" and the channel label is dropped.
- **Campaign links:** one row per job, with copy.

### Dashboard

Two new tiles in the existing dashboard layout: **Urgent jobs** (open jobs with urgent/critical priority) and **Overdue jobs**. Each tile links to the Jobs page with a matching filter. The Jobs page gets a Priority filter and an "Overdue" toggle, both readable from the URL (`/jobs?priority=urgent,critical`, `/jobs?overdue=1`). Both tiles count open jobs in the viewer's scope (`jobsInScope`) and ignore the dashboard's period filter, because they describe the current state. *(builder's call)*

## Data / persistence

- Bump `PERSIST_VERSION`. A mismatch resets to seed, which is the existing behaviour, so no migration code is needed.
- Seed:
  - Rewrite seeded campaigns in the new shape, covering every status, mixed types, budgets, and at least one past-end active campaign.
  - Give seeded jobs priorities and target dates, with at least 2 urgent/critical and 1 overdue.
  - Seeded campaign applicants use `source: 'Campaign'`.
- i18n: every new string goes in `en.ts` and `vi.ts`.

## Approaches considered

- **A. Two rounds, core first (chosen by user).** This round uses only data the app already has. Referral is a new flow involving outside people, duplicate checks and approvals, so it deserves its own design.
- **B. Everything in one round.** One delivery, but a very large spec and review, and core would wait on referral.
- **Channel handling:** the user chose to remove channels outright, rather than hiding the step or trimming only the spec's channel extras.

## Left to the builder

- Exact visuals, which should follow existing Jobs/Campaign styling.
- Component split, how the editor pages share code with the job editor, and test layout.
- Code numbering storage.
- The Funnel component reuse versus a new one.

## Revision: jobs join from the Job form, no tracking links (2026-11-20, after round 1)

The user simplified the campaign after reviewing round 1. These rules override the sections above where they conflict.

- **Fields removed from Campaign:** Type, Department, Hiring manager, Target shortlisted, Cost-per-hire target. The list loses its Type column and Type filter; the detail header loses the type chip.
- **Fields kept:** Name, Code, Description, Owner, Priority, Start/End, Application deadline, Status, Target applicants, Budget + Currency.
- **Jobs join from the Job form.** `Job.campaignId` (one campaign per job) is picked on Create/Edit Job. The picker lists campaigns that have not finished, plus the job's current one. The campaign editor no longer has a Jobs & targets section, and a campaign can be created and launched with no jobs.
- **Target per job = the job's openings (`headcount`, default 1).** Target hires = the sum over the campaign's jobs.
- **Campaign jobs** = jobs pointing at the campaign, then jobs it already credited applicants to (moved since, marked "Moved to another campaign"; deleted ones show by id with target 0).
- **No tracking links.** `?src` is no longer read. A careers-page applicant to a job is credited to the job's campaign only while that campaign is effectively active (a scheduled one counts from its start date). Draft, paused, completed and cancelled campaigns credit nothing. Applicants HR adds manually or from the Talent Pool are never credited.
- **Source = the campaign name.** It is stored on the application and shown wherever the source appears.
- Moving a job to another campaign leaves earlier applicants credited to the old campaign.
- `PERSIST_VERSION` = 13.
