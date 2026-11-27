# AI Assistant — Friendlier Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Better suggestion chips, no disclaimer, and chat history as an on-demand overlay so the chat uses full width.

**Architecture:** All UI changes stay in `AssistantPage.tsx`; copy lives in `i18n/en.ts` + `i18n/vi.ts`. No store or search-logic change.

**Tech Stack:** React + TypeScript, Tailwind, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-26-ai-assistant-friendlier-design.md`

## Global Constraints
- Every new string has an `en` and `vi` key under `assistant.*`.
- Do not touch `store/actions/chats.ts` or `domain/scoring.ts`.
- Works in light and dark mode (follow existing `dark:` classes).

## Review Focus
- Example queries must actually return results with seed data — a chip that yields "no candidates" is worse than none. (Test in Task 1.)
- Esc / backdrop must close the history panel; selecting a chat closes it. (Test in Task 2.)
- Deleting the active chat from the panel returns to welcome state (existing test, kept).
- Language switch to `vi` shows Vietnamese chips. (Test in Task 1.)

---

### Task 1: Example chips + remove disclaimer

**Files:**
- Modify: `app/src/features/assistant/AssistantPage.tsx`
- Modify: `app/src/i18n/en.ts`, `app/src/i18n/vi.ts`
- Test: `app/src/features/matching/MatchingAssistant.test.tsx`

**Interfaces:**
- Produces: i18n keys `assistant.example.1..3`, `assistant.examplesLabel` ("Try an example" / "Thử một ví dụ"). Remove `assistant.disclaimer`.

- [ ] **Step 1: Update tests**
  - Welcome test: expects button `Senior React, good English` (example 1) and no text `/AI generated responses/`.
  - New test `clicking an example fills the input without sending`: click example 1 → input value equals the example, `chats` length still 0, example buttons still visible.
  - New test `every example query returns at least one candidate`: for each of the 3 en examples, `searchCandidates(candidates, parseQuery(q, taxonomy)).length > 0`.
  - New test: with `ui.lang = 'vi'`, example 1 renders as `Senior React, tiếng Anh tốt`.
  - New test: after sending a query, example chips are not rendered.
- [ ] **Step 2: Run** `npx vitest run src/features/matching/MatchingAssistant.test.tsx` — expect FAIL.
- [ ] **Step 3: Implement.** Examples: en `Senior React, good English` / `Java backend, 5 years, Fintech` / `Mid-level Flutter mobile`; vi `Senior React, tiếng Anh tốt` / `Backend Java, 5 năm kinh nghiệm, Fintech` / `Mobile Flutter mid-level`. If any example returns 0 hits with seed data, swap its domain/skill for one present in seed (keep 3 criteria types covered). Chips render under the welcome block only when `messages.length === 0`, with the `examplesLabel` caption; click → `setText(example)` and focus input via ref. Delete the disclaimer `<p>` and `CHIPS` const.
- [ ] **Step 4: Run** same test file — expect PASS. Update the fixture test (line ~83) which counted `Frontend Developer` ≥ 3 (history titles only now — adjust to ≥ 2 or to whatever the fixture history shows once the panel is open in Task 2).
- [ ] **Step 5: Commit** `feat(assistant): example query chips, drop disclaimer`

### Task 2: History as overlay panel

**Files:**
- Modify: `app/src/features/assistant/AssistantPage.tsx`
- Modify: `app/src/i18n/en.ts`, `app/src/i18n/vi.ts` (rename `assistant.toggleHistory` → `assistant.history`: "History" / "Lịch sử")
- Test: `app/src/features/matching/MatchingAssistant.test.tsx`

**Interfaces:**
- Consumes: existing `History` component (unchanged props).

- [ ] **Step 1: Update tests**
  - History closed by default: `queryByText('Today')` is null after sending in-page until `History` button clicked.
  - Clicking `History` opens a `role="dialog"` named `History`; clicking a session closes it and shows that conversation.
  - Pressing Escape closes it; clicking the backdrop (`data-testid="history-backdrop"`) closes it.
  - `New chat` button is in the header (reachable without opening the panel) and returns to welcome state.
  - Existing delete + fixture "Older" tests open the panel first.
- [ ] **Step 2: Run** test file — expect FAIL.
- [ ] **Step 3: Implement.** Header: left `History` button (icon `history` + label), title + Beta, right `New chat` button (icon `add`). Panel: `absolute inset-y-0 left-0 w-[280px]` inside the chat area container (`relative`), `translate-x` transition, `role="dialog" aria-label={t('assistant.history')}`; backdrop `absolute inset-0 bg-black/20` behind it. `historyOpen` default `false`; `keydown` Escape listener only while open. Chat column becomes full width (remove the width-animated sidebar wrapper).
- [ ] **Step 4: Run** `npx vitest run src/features/matching` and `npx tsc --noEmit -p .` — expect PASS / no errors in touched files.
- [ ] **Step 5: Verify in browser** `/assistant`: empty state, panel open/close, dark mode.
- [ ] **Step 6: Commit** `feat(assistant): history as overlay panel, new chat in header`
