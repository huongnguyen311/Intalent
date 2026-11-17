# InTalent — Navigation & Pipeline redesign (short design)

Date: 2026-11-17 · Status: draft for approval · Builds on `2026-11-16-intalent-recruitment-app-design.md`

## Why
Stakeholder feedback on the React prototype: the left menu and the Pipeline page look **cluttered, not compact** ("nhìn rối, không gọn"). She also wants **one place to see what is published to candidates**, and questioned why Notes has its own page.

## Goals
1. **Sidebar in collapsible sections.** Each group (Tuyển dụng, Talent Pool, JD, Cài đặt) folds/unfolds; a folded group shows its item count, e.g. "JD (2)". The group holding the current page is always open. The whole sidebar collapses to an icon rail (« button), with a tooltip with the page name on hover. Fold state is remembered per browser.
2. **Fewer items (17 → 13):**
   - Notes becomes a tab inside "Ứng viên" (Candidate Pool): tabs **Hồ sơ | Ghi chú**. `/notes` redirects to `/candidates?tab=notes`.
   - Upload CVs + Ultra Upload become one menu item **"Upload CV"** with a mode switch on the page (**Thường | Hàng loạt (Ultra)**). Both existing routes keep working; the switch navigates between them.
   - New item **"Trang tuyển dụng"** (see 3).
   - "Cài đặt" (Taxonomy, System Config, Users, CV theo TA) is folded by default.
   - Groups: Dashboard · TUYỂN DỤNG (Jobs, Pipeline, Campaigns, Trang tuyển dụng) · TALENT POOL (Ứng viên, Upload CV, AI Search) · JD (JD Management, JD Matching) · CÀI ĐẶT (4).
3. **"Trang tuyển dụng" (published jobs), internal page `/published`.** A list of the jobs currently visible on the public careers site (status open), each showing title, department, location, level, days published, applicants from careers + campaigns, and a link to the pipeline. Buttons: "Xem như ứng viên" opens `/careers/:jobId` in a new tab, and "Mở trang tuyển dụng" opens `/careers`. There is also a "Gỡ khỏi trang tuyển dụng" action (sets the job to closed after a confirm) and a note when no job is published.
4. **Pipeline redesign:**
   - **Compact cards (3 lines):** avatar + name; title; one meta row with a source dot + label, days in stage, and ★ rating. The duplicate "From Talent Pool" chip is removed (the source already says Talent Pool). Overdue cards are shown by a red left border plus a small ⚠ next to the days, not by red text. Target is about 7–8 cards visible per column at 1440×900.
   - **Header bar:** job switcher; summary "N ứng viên · X quá hạn · Mở D ngày"; search box (name/title); source filter; view toggle **Kanban | Danh sách**; "Thêm từ Talent Pool".
   - **List view:** a sortable table (Ứng viên, Vòng, Nguồn, Ngày trong vòng, Điểm, Ngày thêm). Clicking a row opens the same drawer. Stage can be changed from a per-row "Chuyển sang…" menu.
   - **Hired / Rejected columns** can be collapsed to a narrow vertical strip with the stage name and count. Collapsed by default when the job has more than 3 active stages filled. A collapsed strip is still a drop target (dropping on Rejected still asks for a reason).
   - Search, filter and view choice apply to both views. Drag & drop, keyboard moves, reject reason and drawer behave as today.
   - The same compact board is used inside Job detail → Pipeline tab.

## Non-goals
Mobile layout of the internal app. Changing data model rules (dedupe, applications, sources). Restyling other pages beyond what the merged items need.

## Anti-goals
- Fixture mode (`?fixture=mockup`) must still render the **old** sidebar and the old Candidate Pool / Upload pages pixel-identically (≤ 0.5%). The new nav, tabs and mode switch appear only in normal mode.
- No lost features: everything reachable today stays reachable within 2 clicks.

## Constraints
Same as the base spec: only classes in `app.css` or the Tailwind supplement; all new strings via i18n (EN + VI); 1440×900 desktop; tests for behavior; existing 244 tests stay green; `npm run fidelity` stays green.

## Approaches
- **Chosen: change the existing React app in place** on `feat/recruitment-app`, with the same task + review process. It builds on the working store, routes and components.
- Rejected: an HTML mockup first, because it doubles the work. Rejected: a UI component library, because it would clash with the existing look.

## Builder's calls (stakeholder may correct)
- Icons for new items: `public` for Trang tuyển dụng, `sticky_note_2` for the Notes tab.
- Collapse state is kept in `localStorage` under `intalent-ui-nav` (outside the demo store, so Reset demo doesn't fold the menu).
- Route of the published-jobs page: `/published`.
- List view page size is 20; sorting is client-side.
