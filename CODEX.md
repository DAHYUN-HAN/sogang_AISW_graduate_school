# Codex Work Backlog

This file turns the Notion Phase 1-4 planning into concrete work for coding agents.

## Immediate Goal

- 2026-09-17 WP5/WP9 P0: completed community existing photo/document editing and processing-owner mutual-aid evidence editing. Shared rows expose open/change/delete/add, explicit evidence replacement preserves legacy clients, and account-scoped caches plus fresh edit hydration prevent private-data reuse and stale attachment overwrite. Full frontend 640 tests and backend 422 tests (1 skipped) pass; desktop/mobile-web UI save/reopen, signed download and file/link roundtrips pass. Native package/physical-device validation remains Phase 5 QA. Details: `docs/qa/ATTACHMENT_EDIT_2026-09-17.md`.

Use the Phase 2 contracts as the foundation, then execute Notion Phase 3 and Phase 4 as development sprints.

2026-07-05 policy alignment: implement against `정책_정의서_260705.pdf` and AISW UI/design PDFs where they are more specific than Phase 2. Content routes are member-only; guest access is limited to login, signup/email verification, password recovery, refresh, registration options, legal screens, and health/docs.

## Required Reading Before Coding

- Product plan: `PLAN.md`
- Agent rules: `AGENTS.md`
- API changes: `docs/phase2/API_CONTRACT.md`
- DB changes: `docs/phase2/DB_SCHEMA_DECISIONS.md`
- Auth and permissions: `docs/phase2/AUTH_PERMISSION_SPEC.md`
- Frontend routes/screens: `docs/phase2/FRONTEND_ROUTE_SPEC.md`

## Current Baseline

Already implemented or partially implemented:

- Boards, posts, comments, likes, bookmarks.
- Auth backend: login, register, email verification, refresh, logout, password reset.
- User profile backend.
- Search backend and global search screen.
- Media upload backend/client foundation.
- Completed issue #119: aligned the Figma attachment copy and enforced a global 10 MiB (`10485760` bytes) upload cap across backend configuration, environment examples, API contract, and the production Nginx multipart envelope.
- Events backend, Home calendar, and day/detail screens.
- FAQ backend and screen.
- Notifications backend, settings API, notification settings screen.

Known gaps:

- The 2026-07-27 current-worktree verification reached `0021_account_deletion_receipts`: 104/104 backend tests passed on both SQLite and isolated PostgreSQL. Clean migration, `0019`→head, `0021`→`0019`→`0021`, exact unversioned `0001` recovery, and unknown-schema fail-closed checks passed.
- Frontend verification passed 7/7 tests, typecheck, Expo Doctor 17/17, web export, and lint with zero errors and zero warnings. After the lockfile update, a clean `npm ci --legacy-peer-deps` install re-passed tests 7/7, typecheck, and lint 0/0.
- Local production Compose config/build, backend/worker/database health, UID 10001, readiness, guest/user/admin HTTP checks, one-shot worker, and web `/healthz` plus deep-link fallback passed. An isolated Windows short-path build also produced and validated an unsigned Android release AAB from the same 115 frontend source files. A signed production Android AAB was subsequently generated and verified on 2026-09-09 (see WP9); physical-device checks remain open.
- Backend `pip-audit` reports zero known vulnerabilities. After the safe `postcss` 8.5.18 update, frontend runtime dependencies (`npm audit --omit=dev`) report 33 affected entries: critical 0, high 19, moderate 14; the all-dependency audit reports 40: critical 0, high 26, moderate 14. The remaining automated remediation requires incompatible major overrides or a breaking Expo 57 / React Native 0.86 upgrade, so release remains blocked until the owner accepts the risk with a deadline or approves the upgrade.
- Production startup uses non-authoritative reference seeding: it creates no demo user, preserves operator edits, and leaves custom boards active. Deterministic demo credentials remain non-production-only. A production-only, advisory-lock-protected one-time command promotes an existing active member as the first administrator and records a detail-free audit event.
- CI declares `permissions: contents: read` and installs pinned `pip-audit==2.10.1` through `requirements-test.txt`; the daily worker receives the approved account-deletion receipt retention value and reports its cleanup count.
- Checksum-verified Gitleaks 8.30.1 found zero findings across 43 commits and 298 current non-ignored files, and CI now scans full history. The final signed artifact still needs an independent secret scan.
- Reproducible CycloneDX 1.6 SBOM and license review passed for the production backend image and frontend production tree: forbidden, strong-copyleft-only, and unknown licenses are all zero. Weak/file-level copyleft, dual-license, font exceptions, and final signed native notices remain artifact-level review items.
- Local Android release rehearsal: `:app:bundleRelease` succeeded after using a short CMake staging path; bundletool 1.18.3 validation passed, API 36 and 16 KB page alignment were confirmed, and the extracted unsigned AAB had zero Gitleaks findings. Its placeholder package/version and bundled localhost/development-client strings make it explicitly non-candidate evidence.
- A provider-neutral operational-alert adapter sends structured non-PII events for unhandled API exceptions, notification-worker failures, and push send/ticket/receipt failures. Production requires an approved HTTPS webhook in both backend and worker environments; provider setup and live alert delivery are deployment blockers.
- Mobile password reset screen exists.
- Profile edit and account management screens exist; profile image selection, protected upload, display, replacement, and removal are implemented.
- Post create/edit attachment linking and native document/image picking are implemented; upload-progress and physical-device edge cases remain Phase 5 QA.
- Home calendar/day/detail routes, admin event CRUD, and idempotent D-day/D-1 notification hooks exist; recurring events are deferred to v1.1 and physical-device QA remains.
- Expo push token/provider integration, ticket/receipt logging, retry, and invalid-token cleanup exist. Production FCM/APNs credentials and physical-device delivery QA remain.
- Admin route now covers banners, launch-critical notice posts, board settings, accounts, separate permanent student-roster and current-term dues-payment tabs, reports, FAQ, and events.
- My activity screen exists; guide cards are not fully implemented.
- Figma function-alignment pass 1-5 is implemented: five-tab IA (Home, Notices, Community, Participation, Student Council), direct community feed, private activity bank-account metadata, dedicated council notification setting, structured mutual-aid status/rejection workflow, activity source selection sheets, and study recruitment status/contact fields.
- Legacy Swing2App reconciliation now uses the cleaned article/comment workbooks, strict local `fileStorageId` attachment lookup, explicit dry-run/apply modes, isolated-target guards, idempotent source hashes, PII redaction, same-post content-hash deduplication, FAQ media links, author name/cohort snapshots from `0025_author_content_snapshots`, and an admin-only provenance ledger. Current Alembic head is `0029_roster_dues_separation`. Raw XLSX/CSV/attachment sources remain local-only because this repository is public and the files contain personal data.
- Board IA now includes legacy notice, webinar, academic schedule, alumni directory, GSA intro/cohort, and roadmap/benefit boards from the production app review.
- Post/report UX now includes post and comment report submission hooks plus admin report review/status handling.
- Author blocking API/UI is now implemented for post lists, comments, and search results.
- Admin user management now supports member search, role changes, and activation status changes.
- Design gate is intentionally deferred for Phase 3 UI polish.
- Native session persistence uses Expo SecureStore; web keeps the existing localStorage fallback.
- PostgreSQL-backed production rate limiting covers auth, reports, post/comment writes, and media upload.
- Protected local storage with signed access URLs is the v1 decision. Object storage is a future deployment enhancement, not a Phase 5 entry blocker.

## Launch Replacement Readiness

Updated: 2026-07-27

Goal: replace the existing Sogang app for day-to-day production use, then move into formal store release QA.

P0 already covered:

- Legacy production app IA was reviewed against the new board IA.
- Legacy Excel/CSV board data was imported into local Docker PostgreSQL.
- Authenticated member board browsing, post detail, comments, likes, bookmarks, search, notifications, events, FAQ, reports, and basic admin workflows exist.
- Admin can review reports, delete reported targets through protected APIs, manage events, and manage users.
- Users can block authors; blocked authors are hidden from post lists, comments, and search.
- Users can manage blocked authors from settings.
- Native/web document attachment picking is connected to media upload for post create and edit.
- Profile image selection, upload, save, display, and removal are connected.
- Admin can manage FAQ content from the app without direct DB edits.
- Admin can manage home banners, notice posts, board settings, and account status/roles from the app.
- Completed P0 Figma alignment: home/notice sample fallbacks were removed, home banners are administrator-uploaded image-only assets, and notice deadlines are driven by admin data with D-day display and notification dispatch.
- Completed P0 board-presentation alignment: member board dates follow the per-surface Figma matrix (`YY.MM.DD(weekday)` by default, schedule/home/notification exceptions documented in `docs/phase2/FRONTEND_ROUTE_SPEC.md`), activity feeds use the selected activity date, Past Council activity dates survive admin edits, and comment timestamps switch from recent minutes to `HH:mm` as captured. Study recruitment and council activity rows match the approved variants, while `lecture-reviews` remains anonymous and comment-free.
- Completed P0 privacy alignment: mutual-aid evidence uses private storage and short-lived signed downloads limited to administrators; members receive neither evidence metadata nor a usable direct media lookup.
- Completed P0 roster/payment separation: participant identity no longer comes from member accounts. `student_roster` permanently accumulates everyone who passed through the school; the headerless `name`, `major`, `student number` XLSX import inserts new student numbers and overwrites name/major for existing numbers without deleting omitted rows or touching payment state. `dues_payments` is the current-term sparse payment table. Its upload validates every name/student-number pair against the roster before deleting all prior `ALL` and `ONCE` rows and registering every uploaded row as `ALL`. Per-person editing keeps identity read-only and assigns `ALL`, one active activity-board `ONCE`, or `UNPAID` (absence of a payment row). The board-aware activity picker searches every roster row by name, exposes only `is_paid_for_board`, renders `ALL`/matching `ONCE` black and unpaid/different-board `ONCE` gray, and permits every result to be selected. Visual verification: `docs/qa/ROSTER_DUES_SEPARATION_2026-09-23.md` and `docs/qa/evidence/roster-dues-separation/`.
- Completed P0 account/calendar alignment: password changes revoke refresh sessions, event categories match the mobile UI, and month-end event queries include the final day.
- Completed P0 account-deletion alignment: authenticated deletion requires the current password and the public email request/verify path is non-enumerating. User PII, sessions, likes, bookmarks, searches, notifications, and unattached uploads are deleted. All authored posts/comments and connected media remain regardless of visibility/status, their account links are cleared, and writing-time name/cohort snapshots preserve the author display. This includes mutual-aid applications and evidence. Migration `0021` records a non-identifying receipt; migration `0025` adds and backfills the author snapshots.
- Completed P0 account-deletion completion UI alignment: the existing acknowledgement, retention notices, destructive action, and current-password security step remain unchanged; authenticated `completed=1` now uses the approved minimal check/title/`확인` state, while the public email-deletion completion retains its detailed guidance.
- Completed production bootstrap hardening: startup creates no demo credential and non-authoritative reference seeding preserves operator-managed content and custom boards. The first administrator must be an existing active member promoted once with the production-only advisory-lock-protected bootstrap command.
- Completed participation club alignment: only admins manage club guide posts, every club post requires a representative image, and admins configure the detail CTA through `metadata.application_url`.
- Completed activity-certification alignment: all authenticated members can submit image-only certifications, receive a dedicated completion state, page through detail images, and only admins can read the stored bank-account metadata.
- Completed P0 detail-return alignment (QA 140): post detail header back and Android hardware back now reactivate the validated originating list across study, club, networking, notices, community, search, notifications, and My Activity, preserving selected tabs, filters, search/sort state, and scroll position; direct links use navigation history, then an explicit source-board or product-hub fallback.
- Completed QA 198 member-post return alignment: member-writable community, participation, suggestion, and mutual-aid edits opened from detail dismiss both edit and detail after save and restore the validated originating list. Create/detail Back keeps the same list target, push-notification post links now preserve Notifications as their origin, while unsaved edit Back, direct-entry fallbacks, administrator-authored boards, albums, and admin-console navigation remain unchanged.
- Completed P0 activity-account edit alignment (QA 143): club, study, and networking certification edits expose an empty optional replacement field without returning the stored account to the client; blank submissions preserve the existing account and a new non-empty value replaces it.
- Completed participation write-policy alignment: study recruitment and every activity certification are member-writable; club/networking guide posts, representative images, and application CTA links are admin-managed.
- Completed P0 bug #26 alignment, revised by the 2026-09-17 user correction: the club-certification picker loads every published `club-promo` page and offers every operating administrator-managed club by source ID/current title in guide API order. The separate `club_operation_status` setting excludes operation-ended clubs but retains recruitment-closed clubs; missing legacy state defaults to operating. The former seven-name restriction and name-based deduplication are removed, so new and renamed clubs appear automatically. Existing club guide posts and legacy certification links remain readable and unchanged; study/networking source selection is unchanged. The API validates and canonicalizes the source, and guide renames update existing list/detail tags while retired guides retain their last official historical name.
- Completed participation activity-form alignment: club, study, and networking certifications keep `활동 사진` and `활동 소감` labels visible, allow only KST today and past activity dates in both the calendar and submission validation, and disable navigation beyond the current month. Study list cards omit the redundant certification badge while club cards retain the canonical club-name badge; mutual-aid date rules remain unchanged.
- Completed council content alignment: only suggestions and mutual-aid submissions are member-writable; admins manage one current-council introduction plus cohort-leader and past-council summary/detail entries. The current-council route opens directly, cohort/past routes select an entry first, and all three details share representative image, greeting, and introduction. Member profile cards remain in administrator data and the list summary count but are hidden from member-facing detail screens. Notice photo/text posts can be opted into the council activity history without duplicate content.
- Completed council organization-introduction multi-image alignment: current council, cohort leaders, and past councils use one ordered `photo_urls[]` gallery; its first image is the representative image mirrored to `banner_image_url`. Member reads resolve `photo_urls[]`, then legacy `attachment_urls[]`, then `banner_image_url`. The admin editor supports multi-select, add, individual removal, and up/down ordering while preserving the ordered array; this reuses `boards.metadata` JSONB and requires no Alembic migration. `attachment_urls[]` remains read-compatible legacy data, and legacy import links only image MIME types into organization galleries.
- Completed mutual-aid privacy/UI alignment: authenticated members can read application content, admins can review all private evidence, evidence is API-required, and non-admin detail/media responses never expose evidence filenames, links, or signed URLs.
- Completed P0 bug #28 alignment: mutual-aid remarks are optional end to end, while ordinary post content remains required by board-aware API validation.
- Completed web keyboard-submit alignment for bug-report items #52 and #53: Enter on the login password field runs the guarded login action; the multiline comment field submits on Enter, preserves Shift+Enter newlines, ignores Korean IME composition Enter/229 events, rejects whitespace-only text, and uses a synchronous ref lock against rapid duplicate submissions.
- Completed P1 bug #104 alignment: reply composition identifies the selected comment by its visible cohort/author label, hides the internal parent comment ID and `작성 중`, switches to the reply placeholder, and keeps a clear cancel action.
- Completed P0 bug #13 alignment: comment authors can delete their own comments through an in-app confirmation that works on native and web; backend author permission and comment-count updates have regression coverage.
- Completed P0 comment/report UI alignment: root comments and two-depth replies match the approved divider, neutral reply-row, inline edit, action, and right-aligned report states; post and comment reports share the approved radio-reason bottom sheet with conditional `기타` detail; post/comment delete confirmations use the approved centered destructive treatment. Owner report attempts remain API-blocked and now show local explanatory feedback.
- Completed P0 bug #92 alignment: comprehensive-exam and graduation-thesis post-detail menus omit the design-excluded author-block action while preserving report, owner actions, and global block semantics.
- Completed bug #16 navigation alignment: post links opened from a board retain the originating board ID, direct post links fall back to the post's own board, header and Android hardware back share that behavior, and no user-facing fallback routes to the hidden all-boards tab.
- Completed bug #12 schedule alignment: Home month arrows update the embedded calendar and its API range without navigating, empty upcoming-schedule rows are inert, and inclusive multi-day overlap rules are shared by the Home calendar and day API queries.
- Completed bug #51 navigation alignment: My Posts, My Comments, and Bookmarks return to My Page from both the header and Android hardware back instead of exposing the tab that happened to be behind the profile drawer.
- Completed QA 145-147 navigation alignment: opening the My Page drawer records the mounted Home, Notices, Community, Participation, or Council origin; Profile, Notifications, and Account header Back and Android hardware Back explicitly reactivate that same mounted tab and reopen the drawer, ignoring unrelated settings history and using Home only when no valid origin exists. Repeated Back is guarded, and the mounted tab's filters, nested list state, and scroll state are not reset.
- Completed P0 bugs #10, #12, #20, #24, #34, and #37 alignment: exam-archive tags are normalized to `시험족보`, duplicate cohort prefixes are removed from author labels, edit success no longer stacks duplicate detail routes, the activity account placeholder matches the approved copy, suggestion details omit author blocking, and mutual-aid detail labels use regular font weight.
- Completed P1 bugs #69 and #70 alignment: activity-certification edits hydrate and update the participant picker and activity calendar while preserving attachments, source linkage, and hidden bank-account metadata.
- Aligned the activity-certification participant design: eligible authors can find and add themselves through the existing name search, and the form explicitly reminds them to do so for support-payment eligibility.
- Completed P1 bug #36 alignment: profile photo selection uploads a real browser `File` on web and a native file descriptor on iOS/Android; image-only changes no longer resubmit or validate unchanged legacy profile fields, and the refreshed profile cache is committed before returning to My Page.
- Completed QA 148 avatar alignment: a positive profile media ID or trimmed nonempty profile URL renders the image in My Page surfaces; absent, blank, or invalid media uses `DefaultAvatarIcon`, with no nickname initial or `?` fallback inside the avatar.
- Completed functional bugs #3 and #4: the notice feed now combines every active notice board, excludes the calendar board, and applies academic/event/webinar/other filtering consistently so the all/other tabs no longer omit valid posts. Home uses the same active notice-board set and shows the two newest deduplicated notices without pin priority. Home notice metadata resolves post and board aliases to user-facing tags, groups webinar and special-lecture notices under `행사공지`, and replaces raw `other` with `기타공지`.
- Completed functional bugs #9, #14, and #15: the resource board set now seeds and routes the member-writable `graduation-thesis` board, and the home event-album shortcut returns to the community tab root so the bottom navigation and back behavior remain intact.
- Completed resource-post edit alignment: authors and administrators can move an existing resource-sharing post among the active resource boards; the API enforces target permissions, preserves the post's related content, and canonicalizes the stored/displayed tag from the target board (`강의후기`, `시험족보`, `종합시험`, or `졸업논문`).
- Verified completion candidates #19, #22, #27, and #32: the in-progress tag uses the approved green state, activity dates share the `YY.MM.DD` formatter, mutual-aid cards expose processing/completed/rejected states, and member detail shows the rejection reason in the pink rejection panel. Regression contracts cover each behavior.
- Completed admin mutual-aid workflow: dedicated processing queue, status filters, private evidence review, required rejection reason, and user notification for processing/completed/rejected changes.
- Completed suggestion workflow: anonymous pending/answered list states, dedicated creation completion, admin reply queue, reply-required answered validation, and author notification.
- Completed cohort-leader administration: admin-only structured multi-cohort registration with captain/vice-captain profiles, representative images, greeting/intro content, and legacy content fallback.
- Completed past-council/FAQ separation: new admin-only past-council board and structured management UI, member read-only list/detail, while FAQ remains on dedicated admin CRUD and user route.
- Completed QA 181/183 council ordering alignment: member-facing past-council and cohort-leader lists sort numeric council/cohort labels descending while leaving database metadata and administrator-managed storage order unchanged; nonnumeric legacy labels remain stable after numeric entries.
- Completed notification surface audit: Expo project/channel/plugin configuration, native token cleanup on logout, browser permission/test notification and open-site web system notifications. Closed-site web push remains a separate provider/service-worker integration.
- Completed QA 161 refresh alignment: Home, Notices, and shared board lists use pull-to-refresh while retaining their cached content and current filters/search/scroll state; a successful paginated-post refresh replaces all accumulated pages with the refreshed page 1 and restarts pagination at page 2, while a failed refresh keeps the previous rows. Protected media URLs remain stable until an image load failure explicitly refreshes them, and notification delivery/bootstrap refresh remains independent.
- Completed QA 173/188 bottom-tab root alignment: every explicit press of Home, Notices, Community, Participation, or Council navigates to that tab root even when it is already active or only visually highlighted by a detail route. Notices, Community, and Participation recreate `전체`, `행사 사진첩`, or `동아리 > 안내` at the top; Home opens its main screen and Council opens its menu list. Detail Back and programmatic My Page returns remain state-preserving because they do not emit a bottom-tab press.
- Completed QA 175/176 code alignment: deployed media allowlists cover images, PDF, Office/PPT, HWP, ZIP, text, and Jupyter notebook attachments, and production startup rejects a stale incomplete allowlist. The already-linked HWP keeps its existing DB row, post link, `.doc` storage name, and bytes while signed download responses expose the correct HWP MIME and `.hwp` filename. A dry-run-first repair validates that unchanged HWP and inserts only the seven missing ZIP/TXT/IPYNB media rows, files, and post links; production apply remains an operator step after coordinated database and media backups.
- Completed QA 177/185 follow-up alignment: exam-archive list and detail metadata expose the cohort/author while lecture reviews remain anonymous, and a retained post-detail route performs exactly one fresh detail read on refocus without duplicating its initial read so the displayed notice view count updates on each visit.
- Completed QA 186 home-notice alignment: the Home notice `더보기` action recreates the Notices root at `전체` before navigating, without changing detail Back or any other state-preserving return flow.
- Completed QA 187 home-alumni alignment: Home ends with the approved `동문회 주소록` row and always opens the fixed Rembr directory URL `https://app.rmbr.in/SPbmZjUxRzb` without depending on board metadata or administrator link settings.
- Completed QA 189 notice freshness alignment: selecting `전체`, `학사공지`, `행사공지`, or `기타공지` refetches the board registry and starts the matching server-filtered notice feed at page 1 while preserving the selected filter, so new notices appear without manual pull-to-refresh.
- Completed board-feed pagination alignment (2026-08-30): Notices, Community photo albums, Resource `전체`, individual resource boards, Participation guides/certifications, and Council activity history use 20-row incremental pages with guarded next-page loading. Notice/Resource `전체`/Council activity use one permission-filtered aggregate API query instead of per-board fan-out; Home performs one bounded pure-latest notice request with `size=2&pin_priority=false`. Notice categories use one mutually exclusive server classifier in which an explicit post category wins and only blank categories fall back to the board. Header Back retains the mounted filter/list state, while explicit Notices, Community, and Participation bottom-tab presses keep the existing reset to `전체`, `행사 사진첩`, and `동아리 > 안내`.
- Verified board-feed pagination on 2026-08-30 at final HEAD: backend compile and full pytest passed (`334 passed, 1 skipped`, one third-party deprecation warning); frontend `npm test` passed (`397 passed`), typecheck/export passed, and lint had `0` errors with `9` unrelated pre-existing warnings. The rebuilt isolated Docker QA stack was healthy, and mobile-sized Chrome flow checks observed exactly one page-2 request after scrolling for Notices, Community photo albums, Resource `전체`, lecture reviews, Participation guides, and activity certifications; filter requests restarted at page 1, detail header Back retained state, and tab reselection restored the existing defaults. Injected refresh and page-2 failures kept existing Notice rows, exposed the correct retry banner/footer, and recovered through the matching page-1/page-2 request. Native pull gestures still require iOS/Android device or emulator QA, and the QA database had zero Council activity rows, so its empty page-1 state was verified visually while its multi-page behavior remains covered by API/hook tests rather than this browser dataset.
- Completed activity-certification image presentation controls: certification feeds use the Figma feed-card image ratio `328x219`, while administrators can configure each activity-certification board's detail gallery with a default rule plus optional landscape/portrait overrides. Rules combine maximum width, natural or fixed height, optional maximum height, `contain`/`cover`, and full-view availability; square images use the default. The versioned contract is stored in existing board metadata with strict API validation and preserves unrelated metadata, so no Alembic migration or data backfill is required. Missing configuration follows the approved Figma baseline with full-width `contain` frames: default/portrait `400px`, landscape `240px`, and full-view enabled; photo albums alone retain their separate fixed `240px` hero frame. Club-activity feed previews omit the legacy `[동아리명] :` / `[동아리 명] :` template row. Notices, participation guides, and other activity text remain unchanged. The full-view portions of this original implementation are superseded by the 2026-09-12 WP5/WP9 user correction: participation no longer exposes the control/viewer, including with legacy enabled metadata.
- Completed notice-detail image frame alignment (2026-09-01): notice images use one of two responsive `contain` frames based on their source orientation—landscape, square, and unreadable images use `4:3` (`320x240` at the approved baseline), while portrait images use `4:5` (`320x400`). The full source remains visible and mismatched ratios use the frame background as letterboxing. Notice images no longer expose full-view or tap-to-open behavior; file and link attachments and every non-notice image flow retain their existing interaction.
- Completed QA 180 safe representative/detail-image alignment: the single `게시판 관리` entry gives 공지사항, 커뮤니티·자료, 참여활동, and 원우회 the same group → actual board → 콘텐츠/운영 설정 structure. At `참여활동 → 동아리 홍보/네트워킹 → 콘텐츠`, the administrator manages the first image as the list-only representative thumbnail and manages later ordered images in a separate detail-image section. Club/networking detail omits the representative image and renders only detail images below the body. The dedicated representative-image endpoint replaces only the first image while preserving every post field, metadata value, detail image, and unrelated attachment; legacy posts without stored `application_url` no longer fail unrelated CTA validation. The full editor persists the ordered attachment set before rechecking the representative-image requirement. No database schema or Alembic migration is required.
- Completed QA 109 participation-link alignment: every `club-promo` and `networking-programs` guide displays the administrator-managed participation URL only through the `가입 신청` or `참가 신청` CTA. Legacy body lines explicitly labeled `참여 링크`, `가입 링크`, or `신청 링크` are canonicalized into `metadata.application_url` for reads and omitted from visible content; create/edit stores the same labeled URL only as CTA metadata, while unrelated body URLs remain unchanged.
- Completed QA 194/195 home-notice and member-write navigation alignment: Home builds the complete deadline suffix in one place so expired notices render `마감` once while current/upcoming notices retain `마감 D-day`/`마감 D-N`; the schedule card keeps its separate existing `마감`/`D-day`/`D-N` display. Resource sharing and study recruitment now carry a validated originating tab into the shared composer, so X returns to Community or Participation instead of following stale Home/Council history. Standalone mutual-aid and suggestion writes retain their existing back/board fallback, activity certification retains its dedicated board-list return, and bottom-tab reset, submit/completion, edit, admin-write, and API behavior are unchanged. Frontend verification passed all 463 tests, a fresh non-incremental typecheck, and web export; lint passed with 0 errors and 9 unrelated pre-existing warnings.
- Completed QA 179 event-album admin creation alignment: `게시판 관리 → 커뮤니티 → 행사 사진첩 → 콘텐츠` always exposes the album registration action to administrators, including the seeded member-writable album policy. The public album feed keeps its existing hidden creation affordance, and the existing album composer and backend authorization remain unchanged.
- Completed QA 179 event-album multi-upload hardening: photo-album create/edit keeps successful images when one selected upload fails and accepts at most 20 images per post on web and native. Each selection is capped to the remaining slots, the add action is disabled at 20, and the backend rejects create/update payloads above 20 with `ALBUM_IMAGE_LIMIT_EXCEEDED`; legacy posts above the limit must be reduced before an edit can be saved. Every image keeps the 10 MiB per-file boundary. Administrator media uploads bypass the request-count throttle so a valid album batch does not exhaust an hourly admin quota; non-admin media uploads retain the existing 20-per-account and 60-per-IP hourly limits. No database schema change or data backfill is required.
- Completed QA 179 admin content paging and delete alignment: standard managed-board content, including the event album, uses the protected admin post endpoint in 10-row server pages with the same previous/current/next controls as other admin lists. Board, search, and status-filter changes restart at page 1; deleting the final row of a later page moves to the preceding page. Admin post deletion now uses an in-app confirmation card instead of a platform alert callback so the delete request works consistently on native and web, retains the modal on failure, and refreshes admin/member post caches after success.
- Completed QA 199 UTC/KST alignment: success responses serialize every datetime as an explicit UTC ISO 8601 value ending in `Z` without changing date-only values or stored instants. Event create/update normalizes offset-aware inputs to UTC storage, event range queries and D-day dispatch share `Asia/Seoul` calendar boundaries, and the existing `개강` instant remains September 1 at 00:00 KST.
- Completed QA 171 activity-certification account alignment: the protected admin post list exposes a non-empty bank-account value only inside `게시판 관리 → 참여활동 → 활동인증 게시판 → 콘텐츠`. Member-facing list/detail responses remain scrubbed, and the admin dashboard's aggregate recent-post cards do not render the account.
- Completed QA 153 activity alignment: lecture-review bookmarks show only `YY.MM.DD(weekday)` in My Activity, without `Anonymous`, cohort, or a separator; other bookmark author/date metadata is unchanged.
- Historical 2026-07-12 and early 2026-07-27 runs reached `0016` and `0019`. The current 2026-07-27 gate reaches `0021`; clean, legacy, downgrade/upgrade, failure-safety, API/media/worker/monitoring, backup/restore, and 104-test PostgreSQL checks pass.
- Completed clean non-production database migration and deterministic seed verification (`users=1`, `boards=32`, `banners=1`); production reference seeding and initial-admin bootstrap are separately regression-tested.
- Completed native SecureStore session persistence, public terms/privacy routes, runtime production secret/CORS/SMTP validation, and PostgreSQL-backed abuse rate limiting.
- Added a daily KST notification worker plus backup/restore rehearsal instructions in `OPERATIONS.md`.
- Backfilled missing notice deadlines for 131 active notice posts; inferred dates use related events or notice text, with a 14-day fallback.
- FAQ has category filtering and accordion-style reading.
- Roadmap, student council fee benefits, club/study, and alumni networking guide content is available from the home flow.

Functional Swing2App replacement estimate:

- UI/menu coverage is high, but release readiness is tracked separately from feature presence.
- Store readiness remains `NO-GO` until signed builds, device/store/live-host checks, approved external inputs, and the frontend dependency-risk decision are complete; do not infer production readiness from menu parity or local Compose success.

P0 launch-candidate hardening:

- Implemented in code: mutual-aid evidence is administrator-only across post detail and media access; non-admin direct media lookup returns object-hiding `404`.
- Implemented in code: public `/uploads` is removed; every media access URL is authorized, uploads stream in chunks, and size/MIME/extension limits are configurable.
- Implemented in code: required post/comment text is trimmed and validated, and FastAPI validation/HTTP errors use the normalized envelope.
- Implemented in code: unknown unversioned schemas are never stamped automatically; clean and exactly recognized legacy paths have regression coverage.
- Implemented in CI: pytest uses a separate PostgreSQL test database and the frontend job verifies lint, focused tests, typecheck, Expo Doctor, and web export.
- Decided for v1: guide content continues to use protected board/post administration; a dedicated guide CRUD domain is deferred to v1.1.
- Completed in code: authentication codes are keyed, email-only, one-time and attempt-limited; deployed SMTP requires verified STARTTLS/implicit TLS, bounded timeouts, and `SMTP_REQUIRED=true`. A digest-pinned optional Compose Cloudflare connector now follows `CLOUDFLARE_ENABLED` with token-file and exact-proxy validation. External gate: create the Named Tunnel/routes, install real token/provider values, and pass the connector/container/inbox/restart signup runbook.
- Completed in code: transactional authentication emails use a provider-aligned SMTP envelope sender and explicit branded From, monitored Reply-To, Date, Message-ID, and automated-message headers. Header-injection and transport behavior have regression coverage; SPF/DKIM/DMARC results and Sogang inbox placement remain external deployment checks.
- Completed: add production rate limiting for login, verification, password reset, reports, post/comment writes, and media upload.
- Completed in code: native token storage uses SecureStore. Physical-device refresh/logout verification remains Phase 5 QA.
- Run full route audit for guest/user/admin on iOS, Android, and web.
- Completed locally: isolated Docker/API smoke reached `0021_account_deletion_receipts` on 2026-07-27 and the 2026-08-02 PostgreSQL migration rehearsal reached `0022_legacy_import_records`. On 2026-08-04 an isolated PostgreSQL database passed clean upgrade and `0023`→`0024`→`0023`→`0024`; the full local legacy-media import, 594-file manifest verification, API fetch, and web image-render smoke also passed.
- Completed locally: the coordinated legacy transfer set (`database.dump`, public/private media archives, redacted reports, and SHA-256 manifest) restored into a fresh PostgreSQL database and fresh media directories; all 594 files and 635,375,068 bytes reproduced the pre-transfer manifest exactly.
- Completed locally: PostgreSQL `pg_dump`/restore reproduced 30 tables with identical all-table row counts and column/index/constraint fingerprints; protected-media tar/restore reproduced identical checksums.
- Completed locally: an unsigned Android release AAB built and passed bundletool, API 36, 16 KB page-alignment, merged-manifest, and extracted-artifact secret checks. It is not a production candidate because official release inputs and signing are absent and placeholder/development strings remain.
- External release gate (updated 2026-09-09): Android branding/native identity, 10 EAS public production values, and new upload key `aisw-campus-production` are prepared. User deferred remote push; strict release checks pass with explicit `pushNotificationsEnabled=false`, and Firebase/FCM activation moves to a later release. Signed AAB `outputs/android/AI-SW-CAMPUS-0.1.0-2.aab` passed bundle, signature, API 36, 16 KB alignment, and secret-scan checks. Final policy content, physical-device QA, Play submission, and iOS archive remain open. See `docs/qa/ANDROID_BRANDING_2026-09-08.md`.
- Store blocker: replace `com.anonymous.sogangcommunity`, add the official iOS bundle identifier, and confirm store version/build numbers.
- Store blocker: provide the official support email/contact URL and final store privacy-policy URL.
- Phase 5 QA: verify push registration/delivery on physical Android/iOS devices and complete the iOS build on macOS/EAS.
- Prepare final store screenshots/icon/feature graphic and the Phase 5 QA issue list.

P1 strongly recommended:

- Completed P1 bug #196 FAQ accordion alignment: the member FAQ route starts with every answer collapsed, renders the approved question-only rows with a right-side chevron, and independently toggles each answer and its protected image attachments without changing FAQ API or admin CRUD behavior.
- Completed: Expo Push ticket/receipt logging, two-attempt transport retry, and invalid-token deactivation.
- Completed: immediate notice notifications and idempotent event D-day/D-1 dispatch.
- Completed: admin statistics dashboard and operational audit log.
- Completed: signup display names allow duplicate real names while school email remains the unique account identity.
- Completed QA 85 display alignment: the current terms/privacy draft remains one canonical source, while `/legal/privacy` presents its existing clauses with `제N조 (제목)` headings and the recorded consent date but without policy version/effective-date metadata. Signup submission, consent audit history, the admin version workflow, and the terms screen keep their existing metadata behavior. The legal text is not final and must be replaced after official approval.
- Completed: pagination and empty/error/loading states for notifications, search, and activity lists.
- Completed: Argon2id for new passwords with transparent PBKDF2 rehash on login.
- Completed QA 144: mutual-aid event dates before KST today are disabled and revalidated in the mobile form, and the API rejects direct create/date-change bypasses while allowing today, future dates, and unchanged historical dates during other edits.
- Completed mutual-aid status/edit alignment: completed requests cannot be deleted, rejected requests can be deleted, and processing-request edits reuse the full application form with existing private-evidence open/remove/add support.
- Completed P1 bug #46: missing required fields, attachments, invalid dates/links, upload failures, and server rejections use an in-app notice modal that renders consistently on native and web instead of relying on React Native Web's no-op `Alert.alert()`.

P2 or v1.1:

- Draft autosave.
- Recurring events.
- Advanced analytics.
- Full-text PostgreSQL search index tuning.

## Work Package 1: Phase 3 Runtime and CI Setup

Source: Notion `Project initial setup (repo, CI/CD)`.

Scope:

- Define branch policy: `main`, `develop`, `feature/*`, `fix/*`.
- Add or document lint/typecheck/test commands.
- Add backend and frontend `.env.example` files.
- Add CI for backend compile/import checks, migration syntax checks, and frontend typecheck.
- Document local, staging, and production environment separation.
- Document secret handling rules.

Definition of done:

- A new developer can clone, configure env files, and run the app from README instructions.
- CI fails on TypeScript errors, backend syntax errors, and migration syntax errors.
- Docker runtime smoke test is passed or blocked with the exact reason.

## Work Package 2: Phase 3 DB Build and Initial Data

Source: Notion `DB build and initial data setup`.

Scope:

- Verify Alembic migrations against PostgreSQL.
- Verify seed data matches the target IA from `PLAN.md`.
- Add local development dummy data only where useful.
- Keep deterministic users/credentials non-production-only; production startup may add missing reference records but must not overwrite operator edits or deactivate custom boards.
- Provision the first production administrator only by promoting an existing active member through the one-time audited bootstrap command.
- Document backup policy and data reset policy.
- Keep DB schema aligned with SQLAlchemy models and Pydantic schemas.

Definition of done:

- `alembic upgrade head` succeeds on a clean database.
- Non-production deterministic seed and production non-authoritative reference seed both succeed with their distinct safety guarantees.
- Initial boards, local demo accounts, and the production-only first-admin bootstrap are documented.

## Work Package 3: Phase 3 Auth and Account Completion

Source: Notion `Auth/login feature development`.

Scope:

- Completed: mobile password reset request/verify/confirm screens.
- Completed: frontend token refresh failure handling and logout fallback.
- Completed in code: provider-independent STARTTLS/implicit-TLS transport, connection-only preflight, normalized signup delivery failure, one-time registration claim, remote-client timeout handling, and an optional Compose-managed Named Tunnel connector. Deployment-only: supply the Cloudflare token/dashboard routes and run the container SMTP/inbox and external-network restart signup tests described in `OPERATIONS.md`.
- Completed: Argon2id for new passwords with transparent PBKDF2 rehash on successful login.
- Completed: PostgreSQL-backed rate limiting for login, verification, password reset, reports, write-heavy endpoints, and media upload.

Definition of done:

- Guest, user, and admin auth paths can be smoke-tested.
- Password reset works from mobile UI through backend API.
- Logout invalidates refresh tokens.
- Auth errors are readable and do not leak sensitive details.

## Work Package 4: Phase 3 Profile and Account UI

Source: Notion `User profile feature development`.

Scope:

- Add profile view/edit screen.
- Add account screen for password change and irreversible account deletion.
- Add profile image upload using the media foundation.
- Keep signup name/nickname required and normalized, but allow duplicate real names.
- Decide whether banned-word filtering is required for launch.

Definition of done:

- User can edit backend-supported profile fields.
- Profile image upload stores media and shows the updated image.
- Password change and authenticated account deletion are available from settings; a signed-out user can use the public email request/verify deletion flow.

## Work Package 5: Phase 3 Core Community Feature A

- 2026-09-17 WP5/WP9 P0 saved activity-account editing: author/admin edit responses include the stored bank account and the shared activity form prefills it. Unchanged/blank input preserves the account; replacements are visible when reopening edit. Ordinary member lists/details still redact it, peers cannot fetch edit context, and unrelated private metadata remains hidden. Related API tests 100/100, frontend regressions 48/48 and typecheck pass. Evidence: `docs/qa/ACTIVITY_BANK_ACCOUNT_EDIT_2026-09-17.md`.

- 2026-09-17 WP5/WP9 P0 write-return cleanup: reproduced retained new-post text and retained board search after Community > Resources > Write > Back. The retained hidden board route now unmounts an abandoned new-post form; its next visit starts empty, including attachments. Opening Write closes/clears the originating list search but retains its selected category. Existing-post edits and detail-return search preservation keep their policies. Actual-screen regressions cover both missing resets, and the related navigation suite passes 92/92. Evidence: `docs/qa/POST_CREATE_RETURN_2026-09-17.md`.

- 2026-09-17 WP5/WP9 P0 dynamic club selection: removed the seven-name allowlist from the shared activity-certification create/edit form. All published operating administrator-managed club guides are selectable, including `파인튜닝 (커피)`; existing source-ID validation, canonical name updates, historical links, and hidden/deleted exclusions remain. The actual selection-expression regression reproduced an empty list before the fix and now passes. API registration → member lookup → certification save → administrator rename passes; related API tests 14/14, frontend activity tests 27/27, typecheck and scoped lint pass (two existing duplicate-import warnings). Local mobile-web selection confirmed; capture: `outputs/qa/image-viewer-2026-09-17/club-source-picker-mobile.png`. Native device/package validation remains `Phase 5 QA`.

Source: Notion `Core feature A: boards/community`.

Scope:

- Completed Android navigation audit fixes (2026-09-12, WP5/WP9 P0): FAQ/notice search/calendar day/notification-event header and system Back now share their intended origin; board search and sort close before leaving the list; post/edit/event loading and error screens retain navigation controls. A stable tab fallback preserves screen-handler priority after detail returns and My Page closes. All seven reported defects passed on a freshly built Android 16 test APK, versionCode 6; full frontend tests 611/611, fresh typecheck, scoped lint and reviewed follow-up passed. Screenshots, build/source identity, regression scope and physical-device/iOS Phase 5 QA limits: `docs/qa/NAVIGATION_FIXES_2026-09-12.md`.
- Completed comment keyboard and council-header follow-up (2026-09-12, WP5/WP9 P0): comment/reply creation dismisses the keyboard and removes focus only after a successful server response; pending/error behavior is preserved. The executive-introduction detail header consistently reads `원우회 임원진 소개` even with legacy `현재 원우회` metadata. The actual-handler regressions reproduced the missing success cleanup before the fix; full frontend tests 588/588 and read-only code review passed. Android 16 / Expo Go now verifies successful exam-archive comment registration, automatic keyboard dismissal and focus removal, and the corrected council header with populated title metadata. Before/after screenshots are recorded; packaged/physical-device checks remain Phase 5 QA, with no new APK. Evidence and earlier four-item audit: `docs/qa/FOUR_REMAINING_ISSUES_2026-09-12.md`.
- Completed album-arrow and participation image follow-up (2026-09-12, WP5/WP9 P0): reuse the existing 28px gray-circle slider icons and remove the drawer's transparent edge layer so both photo buttons expose the full 44px hit width. The parent recognizes only intentional edge drags, preserving initial/release positions across the native responder lifecycle. Remove participation full-view controls/modal and its administrator toggle; legacy true metadata cannot enable it and album images remain non-expandable. Mobile-web hit/cursor scans match at three heights, 13/13 boundary clicks pass, and Android taps confirm the formerly covered left positions. Full frontend tests 585/585, typecheck, scoped lint, and reviewed lifecycle corrections passed. Packaged/physical-device checks remain `Phase 5 QA`; no new APK. Version discrepancy and evidence: `docs/qa/GALLERY_TOUCH_AND_FULL_VIEW_2026-09-12.md`; initial eight-slider/five-attachment captures: `docs/qa/ALBUM_ARROWS_ANDROID_2026-09-12.md`.
- Completed participation search alignment (2026-09-07, P0 board-scoped search): show search only for club/study/networking activity-certification lists, including empty lists; keep guide/recruitment and unavailable-board screens without search, clear search when changing participation boards, and preserve Community behavior. Verification: full frontend test suite and typecheck passed; lint returned 0 errors and 7 existing warnings outside the changed files. Phase 5 QA: verify activity search, empty results, closing search, and return to guide/recruitment on physical devices.
- Completed comment-count refresh (2026-09-10, WP5 P0): successful comment/reply creation and deletion refresh mounted board/aggregate, multi-board, home popular, personal activity, and admin post/stat caches before completion; Back preserves loaded pages and filters while displaying server counts, including parent/reply deletion. Verification: five regression tests (including the original stale `1` reproduction), full frontend 537/537 tests, typecheck, and changed-file lint passed. Evidence and Android follow-up: `docs/qa/COMMENT_COUNT_REFRESH_2026-09-10.md`.
- Completed report-sheet Back handling (2026-09-10, WP5 P0): header/Android Back dismiss post/comment reports and More menus before navigating from detail; delete confirmations also consume Back and retain pending-request guards. The shared callback observes overlay state changes, preventing dismissed reports from reappearing after return. Verification: six callback regressions (five reproduced failures before the fix), navigation suite 59/59, full frontend 543/543, typecheck, and changed-file lint passed. Android 16 / Expo Go verification with production data passed Report → first hardware Back (sheet closes) → second Back (list) → reopen (no sheet); ordered captures: `docs/qa/REPORT_SHEET_BACK_ANDROID_2026-09-10.md`. Final APK generation and packaged/physical-device QA remain deferred until all fixes are complete.
- Completed (QA 204): isolate the shared create/edit form by route `boardId + postId + category`, reset every draft/attachment/local field state when the destination changes, preserve in-form board selection and existing `returnTo`/Back behavior, and cover resource-sharing ↔ study recruitment in both directions.
- Completed: activity-certification, mutual-aid, and moved resource-post edits launched from detail carry an exact origin marker and return to the existing refreshed detail after save, eliminating duplicate detail stacks while preserving contextual direct-entry fallback and all other edit completion routes.
- Completed: ordinary post creation preserves the validated originating list and source board in the result detail, so a create→edit→detail flow returns to Community or Participation in one Back instead of falling through to Home.
- Completed: Android hardware Back in cohort-leader and past-council boards uses the same child-first action as the header, closing an open in-screen profile before leaving the board.
- Completed participation search scope follow-up (2026-09-07, WP5 P0): activity-certification board searches match title and body only for members and admins, excluding current/historical author names and participant metadata; preserve Community search. API regression coverage includes all three participation boards and both roles. Verification: backend suite 387 passed, 1 skipped; backend import/OpenAPI and compile checks passed.
- Completed participation badge-search follow-up (2026-09-07, WP5 P0): extend certification search to the displayed club/networking tag, preserving current source-title priority and legacy fallbacks. Fix `사진` returning only the one title match instead of all four tagged club posts; apply tag matching before pagination. Study title/body search, author exclusion, and Community behavior remain unchanged. Verification: backend suite 394 passed, 1 skipped; import/OpenAPI, compile, and review passed. Staged SQL in a production PostgreSQL read-only transaction matched all four expected posts.
- Add post create/edit image/file picker and upload progress.
- Polish pagination or infinite scroll.
- Add report model/API hooks for later moderation.
- Add draft autosave if accepted as P1 for launch.
- Confirm anonymous post behavior in list/detail/admin contexts.
- Add board category/filter UX where each board type needs it.

Definition of done:

- User can browse boards, create/edit/delete posts, comment/reply, like, bookmark, search, and attach media from mobile.
- Permission failures are handled cleanly.
- Community flows pass mobile route testing.

## Work Package 6: Phase 4 Notifications and Notices

- 2026-09-17 WP6/WP9 user correction: notice-tab rows and Home notice summaries show `마감 D-N` / `마감 D-day` through the deadline date; expired/undated notices show their publication date without a deadline suffix or dangling separator. This supersedes the notice wording recorded under QA 194/195; schedule-card labels retain their existing behavior. Shared formatting tests (4), typecheck and scoped lint pass. Local mobile-web notice rows cover future/today/expired deadlines; Home confirms the same formatting. Capture: `outputs/qa/image-viewer-2026-09-17/notice-deadline-copy-mobile.png`.

Source: Notion `Core feature B: notifications/notices`.

Scope:

- Completed: admin notice CRUD.
- Completed: notification trigger rules for comments, likes, notices, and events.
- Completed: push token model and API.
- Completed: Expo provider adapter with disabled/local fallback, retry, and ticket/receipt logging.
- Completed: in-app notification list/read state/settings UX.
- Completed: notification categories and D-day/D-1 timing; physical-device delivery remains Phase 5 QA.
- Completed: event notifications open event detail with a detail-specific, exact Notifications return target; event-detail Back prioritizes that mounted list while Home, day, and admin history behavior remains unchanged and direct entry falls back to Home.

Definition of done:

- In-app notifications are created by real app events.
- Users can read and configure notification categories.
- Push integration has provider env variables, local fallback, and error logging.

## Work Package 7: Phase 4 Schedule and Events

Source: Notion `Core feature C: schedule/events`.

Scope:

- Completed: Home embedded calendar and date-specific day route.
- Completed: event detail screen.
- Completed QA 201: duplicate standalone event-list and full-calendar UIs are removed; `/events` redirects to Home, event notifications open their specific detail, and the unlinked all-boards and guide-placeholder routes are removed without changing Home schedule, day/detail, or admin management.
- Completed: admin event create/update/delete UI.
- Completed: event categories `academic`, `event`, `exam`, `council`, `external`, and `other`.
- Decided: recurring events are deferred to v1.1.
- Completed: idempotent D-day/D-1 notifications are connected to the notification system.

Definition of done:

- Authenticated members can browse the Home calendar and day/detail views; existing `/events` links resolve to Home and guest API requests return normalized `401`.
- Admin users can manage events.
- D-day notification behavior is documented and testable.

## Work Package 8: Phase 4 Admin Surface

Source: Notion `Admin page development`.

Scope:

- Decide admin surface location: separate web app, Expo admin routes, or backend-served admin.
- Implement admin login guard and backend role checks.
- Add user management: list, role/status update, deactivate.
- Add moderation: posts/comments/report review/delete.
- Add content management: notices, FAQs, events, guide cards.
- Add basic statistics: users, active users, posts, comments, notices.

Definition of done:

- Admin actions are protected by backend admin dependencies.
- Admin can manage launch-critical content without direct DB edits.
- Audit/logging needs are documented, even if deferred.

## Work Package 9: Phase 4 Full Frontend-Backend Integration

- 2026-09-24 WP9 iOS App Store update: the prior IPA (build 8) reached App Store Connect with `expo.version` 0.1.0 while the live App Store version is 1.0 (build 4). Bump the shared app version and Android native version name to 1.0.1 before creating the next production iOS build; EAS remote auto-increment continues to own the iOS build number. Screenshots and App Store review/release remain separate App Store Connect steps.

- 2026-09-24 WP9 iOS submission tooling: EAS CLI 21.3.0 fails Apple Developer login with `iTunes service key is empty`; Expo resolved this in 24.4.1. The CLI range now requires that fix, and the production iOS submit profile uses the existing App Store Connect app ID so EAS can reuse its stored API key without an Apple ID session. Static release configuration checks pass; this does not change the built app binary.

- 2026-09-17 WP5/WP9 non-admin upload audit (`Phase 5 QA`): mapped four resource categories, three activity certification boards, private mutual-aid evidence and profile images; separated album/six legacy route implementations from current menu entry points. Resource and retained generic edit forms omit attachment controls; activity/album/profile controls exist, while mutual-aid existing evidence is intentionally protected. Source inventory and verification limits: `docs/qa/USER_ATTACHMENT_UPLOAD_AUDIT_2026-09-17.md`.

- 2026-09-17 WP5/WP9 resource attachment edit investigation (`Phase 5 QA`): current Android source reproduces missing attachment controls when editing an image-bearing resource post. The edit form loads/saves attachment IDs but renders management only for participation guides/albums. Confirmed frontend visibility condition; backend replacement support exists in source. Investigation only; evidence and repair scope: `docs/qa/RESOURCE_EDIT_ATTACHMENTS_2026-09-17.md`.

- 2026-09-17 WP5/WP9 image interaction follow-up: community/participation images now open a shared full-screen modal with pinch zoom, bounded pan, double tap, photo paging, and modal-only Back/Esc. Per the user's visual follow-ups, the bottom zoom/percentage controls and gesture hint are removed, and the image gains the full footer space. External opening is reserved for documents; notice images remain inert and guide representatives remain excluded. Local web and Android Expo Go evidence and packaged/iOS QA scope: `docs/qa/IMAGE_VIEWER_2026-09-17.md`.

- 2026-09-15 WP5/WP9 representative-image follow-up (`Phase 5 QA` / P2): club/networking editors still mark the first image as list-only, but current detail renders every image after commits `95007d9`/`a8ff2d1` and no longer calls the representative-exclusion helper. Actual-source JSX probe confirms both affected guide slugs; existing helper tests pass 7/7 because they do not exercise screen wiring. Corrected APK 10 case 8 to image-order pass / representative-exclusion failure. Investigation only, no app/data changes: `docs/qa/PARTICIPATION_REPRESENTATIVE_IMAGE_2026-09-15.md`.

- 2026-09-15 WP5/WP9 Android APK 10 verification requested by the user: built the current working tree, verified signature/manifest/16KB alignment/current bundle and installed SHA, and executed all 10 reported reproduction sequences on Pixel_7 / Android 16. Results: 9 passed, status-bar separation partially meets the request (opaque white instead of translucent). Gesture and three-button retained-Activity Back each pass 3 real launcher-resume cycles; comment keyboard dismissal, 30-line inside-body dragging/registration, calendar shape, gallery taps, SG_LLM order and recorded notice transitions pass. Added `Phase 5 QA` findings for clipped detail headers and low-contrast three-button system icons. Temporary post/comment deleted; no application source changes. Evidence/artifact and physical-device limits: `docs/qa/APK_TEN_ISSUES_2026-09-15.md`.

- 2026-09-11 WP5/WP9 P0 remaining mobile polish: post deletion restores the validated source list (including `dismissTo` for standalone boards) and refreshes retained My Activity/Home caches; Home/Notices loading indicators avoid overlap; the banner viewport clips adjacent pages; root/native status-bar icons use dark styling. Source/Expo Go/mobile-web verification and read-only review: `docs/qa/MOBILE_POLISH_2026-09-11.md`. The requested bundled release APK `AI-SW-CAMPUS-0.1.0-4-mobile-fixes-test.apk` was built, signature/CRC/alignment/source-verified, updated over the existing app and launched on Pixel 7 / Android 16. Excluding rows 4/11/12, APK results are 9 passed, 1 partial and 6 pending; long-body inside scrolling, resource-create Back and dark status icons passed. Full frontend tests: 582/582. Startup/transition/loading animation, deletion scenarios and broader physical Android/iOS coverage remain `Phase 5 QA`; exact evidence and limits: `docs/qa/APK_REGRESSION_2026-09-11.md`.
- 2026-09-10 WP5/WP9 P0 resource-create Back fix: reproduced Community > Resources > Write > Android Back incorrectly returning Home in the installed APK and pre-fix source. The shared form now uses the same origin-aware callback for header and focused Android Back, dismisses open selectors first, and prioritizes registered completion over retained form state. Android 16 / Expo Go verifies one-press Resources return with the Exam Archive category retained, repeated header return, keyboard-first dismissal, and board-selector-first dismissal. All 574 frontend tests, typecheck, and scoped lint (0 errors, 2 existing warnings) passed; read-only review findings were resolved. Evidence: `docs/qa/RESOURCE_CREATE_BACK_ANDROID_2026-09-10.md`. Final packaged/physical Android and iOS/web QA remain `Phase 5 QA`; no new APK was generated per the user's batch-build instruction.
- 2026-09-10 WP5/WP9 P0 long-post scrolling verification: the installed APK scrolls a roughly 30-line body but leaves Register behind the keyboard (button bottom 2038 > IME top 1517); current source exposes the full button after an inside-body drag (1412 <= 1517). The applicable runtime fix is already committed in `4c7bfb5`; this follow-up records acceptance criteria and evidence without adding another gesture implementation. Geometry checks fail on the old capture and pass on the current one; 71 existing frontend regressions and typecheck passed. Evidence: `docs/qa/LONG_POST_SCROLL_ANDROID_2026-09-10.md`. The exact inside-only gesture failure was not reproduced in this condition. Final packaged/physical Android and iOS/web verification remain `Phase 5 QA`; no new APK was generated.
- 2026-09-10 WP5/WP9 P0 Council IA update: per the user's explicit menu-removal request, removed `원우회 활동내역` from the shared web/native Council hub. The other seven entries, Council bottom tab, existing boards/posts, notice linkage, direct routes, administrator management, and Past Councils activities remain. Android 16 / Expo Go before/after screenshots and UI XML verify removal and remaining menu order (`outputs/qa/council-activity-menu-2026-09-10/dev-before.png`, `dev-after.png`); 40 existing council/design tests, typecheck, scoped lint, and read-only review passed. No new test was added for this reversible menu-only edit. Web shares this screen but was not deployed or browser-tested in this task. Final packaged/physical QA and APK generation remain deferred until the requested fix batch is complete.
- 2026-09-10 WP5/WP9 P0 My Activity Back fix: repeated My Posts/Bookmarks visits no longer replace Activity with duplicate Settings index screens. Header/system Back restores the original drawer in one press, and one drawer close reveals the origin. Detail return also preserves the selected posts/comments/bookmarks filter through a strictly validated return URL. Android 16 / Expo Go checks cover repeated header returns, bookmark detail return, and system Back ordering; 564/564 frontend tests, typecheck, scoped lint, and read-only review passed. Evidence: `docs/qa/MY_ACTIVITY_BACK_ANDROID_2026-09-10.md`. Final packaged/physical Android and iOS/web checks remain `Phase 5 QA`; APK generation is deferred until the fix batch is complete.
- 2026-09-10 WP5/WP9 P0 My Page transition fix: the APK exposed the original tab while entering/returning from Profile, Notifications, and Account. The drawer now covers entry through focused layout plus a paint opportunity; Back shows the full drawer before reactivating its remembered origin. Native Modal Back priority, explicit close animation, form actions, and origin state are preserved. Final source was exercised on Android 16 via Expo Go; all 557 frontend tests, typecheck, scoped lint (0 errors, one existing warning), and read-only review passed. Evidence: `docs/qa/MY_PAGE_TRANSITIONS_ANDROID_2026-09-10.md`. Final packaged/physical Android and iOS/web checks remain `Phase 5 QA`; no new APK was built per the user's batch-build instruction.
- 2026-09-10 WP9 P0 splash transition: Android APK cold-launch video confirms the same logo is drawn natively and then by React at a different size (wordmark 266 to 386 px). Native now retains one system splash through the existing session/font/1,500 ms gates and hides it after the ready navigator lays out; web preserves its original React splash. Five new lifecycle regressions failed before and pass after the source change; all 548 frontend tests, typecheck, and changed-file lint passed. Evidence: `docs/qa/SPLASH_TRANSITION_ANDROID_2026-09-10.md`. Per user request, a new APK and the after-fix native recording wait until the fix batch is finished; packaged/physical Android and iOS startup checks remain `Phase 5 QA`.
- 2026-09-10 WP9 album-thumbnail fix: applied a constant transparent border to real photo-album thumbnails and change only the active border color, avoiding Android image clipping when deselecting. Original and fixed APKs were compared on the authenticated production album `제59회 학위수여식` in Android 16; forward/backward wraparound and direct thumbnail selection preserve all images. Full 532 tests, typecheck, changed-file lint, review, APK resource equivalence/signature/alignment, install, and screenshot pixel checks passed. Direct-install APK: `outputs/android/AI-SW-CAMPUS-0.1.0-3-album-thumbnail-fix-test.apk`. Evidence: `docs/qa/ALBUM_THUMBNAILS_ANDROID_2026-09-10.md`. Reporting physical-device verification remains `Phase 5 QA`; original APK/AAB artifacts are preserved.
- 2026-09-10 WP9/WP5 P0 keyboard fix: the root native navigator and separate password Modal avoid keyboard overlap; Android removes avoidance on dismissal, tabs hide during typing, and login/report content can scroll. Actual Android 16 / Expo Go captures reproduce hidden comment/report fields before the fix and verify visible inputs/buttons, post editor, profile scrolling, Modal refocus/reopen, restored tab position and report Back order afterward. Full 543/543 frontend tests, typecheck, changed-file lint and scoped review passed. Evidence: `docs/qa/KEYBOARD_AVOIDANCE_ANDROID_2026-09-10.md`. New APK generation remains deferred until the requested fix batch is complete; packaged/physical Android and iOS checks remain `Phase 5 QA`.

- 2026-09-09 release scope: user deferred mobile push. `app.json` explicitly disables remote push; native module loading, permission prompts, listeners, and token registration are skipped while the in-app notification list/settings and polling remain. Node release checks and Gradle read the same flag; enabling push again requires a valid Firebase file. Regression tests cover disabled, enabled, invalid flags, and unchanged public API requirements. Firebase/FCM setup is `v1.1`. EAS build `5375e36a-f05a-4956-863f-3befa1601d29` finished from isolated commit `9e74489341ea80f9412ac152284fa7bbc6945944`; signed AAB version `0.1.0` / code `2` is saved in `outputs/android`. Full frontend tests: 523/523 passed; typecheck passed; lint: 0 errors, 7 existing warnings. Actual AAB passed bundletool, upload-signature, manifest/API 36, native 16 KB alignment, production-config, and Gitleaks checks. Play submission and device testing were not performed; detailed evidence is in `docs/qa/ANDROID_BRANDING_2026-09-08.md`.

Source: Notion `Frontend-backend full integration`.

Scope:

- 2026-09-08 Android/AAB preparation: copied the supplied icon unchanged, retained the existing full-screen splash and 1.5-second gate, and synchronized SDK 54 native splash plus adaptive/themed icon resources. Aligned native identity with Expo, corrected the EAS owner, registered 10 public production variables, and added branding sync/local release-check commands. User confirmed new registration; EAS upload key `aisw-campus-production` is created and verified. Firebase activation/client configuration remain blocked by an API 403 pending console sign-in; signed builds and physical-device checks remain `Phase 5 QA`. Verification and build sequence: `docs/qa/ANDROID_BRANDING_2026-09-08.md`.

- Completed: Integrated PR #17's schedule, notification, notice, and participation visuals onto the latest main without its irreversible event migration or three-value backend schema restriction. Existing six-value event data and title-only edits remain compatible; user-facing schedules normalize to three Korean labels, while search, participant name/student-number lookup, natural/expandable media, galleries, comments, attachments, admin CRUD, and navigation remain available. Verification evidence is recorded in docs/qa/PR17_FUNCTIONAL_SAFE_INTEGRATION.md.
- Normalize API base URL handling for local, staging, and production.
- Run login -> feature use -> logout flows.
- Test all mobile routes from the target IA.
- Run backend checks, frontend typecheck, and runtime API smoke test.
- Verify iOS and Android builds or document blockers.
- 2026-09-09 WP9 Android Back policy: non-Home primary tabs explicitly return Home regardless of history; non-Home tab-area screens without history also return Home. Existing detail handlers retain normal history handling. The visible My Page drawer uses Android native Modal Back handling before underlying listeners; subscriptions clean up on focus loss/unmount. All 532 frontend tests, typecheck, and changed-file lint passed; the drawer-priority review finding was corrected and re-reviewed. Physical-device reopen/back verification remains `Phase 5 QA`; see `docs/qa/ANDROID_BACK_NAVIGATION_2026-09-09.md`.
- 2026-09-13 WP5/WP9 P0 retained-Activity Back regression: reproduced APK 7 returning from Participation to the launcher after Home Back and real launcher-icon resume. Restored Expo SDK 54's predictive-back opt-out in both app config and the committed native manifest; added release-manifest enforcement. The prior synthetic-key/component-launch test did not cover retained-Activity resume and its QA claim is corrected. All 614 frontend tests, typecheck and changed-file lint passed; APK 8 was built, signed/manifest/source/alignment verified and installed. Native runtime results and physical-device limitations: `docs/qa/BACK_RELAUNCH_2026-09-13.md`.
- 2026-09-13 WP5/WP9 P0 long-body dragging report reopened (`Phase 5 QA`): the user still observes keyboard-hidden dragging failure in the downloaded APK. Installed APK 8 passes native 30/60-line Enter sequences and expanded Korean/emoji cases; diagnostic measurements show no persistent internal body overflow in the tested emulator state. No speculative composer change or new APK was shipped. The affected APK identity, device/keyboard/display conditions and triggering text are needed for reproduction. Evidence and corrected completion scope: `docs/qa/LONG_POST_SCROLL_RECHECK_2026-09-13.md`.
- 2026-09-13 WP5/WP9 P0 clarified body/form scrolling: native multiline fields now stop growing at 240 points. Android uses a nested body viewport with boundary handoff to the form; iOS retains its capped native scrolling editor. APK 9 verifies real 30-line Enter typing, keyboard-hidden internal dragging, independent form movement, both boundary directions, middle-text editing, shrink/reset and 60 Korean paragraphs. Ten native behavior/geometry checks, all 619 frontend tests, typecheck, scoped lint (zero errors, two existing warnings), source/signature/alignment checks and read-only review pass. Physical Android and iOS runtime coverage remain `Phase 5 QA`. Artifact and evidence: `docs/qa/POST_BODY_NESTED_SCROLL_2026-09-13.md`.
- 2026-09-09 WP9 mobile safe-area fix: bottom tabs now add the live bottom inset to both the 74-point height and 8-point bottom padding, including Settings, preserving tab content height and account-deletion hiding. Typecheck, 523 tests, changed-file lint, strict release config, and layout checks for changing insets (0/16/34/48/24/0) passed. Direct-install test APK: `outputs/android/AI-SW-CAMPUS-0.1.0-2-safe-area-test.apk`; the existing native AAB was reused with a fresh production Hermes bundle after checking resource equivalence. Physical Android three-button/gesture and iPhone visual verification remain `Phase 5 QA` (no connected device).
- Prepare Phase 5 QA issue list.
- Implemented for the GCP rehearsal branch: a single-VM raw-public-IP HTTPS
  overlay with pinned Nginx/Certbot images, exact proxy trust, short-lived IP
  certificate renewal, production runtime validation, a fail-closed one-time
  legacy import/restore gate, and PC web/Expo device handoff documentation.
  Live certificate issuance, VM container smoke, SMTP/alert delivery, and
  physical Android/iOS evidence remain deployment-time checks.

Definition of done:

- Critical bug count is zero.
- Every P0 route is reachable and connected to backend data.
- Phase 5 QA can begin with a known test matrix and no undocumented blockers.

- 2026-09-17 WP5/WP9 P0 follow-up: club create/edit now exposes a separate operation state (`운영 중 / 운영 종료`) in existing metadata. Certification source filtering and API validation exclude operation-ended clubs; recruitment closure remains independent. Historical certification edits, state resumption and older-client metadata preservation are covered. Validation and local UI evidence: `docs/qa/CLUB_OPERATION_STATUS_2026-09-17.md`.
