# Administrator Web Pages Implementation Plan

> Use the existing design and execute in this session. The user explicitly authorized provisional decisions and immediate implementation; do not pause for another design/plan approval.

**Goal:** Give every existing administrator tab its own maintainable web page while preserving every currently supported operation.

**Architecture:** Retain Expo Router, session/query isolation and current protected APIs. A persistent admin layout/controller preserves existing workflow state; page components own their presentation. Extract existing handlers and controls mechanically before improving page layouts. Keep native compatibility and old section/deep links. Use actual protected daily APIs for the dashboard.

**Spec:** `docs/superpowers/specs/2026-10-07-web-only-admin-console-design.md` plus the user's 2026-10-07 instruction to implement all existing tabs with provisional choices.

## Constraints and provisional decisions

- Preserve existing create/edit/delete, hide/pin, uploads, media authorization, anonymous replies, request processing, organization introductions, FAQ, calendar, guide/link settings, account controls, roster/payment rules, policy/major options, logs and import review.
- Use the current white shell, Pretendard and app colors. No dependencies or architecture replacement.
- Canonical URLs: `/admin`, `/admin/dashboard`, `/admin/banners`, `/admin/boards`, `/admin/accounts`, `/admin/roster`, `/admin/dues`, `/admin/reports`, `/admin/registration`, `/admin/audit-logs`, `/admin/migration-review`.
- Preserve old `/admin?section=...`, calendar edit and board shortcuts. Keep existing native administration until the user explicitly chooses to remove it.
- Keep domain validation/server permissions unchanged. Document layout/placement choices in `docs/qa/ADMIN_PAGES_DECISIONS_2026-10-07.md` for follow-up edits.
- No release, production migration, deployment, push or unrelated user-file changes.

## Tasks

1. [x] Inventory existing operations and write routing/frame compatibility tests (RED). Add canonical route navigation and protected admin layout; record URL/state rules.
2. [x] Extract shared controls, current controller and every tab's presentation without losing handlers. Preserve existing domain tests by following moved sources. Typecheck and verify operation inventory parity.
3. [x] Make banner, account, report, registration, audit and import-review pages readable on desktop; reuse roster/payment controls and board-type editors. Keep error/empty/loading, pagination and safe confirmations. Keep member-facing create/edit/detail inside admin routes when launched by admins.
4. [x] Add protected dashboard day summaries, seven-day member traffic and paginated post/comment details; test KST, privacy, permissions and null traffic. Wire dashboard metrics/date filters and retain cumulative statistics/operational commands.
5. [x] Verify web export, actual browser 1920/1440/1024 pages, existing operation reachability and representative writes/failures. Run frontend tests/typecheck/lint and backend tests. Independent final review, fix material regressions and update contracts/PLAN/CODEX/QA.

## Review focus

- Existing operations disappearing during JSX extraction or new-route redirects.
- Root role protection covering every nested admin route and preserving member frame.
- Old event/board intents replaying on unrelated tabs; unsaved edits or searches lost during navigation.
- A page or table exceeding notebook width; web Alert confirmations silently doing nothing.
- Dashboard counts/details disagreeing at KST midnight or leaking anonymous/private metadata.

## Execution ledger

2026-10-07: Continue on existing `codex/web-admin-main` branch/shared checkout, preserving previous implementation and the user's unrelated Home test. User's instruction overrides skill approval handoffs. Mechanical extraction precedes visual changes; backend dashboard work has an independent file boundary and fixed contract. No worktree reset or commit of unrelated changes.

2026-10-07 completion: All 11 canonical pages and the reused admin post routes are implemented. Independent inventory/review confirmed existing operations remain. Fixed legacy event query loss, member-route post completion, deferred navigation after leaving admin, native Alert confirmations on web, and dashboard/main/audit cache freshness after post/comment changes. Frontend 833/833 and backend 545 passed/1 skipped; typecheck, changed-file ESLint, web export, backend compile and 70 isolated-browser checks passed. PostgreSQL runtime remains blocked by the unavailable Docker Desktop Linux engine; deployment/migration and mobile runtime checks were not performed. Provisional page decisions and follow-up edit locations are recorded in the QA document.
