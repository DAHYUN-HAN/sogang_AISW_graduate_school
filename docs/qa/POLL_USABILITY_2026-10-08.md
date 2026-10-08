# Poll usability follow-up — 2026-10-08

Scope: approved usability audit, P0 WP6/WP8/WP9. Existing notice routes,
binary independent cards, named participation, administrator closure and
white/blue design remain the product contract.

## Implemented

| Audit finding | Result |
| --- | --- |
| First-response edit restriction is hard to discover | Explain locking before registration, including per-card edit/delete restrictions. |
| Notice application deadline resembles a poll deadline | Explain that the calendar does not close polls and administrators must close them explicitly. |
| Save failure hides the real cause | Preserve API messages; conflict recovery requires confirmation and reloads only poll settings/revision. Unsaved title, body, images and other notice fields remain. |
| Close confirmation lacks a target | Show the saved question title, card number and loaded participant count. Explain immediate closure, target draft discard and inability to reopen/change responses. |
| Admin list lacks poll overview | Add nullable admin-only, page-batched `poll_summary`; unique respondents are not the sum of card votes. Show counts and direct edit access; refresh every 30 seconds. |
| Member saved response is unclear | Display explicit saved-response receipts and separate pending-revote guidance. Multiple-card progress counts only saved responses on currently answerable cards. |
| Unsaved cards show active status | Show 작성 중 and 공지 저장 후 시작. Display current/max card count and explain deferred save versus immediate close. |

Read-only 회원 화면 미리보기 appears before the registration/save controls.
It displays the current draft title, notice text, protected images, application
deadline and card labels. It cannot save, close or cast a vote. It identifies
itself as a draft/layout preview; actual participation counts are checked in
the saved notice.

## Verification

- Backend full suite: **614 passed, 1 skipped**, one existing Starlette/httpx
  deprecation warning. Added coverage checks partial/all closure, zero votes,
  distinct respondents, ordinary notices, pagination and guest/member denial.
- Frontend full suite: **897 passed**. Focused poll tests: **31 passed**.
- Frontend typecheck and scoped ESLint: pass.
- Backend compile/import syntax checks and scoped whitespace checks: pass.
- Regression red runs reproduced the missing admin summary, generic targetless
  close dialog, missing saved-response/progress presentation and missing targeted
  reload. Recovery tests execute the real handler and its editor identity guard,
  preserving unsaved notice fields and rejecting a stale async completion.
- Independent read-only code review: no critical/important findings. It checked
  baseline snapshots because the checkout contains extensive pre-existing work.

## Browser observations

Used the existing local synthetic preview at `127.0.0.1:8000` and Expo web
`localhost:8083`; no production database/deployment. Restarted only the disposable
preview backend to load the aggregate response.

- Admin list displays notice 11 with 4 cards, 2 open, 2 closed, 1 distinct respondent.
  The summary action opens that notice editor directly.
- Close confirmation shows the saved question, current loaded count and effects;
  cancelled without changing closure.
- An unsaved title and added fifth question appear in the draft preview; its
  new card displays 작성 중 in the editor and 등록 후 시작 in the preview.
  Preview has no vote/registration actions. Existing saved notice stays at 4 cards.
- Preview verified at actual DOM width 320px without horizontal overflow.
- Member verified at actual DOM widths 320px and 390px, with matching document
  scroll widths. Progress and receipt fit their cards. Pending alternate selection
  retains the saved-answer receipt and progress; cancelling restores the original
  result without casting a vote.
- Temporary admin tab closed, viewport override reset, existing member preview
  preserved. No preview credentials are included in these notes.

Evidence in ignored `outputs/qa/poll-usability-2026-10-08/`:
`admin-list.jpg`, `close-confirmation.jpg`, `draft-preview.jpg`,
`preview-320.jpg`, `member-320.jpg`, `member-390.jpg`, test logs and pre-change
source snapshots.

## Limits

Physical Android/iOS, font scaling and screen reader runtime remain **Phase 5 QA**.
Live UI save-conflict injection was not performed; API conflicts and targeted
controller recovery are covered automatically. PostgreSQL/Docker runtime and
production migration/deployment were not part of this change. No schema migration,
provider, dependency, or release behavior was added.
