# Talent Pool Overview — redesign

## Intent
TA lead and recruiters open **Tổng quan kho ứng viên** to answer two questions:
1. **What is in the pool** — size, stacks, seniority, domains, English, who is open to work, who brings CVs in.
2. **How good the CVs are** — whether profiles are complete enough to contact and to match against a JD.

Reference: prod Dashboard on talentpool.inapps.net (`reference/prod/02-dashboard.png`). Keep every prod metric, restyled in InTalent; add a CV-quality block prod lacks.

## Goals / non-goals / anti-goals
- Goal: prod metric parity + CV-quality block; every quality number drills into a pre-filtered Candidate Pool.
- Non-goal: recruitment funnel metrics (they stay on the Dashboard); editing data on this page.
- Anti-goal: a pretty page whose numbers lead nowhere — a gap count that can't be clicked to fix.

## Approaches
- **A. One scrolling page, two blocks (chosen)** — whole picture in one view, familiar to prod users; page is long.
- B. Two tabs (Composition / Quality) — tidier, but quality gets missed.
- C. Prod-style overview + quality banner on Candidate Pool — close to where data is fixed, but the overview no longer answers "how good".

User picked A.

## Design
Page: `PoolInsightsPage` (`app/src/features/candidates/PoolInsights.tsx`), same route and menu item.

```
[Tổng quan kho ứng viên]                    [Ngày|Tuần|3M|6M|All]
┌Tổng UV┐ ┌Sẵn sàng┐ ┌AI đọc CV┐ ┌Hồ sơ đầy đủ┐          ← KPI row
── Kho có gì ──
[Top stacks (pie)]  [Cấp bậc (bars)]  [Tiếng Anh (donut)]
[Top domains]       [Stacks của UV sẵn sàng]  [Top TA]
── Chất lượng CV ──
[Thiếu trường]  [Độ mới CV]  [AI parse cần duyệt]  [Consent]
```

- **Period filter** Ngày/Tuần/3M/6M/All, default All, drives every figure (reuse `dashboardMetrics(…, period, now)`).
- **KPI row**: Total candidates; Open to work (count + % of pool); AI parse success (ok/total, %); Complete profiles (%).
- **Composition** reuses `StackPie`, `SeniorityBars`, `EnglishDonut` from `features/dashboard/charts.tsx`, plus ranked bars for domains, available stacks, top TA.
- **CV quality** — new pure domain function `poolQuality(candidates, now)` (in `domain/metrics.ts` or new `domain/poolQuality.ts`), unit-tested:
  - *Complete profile* = has email, phone, seniority, English and ≥1 skill. Gap counts per field: email, phone, seniority, English, skills.
  - *Freshness*: latest of `cvVersions[].at` or `createdAt`; buckets < 6 months, 6–12 months, > 12 months ("stale").
  - *AI parse needs review*: `parse` has any confidence < 0.6 and no `reviewedAt`.
  - *Consent*: no `consents` entry.
  - Anonymized candidates (`anonymizedAt`) are excluded from quality counts.
- **Drill-down**: each quality figure links to `/candidates?gap=<email|phone|seniority|english|skills|stale|parse|consent>`. Candidate Pool reads `gap` from the URL, applies it as an extra filter (in `domain/filters.ts`), shows it as a removable chip, and Clear removes it.
- i18n vi/en for all new labels; dark mode; layout collapses to one column on narrow screens.

## Builder's calls
- "Open to work" / available stacks should filter on `openToWork`; today `availableStacks` uses the whole pool — fix in `dashboardMetrics` (keep the `fromTotals` prod-fixture override working).
- Exact thresholds (0.6 confidence, 6/12 months) are constants, easy to change.
- Seed data may need a few candidates with gaps/stale CVs/low confidence so the block isn't empty — bump `PERSIST_VERSION` if seed changes.
- Tests: domain unit tests for `poolQuality` and `gap` filter; page test for blocks rendering and a drill-down link.
