# Scorecard editable criteria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Interviewers add/remove scorecard criteria in the popup; footer "Still needed" text replaced by inline marks.
**Architecture:** Pure helpers in `domain/scorecard.ts`; `ScorecardDialog` keeps a local editable criteria list.
**Tech Stack:** React, Zustand, Vitest + Testing Library.
**Spec:** docs/superpowers/specs/2026-11-27-scorecard-editable-criteria-design.md

## Global Constraints
- Core criteria stay required; the core group keeps ≥ 1 criterion. Skill keys `skill:<text>`, custom core keys `core:<text>`.
- en + vi strings for every new key.

## Review Focus
- Adding a duplicate (same key, or same label ignoring case) is a no-op.
- Removing a scored criterion drops its score (average and store validation must not see it).
- Store rejects a card whose criteria have no core item.
- Reopening a saved card shows its edited criteria, not the suggestion.
- Submit with gaps saves nothing and shows "Required" on each gap.

### Task 1: Domain helpers
**Files:** Modify `app/src/domain/scorecard.ts`, `app/src/store/actions/hiring.ts:93`; Test `app/src/domain/scorecard.test.ts`
**Produces:** `COMPETENCY_KEYS: string[]`; `addCriterion(list: ScoreCriterionDef[], group: 'skill'|'core', text: string, knownKey?: string): ScoreCriterionDef[]`; `removeCriterion(list, key): ScoreCriterionDef[]` (returns list unchanged when it would remove the last core); `validScores` also requires ≥ 1 core.
- [ ] Tests: dedupe, append at end of group block, last-core guard, validScores false with no core.
- [ ] Implement; run `npx vitest run src/domain/scorecard.test.ts`.

### Task 2: Dialog
**Files:** Modify `app/src/features/hiring/ScorecardDialog.tsx`, `app/src/i18n/en.ts`, `app/src/i18n/vi.ts`; Test `ScorecardDialog.test.tsx`
- [ ] Tests: no "Still needed" text; Submit with gaps shows "Required" and saves nothing; remove Vue + add "GraphQL" skill and custom competency "Teamwork" → saved criteria reflect it.
- [ ] Implement: ✕ per row (`scorecard.remove`), "+ Add" input with datalist per group, `tried` state for marks, scroll to first gap.
- [ ] Run tests + `npx tsc --noEmit`.
