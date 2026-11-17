# InTalent — Talent Pool mockup

Static HTML mockup of InApps Talent Pool. All people and contact data are fictional.

## Run

```bash
cd mockup
python -m http.server 5181
```

Open http://localhost:5181 (login page; any credentials go to the dashboard).

## Screens

| Page | Source |
|---|---|
| Login, Dashboard, Candidate Pool, Upload CVs, Ultra Upload, AI Search, JD Management, Taxonomy, System Config, User Management, CV theo TA | Production layout, fake data |
| Candidate Profile (`candidate-detail.html`), JD Detail (`jd-detail.html`) | Production layout, fake data |
| JD Matching (`jd-matching.html`) | New design (not in production) |

## Structure

- `mockup/` — the built mockup (open directly or serve).
- `mockup/assets/` — production CSS bundle, Inter fonts, images, `mock.js` (page-to-page navigation).
- `reference/` — build scripts:
  - `build.js` — assembles `mockup/` from captured DOM + designed pages, anonymizes, and fails if real data is left.
  - `anonymize.js` — replacement logic. The real→fake mapping is kept locally in `reference/private/` (git-ignored).
  - `candidate-detail.js` — fictional candidate profile.
  - `pages/` — designed screens.

Raw production captures (`reference/dom`, screenshots) are not committed because they contain real data, so `build.js` only runs on the machine that holds them.

## App (React prototype)

`app/` re-implements the 15 mockup screens in React and adds recruitment features (jobs, pipeline kanban, campaigns, public careers site). Vite + React 18 + TypeScript; all data is fake and lives in the browser (localStorage).

Prerequisites: Node 18+.

```bash
cd app
npm install
npm run dev        # http://localhost:5190
npm test           # vitest
npm run build      # type-check + production build
npm run fidelity   # pixel diff vs the static mockup (see below)
```

### Demo script

1. Tab 1: open http://localhost:5190, log in (any credentials), go to Jobs / Pipeline.
2. Tab 2: open http://localhost:5190/careers and apply to a job. Optionally apply through a campaign tracking link copied from a campaign's detail page.
3. Back in tab 1: the new candidate appears in that job's New column with the right source.

Use "Reset demo data" in the user menu to restore the seed data. Language: EN/VI toggle is in the user menu (internal app) and in the header (careers site).

### Fixture mode

Append `?fixture=mockup` to any route to render the original mockup data (not persisted). The fidelity check uses it.

### Fidelity check

`npm run fidelity` screenshots each `mockup/<page>.html` and its app route at 1440x900, diffs them (pixelmatch, threshold 0.1), writes diffs to `app/fidelity-out/` (git-ignored), prints a table, and exits 1 if any page exceeds 0.5% (Ultra Upload, with its animated background, is excluded). It starts no servers; run both first:

```bash
cd mockup && python -m http.server 5181   # static mockup
cd app && npm run dev                     # app on 5190
```

It uses system Chrome if present, otherwise `npx playwright install chromium`.
