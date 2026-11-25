# Job editor as a full-screen page (with live careers preview)

Date: 2026-11-19 · Branch: `feat/recruitment-app` · Follows `2026-11-19-create-job-wizard-design.md`

## Intent

The 4-step Create / Edit / Duplicate Job wizard currently lives in a centred pop-up (`JobDrawer` inside `Drawer`,
max 768px). The roadmap adds a lot to it (required/preferred skills with weights, "Create with AI" with a review
step, salary type/period, deadline, application-form toggles), which will not fit a pop-up. The user chose a
full-screen page now, **with a live careers-page preview beside the form** (option B), so the job post can be
checked while it is written.

## Decisions made by the user

- Full-screen page instead of the pop-up, for Create, Edit and Duplicate.
- Live preview of the careers-page post next to the form (collapsible; hidden on narrow screens).
- Everything decided for the wizard stays (4 steps, step rules, Hiring Team, no Stage SLA, edit has no Save draft,
  recruiters required on Create/Duplicate only, X/escape/discard behaviour translated to the page — see below).

## Approaches considered

1. **Shared form logic + new page — chosen (Claude's call; the user handed over the how).** Move all form state,
   validation and save logic out of `JobDrawer` into a hook (`useJobForm`), keep the four step bodies as components,
   and build `JobEditorPage` for layout. `JobDrawer` is deleted.
2. Keep `JobDrawer` with a "page" variant — rejected: one component carrying two layouts, one of them unused.
3. Switch the app to a data router to block in-app navigation with unsaved changes — rejected: app-wide change, out
   of scope; covered instead by a restorable draft (below).

## Routes

| URL | Opens |
|---|---|
| `/jobs/new` | blank Create |
| `/jobs/new?fromJd=<jdId>` | Create with that JD picked (title/level filled as today) |
| `/jobs/:id/edit` | Edit |
| `/jobs/:id/duplicate` | Duplicate (title + " (Copy)") |

- Guarded like `/jobs` (`Guard perms={['pipeline']}`) and additionally `can(user, 'job.edit')`; without it, show the
  existing `NoAccess`. Unknown job id → the same "not found" the job detail page shows. The job is looked up in the
  user's **scope** (`jobsInScope`), not all jobs: a job that exists but is outside it shows the same lock / no-access
  state `JobDetailPage` shows. *(Claude's call — otherwise a Recruiter could edit jobs they cannot open.)*
- Backward compatibility: `/jobs?new=1` and `/jobs?fromJd=…` redirect (replace) to `/jobs/new` and
  `/jobs/new?fromJd=…` (sign-up and old links keep working).
- Callers change from opening the pop-up to navigating: Jobs list "New job" / row Edit / row Duplicate, Job detail
  Edit / Duplicate, JD detail "Create Job from this JD" (→ `/jobs/new?fromJd=`), Dashboard empty-state link.

## Layout

```
┌ App shell (sidebar stays) ────────────────────────────────────────────────────────────┐
│ ← Jobs   Create Job                                       [Cancel] [Save draft] [Next →]│  sticky header
├──────────────┬────────────────────────────────────────┬────────────────────────────────┤
│ 1 ✓ Job      │  Step title                            │  Careers preview      [Hide ⟩] │
│   details    │  (form fields of the current step,     │  (CareersPreviewTab fed with   │
│ 2 ● Require- │   two columns where today's form has   │   the draft job + picked JD,   │
│   ments      │   a 2-col grid)                        │   updates as you type)         │
│ 3   Comp. &  │                                        │                                │
│   team       │                                        │                                │
│ 4   Careers  │                                        │                                │
│   & publish  │                                        │                                │
└──────────────┴────────────────────────────────────────┴────────────────────────────────┘
```

- **Stepper:** same rules as today (reachable = edit ? all : visited; ticks + "(completed)" for visited steps; focus
  moves to the current step on change). **Vertical on the left only from `2xl` (≥1536px)**; below that it is the
  current horizontal bar above the form. *(Claude's call: with the 256px sidebar a 1280px screen leaves ~1024px —
  not enough for stepper + form + preview side by side.)*
- **Header (sticky):** back link whose target is where the user came from — callers pass `state: { from }`
  (`/jobs` from the list, `/jobs/:id` from the job page, `/jds/:id` from the JD page); with no state (pasted link,
  reload) it falls back by mode: create → `/jobs`, edit/duplicate → `/jobs/:id`. Label "← Jobs" / "← <job title>" /
  "← <JD title>" to match. Cancel and Discard go to the same place. *(Claude's call.)* Page
  title (Create Job / Edit Job / Duplicate job), and the action buttons with exactly today's rules
  (Back · Cancel · Save draft (create only) · Next / Save; edit: Save on every step). Buttons move from the pop-up
  footer to the header so they are always visible on a long page.
- **Form column:** fluid, min ~520px, max ~720px; the approval-sent-back banner sits above the step content.
- Width budget at 1280×800 with the sidebar open (~1024px of content): horizontal stepper on top, form ~540px,
  preview ~400px. From 1536px: vertical stepper ~200px + form ~720px + preview ~440px.
- **Preview column:** from `xl` (≥1280px) shown by default at ~400–460px wide, sticky, scrolls on its own; a
  "Hide preview" / "Show preview" toggle (remembered per browser in `localStorage`, wrapped in try/catch). Below
  `xl` hidden, with a "Preview" button in the header that opens it as a right-hand `Drawer` (side variant).
  Content = `CareersPreviewTab` rendered with the draft (`collect()` + current status) and the picked JD; the
  "unpublished" note keeps working. `CareersPreviewTab` gains an optional `compact` prop (smaller padding/radius,
  `text-xl` title, no `max-w-3xl`) used only here; without it the Job detail tab looks exactly as today.
  *(Claude's call.)*

## Leaving the page with unsaved changes

"Unsaved" = any field change or the `touched` events the wizard already tracks.

- **Cancel / ← Jobs / Back-to-job link:** if unsaved, show the same amber bar "Discard unsaved changes?
  [Keep editing] [Discard]" under the header; otherwise leave.
- **Reload / close tab:** `beforeunload` prompt while unsaved.
- **Browser back or sidebar links** (cannot be blocked with `BrowserRouter`): the draft is kept in
  `sessionStorage` on every change, keyed `job-editor-draft:new[:fromJd=<jdId>]`, `job-editor-draft:edit:<id>` or
  `job-editor-draft:duplicate:<id>` — so a draft is only offered at the exact same starting point. An edit draft also
  stores the job's `updatedAt` and is silently dropped if the job changed since (approval send-back, status change…).
  Opening the URL with a valid draft shows a banner "You have unsaved changes from earlier. [Restore] [Discard]".
  Saving or discarding clears it. Per browser-tab session only. *(Claude's call.)*
- **After Save:** navigate to `/jobs/:id` (created or edited job) — today the list stays put after create; a page
  needs a destination, and the job detail page is where the next actions live. *(Claude's call.)* Toasts unchanged.

## Code shape

- `features/jobs/useJobForm.ts` — all state, `fill`, `pickJd`, `collect`, `validate`, `next`, `save`, `goTo`,
  `touched`, `errors`, `step`, `visited`, plus a `draftJob()` for the preview and `snapshot()/restore()` for the
  session draft. Input: `{ mode: 'create'|'edit'|'duplicate', job?, copyFrom?, jdId? }`; output used by the page.
- `features/jobs/steps/` — `DetailsStep`, `RequirementsStep`, `TeamStep`, `PublishStep` (JSX moved from
  `JobDrawer`, behaviour unchanged; `PublishStep` stays mounted so AI Undo survives).
- `features/jobs/JobStepper.tsx` — gains `orientation: 'vertical' | 'horizontal'`.
- `features/jobs/JobEditorPage.tsx` — routes/params → hook → layout, unsaved guard, preview.
- `JdEditor` ("+ Create a new JD") stays a pop-up on top of the page.
- `JobDrawer.tsx` deleted; `Drawer` keeps the `subheader`/`footer`/`dirty` additions (generic, tested).

## Non-goals

- No new job fields (roadmap steps 2+).
- No router migration; no server-side drafts.
- No change to the careers site itself, nor to `CareersPreviewTab`'s default look (only an opt-in `compact`).

## Anti-goals

- Losing typed data through a mis-click (covered by the guard + session draft).
- Any regression of the wizard rules or tests' intent.
- The page feeling cramped on a 1280–1440px laptop with the sidebar open.

## Testing

- Move the existing JobDrawer tests to render the page at its URL (same assertions; "dialog" queries become page
  queries). Keep Drawer tests.
- New: each route opens the right mode; `/jobs?new=1` and `/jobs?fromJd=` redirect; JD detail button goes to
  `/jobs/new?fromJd=`; Save navigates to `/jobs/:id`; Cancel with changes shows the discard bar, without changes
  leaves; session draft is offered and restored after leaving and coming back, and cleared after save; preview shows
  the typed title and "Why you'll love" text live; preview toggle hides/shows; no `job.edit` permission → NoAccess.
- Visual check in the running app at 1440×900 and 1280×800 (sidebar expanded), EN/VI, light/dark.

## Left to the builder

Exact widths/breakpoints within the ranges above, header styling (follow existing page headers), whether the hook
is one file or split, preview toggle icon.
