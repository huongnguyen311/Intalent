# Job post content on the Job — design

Date: 2026-11-25 · Status: approved by the user in chat

## Intent

HR wants to manage everything the public careers page shows for a job from **one place: the Job form**.
Today the careers page reads About the role, What you'll do, Skills, Requirements, Nice to have and About the team
straight from the JD, while Why you'll love working here and Additional information live on the Job.
One JD can back several jobs (JD-2026-001 → job-3 Senior and job-5 Middle), so each job needs its own editable copy.

## Goals

- The Job owns its own copy of the six post sections.
- Picking a JD on the Job form fills that copy from the JD.
- A "Load from JD" action refreshes the copy from the JD's current content on request.
- The careers page reads the Job's copy.

## Non-goals

- AI evaluation / JD Matching keep reading the JD (user's decision). Editing Skills or Requirements on the Job
  does not change scoring; the user accepts that the post and the scoring can differ.
- No live link: editing a JD never changes an existing job's copy (approach A).
- The JD editor and JD data model are unchanged.

## Approaches

- **A. Job keeps its own copy (picked).** Copy on JD pick, explicit "Load from JD" to refresh. Simple; a published post never changes silently.
- B. Job follows the JD per field until overridden. More flexible, but HR cannot easily tell where each section comes from. Rejected.

## Design

1. **Data** — `Job` gains optional fields: `summary`, `responsibilities: string[]`, `aboutTeam`, `skills: string[]`,
   `mustHave: string[]`, `niceToHave: string[]`.
2. **Form** — step "Job post & application" gets a "Post content" block above Why love / Additional info, in careers-page order:
   About the role (textarea), What you'll do (one item per line), Skills (tag input), Requirements (one per line),
   Nice to have (one per line), About the team (textarea). A "Load from JD" button sits in the block header.
3. **On JD pick** — empty post fields are filled from the JD; fields the user already typed are kept.
   What you'll do = JD responsibilities + daily tasks (deduplicated). Requirements = `jdMustHave(jd)`.
   Applies on create, duplicate and edit (pick of a different JD).
4. **Load from JD** — overwrites all six fields from the selected JD; asks for confirmation when any of them has content.
   Disabled when no JD is selected.
5. **Careers page** — each section reads the Job field, falling back to the JD when the Job field is empty,
   so jobs saved before this change still show everything. The pasted-JD-body fallback stays for JDs with no overview.
6. **Seed** — all seven seeded jobs get their copy filled from their JD.
7. **Persist** — bump `PERSIST_VERSION` so browsers reload the seed.

## Left to the builder

Exact component reuse (existing tag input from the JD editor, list textarea helper), i18n keys, test placement.
