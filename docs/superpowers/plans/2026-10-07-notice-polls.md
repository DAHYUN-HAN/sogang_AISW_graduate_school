# Notice Polls Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task with TDD.

**Goal:** Implement administrator-configured KakaoTalk-style polls inside existing notices, including member voting, re-voting and named results.

**Architecture:** Normalize polls/questions/options/ballots/selections under posts. Save settings in the existing post transaction; use protected poll endpoints for participation. Extend existing media authorization and reuse Council cards.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic, PostgreSQL, Expo Router, React Native, React Query.

**Spec:** `docs/superpowers/specs/2026-10-07-notice-polls-design.md`

## Global Constraints

- Notice-only, admin-only configuration; authenticated member participation.
- 1–3 questions, 2–20 options; 100-character titles/labels; public named voting.
- UTC API/storage and KST calendar/time inputs; poll and notice deadlines independent.
- Stable choices after first vote, idempotent replacement, protected images, account-scoped caches.
- Preserve current dirty workspace and prior admin work. Execute here following the user's “구현”; no push, deployment or unrelated commits.

## Review Focus

- Legacy post clients omit poll: keep all stored settings/votes.
- A first vote races an editor or close: serialize post/poll locks and recheck state.
- Hidden notices and arbitrary option/media IDs: reject inaccessible or foreign records.
- A user deletes their account: remove selections while preserving connected images and first-vote lock.
- A retained screen switches accounts or posts: avoid stale selections, drafts and identities.

## Task 1: Poll persistence, settings and participation

Files: create `backend/app/models/poll.py`, `backend/app/schemas/poll.py`, `backend/app/polls.py`, `backend/app/routers/polls.py`, `backend/alembic/versions/0033_notice_polls.py`, `backend/tests/test_notice_polls.py`; modify model exports, main, post schemas/router, media authorization and account deletion.

Interfaces: `apply_poll_settings(db, post, board, user, draft, supplied)`; `serialize_poll(db, poll, user)`; post mutations accept optional nullable `poll`; `/posts/{id}/poll`, `/vote`, `/participants`, `/close` return normal envelopes.

- [x] Write HTTP tests for notice-only/admin settings, atomic preservation, vote/revote/foreign options/expiry/visibility/participants/deletion/media.
- [x] Run `python -m pytest tests/test_notice_polls.py -q` in backend; confirm missing-feature failures.
- [x] Implement normalized models, migration, schema validators and locked domain mutations; wire to existing posts and media/deletion paths.
- [x] Run targeted tests then backend suite; check migration in disposable SQLite and PostgreSQL if available (PostgreSQL unavailable; exact blocker recorded in QA).

## Task 2: Administrator editor and shared cards

Files: create `frontend/utils/noticePoll.ts`, `frontend/components/admin/AdminNoticePollEditor.tsx`, `frontend/components/PersonListCard.tsx`, `frontend/tests/noticePoll.test.ts`; modify `frontend/types/index.ts`, API client, admin NoticeForm/controller, shared post composers and Council lists.

Interfaces: `NoticePoll`, `NoticePollDraft`, `noticePollDraft`, `noticePollPayload`; controlled editor props `{value,onChange,disabled,postId}`. Images use existing picker/upload and authorized MediaImage.

- [x] Write tests for draft hydration, KST conversion, stable ID payloads and vote validation; run with tsx and confirm RED.
- [x] Implement text/date/image options, add/remove/reorder, multiple-choice toggle, deadline calendar/time, lock/close controls and preservation on unrelated saves.
- [x] Run frontend tests and typecheck; inspect admin editor in browser.

## Task 3: Member participation, integration and review

Files: create `frontend/components/NoticePollCard.tsx`; modify post detail, admin audit labels, contracts, PLAN/CODEX and QA notes.

Interfaces: `pollApi.get/vote/participants/close`; `NoticePollCard({postId,poll})` uses current account in cache keys and paginated participant cards.

- [x] Write actual component interaction tests for select/submit/revote/result/filter/closed states; confirm RED.
- [x] Implement member UI, results, retry/error and participant modal; connect notice detail and cache invalidation.
- [x] Run full backend/frontend suites, fresh typecheck, scoped lint and compile checks.
- [x] Exercise local create → member vote → re-vote → named results → admin close; save screenshot and QA notes.
- [x] Request one independent final code review, address important findings, and report exact validation/remaining runtime limits.

## Execution ledger

- Spec approved by user with “구현”. Inline execution chosen to preserve the running dirty admin workspace; tasks run continuously.
- Tasks 1–3 completed for the requested local implementation. Backend: 602 passed, 1 existing skip. Frontend: 867 passed. Typecheck/scoped lint/compile/web export passed. Actual Alembic revision round-trip passed in a disposable database.
- Local web smoke confirmed text/date/photo settings, KST deadline, ordinary member API voting/permissions, UI submit/revote, whole/filtered people cards, admin close, disabled deadline and body edits preserving closed votes. An open user preview remains at `/board/post/9`.
- Independent review repairs: revision-safe null removal, notice-board conversion rejection and keyboard-disabled deadline; additionally saved-only result ticks, async editor scopes and persisted-only close were tested.
- PostgreSQL races/full migration chain remain Phase 5 QA because Docker Desktop Linux engine is not running; physical Android/iOS checks remain Phase 5 QA. No production migration/deploy or Git commit/push. Exact evidence: `docs/qa/NOTICE_POLLS_2026-10-07.md`.
