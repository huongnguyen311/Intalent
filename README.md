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
