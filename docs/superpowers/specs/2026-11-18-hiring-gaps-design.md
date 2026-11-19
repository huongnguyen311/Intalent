# Hiring gaps vs BambooHR — design (short)

Date: 2026-11-18 · Status: user said "làm luôn" (build directly), decisions below are builder calls.

## Intent
Close the recruitment gaps found when comparing InTalent with BambooHR "Hiring & Onboarding".
InTalent stops at offer accepted; the hired candidate is then handed off to an internal company tool
(still being built). Onboarding is out of scope.

This **widens** the 2026-11-16 spec, which listed offer letters and interview scheduling as non-goals.

## Scope (build order)
1. **Email templates wired to actions** — shared `EmailComposer` (pick template, variables filled, editable, "Send" is simulated and logged). Used from: pipeline drawer, candidate profile "Send Email", the move dialog ("notify candidate" for Interview / Rejected), interview invites, offers. Careers applications log an automatic "Application Received" email.
2. **Interview scheduling + scorecard** — drawer section "Interviews": schedule (round, date/time, duration, onsite/online/phone, place or link, interviewers), cancel, scorecard per interviewer (4 criteria × 1–5 stars, recommendation, note). Scheduling from New/Screening moves the card to Interview.
3. **Offer** — drawer section "Offer": create/edit (salary, currency, start date, contract type, valid until, note), send (simulated email), mark accepted (moves to Hired) or declined (reason).
4. **Hand-off** — Hired applications get "Hand off to HR onboarding": confirm dialog previews the data package (candidate, job, offer). Afterwards the application is read-only (no moves) and shows a "Handed off" badge.
5. **Job extras** — salary range + currency + "show on careers page", collaborators, custom application questions (text / yes-no, required flag). Careers job page shows salary when allowed; apply form asks the questions; answers show in the drawer.

## Follow-ups (same day, approved by user)
- **Careers page**: no separate admin screen. Jobs set to Open appear on the one public `/careers` page; the
  sidebar item opens it in a new tab and `/published` redirects to Jobs.
- **Roles & permissions** (`src/domain/permissions.ts`): Super Admin, Recruitment Lead (was Admin), Recruiter
  (was User), Hiring Manager, Interviewer, Candidate. Each role has a permission list plus a data scope (jobs in
  scope, candidates in scope). Hiring Managers may only move a card one step forward or to Rejected. Routes, menu
  items and buttons follow the matrix. A demo "View as" switcher in the user menu signs in as one user per role;
  the login form signs in as the user whose email is typed.
- **Candidate self-service** (`/careers/login`, `/me`): the Candidate role is kept so candidates can sign in by
  email and keep their CV current. CV uploads (kept as versions), contact details and "Open to work" apply at once;
  seniority, English level and skills are only proposed and wait for HR approval (banner on the profile, count
  on Candidate Pool, "pending" filter).

## Non-goals
Real email/calendar sync, candidate self-scheduling, e-signature, bulk email, custom stages per job.

## Builder calls
- All new data lives on `Application` (`interviews`, `offer`, `handoff`, `answers`) and a new top-level `emails` log; `Job` gets optional fields. Persist version stays 3: older saves are kept and get an empty `emails` log plus the new email templates on load.
- Scorecard criteria are fixed (Technical, Communication, Problem solving, Culture fit).
- Hand-off target is labelled "HR Onboarding (internal)" until the tool has a name.
- Email subject = template name + job title.
