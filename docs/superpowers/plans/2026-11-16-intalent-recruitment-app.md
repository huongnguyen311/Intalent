# InTalent Recruitment App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clickable React prototype of InTalent that re-implements the 15 existing mockup screens pixel-identically and adds Jobs, Pipeline (ATS), Campaigns, Notes, the Talent Pool / Note intake, and a bilingual public careers site, all sharing one in-browser store.

**Architecture:** Vite + React + TS SPA in `app/`. One Zustand store (persisted to localStorage, versioned) holds all entities; pure domain functions (dedupe, scoring, metrics, filters) live in `app/src/domain/` and are unit-tested. Screens port markup from `mockup/*.html` (same Tailwind classes, production `app.css`) and read/write the store through selectors and actions.

**Tech Stack:** Node 24, Vite 6, React 18, TypeScript 5, React Router 6, Zustand 4 (persist), @dnd-kit/core + @dnd-kit/sortable, Vitest + @testing-library/react + jsdom, Playwright (fidelity check), Tailwind CSS 3 (supplement only).

**Spec:** `docs/superpowers/specs/2026-11-16-intalent-recruitment-app-design.md`

## Global Constraints

- All seed/fixture data is fictional; no real names, emails, phones (spec §2 anti-goals). Reuse names/emails already in `mockup/*.html` only for the `mockup` fixture.
- One Candidate per real person; dedupe key = normalized email, else normalized phone (spec §4).
- Add to Pipeline creates an Application, never a Candidate; duplicate candidate+job is blocked with "Already in this job's pipeline (stage X)".
- Stages, in order: `new, screening, interview, offer, hired, rejected`. Moving to `rejected` requires a reason.
- Application `via` ∈ `careers | talent_pool | campaign | manual`; `source` is always set.
- Note path never creates a Candidate; toast copy "Not added to Talent Pool".
- Load `mockup/assets/app.css` unchanged (copied to `app/public/assets/`), fonts beside it, Material Symbols from `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block`.
- Supplement CSS: Tailwind v3, `corePlugins.preflight: false`, tokens `primary #ef5125`, `sidebar-dark #141414`, `border-dark #2e2e2e`, `background-light #f8f6f6`; loaded after `app.css`.
- Desktop 1440×900 for the internal app; careers site responsive down to 360 px.
- Language: EN/VI toggle. Careers default `vi`; internal default `en`. Existing screens keep today's English text as default.
- Demo user is always Super Admin; seeded teammates author ratings/comments.
- Fidelity: 15 existing screens at 1440×900 under `?fixture=mockup` diff ≤ 0.5% vs `mockup/<page>.html` (Ultra Upload animated background excepted).
- Dev server port 5190 (5181 is the static mockup).

## Review Focus

1. Phone/email formatting variants of the same person (`+84 0901 234 567`, `0901234567`, `(+84) 901-234-567`, `KHOA.Pham@Example.com `) must resolve to one Candidate. → Task 2 test `dedupe treats formatting variants as one person`.
2. Dropping a pipeline card on its own column or outside any column must change nothing (no history entry, no activity). → Task 13 test `drop on same column is a no-op`.
3. Corrupt or older-version localStorage must reset to seed, not white-screen. → Task 2 test `loads seed when persisted state is invalid or version mismatches`.
4. Careers apply with unknown `?src=` falls back to source "Careers page"; a closed or draft job cannot be applied to (404-style page). → Task 15 tests.
5. Empty states (job with zero applications, filters with zero results, campaign with no applicants, empty notes) render a message, not a crash. → Tasks 7, 13, 14 tests named `renders empty state`.

---

## File Structure

```
app/
  index.html, package.json, vite.config.ts, tsconfig.json, tailwind.config.cjs, postcss.config.cjs
  public/assets/            app.css, fonts, favicon.svg, images/   (copied from mockup/assets)
  src/
    main.tsx, App.tsx, routes.tsx
    styles/supplement.css   (@tailwind components; @tailwind utilities)
    domain/                 pure logic, unit-tested
      types.ts  normalize.ts  dedupe.ts  stages.ts  metrics.ts  filters.ts  scoring.ts  campaigns.ts  csv.ts  parseCv.ts
    store/
      store.ts  actions/*.ts  selectors.ts  persist.ts
    data/
      seed.ts  fixtureMockup.ts  names.ts
    i18n/
      i18n.ts  en.ts  vi.ts
    components/             shared UI ported from mockup (Sidebar, Header, Card, Chip, Table, Modal, Drawer, Toast, Pagination, Avatar)
    features/
      auth/ dashboard/ candidates/ intake/ notes/ upload/ assistant/ jds/ matching/
      taxonomy/ system-config/ users/ ta-contribution/ jobs/ pipeline/ campaigns/ careers/
  tests/ (colocated *.test.ts(x) next to sources is the convention)
  scripts/fidelity.mjs
```

---

### Task 1: Scaffold app with production styling

**Files:**
- Create: `app/package.json`, `app/vite.config.ts`, `app/tsconfig.json`, `app/index.html`, `app/tailwind.config.cjs`, `app/postcss.config.cjs`, `app/src/main.tsx`, `app/src/App.tsx`, `app/src/styles/supplement.css`, `app/src/App.test.tsx`
- Copy: `mockup/assets/*` → `app/public/assets/` (exclude `mock.js`)
- Modify: `.gitignore` (add `app/node_modules/`, `app/dist/`)

**Interfaces:**
- Produces: `npm run dev` (port 5190), `npm test` (vitest run), `npm run build`; `index.html` loads `/assets/app.css` then `supplement.css`; `<html class="light">`, `<body class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-gray-100 min-h-screen">` exactly as mockup.

- [ ] **Step 1:** `npm create vite@latest app -- --template react-ts`, add deps from Tech Stack; set `vite.config.ts` server port 5190, vitest env `jsdom`.
- [ ] **Step 2: Write failing test** `App.test.tsx`: `renders root without crashing` — render `<App/>`, expect `document.querySelector('#root, [data-app]')` present.
- [ ] **Step 3:** Run `cd app && npm test` → FAIL (App missing).
- [ ] **Step 4:** Implement `App` placeholder; `index.html` head copies the `<link>`s from `mockup/dashboard.html` (Material Symbols, favicon, app.css) without the sonner/gsi inline styles except the sonner block (keep it, toasts use it).
- [ ] **Step 5:** `npm test` → PASS; `npm run build` → succeeds.
- [ ] **Step 6:** Commit `feat(app): scaffold Vite React app with production CSS`.

### Task 2: Domain model, dedupe and store core

**Files:**
- Create: `app/src/domain/types.ts`, `normalize.ts`, `dedupe.ts`, `stages.ts`, `app/src/store/store.ts`, `persist.ts`, `actions/candidates.ts`, `actions/applications.ts`, `actions/notes.ts`, tests `dedupe.test.ts`, `store.test.ts`

**Interfaces:**
- Produces types (spec §4, verbatim field names): `Candidate, Application, Job, Campaign, Note, Activity, User, Jd, TaxonomyItem, Stage = 'new'|'screening'|'interview'|'offer'|'hired'|'rejected'`, `Via = 'careers'|'talent_pool'|'campaign'|'manual'`.
- `normalizeEmail(s: string): string` (trim, lowercase); `normalizePhone(s: string): string` (digits only, leading `84` → `0`).
- `findDuplicate(cands: Candidate[], input: {email?: string; phone?: string}): Candidate | undefined`.
- `STAGES: Stage[]`, `stageLabel(stage, lang)`.
- Store `useStore` with state `{candidates, applications, jobs, campaigns, notes, activities, users, jds, taxonomy, prompts, chats, ui: {lang, piiUnlocked}}` and actions:
  - `upsertCandidate(input: CandidateInput, ctx: {source: string; by: string}): {candidate: Candidate; created: boolean}`
  - `addToPipeline(candidateId: string, jobId: string, ctx: {via: Via; source: string; campaignId?: string; by: string}): {ok: true; application: Application} | {ok: false; reason: 'duplicate'; stage: Stage}`
  - `moveStage(appId: string, to: Stage, by: string, reason?: string): boolean` (false when `to === current` or `to === 'rejected'` without reason)
  - `addNote(input: NoteInput, by: string): Note`; `convertNote(noteId: string, by: string): {candidate: Candidate; created: boolean}`
  - `resetDemo(): void`
- Persist key `intalent-demo`, `version: 1`; on parse error or version mismatch → seed.

- [ ] **Step 1: Write failing tests** in `dedupe.test.ts`: `dedupe treats formatting variants as one person` (the four Review Focus #1 variants all match one candidate); `no match returns undefined`.
- [ ] **Step 2: Write failing tests** in `store.test.ts`:
  - `upsertCandidate merges into existing profile` → second call with same email returns `created:false`, candidates length unchanged.
  - `addToPipeline blocks duplicate application` → returns `{ok:false, reason:'duplicate', stage:'new'}`.
  - `addToPipeline records job, source, time, by` → fields set, one Activity of type `added_to_pipeline`.
  - `moveStage to rejected requires reason`; `moveStage same stage is no-op` (history length unchanged).
  - `addNote never creates a candidate`; `convertNote dedupes`.
  - `loads seed when persisted state is invalid or version mismatches` (write `"{bad"` and `{version:0}` to localStorage, rehydrate, expect seed candidate count).
- [ ] **Step 3:** `npm test` → FAIL.
- [ ] **Step 4:** Implement types, functions, store (Zustand `persist`, custom `migrate` returning seed on mismatch, `onRehydrateStorage` catch → seed). Seed import is a stub returning empty arrays until Task 3.
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6:** Commit `feat(app): domain model, dedupe and store`.

### Task 3: Seed data and mockup fixture

**Files:**
- Create: `app/src/data/names.ts`, `seed.ts`, `fixtureMockup.ts`, `seed.test.ts`
- Modify: `app/src/store/store.ts` (use `buildSeed()`; `?fixture=mockup` → `buildMockupFixture()`, not persisted)

**Interfaces:**
- `buildSeed(rng = mulberry32(20261116)): DemoState` — deterministic. Volumes (spec §9): 150 candidates, 8 users (incl. Super Admin `admin@company.demo`), 6 jobs (4 open, 1 draft, 1 closed), ~70 applications across all stages, 3 campaigns, 10 notes, 4 JDs (the four in `mockup/jds.html`), taxonomy from `mockup/taxonomy.html`, 4 prompts from `mockup/system-config.html`.
- `buildMockupFixture(): DemoState` — reproduces exactly what `mockup/*.html` shows (the 10 candidate rows incl. both "Thinh" rows, 781 totals via `meta.totals` overrides, dashboard chart values, 10 visible users of 17, TA table numbers).
- `isFixtureMode(): boolean` reads `?fixture=mockup` once at startup.

- [ ] **Step 1: Write failing tests** `seed.test.ts`: `seed volumes match spec`; `seed has no duplicate normalized emails or phones`; `every application references existing candidate and job`; `seed is deterministic` (two builds deep-equal); `seed uses only fictional email domains` (every email ends with `@example.com` or `@company.demo`).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (merge the two mockup "Thinh" rows into one in the regular seed). **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(app): deterministic seed and mockup fixture`.

### Task 4: i18n

**Files:** Create `app/src/i18n/i18n.ts`, `en.ts`, `vi.ts`, `i18n.test.ts`

**Interfaces:** `useT(): (key: keyof typeof en, vars?: Record<string, string|number>) => string`; `useLang(): [Lang, (l: Lang) => void]` backed by `store.ui.lang`; careers routes call `useLang` with default `vi` stored separately as `ui.careersLang`.

- [ ] **Step 1: Failing tests:** `vi and en have identical key sets`; `interpolates vars`; `falls back to en for missing vi key` (dev warning).
- [ ] **Step 2–4:** Run FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(app): EN/VI i18n`.

### Task 5: App shell, routing, fixture visibility

**Files:** Create `app/src/routes.tsx`, `components/Sidebar.tsx`, `components/Header.tsx`, `components/AppLayout.tsx`, `components/{Modal,Drawer,Toast,Pagination,Avatar,Chip}.tsx`, `components/Sidebar.test.tsx`

**Interfaces:**
- Routes per spec §5 (internal paths unchanged from production; new: `/jobs`, `/jobs/:id`, `/pipeline/:jobId`, `/campaigns`, `/campaigns/:id`, `/notes`, `/candidates/:id`, `/jds/:id`, `/jd-matching`; public: `/careers`, `/careers/:jobId`, `/careers/:jobId/apply`, `/careers/applied`, `/login`).
- `Sidebar` markup ported from `mockup/jds.html` `<aside>`; groups per spec §5; active classes `bg-primary text-white` + `icon-filled`.
- `useShowNew(): boolean` → false in fixture mode; every new UI element on existing screens is wrapped in it.
- User menu: language toggle, "Reset demo data" (confirm dialog), Log out → `/login`.
- `toast(msg, type)` using sonner-compatible markup already styled in app.css.

- [ ] **Step 1: Failing tests:** `marks current route active`; `hides new nav items in fixture mode`; `shows Jobs, Pipeline, Campaigns, Notes in normal mode`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(app): shell, sidebar, routing`.

### Task 6: Login and Dashboard

**Files:** Create `features/auth/LoginPage.tsx`, `domain/metrics.ts`, `metrics.test.ts`, `features/dashboard/DashboardPage.tsx` (+ chart subcomponents as SVG ported from mockup's recharts output)

**Interfaces:**
- `dashboardMetrics(state, period: 'day'|'week'|'3m'|'6m'|'all', now: Date): {total, active, parsingSuccess: {ok, total}, missingEmail, topStacks: {name, pct}[], seniority: Record<string, number>, topTa: {name, files}[], english: Record<string, number>, domains: {name, pct}[], recruitment: {openJobs, byStage: Record<Stage, number>, hires, topSources: {source, count}[]}}`
- In fixture mode, metrics return `meta.totals` overrides.
- Charts: pie and bar rendered with `recharts` (same lib production used, identical DOM) — add dependency.

- [ ] **Step 1: Failing tests:** `computes totals from candidates`; `period filter excludes older candidates`; `recruitment byStage counts applications`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Port markup from `mockup/login.html`, `mockup/dashboard.html`; login submit → `/`; Recruitment row (behind `useShowNew`).
- [ ] **Step 6:** Commit `feat(app): login and dashboard`.

### Task 7: Candidate Pool, intake modal, Notes

**Files:** Create `domain/filters.ts`, `filters.test.ts`, `features/candidates/CandidatePoolPage.tsx`, `features/intake/IntakeModal.tsx`, `IntakeModal.test.tsx`, `features/notes/NotesPage.tsx`, `NotesPage.test.tsx`

**Interfaces:**
- `filterCandidates(cands, q: {text?, seniority?, stack?, english?, owner?, tags?: string[]}, sort: 'newest'|'name'|'seniority'): Candidate[]`; page size 10.
- `IntakeModal` step 1 two cards "Add to Talent Pool" / "Add to Note" with one-line explanations (i18n keys `intake.pool.title/desc`, `intake.note.title/desc`); pool form → `upsertCandidate` (toast "Existing profile updated" when `created:false`), optional "Also add to job"; note form → `addNote`, toast "Not added to Talent Pool".
- Row menu: View, Add to Pipeline (opens Task 8 modal), Edit. Bulk select → Add to Pipeline.

- [ ] **Step 1: Failing tests:** `filters by seniority and stack`; `text search matches name, email, title`; `renders empty state` (no results message); intake: `Add to Note does not create a candidate`; notes: `convert to Talent Pool links the note`, `renders empty state`.
- [ ] **Step 2–4:** FAIL → implement (port `mockup/candidates.html`) → PASS.
- [ ] **Step 5:** Commit `feat(app): candidate pool, intake and notes`.

### Task 8: Candidate Profile, Used in, Add to Pipeline

**Files:** Create `features/candidates/CandidateProfilePage.tsx`, `features/candidates/AddToPipelineModal.tsx`, `AddToPipelineModal.test.tsx`

**Interfaces:**
- Profile ported from `mockup/candidate-detail.html` (CV pane renders `candidate.cv` like the mockup's fake CV). Edit mode toggles inputs and saves via `updateCandidate(id, patch)` (add to store in this task).
- "Used in" section: rows `{job title, stage chip, source, via, addedBy, addedAt}` linking to `/pipeline/:jobId`.
- `AddToPipelineModal({candidateIds: string[]})`: pick open job, source (default "Talent Pool"), confirm; per-candidate result list (added / already in stage X).

- [ ] **Step 1: Failing tests:** `adds selected candidates with via talent_pool`; `reports already-in-pipeline per candidate`; `only open jobs are selectable`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(app): candidate profile with pipeline history`.

### Task 9: Upload CVs and Ultra Upload

**Files:** Create `domain/parseCv.ts`, `parseCv.test.ts`, `features/upload/UploadPage.tsx`, `features/upload/UltraUploadPage.tsx`

**Interfaces:**
- `parseCvFile(file: {name: string; size: number}, rng): CandidateInput` — fake extraction derived from file name + rng (fictional values).
- Limits from mockup copy: Upload — PDF/DOCX/TXT, 5 MB, 10 files/batch; Ultra — PDF/DOCX, 5 MB, 1000 files. Over-limit files are rejected with reason.
- Queue rows: queued → parsing (progress) → done (created | merged into existing) | failed.

- [ ] **Step 1: Failing tests:** `rejects files over 5MB and wrong types`; `batch over 10 files rejects extras` (Upload only); `parsed duplicate merges instead of creating`.
- [ ] **Step 2–4:** FAIL → implement (port both mockup pages incl. Ultra's animated background) → PASS.
- [ ] **Step 5:** Commit `feat(app): CV upload with simulated parsing`.

### Task 10: JDs, JD Matching, AI Search

**Files:** Create `domain/scoring.ts`, `scoring.test.ts`, `features/jds/{JdListPage,JdDetailPage,JdEditor}.tsx`, `features/matching/JdMatchingPage.tsx`, `features/assistant/AssistantPage.tsx`

**Interfaces:**
- `scoreCandidate(c: Candidate, req: {stack: string[]; seniority?: string; years?: number; domains?: string[]; english?: string}): {score: number; have: string[]; miss: string[]; reason: string}` — weights 40/30/20/10 (stack / experience+seniority / domain / English), as shown on the JD Matching screen.
- `parseQuery(text: string, taxonomy): req` for AI Search (keywords → stack, seniority, English, domain; VI and EN words, e.g. "tiếng Anh tốt" → english ≥ Advanced).
- JD CRUD: create from pasted text (keyword extractor), edit, publish/unpublish, delete (confirm). "Create Job from this JD" button (Task 12 handles the drawer; here it navigates `/jobs?fromJd=:id`).
- JD Matching page ported from `mockup/jd-matching.html`, data from `scoreCandidate`.

- [ ] **Step 1: Failing tests:** `full stack match scores higher than partial`; `missing skills listed`; `parseQuery reads "senior .Net, tiếng Anh tốt"` → `{stack:['.NET'], seniority:'Senior', english:'Advanced'}`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(app): JDs, matching and AI search`.

### Task 11: Taxonomy, System Config, Users, CV theo TA

**Files:** Create `domain/csv.ts`, `csv.test.ts`, `features/taxonomy/TaxonomyPage.tsx`, `features/system-config/SystemConfigPage.tsx`, `features/users/UsersPage.tsx`, `features/ta-contribution/TaContributionPage.tsx`, `domain/taContribution.ts`, `taContribution.test.ts`

**Interfaces:**
- Taxonomy tabs English Level / Domain / Seniority: add, rename, deactivate; usage count = candidates using it.
- Users: add/edit/deactivate, role ∈ Super Admin/Admin/User/Candidate; stats cards computed.
- `taContribution(state, period): {rows: {ta, newCv, duplicate, parseError, processing, transferIn, transferOut, total}[], totals}`; owner transfer action `transferOwner(candidateId, toUserId, by)` (store) feeds "Lịch sử chuyển giao" tab.
- `toCsv(rows: Record<string, string|number>[]): string` (RFC 4180 quoting) → download `cv-theo-ta.csv`.

- [ ] **Step 1: Failing tests:** `csv quotes commas and quotes`; `ta totals equal sum of rows`; `transfer moves count from one TA to another`.
- [ ] **Step 2–4:** FAIL → implement (port the four mockup pages) → PASS.
- [ ] **Step 5:** Commit `feat(app): configuration screens and TA report`.

### Task 12: Jobs

**Files:** Create `features/jobs/{JobsPage,JobDrawer,JobDetailPage}.tsx`, `JobsPage.test.tsx`; store actions `createJob, updateJob, setJobStatus`

**Interfaces:**
- List columns per spec §6.2 incl. mini stage bar; filters status/department/location.
- `JobDrawer({jdId?})` prefill from JD; fields title, department, location, level, employment, `stageSla` (default `{new:2, screening:5, interview:7, offer:5}` days), publish toggle (`status:'open'`).
- Job detail tabs: Pipeline (embeds Task 13 board), Candidates, Campaigns, Careers preview (iframe-free: renders careers job component).

- [ ] **Step 1: Failing tests:** `creating from JD prefills title and stack`; `draft job not listed on careers` (selector `publicJobs`).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(app): jobs`.

### Task 13: Pipeline (ATS)

**Files:** Create `features/pipeline/{PipelinePage,Board,Column,CandidateCard,ApplicationDrawer,AddFromPoolModal,RejectDialog}.tsx`, `Board.test.tsx`; store actions `addComment(appId, text, by)`, `rateApplication(appId, by, stars: 1-5)`

**Interfaces:**
- Board uses @dnd-kit with `KeyboardSensor`; `onDragEnd` calls `moveStage`; target `rejected` opens `RejectDialog` first; cancel leaves card in place.
- Card: avatar, name, title, source badge, avg rating, days in stage = `floor((now - stageEnteredAt)/day)`, red when `> job.stageSla[stage]`, marker "Talent Pool" when `via==='talent_pool'`.
- Drawer: summary, stage history, comments (seeded teammates), ratings, "Move to…", link to profile.
- Header: job switcher (open jobs), "Add from Talent Pool" → reuses `AddToPipelineModal` in multi-select search mode.

- [ ] **Step 1: Failing tests:** `drop on same column is a no-op`; `drop on rejected asks reason and cancel keeps stage`; `days in stage turns red after SLA`; `renders empty state` for a job with no applications.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(app): pipeline kanban`.

### Task 14: Campaigns

**Files:** Create `domain/campaigns.ts`, `campaigns.test.ts`, `features/campaigns/{CampaignsPage,CampaignWizard,CampaignDetailPage}.tsx`

**Interfaces:**
- Channels: `facebook, linkedin, fb_groups, vietnamworks, topcv, referral, other` (labels/icons in i18n).
- `trackingLink(campaign, channel, jobId, origin): string` → `${origin}/careers/${jobId}?src=${campaign.id}-${channel}`.
- `parseSrc(src: string, campaigns): {campaignId, channel} | null`.
- `campaignStats(state, campaignId): {views, applicants, conversion, hires, byChannel: Record<Channel, number>}` (views simulated deterministically from id).
- Wizard 3 steps per spec §6.4; review step shows links with Copy and a post preview text per channel.

- [ ] **Step 1: Failing tests:** `tracking link round-trips through parseSrc`; `stats count applications by channel`; `renders empty state` for campaign without applicants.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(app): campaigns`.

### Task 15: Public careers site

**Files:** Create `features/careers/{CareersLayout,CareersHome,CareersJob,ApplyForm,Applied,StatusCheck}.tsx`, `ApplyForm.test.tsx`; store action `applyFromCareers(input, jobId, src?: string)`

**Interfaces:**
- `applyFromCareers(...)`: `upsertCandidate` (dedupe) → `addToPipeline` with `via: src ? 'campaign' : 'careers'`, `source` = campaign channel label or `"Careers page"`; unknown `src` → `"Careers page"`; duplicate application → friendly "You have already applied" page.
- Only `status:'open'` jobs are routable; others render "This job is no longer available".
- Layout: public header (InApps logo/hub icon, EN/VI toggle default `vi`), responsive grid (1 col < 640 px, 2 cols ≥ 640, 3 cols ≥ 1024).
- Status check (optional per spec): email → list of applications with candidate-friendly stage words.

- [ ] **Step 1: Failing tests:** `apply creates application in new with Careers page source`; `apply with campaign src sets campaignId and channel source`; `unknown src falls back to Careers page`; `closed job cannot be applied to`; `re-apply shows already applied and creates nothing`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(app): public careers site`.

### Task 16: Fidelity check and docs

**Files:** Create `app/scripts/fidelity.mjs`; Modify `README.md`, `app/package.json` (script `fidelity`)

**Interfaces:** `npm run fidelity` — starts nothing itself; expects mockup on `http://localhost:5181` and app on `http://localhost:5190`; for each of the 15 pages screenshots `mockup/<page>.html` and the matching app route with `?fixture=mockup` at 1440×900, pixel diff (pixelmatch threshold 0.1), prints a table, exits 1 if any page > 0.5% (Ultra Upload excluded from fail).

- [ ] **Step 1:** Implement script (Playwright + pngjs + pixelmatch, writes diffs to `app/fidelity-out/`, git-ignored).
- [ ] **Step 2:** Run both servers, `npm run fidelity` → all pages ≤ 0.5%. Fix ports until green.
- [ ] **Step 3:** README: how to run app, demo script (careers apply in tab 2 → pipeline in tab 1), reset demo data, fixture mode.
- [ ] **Step 4:** Commit `chore(app): fidelity check and docs`.
