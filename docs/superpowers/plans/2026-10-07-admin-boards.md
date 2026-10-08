# Web board management implementation plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation, with a fresh final review.

**Goal:** Implement the approved white desktop board screen, current member taxonomy, child-board creation and recoverable removal.

**Architecture:** Keep Expo Router, the shared protected administrator workspace, existing board metadata and dedicated content editors. A presentation helper maps real board IDs to the four member-facing groups; optional `metadata.admin_navigation` records a section and parent board. Removal deactivates the selected board and its descendants without deleting posts or comments.

**Tech Stack:** React Native Web, React Query, FastAPI, SQLAlchemy.

**Spec:** Approved conversation mockup and `docs/superpowers/specs/2026-10-07-web-only-admin-console-design.md`.

## Global constraints

- WP8/WP9; existing IA and board-scoped filters are P0. This uses current tags, not a new general tagging system.
- Current checkout `codex/web-admin-main` contains the authorized prior admin work; continue here and preserve unrelated edits.
- No commit, deployment, production migration or new provider. No schema change.
- No board finder. Existing member menus, IDs, policies, editors and content remain.
- Current groups: 원우회, 참여활동, 커뮤니티, 공지사항. Old calendar and other legacy boards remain under collapsed additional management.
- Board removal is recoverable hiding; the UI says so. Reactivation requires an active parent.

## Review focus

- Mixed notice boards/categories must filter the full dataset before pagination, including older webinar aliases as event notices.
- Hidden/legacy boards must remain accessible to admins, while member visibility respects inactive ancestors.
- Parent IDs must be valid, in the same management section and acyclic, including attempted parent removal/reassignment.
- Dedicated intro, FAQ, external link, mutual-aid and suggestion editors must remain reachable.
- In-flight editing/saving must not switch to a different board or show stale content.

### Task 1: Board grouping and protected APIs

**Files:** `frontend/utils/adminBoardTree.ts`, `frontend/tests/adminBoardTree.test.ts`, `backend/app/board_navigation.py`, board/post routers, `backend/tests/test_admin_board_navigation.py`.

**Interfaces:** `adminBoardSections(boards)` returns canonical sections with real board IDs; `adminBoardSection(board)` resolves existing/default metadata; `adminBoardParent(board)` returns validated parent ID. Admin posts accept comma-separated `board_ids` and `notice_category`.

- [x] Write and run failing grouping/parent/API tests.
- [x] Implement section mapping, parent validation, recursive reversible removal and paginated notice/group filtering.
- [x] Run targeted tests; expected all pass with API admin enforcement and content retained.

### Task 2: Desktop screen and forms

**Files:** AdminBoardsPage, new sidebar/table/create components, shared controller, API client.

**Interfaces:** Existing workspace handlers/editors remain available. Create records section/optional parent metadata; selected board content/settings use the current protected handlers.

- [x] Implement left taxonomy rail, compact right table/tag/search controls and per-row actions.
- [x] Open settings and notice editor only on demand; retain dedicated specialized renderers.
- [x] Create within major group/section/optional parent; expose hide/restore with descendant behavior explained.
- [x] Run frontend test command, typecheck, changed-file lint and backend suite.

### Task 3: Verify and show

- [x] Browser-check four groups, tags, specialized content, settings, create/remove/restore in isolated local preview.
- [x] Review changed code with fresh reviewer; address material findings and record evidence.
- [x] Update CODEX/API/route decisions and show the running local administrator page.

## Completion record

Frontend 842/842; backend 551 passed / 1 skipped; typecheck and scoped lint
passed. Actual browser creation, nested removal/restoration, cross-board
notice edit, draft protection and 1024/1440px geometry passed. One fresh
review completed and material findings were addressed. Decisions and
verification: `docs/qa/ADMIN_BOARDS_WEB_2026-10-07.md`. Work remains in the
authorized local checkout; no commit, integration, deployment or production
database change was requested or performed.
