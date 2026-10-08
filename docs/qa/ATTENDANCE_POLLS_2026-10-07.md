# P0 attendance polls — 2026-10-07

User approved the audit corrections with “수정 진행”. WP6/WP8/WP9, existing notice
architecture and checkout retained. This supersedes the generic P2 poll settings
in `NOTICE_POLLS_2026-10-07.md` and its original design.

Later same-day comparison and runtime follow-up: `KAKAO_POLL_PARITY_2026-10-07.md`.
Its additional features, verification counts and local sample state supersede the
corresponding baseline snapshots below.

## Implemented behavior

- One notice supports up to 20 independent attendance cards. This provisional
  safety limit replaces the old three-question limit. Each new/changed card has
  exactly two editable text labels, default YES / NO, and single selection.
- Members can participate in one card without answering others, replace their
  choice until closure, inspect result bars, and open named participants for a
  card or option. Council's existing `PersonListCard` shows cohort/name/choice.
- Only administrators configure or close cards. Manual closure is independent
  and idempotent. No poll deadline or automatic closure; the notice application
  calendar/time and body image editor remain separate and unchanged.
- Voted/closed card structure cannot change or be removed. Other cards remain
  editable/addable. Re-voting replaces only submitted card selections and does
  not increase unique participant counts or erase other votes.
- Stored question/option/ballot/selection IDs and media remain. Obsolete date,
  multiple-choice, photo and nonbinary records retain readable results; they
  reject new participation. Unvoted/unclosed obsolete cards may be removed or
  converted to binary through the authorized API. New photo/multi/date settings
  are rejected; legacy automatic deadlines no longer affect participation.
- Closing restores that saved target card while retaining other unsaved cards.
  Confirmation explains that target edits are discarded. Scope/unmount guards
  prevent late completions overwriting another notice. Vote cache updates cancel
  old fetches and await an authoritative account/post refetch.

Visual flow reference: [KakaoTalk poll screenshots](https://www.ajd.co.kr/contents/basic-tip/detail/카카오톡_카톡_투표_기능_생성부터_결과_확인까지-34602).
White/blue project theme retained. This matches the requested participation flow;
pixel parity with every current native KakaoTalk version is not claimed.

## Verification

- HTTP/migration tests written first: initial expected failures for partial
  participation, independent closure, binary-only settings, four cards and
  missing migration. Frontend initial five expected failures recorded in
  `outputs/qa/admin-main-2026-10-07/attendance-frontend-red.log`.
- Poll backend/migration coverage: **21 passed**. Full backend suite: **608
  passed, 1 skipped**, existing Starlette/httpx warning. Includes permission,
  stale revision, foreign IDs/filters, hidden media, account deletion, atomic
  saves, independent counts/choices, closure, append after all cards closed,
  locked structure and legacy preservation.
- Full frontend suite after review fixes: **883 passed**. Typecheck passed;
  full lint has zero errors and two existing duplicate-import warnings. Changed
  poll files lint clean. Backend compile/import and web export passed.
- Read-only reviewer found target-close draft and out-of-order result-cache
  issues; both corrected and regression checked. Reviewer independently used
  real QueryClient/QueryObserver to verify reversed mutation responses and a
  late stale GET cannot erase successful card answers. No remaining important
  findings in the requested scope.
- Git whitespace check passed; existing CRLF conversion warnings only.

Logs: `outputs/qa/admin-main-2026-10-07/attendance-{backend-polls,backend-full,
frontend-targeted,frontend-full,typecheck,lint,review-lint,compile,export,diff-check}.log`.

## Local runtime

Applied **only** Alembic `0034_attendance_polls` to the existing disposable SQLite
preview after an SQLite backup at
`outputs/qa/admin-main-2026-10-07/admin-interactive-preview-before-attendance-0034.sqlite3`.
Before/after migration counts remained identical: 2 parent polls, 4 questions,
8 options, 3 ballots and 6 selections. Manual closure and first-vote times were
backfilled; no legacy rows removed. Protected local API restarted on port 8000;
Expo web remains on 8082.

Browser verification used separate localhost administrator / 127.0.0.1 ordinary
member origins. Notice **11**, `[참석 투표 미리보기] AISW인의 밤`, was created through
the actual administrator form with two independent polls. Member submitted only
the first, changed to the other label, and saw their current cohort/name/choice
with one participant. Administrator appended an unsaved third card, closed only
the second, retained the third draft, and saved it with a body edit. Reload
preserved first-card vote/count, second-card closure, and new third card. First
and third remain open; second is an explicit closed-result example.

Prior notice 10 retains application deadline `2026-10-09T09:30:00Z` (18:30 KST),
body version 1 and inline image ID 4 at UTF-16 offset 16. Its attachment/body
behavior is also covered by the full frontend regression suite.

Screenshots:
- `outputs/qa/admin-main-2026-10-07/attendance-admin.png`
- `outputs/qa/admin-main-2026-10-07/attendance-member.png`
- `outputs/qa/admin-main-2026-10-07/attendance-participants.png`

Production migration/deployment was not requested or performed. Actual
PostgreSQL migration/concurrent locking and physical Android/iOS runtime are
**Phase 5 QA**. Shared RN code and web export are verified, not a new installed
mobile build. Existing unrelated admin/roster/dues/banner work remains untouched.
