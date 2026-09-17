# Non-admin upload surface audit — 2026-09-17

WP5/WP9, investigation only. Scope: member-facing upload call sites, create/edit routes and seeded board permissions. This is an audit of the current working-tree source and reference seed data, not a live production-board configuration audit. No application code or user data was changed.

## Current member menu flows

| Location | Upload | Existing files in edit | Add/remove in edit |
| --- | --- | --- | --- |
| Community > Resources > Lecture reviews (`lecture-reviews`) | Images and documents | Loaded into state but not rendered | Missing controls |
| Community > Resources > Exam archive (`exam-archive`) | Images and documents | Loaded into state but not rendered | Missing controls; Android reproduced |
| Community > Resources > Comprehensive exam (`comprehensive-exam`) | Images and documents | Loaded into state but not rendered | Missing controls |
| Community > Resources > Graduation thesis (`graduation-thesis`) | Images and documents | Loaded into state but not rendered | Missing controls |
| Participation > Club activity certification (`club-activity`) | Activity images | Hydrated into the reused create/edit form | Add and individual removal implemented |
| Participation > Study activity certification (`study-activity`) | Activity images | Hydrated into the reused create/edit form | Add and individual removal implemented |
| Participation > Networking activity certification (`networking-activity`) | Activity images | Hydrated into the reused create/edit form | Add and individual removal implemented |
| Council > Mutual aid (`mutual-aid`) | Private evidence files; link is an alternative | API intentionally omits existing evidence for non-admins | New evidence can be selected/removed before saving; individual existing files cannot be listed or removed. An unchanged edit preserves them; submitting new evidence replaces the relation set |
| My Page > Profile edit | One profile image | Current image URL/media ID loaded | Image replacement and reset to default implemented |

Activity certifications require at least one image. Mutual-aid editing is limited to processing requests; completed/rejected requests are not ordinary editable posts. Profile images are a separate upload flow rather than post attachments.

## Retained routes and upload implementations

| Board | Current reachability distinction | Edit attachment behavior |
| --- | --- | --- |
| Event album (`event-album`) | Member-write permission in seed and upload form remain, but the board list explicitly hides the create button for albums | Existing file names, add-photo action and individual removal implemented |
| Major community (`community-major`) | Legacy route/seed remain; current Home popular-post section is disabled | Same missing attachment UI as resources |
| Research paper sharing (`community-paper`) | Legacy route/seed remain; absent from the current Community resource tabs | Same missing attachment UI as resources |
| Seminar sharing (`community-seminar`) | Legacy route/seed remain; current Home popular-post section is disabled | Same missing attachment UI as resources |
| Job information sharing (`community-job`) | Legacy route/seed remain; absent from the current Community resource tabs | Same missing attachment UI as resources |
| Club applications (`club-apply`) | Legacy route/seed/fallback remain; current primary group navigation opens `club-promo`, and the legacy guide board hides its create button | Same missing attachment UI as resources |
| Study applications (`study-apply`) | Legacy route/seed/fallback remain; current primary group navigation opens `study-recruit`, and the legacy guide board hides its create button | Same missing attachment UI as resources |

These are code-supported routes, not seven additional upload buttons currently visible in the main menu. The album create form also exposes the generic document picker, while its API permits images only; this is a separate UI/API mismatch to track in Phase 5 QA.

## Excluded flows

- Study recruitment (`study-recruit`) and suggestions (`suggestions`) explicitly omit attachment UI when creating. They should not be counted as member upload surfaces, even though old/API-created posts can contain attachments.
- Comments, reports, signup, account settings and schedules have no member file-upload call sites in the current frontend.
- Admin routes, admin-only notice/council content, club guides, networking guides, organization introductions, FAQs, banners and spreadsheet imports are outside this audit.

## Source evidence

- All non-admin picker call sites are in `frontend/app/(tabs)/board/post/create.tsx`, `frontend/app/(tabs)/board/post/edit/[postId].tsx`, and `frontend/app/(tabs)/settings/profile.tsx`. `frontend/utils/mediaPicker.ts` contains their shared upload implementation.
- Create: hydration at line 503; activity photo controls at line 1052; private evidence controls at line 1516; study/suggestion exclusion and generic image/document controls at line 1647.
- Edit: hydration at line 101; existing attachment IDs sent at line 227; attachment UI restricted to participation guides/albums at line 467.
- Routes: `frontend/utils/appRoutes.ts`, `postEditRouteForPostDetail`, reuses the create form for activity and member mutual-aid edits, and sends other posts to the separate edit form.
- Entry visibility: `frontend/app/(tabs)/board/[boardId].tsx:997`; `frontend/app/(tabs)/home.tsx`, `SHOW_HOME_POPULAR_POSTS = false`; current community tabs and participation group navigation.
- Permissions/default boards: `backend/app/seed.py`, including `LEGACY_COMMUNITY_BOARD_SEED_DATA`. Production can retain operator-managed/custom boards, so seed membership does not establish production visibility.
- Private evidence: `backend/app/routers/posts.py`, `_post_attachments` and `_replace_attachments`.

## Findings and verification scope

`Phase 5 QA`: fix resource edit attachment controls for all four resource categories. The same conditional affects six retained generic board routes; reuse a common member attachment editor if those routes are kept. Preserve the explicit mutual-aid evidence policy.

Exam-archive Android reproduction is recorded in `RESOURCE_EDIT_ATTACHMENTS_2026-09-17.md`. Remaining rows describe verified source wiring, not completed end-to-end upload/delete tests. No new tests or fixes were added for this inventory.
