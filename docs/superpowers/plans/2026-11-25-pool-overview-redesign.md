# Talent Pool Overview Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/pool-overview` into one scrolling page — period filter, 4 KPIs, "what's in the pool" charts (prod parity) and a clickable "CV quality" block that drills into a pre-filtered Candidate Pool.

**Architecture:** Pure domain function `poolQuality()` + `matchesGap()` in a new `domain/poolQuality.ts`; `filterCandidates` gains a `gap` query key; Candidate Pool seeds that key from `?gap=`; the page reuses `dashboardMetrics()` and the recharts components in `features/dashboard/charts.tsx`.

**Tech Stack:** React 18, TypeScript, zustand, react-router 6, Tailwind, recharts, vitest + Testing Library. Run commands from `app/`.

**Spec:** `docs/superpowers/specs/2026-11-25-pool-overview-redesign-design.md`

## Global Constraints

- All new UI copy in both `src/i18n/vi.ts` and `src/i18n/en.ts` (keys prefixed `pool.insights.`).
- Dark mode classes on every new surface (follow `CARD`/`TITLE` in `PoolInsights.tsx`).
- Thresholds are exported constants: `LOW_CONFIDENCE = 0.6`, `AGING_MONTHS = 6`, `STALE_MONTHS = 12`.
- Complete profile = non-empty email, phone, seniority, English, and ≥1 skill.
- Candidates with `anonymizedAt` are excluded from quality counts and never match a gap.
- Gap keys (URL + type): `email | phone | seniority | english | skills | stale | parse | consent`.
- Dashboard (recruitment) page behaviour must not change.

## Review Focus

- **Period ≠ All vs. drill-down**: *user decision* — the quality block follows the period filter (candidates created in the period). Drill-down links carry the period: `/candidates?gap=email&since=3m`; Candidate Pool applies `since` as a createdAt cutoff and shows it in the chip, so the list size matches the figure. Tests in Tasks 3 and 4.
- **Unknown/garbage `?gap=` value**: pool page ignores it (no chip, full list). Test in Task 3.
- **Empty pool / zero candidates**: page renders 0s and no NaN%. Test in Task 4.
- **Candidate with no `cvVersions`**: freshness falls back to `createdAt`. Test in Task 1.
- **Whitespace-only email/phone** counts as missing. Test in Task 1.

---

### Task 1: `poolQuality` domain + gap matching

**Files:**
- Create: `src/domain/poolQuality.ts`
- Test: `src/domain/poolQuality.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Gap = 'email'|'phone'|'seniority'|'english'|'skills'|'stale'|'parse'|'consent';
  export const GAPS: Gap[];
  export const LOW_CONFIDENCE = 0.6; export const AGING_MONTHS = 6; export const STALE_MONTHS = 12;
  export function isGap(v: string | null): v is Gap;
  export function lastCvAt(c: Candidate): string;          // max(cvVersions[].at) else createdAt
  export function matchesGap(c: Candidate, gap: Gap, now: Date): boolean;
  export interface PoolQuality {
    total: number;                      // non-anonymized candidates
    complete: number;                   // count with all 5 fields
    missing: Record<'email'|'phone'|'seniority'|'english'|'skills', number>;
    freshness: { fresh: number; aging: number; stale: number }; // <6m, 6–12m, >12m
    parseReview: number;                // any confidence < 0.6 and no reviewedAt
    noConsent: number;                  // consents absent or empty
  }
  export function poolQuality(cands: Candidate[], now: Date): PoolQuality;
  ```

- [ ] **Step 1: Write failing tests** — build candidates with a local `cand(p: Partial<Candidate>)` helper (all fields filled, `consents` one entry, `createdAt: '2026-11-01'`), `now = new Date('2026-11-25')`:
  - `complete profile counts only when all five fields present` → 3 cands (full, `email:'  '`, `skills:[]`) ⇒ `complete 1`, `missing.email 1`, `missing.skills 1`.
  - `freshness buckets by latest CV upload, falling back to createdAt` → createdAt 2025-01-01 + cvVersions at 2026-10-01 ⇒ fresh; createdAt 2026-03-01 no versions ⇒ aging; createdAt 2025-06-01 ⇒ stale.
  - `parse needs review when a confidence is below 0.6 and not reviewed` → `{confidence:{email:0.5}}` counts; same with `reviewedAt` doesn't; `{confidence:{email:0.6}}` doesn't.
  - `noConsent counts missing or empty consents`.
  - `anonymized candidates are excluded` → `total` and every count skip it; `matchesGap(anon,'email',now)` false.
  - `isGap rejects unknown values` → `isGap('foo')` false, `isGap(null)` false, `isGap('stale')` true.
  - `matchesGap agrees with poolQuality counts` → for each gap, `cands.filter(c=>matchesGap(c,g,now)).length` equals the matching count.

- [ ] **Step 2: Run** `npx vitest run src/domain/poolQuality.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** in `src/domain/poolQuality.ts`; `poolQuality` = tally of `matchesGap` over non-anonymized candidates (single source of truth). Month math: `now` minus N calendar months via `setMonth`.
- [ ] **Step 4: Run** same command — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): pool quality metrics`

### Task 2: `gap` filter + open-to-work metrics

**Files:**
- Modify: `src/domain/filters.ts` (`CandidateQuery`, `filterCandidates`)
- Modify: `src/domain/metrics.ts:250-283` (`dashboardMetrics`, `DashboardMetrics`)
- Test: `src/domain/filters.test.ts` (create if absent), `src/domain/metrics.test.ts`

**Interfaces:**
- Consumes: `Gap`, `matchesGap` (Task 1).
- Produces: `CandidateQuery.gap?: Gap`; `CandidateQuery.since?: Exclude<Period,'all'>` (createdAt within the period); exported `inPeriod(c: Candidate, period: Period, now: Date): boolean` from metrics.ts (used by `dashboardMetrics` and the filter); `filterCandidates(cands, q, sort, now = new Date())`; `DashboardMetrics.available: number` (count with `openToWork === true`); `availableStacks` computed from open-to-work candidates only.

- [ ] **Step 1: Failing tests**
  - `filterCandidates keeps only candidates matching the gap` → `{gap:'email'}` over [with email, without] returns the one without.
  - `available counts only open-to-work candidates` → 3 cands, 1 `openToWork:true` ⇒ `m.available === 1`, `m.availableStacks` built from that one's skills.
  - `fixture totals still override` → existing fromTotals test keeps passing; `fromTotals` sets `available: d.activeCandidates`.
- [ ] **Step 2: Run** `npx vitest run src/domain/filters.test.ts src/domain/metrics.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** — gap clause in the filter predicate; `available` + open-to-work `availableStacks` (top 5) in `dashboardMetrics`.
- [ ] **Step 4: Run** same + `npx vitest run src/features/dashboard` — Expected: PASS (Dashboard unchanged).
- [ ] **Step 5: Commit** `feat(app): gap filter and open-to-work metrics`

### Task 3: Candidate Pool reads `?gap=`

**Files:**
- Modify: `src/features/candidates/CandidatePoolPage.tsx:128-150, ~255` (filter bar)
- Test: `src/features/candidates/CandidatePoolPage.test.tsx`
- i18n: `candidates.gap.<gap>` labels (vi/en), e.g. vi `Thiếu email`, `CV > 12 tháng`, `AI parse cần duyệt`, `Chưa có consent`.

**Interfaces:**
- Consumes: `isGap`, `CandidateQuery.gap`.

- [ ] **Step 1: Failing tests** (render with `<MemoryRouter initialEntries={['/candidates?gap=email']}>`, seed + one candidate with `email:''`):
  - `?gap=email shows only gap candidates and a removable chip` → 1 data row; chip text `Missing email`; clicking chip's close button shows full list.
  - `Clear removes the gap filter` → after Clear, row count back to 11.
  - `unknown gap value is ignored` → `?gap=foo` ⇒ 11 rows, no chip.
  - `since narrows to the period` → `?gap=email&since=3m` with one recent and one 2025 missing-email candidate ⇒ 1 row, chip text includes `3M`; unknown `since` ignored.
- [ ] **Step 2: Run** `npx vitest run src/features/candidates/CandidatePoolPage.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** — initial `q` state `{ gap: isGap(params.get('gap')) ? … : undefined }`; chip (`data-testid="pool-gap-chip"`) next to filters; removing chip or Clear also deletes `gap` from URL (keep `tab` param intact). `filtersActive` already covers the new key.
- [ ] **Step 4: Run** same — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): candidate pool gap filter from url`

### Task 4: Redesigned overview page

**Files:**
- Modify (rewrite): `src/features/candidates/PoolInsights.tsx`
- Create: `src/features/candidates/PoolInsights.test.tsx`
- i18n: `pool.insights.*` (vi/en)

**Interfaces:**
- Consumes: `dashboardMetrics(data, period, now)` + `Period` (metrics.ts), `poolQuality`, `GAPS` (Task 1), `StackPie`, `SeniorityBars`, `EnglishDonut` (`features/dashboard/charts.tsx`), `seniorityRows` (DashboardPage).

Layout (top → bottom), each section `data-testid`:
1. Header row: title + period segmented control `pool-period` (Ngày/Tuần/3M/6M/All, default `all`; reuse the Dashboard's period control if one is exported, else a local `Segmented`).
2. `pool-kpis`: Total candidates · Open to work (`available`, % of total) · AI parse success (`ok/total`, %) · Complete profiles (`complete/total` %, from `poolQuality`).
3. `pool-composition` heading "Kho có gì": Top stacks (pie + legend %), Seniority (bars), English (donut + legend counts, centre = top level %), Top domains (ranked %), Open-to-work stacks (ranked counts), Top TA (ranked files).
4. `pool-quality` heading "Chất lượng CV": computed by `poolQuality(candidates.filter(c => inPeriod(c, period, now)), now)`. Missing fields card (5 rows), Freshness card (3 buckets; stale row links), AI parse review card, Consent card. Every non-zero gap figure is a `<Link>` to `/candidates?gap=${g}` plus `&since=${period}` when period ≠ all; zero renders as plain text.

Grid: `grid-cols-1 md:grid-cols-2 xl:grid-cols-4` for KPIs, `xl:grid-cols-3` for composition, `xl:grid-cols-4` for quality.

- [ ] **Step 1: Failing tests** (`MemoryRouter`, `buildSeed()`; add 1 candidate `email:''`):
  - `renders KPIs, composition and quality sections` → all four testids present.
  - `missing-email figure links to the filtered pool` → link with `href="/candidates?gap=email"`.
  - `period change updates quality and its links` → add an old candidate (createdAt 2025-01-01, `email:''`); All shows missing-email 2, after clicking `3M` shows 1 and its link is `/candidates?gap=email&since=3m`.
  - `empty pool shows zeros, no NaN` → `candidates: []` ⇒ `queryByText(/NaN/)` null.
- [ ] **Step 2: Run** `npx vitest run src/features/candidates/PoolInsights.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** the page per layout above; remove now-unused `pool.insights.summary` key.
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit` — Expected: all pass, no type errors.
- [ ] **Step 5: Commit** `feat(app): redesign talent pool overview`

### Task 5: Seed variety + visual check

**Files:**
- Modify: `src/data/seed.ts` (candidate entries), `src/store/persist.ts` (`PERSIST_VERSION` 16 → 17), any count assertions in `src/data/seed.test.ts`

- [ ] **Step 1:** Check `poolQuality(buildSeed().candidates, new Date())` in a quick test/console: if any of missing email/phone, stale, parseReview, noConsent, open-to-work is 0, adjust existing seed candidates (prefer editing fields over adding rows) so each is ≥1.
- [ ] **Step 2:** Bump `PERSIST_VERSION` to 17; fix seed count tests.
- [ ] **Step 3: Run** `npx vitest run` — Expected: all pass.
- [ ] **Step 4:** `npm run dev`, open `/pool-overview` at 1440 and 390 width, light + dark; click a gap link and confirm the pool list + chip. Screenshot to scratchpad.
- [ ] **Step 5: Commit** `chore(app): seed data for pool quality`
