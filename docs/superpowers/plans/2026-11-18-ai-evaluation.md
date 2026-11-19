# AI Evaluation per Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every application stores versioned AI evaluations (score, 4-criterion breakdown, strengths/gaps with CV evidence, questions to verify), shown as a badge on pipeline cards, a drawer section with Re-run, and an optional "Sort: AI score" in the pipeline header.

**Architecture:** A pure domain function `evaluateApplication` builds on the existing `scoreCandidate` + `jdRequirements`. The store keeps `aiEvaluations[]` + `aiPending` on `Application`; a `runAiEvaluation` action appends a version. A small hook mounted in `AppLayout` drains pending applications after ~2 s to simulate the AI queue.

**Tech Stack:** React 18 + TypeScript, Zustand store with persist, Vitest + Testing Library, Tailwind, custom i18n (`i18n/en.ts`, `i18n/vi.ts`).

**Spec:** `docs/superpowers/specs/2026-11-18-ai-evaluation-design.md`

## Global Constraints

- No new pipeline stage; `STAGES` stays `['new','screening','interview','offer','hired','rejected']`.
- AI never changes `stage`; no code path from evaluation to `moveStage`.
- Weights unchanged: stack 40, experience 30, domain 20, English 10 (`WEIGHTS` in `domain/scoring.ts`).
- Model label exactly `'intalent-match-v1'`.
- Evidence is a verbatim substring of the candidate's CV/experience text, or absent; never generated text.
- Default pipeline order stays "board order" (by `stageEnteredAt`); AI sort only when chosen.
- Interviewers see the AI section only when `awaitsScorecardFrom(app, user.id)` is false (same rule as ratings).
- Every new UI string exists in both `i18n/en.ts` and `i18n/vi.ts`.
- `PERSIST_VERSION` 3 → 4.
- Do not change `features/matching/*` or the `?fixture=mockup` screens.

## Review Focus

1. Job whose JD is missing or has an empty stack → evaluation still produced; stack counts as full credit per `scoreCandidate`; no crash, no NaN. (Task 1 test `handles job without JD`.)
2. Candidate with empty `cv` and no `experience` → strengths carry no `evidence`, never an invented quote. (Task 1 test `never invents evidence`.)
3. Application created while nobody is on a pipeline page (careers apply) → still pending, evaluated once an internal page is open; never evaluated twice for one pending flag. (Task 2 test `runAiEvaluation clears pending and is idempotent for pending`, Task 3 test `queue drains once`.)
4. Re-run on a handed-off (read-only) application → button hidden. (Task 3 drawer test.)
5. Sorting by AI score with pending/unevaluated cards → those sort last, no reordering of other stages' logic. (Task 3 test `sort puts unevaluated last`.)

---

### Task 1: Domain — breakdown + `evaluateApplication`

**Files:**
- Modify: `app/src/domain/scoring.ts` (add `breakdown` to `ScoreResult`)
- Modify: `app/src/domain/types.ts` (add `AiEvaluation`, `AiCriterion`, `AiFinding`)
- Create: `app/src/domain/aiEvaluation.ts`
- Test: `app/src/domain/aiEvaluation.test.ts`, extend `app/src/domain/scoring.test.ts`

**Interfaces:**
- Produces (types.ts):
  ```ts
  export type AiCriterion = 'stack' | 'experience' | 'domain' | 'english';
  export interface AiFinding { criterion: AiCriterion; text: string; evidence?: string }
  export interface AiEvaluation {
    id: string; score: number;
    breakdown: { key: AiCriterion; points: number; max: number }[];
    strengths: AiFinding[]; gaps: AiFinding[]; questions: string[];
    model: 'intalent-match-v1'; at: string;
  }
  ```
- Produces (scoring.ts): `ScoreResult.breakdown: Record<AiCriterion, number>` (points, rounded so the four sum to `score`).
- Produces (aiEvaluation.ts): `evaluateApplication(c: Candidate, req: Requirements, at: string, id: string): AiEvaluation`; `AI_MODEL = 'intalent-match-v1'`; `findEvidence(c: Candidate, term: string): string | undefined`; `requirementsForJob(job: Job, jds: Jd[], taxonomy: TaxonomyItem[]): Requirements` (uses `jdRequirements`, returns `{ stack: [] }` when the JD is missing).

- [ ] **Step 1: Write failing tests** in `aiEvaluation.test.ts` (reuse the `base`/`req` fixtures style from `scoring.test.ts`):
  - `breakdown sums to score`: `e.breakdown.reduce((s,b)=>s+b.points,0) === e.score`; maxes are `[40,30,20,10]` in order stack, experience, domain, english.
  - `strengths and gaps follow have/miss`: candidate missing `Vue` → a gap with `criterion:'stack'` whose text contains `Vue`; `React` → a strength.
  - `cites CV text as evidence`: `cv: 'Built dashboards in React and TypeScript for clinics.'` → strength for React has `evidence` equal to that sentence (substring of `cv`).
  - `never invents evidence`: `cv: ''`, no experience → every finding has `evidence === undefined`.
  - `one question per gap`: `e.questions.length === e.gaps.length` and each is non-empty.
  - `handles job without JD`: `requirementsForJob({...job, jdId:'missing'}, [], [])` → `{ stack: [] }`; evaluating with it gives a finite score.
  - `model and id/at passed through`: `e.model === 'intalent-match-v1'`.
  - In `scoring.test.ts`: `breakdown sums to score` for the existing `req`.
- [ ] **Step 2:** `cd app && npx vitest run src/domain/aiEvaluation.test.ts src/domain/scoring.test.ts` → FAIL (module/field missing).
- [ ] **Step 3:** Implement. In `scoreCandidate` compute the four point values (`stack*40`, `(seniority+years)*15`, `domain*20`, `english*10`), round each, and set `score` = their sum (keep existing tests green). `findEvidence`: split `cv` + `experience[].description` into sentences (`/(?<=[.!?\n])\s+/`), return first sentence containing the term via `hasToken(fold(sentence), fold(term))`. Findings: stack → one per `have`/`miss`; experience → strength if points ≥ 0.8×max else gap ("Seniority X vs required Y" / "~N yrs vs N required"); domain → strength per hit, gap per missing; english → strength/gap vs required level; criteria with nothing required produce no finding. Questions: template per gap, e.g. `Confirm hands-on experience with ${skill}` / `Verify English level in interview` / `Ask about ${domain} projects` / `Probe depth of experience for ${seniority} role`.
- [ ] **Step 4:** rerun → PASS; `npx vitest run src/domain` all green.
- [ ] **Step 5:** `git add app/src/domain && git commit -m "feat(app): ai evaluation domain with breakdown and evidence"`

### Task 2: Store, seed, persist

**Files:**
- Modify: `app/src/domain/types.ts` (`Application.aiEvaluations?: AiEvaluation[]`, `Application.aiPending?: boolean`, `ActivityType` += `'ai_evaluated'`)
- Modify: `app/src/store/actions/types.ts` (declare `runAiEvaluation`)
- Modify: `app/src/store/actions/applications.ts` (`addToPipeline` sets `aiPending: true`; add `runAiEvaluation`)
- Modify: `app/src/data/seed.ts` (`withAiEvaluations(apps, candidates, jobs, jds, taxonomy, clock)` after `withHiringRecords`)
- Modify: `app/src/store/persist.ts` (`PERSIST_VERSION = 4`)
- Test: `app/src/store/aiEvaluation.test.ts`, extend `app/src/data/seed.test.ts`

**Interfaces:**
- Consumes: `evaluateApplication`, `requirementsForJob`, `AiEvaluation` (Task 1).
- Produces: `runAiEvaluation(appId: string, by: string): AiEvaluation | undefined` — appends to `aiEvaluations`, clears `aiPending`, logs activity `{type:'ai_evaluated', applicationId, candidateId, jobId, by, at, detail:'AI evaluation v<n>: <score>'}`; returns `undefined` for unknown app or app with `handoff`. Never touches `stage`/`history`.

- [ ] **Step 1: Write failing tests** (`store/aiEvaluation.test.ts`, setup copied from `hiring.test.ts` `withApp`):
  - `new application starts pending`: `find().aiPending === true`, `aiEvaluations` undefined.
  - `runAiEvaluation clears pending and is idempotent for pending`: after one run `aiPending` falsy, `aiEvaluations.length === 1`; second run (re-run) → length 2, newest last, `stage` still `'new'`, `history.length` unchanged.
  - `logs ai_evaluated activity`.
  - `refuses handed-off application`: set `handoff` → returns `undefined`, no new version.
  - seed.test: `every seeded application has one evaluation and none pending`.
- [ ] **Step 2:** `npx vitest run src/store/aiEvaluation.test.ts src/data/seed.test.ts` → FAIL.
- [ ] **Step 3:** Implement as per Interfaces; seed evaluations use `at = app.addedAt` and ids `ai-<appId>-1`; bump `PERSIST_VERSION`.
- [ ] **Step 4:** `npx vitest run` (whole suite) → all PASS; `npx tsc --noEmit -p .` clean.
- [ ] **Step 5:** commit `feat(app): store versioned ai evaluations per application`.

### Task 3: UI — queue, card badge, drawer section, sort, i18n

**Files:**
- Create: `app/src/features/pipeline/useAiQueue.ts` (mounted once in `components/AppLayout.tsx`)
- Create: `app/src/features/pipeline/AiEvaluationSection.tsx`
- Create: `app/src/features/pipeline/aiTone.ts` (move `tone()` out of `features/matching/MatchList.tsx` and import it there — no visual change)
- Modify: `features/pipeline/CandidateCard.tsx` (badge on line 3), `ApplicationDrawer.tsx` (section above `InterviewsSection`), `PipelineHeader.tsx` + `PipelineWorkspace.tsx` + `Board.tsx` (+ `PipelineList.tsx` if it sorts separately) for sort, `i18n/en.ts`, `i18n/vi.ts`
- Test: `app/src/features/pipeline/AiEvaluation.test.tsx`

**Interfaces:**
- Consumes: `runAiEvaluation` (Task 2), `AiEvaluation` (Task 1).
- Produces: `useAiQueue(delayMs = 2000): void` (calls `runAiEvaluation(id, 'ai')`; Re-run passes the current user's id); `PipelineSort = 'board' | 'ai'`; `PipelineHeader` props `sort: PipelineSort; onSort(s)`; `Board` prop `sort?: PipelineSort`; `latestEvaluation(app): AiEvaluation | undefined` in `domain/aiEvaluation.ts`.
- i18n keys (EN / VI):
  - `ai.badge.pending` "AI scoring…" / "AI đang chấm…"
  - `ai.section` "AI evaluation" / "Đánh giá AI"
  - `ai.score` "Match score" / "Điểm phù hợp"
  - `ai.criterion.stack|experience|domain|english` "Stack|Experience|Domain|English" / "Stack|Kinh nghiệm|Domain|Tiếng Anh"
  - `ai.strengths` "Strengths" / "Điểm mạnh"; `ai.gaps` "Gaps" / "Còn thiếu"; `ai.questions` "To verify" / "Cần xác minh"
  - `ai.noEvidence` "Listed in profile skills" / "Chỉ thấy trong danh sách skills"
  - `ai.rerun` "Re-run" / "Chấm lại"; `ai.openCv` "Open original CV" / "Mở CV gốc"
  - `ai.meta` "{model} · {date} · version {n}" / "{model} · {date} · phiên bản {n}"
  - `ai.disclaimer` "AI suggests only. HR makes the decision." / "AI chỉ gợi ý, HR là người quyết định."
  - `pipeline.sort.board` "Board order" / "Thứ tự mặc định"; `pipeline.sort.ai` "AI score" / "Điểm AI"; `pipeline.sort.label` "Sort" / "Sắp xếp"

- [ ] **Step 1: Write failing tests** (`AiEvaluation.test.tsx`, use existing render helpers from `Board.test.tsx`):
  - `card shows score badge`: seeded app with evaluation score N → card contains `✦ N`.
  - `card shows pending badge`: app with `aiPending` → text `AI scoring…`.
  - `queue drains once`: fake timers, render `AppLayout` child with one pending app, advance 2000 ms → `aiEvaluations.length === 1`, advance again → still 1.
  - `drawer section shows breakdown, findings, disclaimer, open CV link to /candidates/:id`.
  - `re-run adds a version` (meta shows `version 2`); `re-run hidden when handed off`.
  - `interviewer awaiting scorecard does not see AI section`.
  - `sort puts unevaluated last`: choose "AI score" → card order within New column is descending score, pending last.
- [ ] **Step 2:** `npx vitest run src/features/pipeline/AiEvaluation.test.tsx` → FAIL.
- [ ] **Step 3:** Implement. Badge: small pill after the days span, colours from `aiTone(score)`; pending pill grey with `…`. Section: score + bar per criterion (`points/max`), ✓ strengths / ✗ gaps with evidence in quotes or `ai.noEvidence`, questions list, meta line, Re-run (`perm('pipeline.move')` and no handoff), "Open original CV" `Link` to `/candidates/:candidateId`, disclaimer. Sort control: a `Popover` button next to the view toggle; `Board` applies it inside each stage's list only.
- [ ] **Step 4:** `npx vitest run` all PASS; `npx tsc --noEmit -p .` clean; `i18n.test.ts` passes (key parity).
- [ ] **Step 5:** Manual check: `npm run dev`, open `/pipeline`, apply on `/careers/<job>/apply`, return to pipeline → card shows "AI scoring…" then a score; drawer section renders at 1440 px without overflow.
- [ ] **Step 6:** commit `feat(app): ai evaluation badge, drawer section and sort in pipeline`.
