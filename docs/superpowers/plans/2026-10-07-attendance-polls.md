# Attendance polls correction

User-approved scope: implement the audited corrections for AISW인의 밤.
This supersedes the earlier generic poll settings, within WP6/WP8/WP9 P0.

Keep the existing notice poll container and stable question/option/ballot IDs.
Each question becomes an independent attendance poll with its own first-vote
lock, participant count, manual closure, single-choice submit and result card.
Existing ballots store selections across cards; changing one replaces only that
card's selections. Add nullable per-card closure/first-vote columns through
Alembic 0034 and backfill legacy manual closure and locks without deleting votes.
New/changed polls are text-only, exactly two editable labels (YES/NO defaults),
single choice, with no date deadline and a provisional maximum of 20 cards per
notice. Unchanged legacy configurations/results
remain readable and preserved. New polls can be appended after others receive
votes or close; voted/closed cards cannot be deleted or reconfigured.

UI: one white card per poll, title and 진행 중/종료, two checked selection rows,
투표하기/다시 투표하기, result bars and clickable participant counts. Each card
opens its own named participant list using the existing Council person cards.
Reuse app white/blue theme and Kakao-style layout/interactions; no date/photo/
multi-select creation controls. Notice application deadline and body editor stay.
Reference screenshots: https://www.ajd.co.kr/contents/basic-tip/detail/카카오톡_카톡_투표_기능_생성부터_결과_확인까지-34602

- [x] Add red HTTP/migration tests for independent choices, closure, counts,
      partial revotes, adding/removing cards, strict binary settings and legacy preservation.
- [x] Implement per-card persistence, protected vote/close/participant APIs,
      migration/backfill and existing-client body omission preservation.
- [x] Add red frontend tests and implement strict drafts, per-card member UI,
      protected admin editor controls and scoped participant queries.
- [x] Apply 0034 only to the existing local preview after a verified backup;
      restart API, exercise create/vote/revote/close/append/body edit in browser.
- [x] Review changes; run backend/frontend suites, compile/typecheck/lint/web
      export; record exact runtime/device limitations and final screenshots.

No production migration/deployment, architecture replacement, provider or new
dependency. Use current checkout to preserve ongoing admin work.
