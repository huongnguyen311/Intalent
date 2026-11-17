# Pipeline Column Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Pipeline Kanban column titles with a header card showing the stage, count, SLA plus overdue count, and the stage's share of the job.

**Architecture:** A pure helper in `app/src/domain/pipeline.ts` computes the per-stage metrics. A new `ColumnHeader` component renders them inside `Column.tsx` for expanded columns.

**Tech Stack:** React 18, TS, Vitest + Testing Library, Tailwind supplement.

**Spec:** `docs/superpowers/specs/2026-11-17-pipeline-column-header-design.md`

## Global Constraints
- New strings go through useT with en + vi keys (vi typed Record). Use only classes in app.css or the Tailwind supplement.
- Count = visible (filtered) cards in the column. Overdue and share come from the job's unfiltered applications.
- Hired and Rejected have no SLA line. Collapsed strips are unchanged. Drag & drop and the list view are unchanged. Fixture fidelity stays green.

## Review Focus
1. A job with 0 applications must show 0% share, not NaN. → test `share is 0 when job has no applications`.
2. When a filter hides cards, the count changes but overdue and share stay. → test `filter changes count but not overdue or share`.

---

### Task 1: Column header card

**Files:**
- Modify: `app/src/domain/pipeline.ts`, `app/src/features/pipeline/Column.tsx`, `app/src/features/pipeline/Board.tsx` (pass unfiltered job apps), `app/src/i18n/en.ts`, `vi.ts`
- Create: `app/src/features/pipeline/ColumnHeader.tsx`
- Test: `app/src/domain/pipeline.test.ts` (create if missing), `app/src/features/pipeline/Board.test.tsx`

**Interfaces:**
- `stageMetrics(jobApps: Application[], job: Job, stage: Stage, now?: number): { sla?: number; overdue: number; share: number }`.
  - `sla` is `job.stageSla[stage]`, and undefined for hired and rejected.
  - `overdue` is the number of apps in the stage where `isOverSla`.
  - `share` is `round(100 * inStage / jobApps.length)`, or 0 when there are no apps.
- `ColumnHeader({ stage, count, metrics })`:
  - Line 1 has a left border plus a light tint in the stage color (reuse the existing stage dot color map), `stageLabel` in normal case and bold, and the count.
  - Line 2 is `pipeline.col.sla` "SLA {days} days · {n} late ⚠" / "SLA {days} ngày · {n} trễ ⚠". When nothing is late it uses `pipeline.col.onTime` "SLA {days} days · on time" / "SLA {days} ngày · đúng hạn". Hired and Rejected have no line 2.
  - Line 3 is a thin bar (`h-1.5`) filled to `share%` in the stage color, plus the text "{share}%".
  - Line 1 keeps the existing collapse chevron for Hired and Rejected.

- [ ] **Step 1: Failing tests:** `stageMetrics counts overdue and share`; `share is 0 when job has no applications`; `hired and rejected have no sla`; Board: `column header shows sla and late count`; `filter changes count but not overdue or share`; `vi header uses ngày and trễ`.
- [ ] **Step 2:** `cd app && npx vitest run src/domain/pipeline.test.ts src/features/pipeline/Board.test.tsx` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Focused, then full `npm test`, `npm run build` and `npm run fidelity` → PASS. Take a 1440×900 screenshot of `/pipeline/job-1`.
- [ ] **Step 5:** Commit `feat(app): pipeline column header with sla and share`.
