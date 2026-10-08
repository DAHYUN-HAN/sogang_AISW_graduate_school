# Notice Body Editor QA — 2026-10-07

Scope: requested WP6/WP8/WP9 P0 notice CRUD follow-up, within the existing
administrator web console. No schema, provider, dependency, deployment or
production data change.

## Delivered behavior

- 신청·접수 마감 uses the existing calendar/date and clock controls, including
  optional clearing. The editor displays KST and saves UTC; invalid dates stop
  before the post API call. Poll and application deadlines remain independent.
- Attach/upload as before, select a body cursor and choose 본문에 넣기 on an
  image. The body shows the image between editable text areas. 본문에서 빼기
  merges text and keeps the attachment; deleting or replacing the attachment
  also updates body references. Upload/save locks and generation checks remain.
- Plain body text stays in `posts.content`, with ordered image offsets in
  versioned existing metadata. Only current authorized image attachments render
  inline. Unknown versions, malformed offsets, duplicates, non-images and
  detached IDs are ignored without dropping ordinary text/attachments.
- Member detail renders text/image/text once, retains the existing frame and
  image viewer, and shows unused attachments below. Council-linked notices with
  inline images use this layout once; legacy linked notices retain the gallery.
  Existing categories, pinning, council linkage and notice polls remain.

## Verification

- New utility/deadline/editor tests: 11 passed. Deadline hydration/save and invalid
  input tests failed before implementation. The stale cursor removal test failed
  before clearing the target and passed after correction.
- Full frontend suite: 878 passed, zero failures.
- Typecheck and scoped ESLint: exit 0, no diagnostics.
- Expo web export: exit 0.
- Existing protected notice-poll API regression suite: 14 passed, with the
  existing Starlette/httpx deprecation warning. Backend code is unchanged.
- Git whitespace check: exit 0; repository LF/CRLF advisory warnings remain.
- Scoped read-only review identified missing inline image-viewer access,
  council gallery duplication and stale insertion selection after image removal;
  all were addressed and verified.

Logs are under `outputs/qa/admin-main-2026-10-07/notice-body-*.log`.

## Real local browser flow

The existing SQLite preview API at :8000 and Expo web at :8082 were retained.
Created synthetic preview notice 10 through the actual administrator form and
uploaded the existing `council-reply.png` test image. Selected a body cursor,
inserted the image between paragraphs and edited the following text. Opened the
date popup and set 2026-10-09 18:30 KST. Saved and reloaded from the notice table:
the text segments, inline image and date/time were restored unchanged.

Removed the image from the body, confirmed all text remained, and reinserted it.
Replaced the attachment through the actual upload chooser and saved with council
linkage enabled. The stored body uses media ID 4 at UTF-16 offset 16, and the
canonical attachment is ID 4. The database stores 2026-10-09 09:30 UTC; it reopens
as 18:30 in the editor. Read-only assertions:
`outputs/qa/admin-main-2026-10-07/notice-body-live-save.json`.

The member route `/board/post/10` displays text/image/text without a duplicate
hero or attachment image. Its existing fullscreen viewer opens and closes.
The administrator preview editor remains open; the temporary member QA tab was
closed. The user's original tab was retained.

Screenshots:

- `outputs/qa/admin-main-2026-10-07/notice-body-admin.png`
- `outputs/qa/admin-main-2026-10-07/notice-body-member.png`

Physical Android/iOS image/input interaction and packaged-build verification
remain `Phase 5 QA`. This request did not deploy to production or change its DB.
