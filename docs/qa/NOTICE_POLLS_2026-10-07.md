# Notice Polls QA — 2026-10-07

Scope: user-requested P2 notice polls under WP6/WP8/WP9, approved with “구현”.
Spec: `docs/superpowers/specs/2026-10-07-notice-polls-design.md`.
Plan: `docs/superpowers/plans/2026-10-07-notice-polls.md`.

## Delivered behavior

- Existing administrator web notice editor adds text/date/photo choices,
  up to three questions, single/multiple selection and optional KST deadline.
  Poll settings save atomically with the notice; existing clients that omit
  poll keep all stored settings and votes.
- Published readable notices accept the authenticated account's complete ballot;
  repeating a vote replaces its selections. Results show counts, percentages,
  saved personal choices and paginated current public names/cohorts/choices.
  Participants and existing Council rows share the same white/blue person card.
- First vote freezes questions/options permanently, including after all voters
  delete their accounts. Open deadlines and notice bodies remain editable.
  Administrators alone configure/remove/close. Closed ballots reject changes;
  results remain readable. Poll create/update/remove/close appears in audit logs.
- Stable settings revisions reject stale edits/removal. `poll:null` requires
  `poll_revision`. Board moves preserve poll IDs/votes; incompatible board
  conversion is rejected. Post mutation locks and board shared locks coordinate
  votes/settings/close with board changes. PostgreSQL execution is still pending.
- Protected option images follow parent-post authorization and survive owner
  deletion when still attached. Individual names/choices are not copied into
  operational audit records.

## Verification evidence

Final commands and observed results:

| Check | Result | Evidence |
| --- | --- | --- |
| `python -m pytest -q` (backend) | 602 passed, 1 skipped | `outputs/qa/admin-main-2026-10-07/polls-backend-suite.log` |
| `npm test` (frontend) | 867 passed | `outputs/qa/admin-main-2026-10-07/polls-frontend-suite.log` |
| `npm run typecheck` | exit 0 | `outputs/qa/admin-main-2026-10-07/polls-typecheck.log` |
| Scoped ESLint for poll components/utils/tests and shared schedule | exit 0, no warnings/errors | `outputs/qa/admin-main-2026-10-07/polls-lint.log` |
| `python -m compileall -q backend/app backend/alembic` | exit 0 | executed after final backend changes |
| `npx expo export --platform web --output-dir ../outputs/qa/admin-main-2026-10-07/polls-web-export` | exit 0 | `outputs/qa/admin-main-2026-10-07/polls-web-export.log` |
| Actual Alembic 0033 upgrade/downgrade through Operations context | passed; seeded parent rows retained | `backend/tests/test_notice_poll_migration.py`, included in suite |
| Live protected member API | vote 200 when open; 409 `POLL_CLOSED` after close; member close 403; participants/image access 200 | `outputs/qa/admin-main-2026-10-07/polls-live-smoke.log` |

API tests cover notice/admin restrictions, atomic failure, omission preservation,
revision/foreign choice validation, multi-question/date/multiple selection,
expiry/manual close, hidden notice/media access, account deletion, pagination,
live profile changes, invalid images, pre-vote removal, moves and board conversion.
Component tests exercise real selection/submission/revote/result/filter behavior,
discarded choices, closed state, late upload isolation, persisted-only close and
keyboard-disabled deadline inputs. RED was observed before implementation and
for the stale-removal, unsaved-result, upload-lifetime and unsaved-close regressions.

The backend emits one existing Starlette/httpx deprecation warning. The skipped
existing test remains skipped; no new poll test is skipped.

## Local browser smoke

Existing Expo server stays on `http://localhost:8082`; protected preview API stays
on port 8000, using only the pre-existing local preview SQLite file. Restarted API
to load new models/routes; existing data was preserved. No production DB was used.

1. In `/admin/boards`, create `[투표 미리보기] 원우 모임 일정` (post 8):
   text place question, two date options with multiple selection, option image,
   and October 14 18:00 KST deadline. Save shows registration success.
   Live API confirms `2026-10-14T09:00:00Z`; option image is absent from the main gallery.
2. A synthetic local member (`투표 미리보기 원우`, 74기) votes through the real API;
   standard member permission denies close and permits protected image/results.
3. In the shared member detail, admin votes as their own account (per spec),
   selects both dates, then re-votes from 학교 to 식당 and removes one date.
   Participants stay at two; place/date counts change to 1/1, with correct saved tick.
4. Whole participant modal shows 72기 and 74기 people with their actual choices.
   Clicking 식당 filters to one person using the same card.
5. Reopen admin editor: questions/options are disabled, deadline still editable.
   Confirm immediate close: deadline inputs/clear become disabled and member
   screen removes vote/revote actions after its next poll refresh.
6. Edit and save the closed notice body: successful save keeps poll, image and votes.
   Reloaded notice still shows closed results.
7. Leave an additional open copy (post 9, `[투표 미리보기] 직접 참여해 보기`)
   for user review at `http://localhost:8082/board/post/9`.

Captures:
- `outputs/qa/admin-main-2026-10-07/poll-admin-editor.png`
- `outputs/qa/admin-main-2026-10-07/poll-participants.png`
- `outputs/qa/admin-main-2026-10-07/poll-open-preview.png`

## Independent review and repairs

One fresh read-only review found stale null-removal bypass, notice-board conversion
stranding polls and keyboard-active closed/busy deadlines. All three were repaired
and covered by HTTP/component checks. The unsaved result tick was also repaired
and reproduced with a regression test. Async editor scopes now additionally reject
late completions after notice/session changes. Unsaved polls on an existing notice
hide immediate close until first save. All final suites above ran after these fixes.

## Runtime limits / handoff

- `Phase 5 QA`: PostgreSQL multi-connection race tests and full migration chain.
  `docker info` fails because `dockerDesktopLinuxEngine` named pipe is absent;
  Docker Desktop daemon is not running. SQLite validates routes/constraints and
  target migration, but does not verify PostgreSQL row-lock scheduling.
- `Phase 5 QA`: physical Android/iOS voting, hardware Back and modal behavior.
  Web interaction/build and framework typecheck passed; no device build was run.
- Production deployment and Alembic upgrade were not requested or performed.
  Apply `0033_notice_polls` after `0032_admin_usage` before deploying these APIs.
- Existing dirty administrator work and unrelated files were preserved. No
  commit, push or PR was created. Only synthetic local preview member/notices
  and a repository image were added for QA; no real account was modified/deleted.
