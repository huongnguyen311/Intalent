# InTalent Recruitment — React prototype design

Date: 2026-11-16 · Status: draft for approval

## 1. Intent

InTalent (InApps Talent Pool) is a standalone recruitment product. Today it is a CV store with AI parsing and search. Stakeholder feedback asks for four capabilities so it covers the full hiring loop **Attract → Collect → Store → Search → Engage → Recruit → Hire**:

1. **Job** — public careers page where outside candidates browse openings and apply with a CV.
2. **Pipeline (ATS)** — per-job Kanban, drag candidates through New → Screening → Interview → Offer → Hired / Rejected.
3. **Campaign** — recruitment campaigns shared to social channels, tracking which source each candidate came from.
4. **Talent Pool** — the shared candidate store. HR picks candidates from it into a job's pipeline; the system records job, source and time, and never duplicates the profile.

Plus an intake rule: when HR receives a candidate they choose **Add to Talent Pool** (official, reusable profile) or **Add to Note** (reference note only, not in the pool).

BambooHR and other ATS products are references for good patterns only; InTalent keeps its own look.

The deliverable is a **clickable React prototype** with shared in-browser data, so stakeholders can walk the whole flow (apply on careers page → appears in pipeline → move stages → hired) and sign off on design and behavior before backend work.

## 2. Goals, non-goals, anti-goals

**Goals**
- All 15 existing mockup screens re-implemented in React, **visually identical** to the current static mockup (`mockup/*.html`), which was itself pixel-matched to production.
- New screens for Jobs, Pipeline, Campaigns, careers site, intake choice (Talent Pool / Note), Notes list, and Add-to-Pipeline.
- One shared data store: actions on one screen show up on the others (e.g. apply on careers page → new card in that job's pipeline and new profile in Talent Pool).
- Runs on localhost for a single presenter on one desktop browser; data survives page reload; a "Reset demo data" action restores the seed.

**Non-goals**
- Real backend, auth, file storage, AI parsing, email/social posting. All are simulated.
- Offer letters, interview scheduling calendar, onboarding, payroll.
- Mobile layout for the internal app (desktop 1440 px, as today). The public careers site **is** responsive.

**Anti-goals (would make it a failure even if it works)**
- Existing screens drifting from today's look (spacing, fonts, colors, icons).
- Any real candidate/user data (all seed data is fictional; see existing `reference/anonymize.js` rule).
- A candidate ending up with two profiles because they were added to two jobs or applied twice.
- Every incoming contact silently landing in the Talent Pool (the Note option must be a real, separate path).

## 3. Lessons taken from the market

| Source | Pattern | How InTalent uses it |
|---|---|---|
| BambooHR | Auto-generated careers page using company logo/color; collaborative review; offer templates | Careers site themed from InTalent brand; comments + ratings on applications |
| Workable | Talent-pool record and job record are **separate copies** that don't sync (known duplicate pain) | Do the opposite: **one Candidate, many Applications** |
| Greenhouse | Pool + Source chosen when adding a prospect; duplicate flag + merge | Source required on every application; duplicate check by email/phone on every create |
| Base E-Hiring | SLA deadline per stage; VietnamWorks integration | "Days in stage" on cards, red after stage SLA; VietnamWorks / TopCV listed as campaign channels |

## 4. Core data model

```
Candidate        one per real person (dedupe key: normalized email, else normalized phone)
  id, name, title, email, phone, seniority, english, skills[], domains[], tags[], groups[],
  cvOwner, source (first-touch), inTalentPool: true, createdAt, cv (fake text)

Application      a candidate's participation in ONE job
  id, candidateId, jobId, stage, source, via ('careers'|'talent_pool'|'campaign'|'manual'),
  campaignId?, addedBy, addedAt, stageEnteredAt, history[{stage, at, by}],
  rating?, comments[], rejectedReason?

Job              an opening (built from a JD)
  id, jdId, title, department, location, level, employment, status ('draft'|'open'|'closed'),
  stageSla{stage: days}, openedAt, hiringManager

Campaign         id, name, jobIds[], channels[], goal (applicants), start, end, status,
                 links[{channel, url with ?src=<campaign>-<channel>}], stats (simulated views)

Note             a contact that is NOT in the Talent Pool
  id, name, contact, text, createdBy, createdAt, convertedToCandidateId?

Activity         audit trail: {type, candidateId, applicationId?, jobId?, by, at, detail}
```

Rules
- **Talent Pool = all Candidates.** A Candidate exists only if someone chose Add to Talent Pool, or the person applied via careers/campaign (applying is consent to be stored).
- **Add to Pipeline** creates an Application (never a Candidate). If an Application for that candidate + job already exists, block with "Already in this job's pipeline (stage X)".
- **Any create path** (manual add, careers apply, CV upload) runs dedupe first. On match: attach to the existing Candidate and show "Existing profile updated" instead of creating a new one.
- Profile shows **"Used in"**: every Application with job, stage, source, added by, date.
- **Note → Talent Pool** conversion is allowed later; it creates a Candidate (dedupe applies) and links the note.

## 5. Information architecture

Sidebar keeps today's styling. Groups (new items marked ★):

```
PLATFORM        Dashboard
RECRUITMENT     ★ Jobs · ★ Pipeline · ★ Campaigns
TALENT POOL     Candidate Pool · Upload CVs · Ultra Upload · AI Search · ★ Notes
JD              JD Management · JD Matching
CONFIGURATION   Taxonomy · System Config · User Management · CV theo TA
```

Public site (no sidebar): `/careers`, `/careers/:jobId`, `/careers/:jobId/apply`, `/careers/applied`.

Routes for the internal app keep today's paths (`/`, `/candidates`, `/upload`, …) plus `/jobs`, `/jobs/:id`, `/pipeline/:jobId`, `/campaigns`, `/campaigns/:id`, `/notes`, `/candidates/:id`, `/jds/:id`, `/jd-matching`.

## 6. Screens and behavior

### 6.1 Existing screens (re-implemented 1:1)
Login, Dashboard, Candidate Pool, Candidate Profile, Upload CVs, Ultra Upload, AI Search, JD Management, JD Detail, JD Matching, Taxonomy, System Config, User Management, CV theo TA.

- Markup is ported from the anonymized `mockup/*.html` (same classes, same structure), then repeated parts are driven by store data.
- **All existing screens are fully functional** (stakeholder decision):
  - Candidate Pool: search, filters (seniority, tech stack, English, CV owner, tags), sort, pagination, PII lock toggle, row menu.
  - Upload CVs / Ultra Upload: picking files runs a simulated parse (progress → extracted fields) and creates Candidates through the same dedupe path; duplicates are reported per file.
  - AI Search: chat-style; the "AI" is a deterministic matcher over the store (skills, seniority, English, domain keywords in the query) returning ranked candidate cards with a one-line reason. Chat history kept in the store.
  - JD Management / JD Detail: create, edit, publish/unpublish, delete JDs; "Create JD" from pasted text fills fields with a simple keyword extractor.
  - JD Matching: same deterministic scoring (weights shown on screen) over the store.
  - Taxonomy: add/edit/deactivate English levels, domains, seniority; usage counts from the store.
  - System Config: prompts and email templates editable (saved, not executed); AI usage page shows simulated numbers.
  - User Management: add/edit/deactivate users, change role; affects who appears as CV owner / hiring manager / reviewer.
  - CV theo TA: computed from Candidates' cvOwner and owner-transfer history; Export CSV downloads a real CSV.
  - Dashboard: every card and chart computed from the store, period filter (Ngày/Tuần/3M/6M/All) works.
- Additions on existing screens (everything else unchanged):
  - **Candidate Pool**: row action menu gets *Add to Pipeline*; bulk select → *Add to Pipeline*; tag/group filter chip; "Add Candidate" opens the intake choice.
  - **Candidate Profile**: new **"Used in"** section (applications history) and **Add to Pipeline** button next to Edit.
  - **Dashboard**: new row "Recruitment" (open jobs, active applications by stage, hires this period, top sources).
  - **JD Detail**: *Create Job from this JD*.

### 6.2 Jobs (`/jobs`, `/jobs/:id`)
- List: title, department, location, level, status, applicants count by stage (mini bar), days open, hiring manager. Filters: status, department, location.
- Create/Edit Job drawer: pick JD (prefills), department, location, level, employment, stage SLAs, publish toggle (shows on careers site).
- Job detail: summary + tabs *Pipeline* (embedded Kanban), *Candidates* (table), *Campaigns*, *Careers page preview*.

### 6.3 Pipeline (`/pipeline/:jobId`)
- Job switcher at top; columns New, Screening, Interview, Offer, Hired, Rejected with counts.
- Card: avatar, name, current title, source badge, rating, days in stage (red when > SLA), "from Talent Pool" marker when via talent_pool.
- Drag & drop between columns (also keyboard). Moving to Rejected asks a reason. Every move writes history + activity.
- Click card → side drawer: application summary, stage history, comments, ratings by team, link to full profile, quick *Move to…*.
- Header action **Add from Talent Pool** → search Talent Pool, multi-select, confirm source → Applications created in New.

### 6.4 Campaigns (`/campaigns`, `/campaigns/:id`)
- List: name, jobs, channels (icons), period, status, applicants vs goal, hires.
- Create wizard (3 steps): jobs + goal + dates → channels (Facebook, LinkedIn, Facebook Groups/communities, VietnamWorks, TopCV, Referral, Other) → review: generated tracking link per channel, copy button, social post preview text.
- Detail: KPI cards (views simulated, applicants, conversion, hires), applicants by channel bar chart, applicants table with source; link to pipeline.
- A tracking link opens the careers job page with `?src=...`; applying through it sets Application.source/campaignId.

### 6.5 Talent Pool intake (`Add Candidate`)
Modal step 1 chooses the path, with plain explanations:
- **Add to Talent Pool** → form (name, email, phone, title, skills, tags, source, CV upload simulated) → dedupe check → Candidate created or existing updated. Optional "also add to job…".
- **Add to Note** → short form (name, contact, note text) → saved to Notes only; toast says "Not added to Talent Pool".

### 6.6 Notes (`/notes`)
Table of notes (name, contact, note, by, date), search, actions: *Convert to Talent Pool*, delete. Converted notes show a link to the profile.

### 6.7 Careers site (`/careers…`, public)
- Landing: company header, search by keyword, filters (department, location, level), job cards.
- Job page: description from JD, requirements, apply button; shares the campaign `src`.
- Apply form: name, email, phone, CV file (simulated parse), LinkedIn, consent checkbox → dedupe → Application in New with source → success page with "we'll contact you".
- Optional status check by email (shows stage label in candidate-friendly words). Marked optional; build if time allows.

## 7. Visual fidelity rule ("giống 100%")

- Load the production CSS bundle (`mockup/assets/app.css`, Tailwind v3 compiled) unchanged, with the same fonts and Material Symbols.
- New UI may only use (a) classes already in that bundle, or (b) a supplementary stylesheet generated by Tailwind v3 with the same tokens (primary `#ef5125`, sidebar-dark `#141414`, border-dark `#2e2e2e`, background-light `#f8f6f6`) and **preflight disabled**, loaded after `app.css`. New screens reuse the existing card, table, chip, button and form patterns.
- **Acceptance check:** for each of the 15 existing screens, screenshot the React route and the static mockup page at 1440×900; pixel diff ≤ 0.5% (animated backgrounds excepted). The static `mockup/` stays in the repo as the reference. *(Builder call)* The check runs with `?fixture=mockup`: this loads a fixture dataset equal to what the mockup shows (the 10 visible candidates, 781 total, same chart values, same users) and hides the new additions (new sidebar items, Add to Pipeline buttons, "Used in", Dashboard recruitment row). Normal mode uses the regular seed and shows everything.

## 8. Approaches considered

| | Approach | Trade-off | Decision |
|---|---|---|---|
| A | Extend the static HTML mockup | Fast, 100% identical by construction; no shared data between screens | Rejected by stakeholder |
| **B** | **React prototype with shared in-browser store, ported from the static mockup** | Real end-to-end flow; more work; fidelity must be enforced by diff check | **Chosen** (stakeholder pick) |
| C | Design-only (Figma/Stitch) | No working flow | Not considered further |

## 9. Decided "how" (builder's calls already made)

- Vite + React + TypeScript + React Router, in a new folder `app/` in this repo. Static `mockup/` untouched.
- Store: a single client store persisted to `localStorage`, seeded from fictional data files; "Reset demo data" in the user menu.
- Drag & drop library: builder's choice (must support keyboard).
- Charts on new screens: reuse the visual style of the existing dashboard charts.
- Run with `npm run dev` on localhost (port builder's choice; avoid 5181 which serves the static mockup).

### Stakeholder decisions (2026-11-16)
- Existing screens: **fully functional** (see 6.1).
- Demo setup: **one person, one desktop browser.** localStorage is enough; no backend, no hosting. The careers site is opened in the same browser (e.g. a second tab) to show the apply → pipeline flow.
- Numbers: builder's call, must look realistic (see below).
- Language: **EN–VI switch.**

### Builder calls (made here, stakeholder may correct)
- **Seed data:** ~150 fictional candidates (enough for pagination, charts and filters to look real), 8 users, 6 jobs (4 open, 1 draft, 1 closed), ~70 applications spread across stages, 3 campaigns, 10 notes, 4 JDs (the existing ones), taxonomy as today. All numbers on screens are computed from the store. The mockup's two "Thinh" rows (same phone) are merged into one candidate in the seed.
- **Language switch:** the careers site is fully bilingual EN/VI with a toggle in its header (default VI). The internal app gets the same toggle in the user menu; new screens are fully translated, existing screens translate their own labels while keeping today's English as the default so fidelity holds.
- **Careers site brand:** employer = InApps (logo/hub icon, primary `#ef5125`, Inter). It may use its own public, responsive layout built from the same tokens; copy and imagery are placeholders.
- **Users:** the demo is always logged in as Super Admin. Ratings/comments/addedBy come from seeded teammates; no role switcher, no per-role PII masking beyond today's lock toggle.
- **Simulated AI:** deterministic keyword/skill scoring, no network calls.

## 10. Left to the builder

Component breakdown, HTML→JSX porting method, exact wording of microcopy, empty states, how simulated CV parsing fills fields.
