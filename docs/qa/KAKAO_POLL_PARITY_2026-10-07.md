# KakaoTalk poll comparison and fixes — 2026-10-07

WP6/WP8/WP9 P0 continuation. User explicitly authorized comparison, verification
and filling gaps without another design/approval pause. The previously approved
notice-only, administrator configuration, two editable text options, single
selection, no deadline and independent manual closure rules remain authoritative.

## Reference and comparison

Visually inspected the participation, option-people, whole-status and ended-result
screens in [this public KakaoTalk guide](https://www.ajd.co.kr/contents/basic-tip/detail/카카오톡_카톡_투표_기능_생성부터_결과_확인까지-34602).
The article reports an update on 2026-03-19, but its screenshots contain 2023 dates.
This is a comparison with those observable reference flows, not a claim of exact
current native KakaoTalk version parity. No live KakaoTalk account was used.

| Observable flow | Before this follow-up | Implemented result |
| --- | --- | --- |
| Option counts open named voters | Result rows only; selection hid counts | Separate count button before/after voting; opening people preserves selection |
| Whole status views | One combined participant list | 항목별, 회원별, 미참여; existing Council cards |
| Reuse a poll | Manually re-enter a card | Administrator copy keeps title/labels, creates fresh records without votes/closure |
| Ended leading result | Count bars only | 1위; equal positive leaders get 공동 1위; no zero-vote winner |
| Select, vote, vote again | Already supported | Verified selection replacement and unchanged unique count; retries retain choice |
| Manual end and readable results | Already supported | Verified card-specific closure, no member submit/revote action, named results retained |

Intentional product differences: white/blue app branding rather than Kakao yellow;
inline cards in a notice rather than a chat-message entry; exactly two single-choice
text options, no anonymous/photo/date/multiple-choice setup or automatic deadline;
only administrators configure/close/copy. One notice can contain multiple independent
cards. Nonparticipants mean current active accounts allowed to read the notice,
not a snapshot of a Kakao chat room. Poll results refetch every 30 seconds and
participant lists every 10 seconds; manual refresh and immediate post-vote refresh
are available. No socket provider or push/reminder integration is introduced.

## Defects found and corrected

- Parent poll revision was part of every card's React key. Appending/editing another
  card could reset an unfinished selection. Keys now depend on account/post and
  only that card's structure/closure. Actual browser selection survived a saved
  fourth-card copy and authoritative refresh, then submitted successfully.
- Installed React Native Web did not expose selected/checked states through the
  existing accessibilityState alone. Explicit ARIA attributes now expose them.
- A radio-role Pressable accepted Enter but not Space on web. A guarded web-only
  handler supports Space/Spacebar without scrolling; native and existing Enter/button
  activation are preserved. Actual keyboard selection and selected-tab attributes
  were verified.

## Backend and privacy

The existing participant endpoint accepts optional participation=voted|not_voted,
defaulting to voted. Nonparticipant mode requires an owned question_id and rejects
option_id. Audience selection applies active-account, board read/active, and notice
publication/author/admin rules, excluding only that card's voters. Responses contain
user_id/nickname/cohort/answers; nonparticipants have empty answers. No contact,
company, dues or roster data. Account/card/option/mode/page cache isolation remains.
No schema change, migration or dependency is required for this follow-up.

## Verification

- Full frontend: **891 passed**. Full backend: **612 passed, 1 skipped**; existing
  Starlette/httpx deprecation warning. Backend compile, frontend typecheck and web
  export passed. Scoped lint: zero errors and two existing API duplicate-import warnings.
- Targeted frontend card/editor/utility coverage: 25 tests included in the full
  run. New coverage includes count access without selection, status modes/cache
  identity, winners/ties/zero votes, stable card identity, rapid duplicate taps,
  Space and failed-vote retry. Expected red runs recorded before fixes.
- Four new backend tests cover independent-card nonparticipants, inactive exclusion,
  minimal profiles, notice/board audience restrictions, foreign/malformed filters,
  guest rejection and 27-member pagination (20 + 7 without duplicates). Existing
  vote/close/settings/migration tests remain green.
- Read-only reviewer independently ran targeted frontend/backend coverage and
  reviewed permissions, pagination, refresh, stable keys, copy and keyboard delta;
  no remaining important findings. Latest keyboard/card targeted run: 13 passed.

Logs in `outputs/qa/admin-main-2026-10-07/`:
`kakao-{frontend-full,backend-full,typecheck,lint,web-export,card-targeted}.log`.
Expected failures: `kakao-{status,ui,copy,a11y,keyboard}-red.log`.

## Actual local browser checks

Protected FastAPI on 8000 and Expo web on 8082; existing disposable SQLite preview.
Separate localhost administrator / 127.0.0.1 member origins isolate sessions.
All changes below used the real forms/endpoints with synthetic preview accounts.

- Notice 11: opened whole status in each of the three modes and direct option
  counts. Names/cohorts and current selections matched the card; missing view showed
  the eligible administrator, not the member who had voted.
- Copied the voted first card through administration; the new fourth card retained
  its two labels, started with zero participants and could be renamed/saved.
  A member's pending third-card NO selection survived the save/refresh.
- Submitted that third-card selection, then ended only that card in administration.
  Member refresh showed closure, NO winner, one participant and no voting action.
  First and fourth cards stayed open; second remains the zero-vote closed example.
- Changed first-card NO to YES. Total remained one; whole status moved the member
  into the YES-labelled option with their name/cohort, leaving the other at zero.
- Verified Space choice and selected-tab ARIA state in the actual browser.
- Notice 10 retains its separate KST application deadline and inline-image metadata;
  body/image and legacy poll regression coverage remains in the full suites.

Screenshots:
- `outputs/qa/admin-main-2026-10-07/kakao-poll-status.png` — final option groups/name/choice.
- `outputs/qa/admin-main-2026-10-07/kakao-missing.png` — eligible nonparticipant view.
- `outputs/qa/admin-main-2026-10-07/kakao-poll-member.png` — ended positive winner.

The existing member frame is approximately 405px on desktop. A requested 320px
browser viewport override was not applied by the in-app browser (DOM still reported
1280px); it was reset and the temporary tab closed. No 320px/device pass is claimed.
Physical Android/iOS and production PostgreSQL/concurrency remain Phase 5 QA;
production migration/deployment was not performed. Existing unrelated work preserved.
