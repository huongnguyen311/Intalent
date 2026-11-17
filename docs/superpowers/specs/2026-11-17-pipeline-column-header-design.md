# Pipeline column header — short design

Date: 2026-11-17 · Approved by stakeholder (option A)

**Why:** the stakeholder wants richer column titles in the Pipeline (today they show only "● NEW 4"), so a recruiter sees at a glance where candidates pile up or run late.

**Design (option A, chosen):** each Kanban column title becomes a small header card:

```
┌──────────────────────┐
│▌ Interview        5  │  stage color left border + light tint; stage name (normal case, bold); count
│  SLA 7 ngày · 1 trễ ⚠│  stage SLA days from job.stageSla + overdue cards in this stage
│  ▓▓▓▓▓▓░░░  29%      │  share of this job's applications currently in this stage
└──────────────────────┘
```

- Stages new / screening / interview / offer show all three lines. When nothing is overdue, line 2 reads "SLA 7 ngày · đúng hạn" with no warning icon.
- Hired / Rejected (expanded) show line 1 and line 3 only, with no SLA. Collapsed strips stay as they are.
- The count shows the cards currently visible (filtered), as today. Overdue and share are computed from all of the job's applications (unfiltered), so filtering doesn't distort them.
- Stage colors reuse the existing stage dot colors.
- Same header in the Pipeline page and the Job detail → Pipeline tab. The List view is unchanged.

**Non-goals:** changing drag & drop, list view, or collapsed strips.
**Constraints:** i18n EN + VI; only app.css or Tailwind-supplement classes; fixture fidelity stays green; tests for overdue count, share %, the no-SLA end columns, and filtered vs unfiltered numbers.
**Approaches:** A (chosen) header card with metrics. B, a funnel strip above the board, was rejected because it adds a row. C, styling only, was rejected because it adds no information.
