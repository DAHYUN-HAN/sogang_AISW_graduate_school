# Poll visual alignment — 2026-10-08

WP6/WP8/WP9 P0. The user requested closer visual alignment with KakaoTalk
after reviewing the existing visual differences. This is a bounded update to
the existing member poll card and participant view.

## Design and scope

Reference: the selection, result and participant screenshots in
[the public KakaoTalk guide](https://www.ajd.co.kr/contents/basic-tip/detail/카카오톡_카톡_투표_기능_생성부터_결과_확인까지-34602),
visually reviewed in the preceding comparison. Its screenshots contain 2023
dates; exact parity with the current native KakaoTalk release is not claimed.

- Compact flat option rows, 18px selection circles, 2px result bars, smaller
  corner radii and reduced vertical spacing. Selection/count targets remain
  at least 44px high.
- Subdued horizontal vote/results buttons, blue accents and compact right-side
  participant status. The total is also in the accessible action label.
- Plain participant rows with circular cohort badges, names and choices.
  `PersonListCard` retains its existing default Council style; polls alone opt
  into `variant="plain"`.
- Status uses a close/title/refresh header, existing option/member/nonparticipant
  tabs and a scrolling body. Below 600px it fills the screen with safe-area
  padding; larger screens use a bounded centered dialog.
- Retain AISW white/blue branding, notice embedding, independent cards,
  binary choices, admin closure, all existing vote/query/keyboard behavior
  and legacy result rendering. No API, DB, dependency or route change.

## Verification

- Final full frontend suite: **891 passed, zero failed**.
- Final `npm run typecheck` and scoped ESLint for both components and the
  poll-card test passed.
- Existing poll coverage remained green. A focused regression first failed
  for the missing accessible participant total (12 passed, 1 failed), then
  passed after the label fix (13 passed). Hook mocks were adapted to the
  existing dimension/safe-area providers; no style snapshot tests were added.
- Read-only component review found low-contrast secondary text and the lost
  spoken total. Both were corrected: retain existing `#6B7280` text and include
  the count in the accessible label. Review found no vote/cache/query/keyboard
  regression or Council default-style regression.
- Whitespace checks include the current component deltas against saved before
  snapshots, because these components were already untracked user work.

Logs and before snapshots: `outputs/qa/poll-design-2026-10-08/`.

## Actual local browser checks

Protected local FastAPI on 8000, Expo web on **8083**, existing disposable SQLite
preview and synthetic member account. Existing source env files were preserved;
the preview process uses a local-only API override. No production changes.

- Opened notice 11, selected an alternate choice in re-vote mode, verified
  side-by-side actions and retained the original saved choice after results
  cancellation. No new vote was submitted.
- Opened the selected option's participant view and closed it; the pending
  choice remained selected (`aria-checked=true`).
- Checked option/member/nonparticipant status tabs, named choices, eligible
  nonparticipants, close and return to the underlying notice.
- Checked closed zero-vote results and closed positive-vote `1위` state.
- Tested actual **390×844** and **320×720** browser viewports. The 320px
  document width was 320px with no horizontal overflow; both used full-screen
  status with accessible close/refresh controls. The normal desktop viewport
  used the centered dialog. Temporary viewport override was reset afterward.

Screenshots:

- `outputs/qa/poll-design-2026-10-08/vote-mobile-390.jpg`
- `outputs/qa/poll-design-2026-10-08/vote-mobile-320.jpg`
- `outputs/qa/poll-design-2026-10-08/results-mobile-320.jpg`
- `outputs/qa/poll-design-2026-10-08/status-mobile-390.jpg`
- `outputs/qa/poll-design-2026-10-08/status-mobile-320.jpg`
- `outputs/qa/poll-design-2026-10-08/status-desktop.jpg`

Physical Android/iOS rendering, system-bar insets and enlarged native fonts remain
**Phase 5 QA**. Web responsive rendering is verified; no installed mobile build,
deployment or migration was requested or performed. Existing unrelated work was
preserved.
