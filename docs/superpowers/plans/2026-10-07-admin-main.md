# Web Admin Main Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan in this session. User instruction: “메인부터 작업 시작”.

**Goal:** Implement the approved desktop admin main with real statistics, persistent pending queues, same-KST-day handled records and recent operational logs.

**Architecture:** Keep Expo Router, React Query and the existing admin editors. Add a focused main component and reusable white web shell to the current admin route. A protected backend overview filters and paginates requests before serialization; daily metrics use UTC ranges for KST dates. First-party authenticated route events supply traffic without an external provider.

**Tech Stack:** Expo / React Native Web / TypeScript, FastAPI / SQLAlchemy 2 / Alembic, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-10-07-web-only-admin-console-design.md`, approved main section.

## Global Constraints

- Preserve existing administrative functions and member UI; wide layout applies only to admin web routes.
- White surfaces, existing Pretendard typography, blue `#2761FF`, text `#15171C`, border `#E1E4E9`.
- Order: statistics, pending counts, mutual-aid/suggestion lists, latest five operational records.
- Pending requests remain regardless of age. Completed/rejected/answered records use their handling timestamp in the current `Asia/Seoul` day.
- No removed guidance, quick actions or utilization shortcut on main. Historic requests remain in existing full management lists.
- Server admin dependencies, normalized responses, Alembic migrations. No real data or secrets in tests.
- Implement main now; retain existing dashboard and other editors while their new designs remain under review.

## Review Focus

- Old pending records after multiple pages must remain reachable and counts must be global.
- KST midnight, null handling timestamps and browser reactivation must not show stale handled records.
- Repeated/cancelled/invalid admin saves must not create duplicate logs or move handling timestamps.
- Traffic retries, route rerenders, admin use and 30-minute inactivity must not inflate counts.
- Request loading/errors and saving failures must retain correct UI and avoid showing fake zeroes or losing drafts.

### Task 1: Admin overview API

**Files:** create `backend/app/admin_main.py`, `backend/tests/test_admin_main.py`; modify `backend/app/routers/admin.py`.

**Interfaces:** `GET /api/admin/main?mutual_page=1&suggestion_page=1&size=5` returns `date`, `as_of`, seven `metrics`, `pending`, and two paginated queues. Queue items contain post/board IDs, title, status, anonymous-safe author, receipt and handling timestamps.

- [x] Write API tests for guest/member rejection, global counts and pagination, pending-first ordering, deleted/hidden exclusion, KST processing boundaries and daily posts/comments including replies.
- [x] Run `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_admin_main.py -q`; observe missing endpoint failures.
- [x] Implement KST range aggregation and SQL predicates before pagination.
- [x] Re-run the new tests and existing privacy/datetime tests.

### Task 2: First-party traffic

**Files:** create usage model/router/migration `0032_admin_usage`, `backend/tests/test_admin_usage.py`, frontend route tracker and pure navigation utility; modify model registration, config/env example and root layout.

**Interfaces:** authenticated `POST /api/usage/page-views` accepts UUID `event_id`, UUID `device_id` and a bounded screen category. Server derives pseudonymous visitor identity and session assignment; admin use is excluded. Main traffic exposes collection status and start timestamp; unavailable values are null.

- [x] Write tests for retry deduplication, distinct visitors, 30-minute session boundary, admin/guest exclusion, disabled collection and absence of raw URLs/identity.
- [x] Observe failures, then implement the model and reversible Alembic migration plus member navigation collection. No IP, user-agent, content or query parameters are stored.
- [x] Run API tests and frontend navigation utility tests; verify migration upgrade/downgrade on an isolated test database.

### Task 3: Main UI and processing

**Files:** create `frontend/components/admin/AdminMain.tsx`, `AdminWebShell.tsx`, `AdminRequestPanel.tsx`, main utilities/tests; modify `frontend/app/admin/index.tsx`, root layout, API/types and post cache invalidation.

**Interfaces:** main calls `adminApi.getMain({mutual_page, suggestion_page})`, recent logs use existing audit API. Detail calls `postApi.getPostDetail`, and existing suggestion/mutual update APIs. Main web navigation selects existing admin sections. Member web frame remains 405px.

- [x] Test route/frame decisions, request status/date presentation, cache targets and save outcomes.
- [x] Implement the full-width white sidebar shell and approved main without introducing unreviewed editor redesigns.
- [x] Open a request inside the admin shell, show authorized evidence, preserve failed drafts, validate replies/rejection reasons, then refresh overview/logs after server success.
- [x] Refresh on KST midnight and foreground/focus. Use global queue totals and previous/next pagination.
- [x] Verify typecheck, lint and actual browser layouts at 1440/1024; check member frame and API error states.

### Task 4: Operational records and integration

**Files:** modify post/comment mutation routers, add audit regression tests, update phase2 contracts, PLAN and CODEX plus verification notes.

- [x] Write tests proving administrator post create/update and comment create/update/delete log exactly once in the transaction; regular member writes and no-op/invalid saves do not log.
- [x] Fill missing audit paths and add safe target/change summaries. Prevent identical mutual-aid/suggestion saves from changing processing timestamps.
- [x] Run backend suite, frontend tests/typecheck/lint, web export and browser/API smoke. Record Docker availability and migration evidence precisely.
- [x] Review the final change and fix material findings before reporting completion. Leave changes reviewable in the current task; no deployment.

## Execution Record

2026-10-07: User explicitly requested implementation of the approved main. Execute directly in this session. Existing design/docs and the user's unrelated Home test are preserved. Created branch `codex/web-admin-main` in the shared checkout; baseline privacy/datetime API tests pass 19/19. Planning handoff and worktree prompts are omitted under the user's start instruction and the developer's requirement to proceed with authorized reversible work.

Completed main implementation and independent review fixes. The existing dashboard is retained; metric/date drilldown and seven-day trends remain its next slice. Traffic covers authenticated ordinary members only under the current member-only policy. API acceptance uses TestClient/isolated SQLite; browser acceptance uses the actual export with every network request intercepted. PostgreSQL/Docker smoke is blocked by the unavailable Docker Desktop Linux engine, not marked passed. Final verification and migration instructions: `docs/qa/ADMIN_MAIN_WEB_2026-10-07.md`. Leave the branch and working changes reviewable in this task; no deployment/integration prompt is necessary for the requested implementation.

Final integration also applies the existing account-deletion policy to current-key member usage events through the shared `app/usage_identity.py` helper. Regression tests cover retaining other members' rows and rejecting a collector whose authenticated principal was deleted before it acquired the account lock. Final backend suite: 525 passed, 1 skipped; frontend: 818 passed; actual exported browser main/processing/Back/reload/member-frame checks pass.
