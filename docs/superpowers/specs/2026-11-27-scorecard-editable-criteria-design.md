# Scorecard: interviewer-editable criteria — design (short)

**Intent.** Criteria are suggested from the JD (skills), the department (core competencies by job family) and the round
(leadership for lead roles, motivation in a final round). The interviewer fine-tunes them right in the Scorecard popup.

**Approaches.** A) admin templates per department × round in Settings; B) A + per-job override on the Job form;
C) interviewer edits in the popup. **Picked C** (user): no settings screen, adjust where scoring happens.

**Design.**
- Suggestion = existing `scorecardTemplate` (unchanged).
- Each criterion row gets a ✕ remove. Each group gets "+ Add": skills offer the JD's remaining skills or free text;
  competencies offer the known competency keys not shown or free text.
- Added core criteria are required; the core group keeps at least one criterion.
- The saved card stores the edited criteria; reopening shows them, not the fresh suggestion.
- Footer "Still needed: …" removed. Submit stays enabled; on a missing score it marks the unscored required rows and the
  recommendation with a red "Required" and scrolls to the first; nothing is saved.

**Non-goals.** No settings page, no per-job template, no change to how round/department are typed.
