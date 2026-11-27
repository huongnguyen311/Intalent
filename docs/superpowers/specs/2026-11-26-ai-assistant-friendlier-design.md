# AI Assistant — friendlier layout (small change)

## Why
User feedback: the AI Assistant page is not user-friendly. Three concrete pain points: the suggestion chips don't fit, the AI disclaimer line is noise, and the chat-history column eats too much width.

## Goals
- Suggestion chips that teach what the search understands and can be edited before sending.
- Remove the disclaimer line.
- Give the chat area the full width; history only on demand.

## Non-goals
- No change to search logic (`parseQuery` / `searchCandidates`), follow-up behaviour, or result cards.
- No new actions on results (add to job/pipeline) — separate request if wanted.

## Approaches (history column)
- **A. Hidden by default, opens as overlay panel — picked.** Full-width chat; one extra click to reach history, which is rarely revisited.
- B. Narrow icon rail (~56px) — saves space but icons can't tell chats apart.
- C. Header dropdown — most compact, but poor for long lists and deleting.

## Design
1. **Disclaimer:** remove the `<p>` and the `assistant.disclaimer` key in `en.ts` / `vi.ts`.
2. **Chips:**
   - Replace hard-coded `CHIPS` with i18n example queries (en + vi) that exercise skill, seniority, years, domain, English — e.g. "Senior React, good English", "Java backend, 5 years, Fintech", "Mid-level Flutter mobile".
   - Click fills the input and focuses it (does not send).
   - Shown only on the empty/welcome state; hidden once a conversation is open.
3. **History (A):**
   - Header: history button (icon + label "History") left of title; "New chat" button on the right of the header.
   - History panel: ~280px, slides in over the chat area (absolute, with a light backdrop); closes on selecting a chat, on backdrop click, and on Esc.
   - Closed by default. The panel keeps today's grouping + delete-on-hover.
   - The "New chat" button moves out of the panel into the header.

## Left to the builder
Exact example wording, icons, animation timing; update `assistant.*` tests if any assert on chips/disclaimer.
