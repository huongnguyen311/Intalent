# AI evaluation per application — design

Date: 2026-11-18 · Branch: feat/recruitment-app · Source: PRD `mockup/AI_Recruitment_SaaS_PRD_MVP.pdf` §3.4, §4.5, AC-08, entity `ai_evaluations`.

## Intent

HR should see why a candidate does or does not fit a job, right where they decide: the pipeline. Today the scorer only runs on the standalone JD Matching page. PRD principle: AI suggests, HR decides; results must be explainable and auditable.

## Goals

- Every application has a stored AI evaluation: total score, per-criterion breakdown, strengths, gaps, evidence from the CV, questions to verify, model version, evaluated-at.
- New applications show "AI đang chấm" for a few seconds (simulated), then the score.
- Card shows a score badge; pipeline header gets "Sort: AI score".
- Drawer gets an "AI evaluation" section with a "Re-run" button and an "Open original CV" link.
- Re-run appends a new version; the drawer shows the latest, and the history count is shown.

## Non-goals

- No new pipeline stage (user chose option B: badge on cards, no AI Screening column).
- No real LLM; the existing rule-based scorer stands in.
- No change to JD Matching page, criteria editing (item 2) or upload (item 3).

## Anti-goals

- AI never moves, rejects or hires (AC-08). No auto-sort by default; the board order stays as is unless HR picks the sort.
- Evidence must never be invented: a strength cites a CV snippet only when the term is actually found in the CV text/skills; otherwise it says "listed in profile skills".
- Don't use sensitive attributes (age, gender, photo...) — the scorer only reads skills, seniority/years, domains, English.
- Keep every existing feature and the `?fixture=mockup` pixel parity (badge hidden in fixture mode if it shifts pixels).

## Approaches

1. Compute on the fly — simplest, always current, but no "evaluating" state, no history, no audit.
2. **Store an evaluation on each application (chosen)** — matches PRD `ai_evaluations` (versions, model_version), gives a believable demo; costs a persisted field, seed data and a persist version bump.

## Design

- **Domain** `domain/aiEvaluation.ts`: `evaluateApplication(candidate, job, jd, taxonomy, now) → AiEvaluation` built on `scoreCandidate` + `extractSkills/detect*` from the JD. Breakdown = the four `WEIGHTS` criteria (stack 40, experience 30, domain 20, English 10) with points earned. Strengths from `have` + met criteria; gaps from `miss` + unmet criteria; evidence = matching sentence from `candidate.cv` / experience text, else "listed in profile skills"; questions = one per gap/uncertain criterion (template text).
- **Type** `AiEvaluation { id, score, breakdown[{key, points, max}], strengths[{text, evidence?}], gaps[...], questions[], model: 'intalent-match-v1', at }`; `Application.aiEvaluations?: AiEvaluation[]` (newest last); `Application.aiPending?: boolean`.
- **Store** `store/actions/applications.ts`: `addToPipeline` sets `aiPending`; a `runAiEvaluation(appId)` action appends an evaluation and clears pending (called after a ~2s timer from the UI layer / store env, instant in tests). Activity type `ai_evaluated`.
- **Seed**: every seeded application gets one evaluation; bump `PERSIST_VERSION` (resets saved demo data to seed — existing behaviour on version change).
- **UI**: `CandidateCard` badge `✦ 78` (colour by band, "…" while pending); `ApplicationDrawer` new `AiEvaluationSection` above Interviews; `PipelineHeader` sort control (default "Board order", option "AI score"). Visible to roles with `pipeline`; Interviewers still blind until scorecard sent (same rule as ratings). EN/VI i18n.
- **Tests**: unit tests for `evaluateApplication` (no invented evidence, breakdown sums to score, gaps ↔ questions), store test for pending → evaluated and re-run versioning, UI test for badge + section + sort.

## Left to the builder

Badge colour bands (reuse JD Matching `tone()`), exact copy, timer mechanism.
