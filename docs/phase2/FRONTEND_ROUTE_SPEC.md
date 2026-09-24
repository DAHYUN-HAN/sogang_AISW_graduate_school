# Phase 2 Frontend Route and Screen Spec

2026-07-05 override: the AISW policy definition makes the app member-only. `/auth/login`, `/auth/register`, `/auth/password-reset`, `/legal/terms`, `/legal/privacy`, `/legal/support`, and `/legal/account-deletion` are guest-visible screens. Signup/email-verification, password recovery, public account-deletion request/verify, refresh, and registration-option API calls support those screens. All tab, board, post, search, event, FAQ, guide, notification, settings, and admin routes require an authenticated session.

Status: implemented baseline, checked 2026-07-27

## 1. Navigation Shape

The 2026-07-27 implementation baseline follows the current `AISW UI.pdf` and uses five bottom-tab areas plus auth and content stacks:

- Auth stack
- Home
- Notices
- Community
- Participation
- Student Council

My Page/Settings opens from the profile action rather than a sixth bottom tab. Do not collapse Notices into Home without a new product decision.

2026-09-09 Android back policy: Home is the initial tab and the return target for hardware/system Back from Notices, Community, Participation, and Council roots, independent of tab history. An open My Page drawer closes first. Detail screens retain their existing back handlers when navigation history exists; a non-Home tab-area screen with no usable history returns Home instead of falling through to Android exit. Only the unobscured Home root delegates the no-history Back event to Android. The tab-area subscription is removed on blur/unmount and is Android-only; iOS gestures and browser history retain their existing handlers. This policy must be checked after backgrounding/reopening the app as well as on a cold start.

2026-09-13 native compatibility (WP5/WP9 P0): Expo SDK 54 / RN 0.81.5 uses `android.predictiveBackGestureEnabled: false` and the matching checked-in application manifest flag `android:enableOnBackInvokedCallback="false"`. Release manifest validation enforces this setting. Reopen verification must launch through the actual app icon, preserve the same Activity across Home Back and resume, and use the system navigation button or edge gesture. Synthetic Back key events and recreated Activities do not cover this regression. Evidence: `docs/qa/BACK_RELAUNCH_2026-09-13.md`.

## 2. Route Map

2026-09-12 navigation QA follow-up (WP5/WP9 P0): FAQ returns to Council, notice-scoped search returns to Notices, Home-origin day screens return to Home, and notification-origin event details return to Notifications through both header and Android Back. Ordinary event details retain their originating day/history. On shared board lists, Android first dismisses the keyboard, then an open sort menu, then inline search (clearing draft/submitted keywords), before leaving the list. Returning from a post or closing My Page must preserve this priority: the tab fallback keeps a stable focus subscription and reads current route/drawer state without registering above screen handlers. Post detail, post edit, and event detail keep their navigation controls during loading and errors; retry remains available. Header/system navigation does not reset retained tab filters. Verification: `docs/qa/NAVIGATION_FIXES_2026-09-12.md`.

2026-09-10 startup policy: native platforms keep the system splash until session hydration, fonts, and the existing 1,500 ms minimum duration are ready, then hide it when the navigator viewport lays out. Do not replay the same artwork in a React loading view on native, because its different scaling causes a visible size jump. Web retains its full-screen React splash and the same readiness gate. Packaged startup verification follows the final APK build; see `docs/qa/SPLASH_TRANSITION_ANDROID_2026-09-10.md`.

| Screen ID | Route | Purpose | Auth |
| --- | --- | --- | --- |
| `S_017` | `/auth/login` | Login | guest |
| `S_018` | `/auth/register` | Signup | guest |
| `S_019` | `/auth/password-reset` | Password reset | guest |
| Legal | `/legal/terms` | Terms of service | guest |
| Legal | `/legal/privacy` | Privacy policy | guest |
| Legal | `/legal/support` | Support and privacy contact | guest |
| Legal | `/legal/account-deletion` | Public email request/verify deletion and completion state | guest |
| Home | `/(tabs)/home` | Quick menu, latest notices, upcoming schedule | user |
| Notices | `/(tabs)/notices` | Notice category list entered from Home | user |
| Community hub | `/(tabs)/community` | Event album and resource sharing | user |
| Participation hub | `/(tabs)/participation` | Club, study, networking, and activity certification | user |
| Student council hub | `/(tabs)/council` | Council content, suggestion, mutual aid, FAQ | user |
| Settings hub | `/(tabs)/settings` | Profile/settings entry | user |
| `S_001` | `/board/[boardId]` | Board post list | user |
| `S_002` | `/board/post/[postId]` | Post detail | user |
| `S_003` | `/board/post/create?boardId=` | Create post | user/admin |
| `S_003` | `/board/post/edit/[postId]` | Edit post | owner/admin |
| `S_006A` | `/events/day/[date]` | Events for the selected calendar date | user |
| `S_007` | `/events` | Compatibility redirect to Home | user |
| `S_011` | `/faq` | FAQ accordion | user |
| `S_013` | `/settings/profile` | Profile edit | user |
| `S_014` | `/settings/notifications` | Notification settings | user |
| `S_015` | `/settings/account` | Account settings | user |
| `S_016` | `/settings/activity` | My activity | user |
| Search | `/search` | Global search | user |
| Admin | `/admin` | Launch-critical content, account, permanent roster, and current-term dues administration | admin |

The root layout must guard all member routes and must guard `/admin` by role. The UI guard is navigation hygiene only; every admin mutation also uses a backend admin dependency.

2026-09-10 keyboard policy: the native root navigator reserves keyboard overlap so all input routes share the same available viewport. Android releases that space completely when the keyboard hides, and bottom tabs hide while typing. Long forms and report details remain scrollable within that viewport. A native Modal with text input uses its own keyboard viewport because it has a separate native window. Web retains browser layout behavior. See `docs/qa/KEYBOARD_AVOIDANCE_ANDROID_2026-09-10.md` for Android execution and remaining packaged/iOS QA.

Long-post acceptance criterion, clarified 2026-09-13: native multiline fields retain their existing minimum heights and grow only to 240 points; longer content scrolls inside the field. The whole writing form also scrolls, and Android movement at a body boundary continues through the outer form so Register remains reachable with the keyboard open or hidden. Android uses a bounded nested ScrollView around the naturally sized input; iOS caps its native scrolling TextInput to preserve caret behavior. Single-line and web layout are unchanged. APK 9 passes the general resource composer's Android emulator checks; physical Android and iOS runtime checks remain Phase 5 QA. See `docs/qa/POST_BODY_NESTED_SCROLL_2026-09-13.md` for implementation and evidence; the preceding expanded-body investigation is retained in `docs/qa/LONG_POST_SCROLL_RECHECK_2026-09-13.md`.

## 3. Home Screen Requirements

Sections:

- Quick menu for P0 flows.
- Latest two notices across every active notice board, ordered by creation time without pin priority.
- Upcoming schedule.
- Recent community posts.
- Final `동문회 주소록` entry that always opens the fixed Rembr directory URL `https://app.rmbr.in/SPbmZjUxRzb`; board metadata and administrator external-link settings do not override the Home destination.

Quick menu:

- Academic notices
- Event notices
- Calendar
- Lecture reviews
- Exam archive
- Suggestions

The Home schedule card changes its displayed month and `GET /events` range in place when the previous/next arrows are pressed. Empty upcoming-schedule copy is not interactive. API datetime values are explicit UTC strings ending in `Z`, while schedule detail/admin inputs and Home calendar placement display the corresponding KST value without changing the stored instant. Multi-day events mark every KST calendar date from `start_at` through `end_at`, inclusive, in the Home card; day routes and D-day notification dispatch rely on the same KST boundary behavior from the events API. A day route opened from the Home schedule returns directly to the existing Home tab when its header back control is pressed instead of popping the hidden events stack. An event detail opened from Notifications carries an event-detail-only `returnTo` whose allowlist contains only the Notifications root; header Back returns to that mounted list before considering history. Event details opened from Home, day, or admin carry no such value and retain history Back with the Home fallback for direct entry. Post-detail, Home day-route, and My Page return contracts remain independent and unchanged.

QA 201: Standalone event-list and full-calendar screens are not part of the final product IA because Home already owns the monthly schedule. Existing `/events` deep links redirect to Home, while Home dates open the retained day route and event notifications open their specific detail directly. The unlinked all-boards and hardcoded guide-placeholder screens are also removed from the route tree; day/detail, FAQ, Notifications, Settings, and every admin management screen remain available.

QA 161: Home, Notices, and shared board lists refresh through native pull gestures while retaining cached content, current filters/search, and scroll-rendering keys. Protected media access URLs do not refresh on a timer; `MediaImage` and `MediaImageBackground` explicitly refresh them after an image load error. Notification delivery and bootstrap refresh continue independently of the removed Home badge poll.

2026-09-11 loading and mobile presentation: Home uses one initial-loading spinner with text placeholders for unresolved sections. Its pull-to-refresh spinner is suppressed during initial loading. Notices likewise suppresses pull and pagination spinners while the initial list loader is visible, and suppresses pagination loading during first-page refresh. The Home banner viewport clips adjacent pages, including when multiple banners are registered. System status-bar icons use dark styling in the root navigator, Expo configuration, and Android app/splash themes. Android source and mobile-web evidence: `docs/qa/MOBILE_POLISH_2026-09-11.md`.

QA 189: Selecting `전체`, `학사공지`, `행사공지`, or `기타공지` on the Notices root immediately keeps that filter selected and refetches both the board registry and notice posts, so newly published notices appear without a manual pull-to-refresh.

QA 173/188: Explicitly pressing any Home, Notices, Community, Participation, or Council bottom tab always navigates to that tab root, including when the same tab is already active or a detail route only makes it appear active. Notices, Community, and Participation recreate their product defaults at the top of the list: `전체`, `행사 사진첩`, or `동아리 > 안내`, respectively. Home opens its main screen and Council opens its menu list. Header/Android Back from detail routes and programmatic My Page returns do not emit this reset and continue preserving the mounted list state described below.

## 4. Board List Screen Requirements

Community tab opens the `event-album` board when available and exposes `행사 사진첩 / 자료공유` as section tabs. A photo-album post accepts 1-20 images in total across create and edit. Each picker invocation exposes only the remaining slots (for example, an existing 19-image post can select one more), disables image addition at 20, and retains successful uploads in selection order when another selected image fails. Existing legacy posts above the limit are not modified automatically and must be reduced to 20 images or fewer before an edit can be saved. Every image still uses the server's 10 MiB per-file limit. Resource sharing offers `강의후기`, `시험족보`, `종합시험`, and `졸업논문`; `graduation-thesis` is a member-writable resource board. Exam-archive list rows show the author cohort/name alongside the post date, while lecture-review and suggestion anonymity remains unchanged. The resource post edit screen exposes a board picker limited to these active resource boards, and moving a post preserves its existing detail URL and related content. After a move, the target resource board is authoritative for the post tag across the resource list, post detail, and My Activity, so a stale stored category must never override the target board label. The `comprehensive-exam` and `graduation-thesis` detail more menus omit the author-block action while preserving report and owner actions; existing blocks and block-based filtering remain global. Participation activity certification uses the existing source-post selection sheet instead of free-text activity names and loads every published `club-promo` page. Per the 2026-09-17 user correction (WP5/WP9 P0), the club picker offers every published, non-deleted administrator-managed `club-promo` post whose separate `metadata.club_operation_status` is not `ended`, using its ID and current title, in the same order returned by the guide API. No fixed club-name list, name-prefix matching, or title-based deduplication may exclude newly registered or renamed clubs; this supersedes the previous seven-club restriction. All legacy club posts and existing certification links remain readable and unchanged, and study/networking source selection is unchanged. List/detail tags prefer the API's canonical `activity_source_title`, then use stored category or legacy metadata only as a historical fallback. Renaming a guide updates existing certification tags, while retiring it removes it from new choices but preserves the last official name on linked history. This behavior does not change the current UI structure, styling, or copy.

The participation club and networking guide lists are backed by `club-promo` and `networking-programs`. Only admins see their create entry points. Create/edit requires a representative image and an HTTP(S) participation URL; the first image attachment is managed in a dedicated representative-image section and is used only by list thumbnails. Administrators manage every later image in a separate detail-image section, and detail renders those images in stored order below the body without rendering the representative image. Replacing the representative image preserves all detail images and unrelated attachments. Detail binds the `가입 신청` or `참가 신청` button to the managed URL. Participation URLs are CTA-only: legacy body lines explicitly labeled `참여 링크`, `가입 링크`, or `신청 링크` are omitted from the displayed body and surfaced as the CTA metadata instead, while unrelated body URLs remain ordinary content.

Board and post back navigation never uses the hidden `/(tabs)/boards` screen as a user-facing destination. A post opened from a stateful app list carries a validated internal `returnTo`; a newly created ordinary post carries the same validated list target and source board into its result detail. Header back and Android hardware back navigate to the already-mounted list screen, preserving participation section tabs, board filters, search/sort state, and scroll position. Allowed return targets are limited to the app's home, notice, community, participation, council, search, notification, My Activity, and positive board-ID routes. This applies consistently to study, club, networking, notices, community, search, notification, and My Activity detail entry. Without a valid `returnTo`, normal history is used; a directly opened post with no usable history falls back to a valid recorded `fromBoardId` list when present, otherwise to the post board's product hub. Leaving a standalone board returns to its product hub, while legacy community boards such as `community-major` return to Home because they are entered there. In the cohort-leader and past-council boards, header Back and Android hardware Back both close an open in-screen profile before leaving the board.

Successful post deletion follows the same validated origin resolution after refreshing affected lists and dismissing the confirmation/menu. An explicit standalone `/board/[boardId]` return target uses `dismissTo` so the existing board list is restored rather than pushed again. My Activity, Home album/popular, and shared post/feed caches are invalidated before returning; deletion failure preserves the current screen for retry. Evidence: `docs/qa/MOBILE_POLISH_2026-09-11.md`.

Study recruitment is backed by `study-recruit` and remains writable by every authenticated member, including recruitment status and contact metadata.

Participation search is available only on the `활동 인증` lists for clubs, study groups, and networking, including empty lists. Club/networking `안내` and study `모집` have no search entry point, including the unavailable-board fallback. The header search control opens the existing board-scoped search input, hides the primary group tabs, and keeps the guide/recruitment and certification chips visible. Submitting searches the title, body, and displayed activity badge of posts in the current certification board, excluding author names and participant metadata for every role; a name written in searchable text can still match. Club badge search follows the displayed current source title, then the specific category or legacy activity-name fallback, including retired club history. Networking searches its category badge. Study cards have no badge and retain title/body search. Tag matching is applied before pagination and result totals. Closing search clears the keyword. Switching to a different participation board also closes search and clears both the draft and submitted keyword. Community search retains its existing behavior.

The shared post create/edit route keys its form instance by the validated route `boardId`, `postId`, and `category`. Per the 2026-09-17 user correction (WP5/WP9), leaving a new-post route unmounts its form even when the hidden board tab retains the route. Returning to the same create route starts a fresh form with no abandoned title, content, attachments, or local selections. A valid existing-post edit is not discarded solely on focus loss; in-form overlays and file pickers retain the current writing session. Opening a new post from a board list closes its search and clears both draft and submitted search text while preserving the selected board/category. Detail-view return continues preserving the list search state. Entering a different board, post, or category therefore starts with that destination's title, fields, attachments, and local selection state instead of reusing another board's draft. Changing the board from the picker inside an already-mounted form remains an in-form edit and does not remount the draft. Existing validated `returnTo`, header Back, Android hardware Back, and direct-entry fallback behavior remain unchanged.

2026-09-21 board change reset (WP5/WP9): changing the board inside a mounted form still does not remount the route, but it now discards the draft after an explicit confirmation (`Screen/Common/BoardChangeConfirmModal`: `게시판을 변경하시겠어요? / 작성 중인 내용이 모두 사라져요.` with `취소` and `변경`). This supersedes the earlier rule that a board switch silently preserved the draft, because each board asks for different fields. Re-picking the current board is a no-op. On create, a form with nothing written yet switches without a prompt, and confirming resets it to empty — title, content, attachments, participants, activity source and evidence. Per the 2026-09-22 user correction the post edit screen behaves the same way: it always prompts, because a saved post always has content to lose, and confirming clears the form rather than reverting to the saved post. Saving after a cleared board change therefore replaces the post's content, which is the intended flow for moving a post between resource boards that ask for different fields. The confirm dialog reuses the `DiscardWriteModal` component, whose card and buttons are identical to `Screen/Common/DiscardWriteModal`.

2026-09-21 user request (WP5/WP9): the create route's `boardId` is optional. Opening create from an aggregated list that spans several boards (Community > 자료공유 > `전체`, feed mode `resources`) omits `boardId` and passes `boardGroup=<board category>` instead, so the form starts with no board chosen and shows the `게시판을 선택하세요` placeholder rather than inheriting the last visited board. Opening create from a specific filter (`강의후기`, `시험족보`, and the other resource boards) keeps passing that board's `boardId` and preselects it. When `boardId` is absent, the picker lists the boards of the `boardGroup` category. Submitting without a chosen board is blocked at the same validation step as the other required fields: the select gets the shared 1.5px #D64545 error border and the `필수 항목을 모두 입력해주세요` toast. The picker itself is the shared bottom sheet used by the club and mutual-aid selectors instead of the previous inline dropdown; `returnTo` and form-instance keying are unchanged.
The common post edit screen always shows persistent `제목` and `내용` labels above their inputs so existing values never obscure each field's purpose; these labels do not depend on board lookup or slug detection.
The recruitment list follows the approved Figma text-row layout: status pill, title, up to two preview lines, and `cohort + author · YY.MM.DD(weekday)`. It does not use the image-heavy club/networking guide card and does not show reaction counts in the list.

Club, study, and networking activity certification remains available to every authenticated member. The create and edit forms keep `활동 사진` and `활동 소감` labels visible independently of their current values. Their activity calendars allow only KST today and past dates, disable navigation beyond the current KST month, and repeat the same future-date validation before submission; this maximum-date rule does not apply to non-certification calendars such as mutual aid. The create flow supports multiple image previews, activity date, required account, and participant inputs, followed by a dedicated completion state. Their single shared subsidy-participant picker searches the independent full student roster by name for the current activity board; it never queries member accounts or auto-selects the author. Results hide the student number, show cohort/name and major, and use only `#212429` black for current-board paid (`ALL` or matching `ONCE`) and `#8A919C` gray for current-board unpaid. Both colors remain selectable, and search caching includes the board ID. Activity-certification detail uses the same current-board black/gray rule for roster-linked participant chips; legacy name-only snapshots remain black because their current payment state cannot be resolved. The edit flow reuses the same calendar and roster picker and hydrates current participant IDs or historical name-only chips, source post, and attachments. Per the 2026-09-17 user correction, an authorized author/admin edit response also prefills the stored bank account. The account remains editable and optional: unchanged or blank input preserves the stored account, while a new non-empty value replaces it. Reopening edit fetches the saved value; a background refetch never overwrites in-progress changes. Ordinary member list/detail responses continue hiding account data and edit queries use their separate cache context. A changed legacy participant list requires complete roster reselection. Every member-writable post edit launched from detail records the validated originating list; after a successful save, the edit and detail depth are dismissed together to restore that already-mounted list, including its participation group, filter, search/sort, and scroll state. Closing an edit without saving still returns to its existing detail, and direct edit entry without usable history replaces with a contextual detail. Administrator-authored boards, photo-album administration, and the admin console keep their existing navigation. A resource post moved between boards returns to its original list while the target board becomes authoritative. Detail supports image paging; account data on ordinary detail is rendered only for admins.

The admin console exposes one Board Management entry. It groups every board as All, Notices, Community/Resources, Participation, or Council, then selects an actual board and either Content or Settings. Board-type content editors stay in the selected board instead of navigating to separate notice, suggestion, mutual-aid, council-introduction, FAQ, or calendar sections. Existing slugs, categories, board types, privacy policies, and server-side admin authorization remain unchanged. `club-promo` and `networking-programs` cards additionally show the current representative-image thumbnail and allow an administrator to replace the first image attachment in place while preserving the post body, participation URL metadata, deadline, anonymity, and every other attachment. The administrator uploads through the existing media flow and submits only the resulting media ID to the dedicated representative-image endpoint; the operation never resubmits or revalidates unrelated post fields and requires no database schema change.

The admin console includes separate top-level `원우 명부` and `원우회비` tabs. `원우 명부` is a dense, paginated table searchable by name, student number, or major. Its headerless `이름, 전공, 학번` XLSX upserts identities by student number, overwrites changed name/major, inserts new students, retains omitted alumni, and never displays or changes payment state. `원우회비` shows every roster member with the derived current-term state. Its upload warning states that upload replaces the whole term; after full validation, all prior `ALL` and `ONCE` rows are cleared and the uploaded name/student-number matches become `ALL`. `납부 설정` keeps identity read-only and chooses `전체 납부`, one active activity-certification board for `1회 납부`, or `미납`; switching the board replaces the previous `ONCE`, and `미납` removes the payment row. Member-account cards do not display or mutate dues state. Visual evidence: `docs/qa/evidence/roster-dues-separation/admin-roster-table.png`, `admin-dues-payments.png`, and `activity-participant-colors.png`; verification matrix: `docs/qa/ROSTER_DUES_SEPARATION_2026-09-23.md`.

Council content is managed by admins except suggestion and mutual-aid submissions. The current-council route opens its single introduction directly, while cohort leaders and past councils use an admin-created summary list followed by a selected detail screen. All three member-facing detail views share an ordered organization-introduction photo gallery, greeting, and introduction; individual member profile cards are hidden because they have no detail action and duplicate the introduction. Cohort and past-council list summaries still use member data for the first name and `외 N명` count. The first `photo_urls[]` image is the representative image and mirrors `banner_image_url`; member rendering resolves `photo_urls[]`, then legacy `attachment_urls[]`, then `banner_image_url`. Admins can select multiple images, add images, delete an individual image, and move each image up or down; saving preserves the resulting order and mirrors its first image. Admins edit the single current-council introduction and can add, edit, reorder through list order, and delete cohort/past organization cards and all member cards; each member includes name, cohort, role, and an optional profile image. Notice create/edit can opt into council activity-history linkage; linked notices reuse their title, body, date, and image attachments in the council list and detail screens.

Mutual-aid lists and search results show member-readable request content with processing/completed/rejected status pills, require private evidence, allow the remarks field to be empty, and end creation on a dedicated completion screen. Ordinary member detail screens hide evidence. Per the 2026-09-17 user decision, the processing request author opens an authorized edit response that includes existing evidence thumbnails/filenames and proof links. The shared attachment editor supports opening, individual replacement/removal and adding private evidence; saving requires at least one file or valid proof link. Its calendar disables only dates before KST today, opens on the first selectable month when necessary, and maps `MUTUAL_AID_DATE_TOO_SOON` to the same guidance. Processing requests expose edit/delete, completed requests expose neither, and rejected requests expose delete only. A peer or non-processing requester guessing an evidence media ID receives the same not-found state as a missing object.
The admin console has a dedicated mutual-aid queue with processing/completed/rejected filters. Opening a request exposes the private evidence to admins and allows `processing`, `completed` (shown as `처리 완료`), or `rejected`; rejection requires a reason.
Suggestion lists use `대기중` and `답변완료` status pills and preserve anonymous presentation. Creation ends on a dedicated completion screen. The admin console has a suggestion queue where admins open a suggestion and write the official reply; saving a reply marks it answered and notifies the author.
The admin console has a cohort-leader section for managing multiple cohorts, captain/vice-captain names, greeting, introduction, representative image, and profile images. The member council screen reads this structured metadata and keeps legacy post parsing only as a fallback.
Past councils and FAQ are separate admin sections. Past councils render a council-number list and member/activity detail tabs from `past_councils` metadata; FAQ renders from its dedicated API and table. Expanded FAQ answers render ordered protected image attachments at their natural aspect ratio.

2026-09-10 council menu override (WP5/WP9 P0 IA): remove the `원우회 활동내역` entry from the shared web/mobile Council hub. Retain the Council bottom tab and its other seven menu items, including Past Councils and their activity detail. Existing activity-history boards, posts, notice linkage, direct routes, and administrator management remain available; this change removes the member hub entry, not stored content.

Notification delivery surfaces:

- iOS/Android register an Expo push token using the EAS project ID; Android creates the `default` notification channel before permission/token requests.
- Web polls the authenticated notification API and can show the browser Notification API while the site is open after explicit browser permission.
- Closed-site background web push is not provided by `expo-notifications`; it requires a separate service worker, VAPID keys, and web-push provider.
- Logout deactivates the current native push token before clearing the session.

Required controls:

- Search input.
- Filter menu when board supports categories/status.
- Sort menu: latest, popular, views.
- Floating create button when user has write permission.

Presentation rules from the approved Figma capture set:

- 2026-09-17 viewer visual follow-up: remove the bottom zoom-in/out buttons, percentage, fit button, and gesture hint on web/native. Remove the footer entirely; keep pinch/double-tap zoom, web keyboard shortcuts, and photo paging, and use the freed space for the image.

- 2026-09-17 user override (WP5/WP9): community and participation post-detail images open a shared full-screen image modal instead of an external URL. This supersedes the 2026-09-12 no-viewer rule for photo albums, participation guides, and activity certifications; inline image frames and gallery navigation stay as designed. The selected image opens first, fitted to the viewport; pinch and buttons support 1–4x zoom, double tap toggles zoom/fit, zoomed dragging is bounded to image edges, and fitted horizontal swipes page within the post. Page changes reset the transform. Close/Esc/Android Back dismiss only the modal and retain the detail position. Club/networking guides include only detail images, excluding the list-only representative image. Notice images, including council-linked notices, remain inert. Document attachments and actual website links retain their existing opening behavior. Use the existing authorized signed-media access flow. Evidence: `docs/qa/IMAGE_VIEWER_2026-09-17.md`.
- 2026-09-24 user override (WP5/WP9): notice images (including council-linked notices shown in 원우회 활동내역), mutual-aid evidence images, and the shared council-introduction photo gallery (원우회 임원진 소개, 기수별 기장단 소개, 역대 원우회) now open the same shared image modal on tap. This supersedes the notice-inert rule above and the `tapping them does not open the source media` sentence below; notice frames stay 4:3/4:5 and still expose no `사진 전체보기` control. Mutual-aid evidence tiles keep their 96×96 placeholder look; only image evidence opens in the modal, while document evidence keeps external opening.

- 2026-09-12 comment/council follow-up (WP5/WP9 P0): dismiss the keyboard and remove input focus only after comment/reply registration succeeds; pending or failed submissions retain the composer. The current council introduction detail header always reads `원우회 임원진 소개`, including when its stored introduction title is `현재 원우회`. Introduction metadata, content, and administrator titles are retained.
- 2026-09-12 user override (WP5/WP9 P0): photo-album previous/next controls reuse the existing activity/council slider icons: a 28px circle with 35% black opacity and a white chevron. Multi-image visibility and current button geometry are preserved. The closed My Page drawer must not overlay any photo-button touch area; both album buttons retain their full 44px hit width. (The leftmost-24px drag observation described here was removed on 2026-09-21 — see below.) Participation and album images do not expose a full-view button or viewer, including when legacy activity metadata has `expandable: true`. See `docs/qa/GALLERY_TOUCH_AND_FULL_VIEW_2026-09-12.md`.
- Community, notice, My Posts/Scrap, council, mutual-aid, and activity-feed dates use `YY.MM.DD(weekday)` in Korean, calculated in `Asia/Seoul`.
- Comment metadata appends `· N분 전` for activity under one hour and `· HH:mm` afterward.
- Activity-certification date inputs, feeds, and details use `YY.MM.DD(weekday)`. Certification feeds use the selected activity date, falling back to the post creation date only for legacy data.
- Schedule day headers use `YY.MM.DD(weekday)`, rows use `HH:mm`, and schedule detail metadata uses `YY.MM.DD(weekday) · HH:mm`.
- Home schedule summaries use `MM.DD(weekday)`.
- Home notice metadata uses `학사공지`, `행사공지`, or `기타공지`; webinar and special-lecture aliases are presented as `행사공지`, and raw codes such as `other` are never shown.
- Home banners are image-only assets registered by an administrator. The app renders the selected responsive image without synthesized title, badge, description, deadline, theme overlay, or gradient; only the carousel page indicator and optional navigation link remain app UI.
- Notice-detail images use the available full width and exactly two orientation frames: landscape, square, and unreadable images use `4:3` (`320x240` at the approved 360px screen baseline), while portrait images use `4:5` (`320x400`). Images use `contain` so the full source remains visible; mismatched ratios use the frame background as letterboxing. Notice images do not expose a `사진 전체보기` control and tapping them does not open the source media. Notice file and link attachments remain interactive. Administrator-managed participation-guide images retain their existing orientation frames. Activity-certification feed thumbnails use the Figma feed-card image frame (`328x219` at the approved 360px baseline, the card width after its 16px side margins), replacing the earlier `2.05:1` frame that was 59px shorter at the same width. Each activity-certification board can independently configure its detail gallery under admin board settings: a required default rule and optional landscape/portrait overrides control maximum width, natural or fixed height, optional maximum height, `contain`/`cover`. Landscape or portrait overrides win when present; square and unreadable source dimensions use the default. Missing or invalid metadata follows the approved Figma baseline at full available width: default and portrait images use a fixed 400px `contain` frame, landscape images use a fixed 240px `contain` frame, with no full-view control or viewer. Legacy `expandable` metadata is accepted for compatibility but does not enable a viewer. Photo albums alone retain the fixed `240px` hero frame. Club-activity feed previews show the first non-empty content row directly below the club tag, including legacy template rows labeled `[동아리명] :` or `[동아리 명] :`, while other activity feeds keep their existing text.
- Notification rows are an explicit exception: today's items use `오전/오후 h:mm`, and older rows use `YY.MM.DD` without a weekday.
- QA 153: lecture-review bookmarks in My Activity render only `YY.MM.DD(weekday)`; they omit `Anonymous`, cohort, and the author/date separator. Other bookmark metadata is unchanged.
- Council activity-history rows contain date and title only; their detail contains title, divider, and body without reactions or comments.
- Mutual-aid member list status labels are `처리중`, `완료`, and `반려`.

States:

- Loading skeleton.
- Empty state.
- Error state with retry.
- Guest write attempt routes to login.

## 5. Post Detail Requirements

Required sections:

- Title.
- Board/category metadata.
- Author display, respecting anonymous rules.
- Body.
- Attachments.
- Like/bookmark actions for logged-in users.
- Comments and replies.
- Selecting a top-level comment reply shows a compact composer target using the same visible `cohort + author` label followed by `님에게 답글`. The target strip never exposes the internal parent comment ID or `작성 중`; reply mode uses `답글을 남겨보세요`, and cancel or successful submission restores the ordinary comment composer.
- Root comments use thin dividers and two-depth replies use indented rounded neutral rows. Every comment keeps a right-aligned `신고` entry; owner rows place the applicable `답글`, `수정`, and `삭제` text actions on one compact line. Edit mode replaces the content with a primary-blue bordered field and shows only `저장` and `취소`.
- Post and comment reports use one bottom sheet with the ordered reasons `스팸/광고입니다`, `욕설 및 비방이 포함되어 있어요`, `허위 정보예요`, and `기타`. Selecting `기타` reveals the multiline detail field and requires nonblank detail before submission. Owner post/comment report attempts are blocked locally with explanatory feedback and never send a report request.
- Header and Android hardware Back close an open post/comment report sheet or More menu before leaving post detail. Delete confirmations consume Back too: close a cancellable confirmation and clear comment-deletion errors, but stay put while deletion is pending. Only unobscured detail uses the existing history/validated-list return policy, preventing dismissed sheets from reappearing on return.
- Edit/delete actions for owner/admin. Destructive comment confirmation is rendered in-app so the delete request works consistently on native and web.
- Post and comment delete confirmations use centered rounded cards, neutral `취소`, destructive `삭제`, and explicit irreversible-deletion copy consistent with the approved mobile reference.
- Pin action for admin.

Resource-board exceptions:

- `lecture-reviews` keeps forced-anonymous presentation for the post author and supports comments; comment rows show the commenter's cohort/author like other boards.
- `exam-archive` shows the cohort/author and supports comments as shown in the latest approved Figma capture.
- Comment rows display `cohort + author`, content, and `YY.MM.DD(weekday) · N분 전` for recent comments or `YY.MM.DD(weekday) · HH:mm` afterward. After account deletion, the writing-time author/cohort snapshot remains visible; only historical orphan rows without any snapshot use `Deleted user`.

## 6. Create/Edit Requirements

Android system Back and the create/edit header share the same origin-aware return decision. Creating from Community > Resources returns to the mounted Resources list with its selected category, without emitting a bottom-tab reset. Open board/date selectors close first; native Modal sheets retain their own close handlers. Registered completion takes precedence over retained form selector state and uses its existing confirmation destination. The Android listener is removed on blur. See `docs/qa/RESOURCE_CREATE_BACK_ANDROID_2026-09-10.md`.

Required fields:

- Title.
- Content, except optional mutual-aid remarks.
- Attachments when supported.
- Anonymous option when board allows.
- Type-specific metadata.
- Club guide metadata: administrator-managed participation URL.

Required behavior:

- Local draft autosave is a deferred P1/v1.1 item and is not required for the Phase 5 entry gate.
- Validate required title and content while allowing mutual-aid remarks to remain empty.
- For mutual-aid creation, accept `Asia/Seoul` today or later and reject past dates. Recompute the boundary at submission time; do not rely only on disabled calendar cells.
- Prevent duplicate submit.
- Show upload progress when attachments exist.

## 7. Auth Screens

Login:

- Email.
- Password.
- Login button.
- Register link.
- Password reset link.

Register:

- Step 1: school email verification.
- Step 2: six-digit email verification code.
- Step 3: name/nickname, cohort, active major, phone, password/confirmation, and current privacy-policy consent.
- Major options and privacy-policy version come from the public registration-options API and are managed by admins.
- The privacy checkbox toggles consent directly. Only the right chevron opens the combined terms-and-privacy document assembled from the same canonical sections used by the My Page terms and privacy screens, and the sheet can close at any scroll position. Signup still requires explicit consent to the active privacy-policy version.

Password reset:

- Email request.
- Reset token confirmation.
- New password.

Find ID decision:

- Email is the only login ID, so v1 does not add a separate ID-discovery API or screen.
- Login and recovery copy should direct the user to their `@sogang.ac.kr` email and password reset.

## 8. Settings Screens

Profile:

- Name/nickname and cohort are read-only identity fields.
- Major is selected from currently active administrator-managed options.
- Phone.
- Company/job fields if retained.
- Profile image.

Notifications:

- Comment.
- Like.
- Notice.
- Event.

Account:

- Password change.
- Logout.
- Irreversible account deletion with current-password input, explicit acknowledgement, error recovery, and completed-session cleanup. After an authenticated deletion, the explicit `completed=1` state uses the compact approved completion UI (`탈퇴가 완료되었어요!`, `확인`) and returns to login without exposing the protected settings stack.

Public account deletion:

- The guest route first requests a six-digit school-email code without disclosing whether the account exists.
- Verification requires email, code, current password, and the exact destructive-action confirmation phrase.
- The page distinguishes request, verification, and completion states, but intentionally does not distinguish unknown account, wrong code, or wrong password errors.
- The copy states that private/draft/hidden/mutual-aid content and private data are deleted, while retained public published content is disconnected from the author.
- The same route distinguishes completion sources: authenticated `completed=1` uses the compact in-app completion state, while public email-code deletion keeps the detailed retention explanation and login/privacy links.

My activity:

- My posts.
- My comments.
- Bookmarks.
- Header and Android hardware Back use the shared drawer return: one press restores the original My Page drawer without replacing the activity route with another Settings index. Repeated visits preserve the selected `posts`, `comments`, or `bookmarks` query and do not accumulate duplicate My Page screens. Closing the restored drawer reveals its remembered main tab. Android evidence: `docs/qa/MY_ACTIVITY_BACK_ANDROID_2026-09-10.md`.

My Page drawer return and avatar:
- 2026-09-21 user request (WP5/WP9): the app defines no navigation swipe gestures of its own, while each platform's built-in gesture stays as-is. Both My Page drawer PanResponders are removed — the left-edge drag that opened it and the leftward drag that closed it — so `MyPageDrawer` registers no gesture handlers at all. The drawer opens from the Home header's My Page button and closes from its own close button or, on Android, the system Back that the overlay Modal consumes. iOS keeps its built-in interactive pop on every stack; no `gestureEnabled: false` is set anywhere, and it must not be added back. The original defect was that the drawer's JS PanResponder claimed the same zone as iOS's native recognizer (leftmost ~25pt) and could not arbitrate against it, so an edge swipe non-deterministically popped the screen, opened the drawer, or did both and left the drawer floating over an unrelated screen; removing the app's own gesture resolves it. Android's `predictiveBackGestureEnabled: false` policy and BackHandler ordering are untouched, and non-navigational horizontal swipes (Home banner carousel, full-screen image viewer paging) are unaffected.
- 2026-09-21 swipe parity (WP5/WP9): an iOS swipe now runs the same return logic as the header and Android Back on the screens where Back is not a plain pop, using React Navigation 7's `usePreventRemove`, which makes `native-stack` set `preventNativeDismiss` so the native gesture itself is held. Post create/edit prevent removal while the form has unsaved changes and no completed post, show `DiscardWriteModal`, and on confirm release the lock and then replay the original navigation action, so a swipe no longer drops a draft. The four My Page settings screens always prevent removal and run the existing drawer return instead, so a swipe restores the drawer over its origin tab rather than popping to `/settings/index`. The header button and Android `BackHandler` paths are unchanged and still take their existing route; only gesture-initiated removals replay the captured action.
- Remaining gap (2026-09-21): board list, post detail, event detail, event day, FAQ, and search still handle Back only through `BackHandler`, so an iOS swipe there performs a plain pop and skips their close-first ordering (keyboard, sort menu, inline search) and validated `returnTo`. These screens lose no user input, so they are left as-is. Tag: `Phase 5 QA`.

- QA 145-147: when the drawer opens, it records the mounted Home, Notices, Community, Participation, or Council origin. Entering Profile, Notifications, Account, or My Activity keeps the drawer covering the origin until the focused settings screen has laid out and had a paint opportunity. Header Back and Android hardware Back first show the full drawer, then explicitly reactivate the mounted origin underneath it; unrelated settings history is ignored, and Home is used only without a valid origin. Reactivating the mounted tab preserves its nested list, filters, search/sort, and scroll state. These handoffs do not slide the drawer away or reopen it over an exposed origin; explicit close retains its slide. Profile-save navigation remains unchanged. See `docs/qa/MY_PAGE_TRANSITIONS_ANDROID_2026-09-10.md` for Android execution and final packaged QA scope.
- QA 148: a positive integer profile media ID or trimmed nonempty profile URL renders the profile image. Missing, blank, or invalid media renders `DefaultAvatarIcon`; no nickname initial, `?`, or other character fallback is rendered inside the avatar.

## 9. Design Gate

Before frontend expansion, Figma should provide:

- Colors.
- Typography.
- Button/input/card/list item components.
- Home.
- Login/register/password reset.
- Board list.
- Post detail.
- Create/edit.
- Calendar.
- FAQ.
- Settings/profile.
- Search.

- 2026-09-17 attachment editing (WP5/WP9 P0): all four resource categories and retained generic community edits display existing image/document rows with thumbnail/name, open, change and delete actions, plus photo/file add actions. Generic member create reuses the editor; specialized activity/album/guide flows keep their current rules. Pending edits are local until save; cancelled/failed replacement preserves the old item and order. Web document opening uses the existing signed download endpoint (`Content-Disposition: attachment`) to preserve the form without a popup, and images use the existing modal. Mutual-aid evidence uses private uploads and explicit replacement IDs/proof field. Edit queries fetch current server data before one-time hydration; later refetches do not overwrite a draft. Account changes replace the root cache and mounted forms.
- 2026-09-21 attachment limits (WP5/WP9): the client restricts generic attachments to the four types the UI advertises (`JPG`, `JPEG`, `PNG`, `PDF`, `DOCX`) and pre-checks size against the same 10 MiB limit the server enforces, so rejected files never leave the device. The server's `MEDIA_ALLOWED_*` allowlist is intentionally left wider (HWP/ZIP/TXT/IPYNB/GIF/WEBP/HEIC) and keeps accepting existing attachments; only the app narrows. Mutual-aid evidence keeps its narrower JPEG/PNG list. Native and web pickers both filter by the same list and re-check the resolved content type after selection, since a picker filter alone is advisory. A multi-file document selection is rejected as a whole when any file fails, so a partial upload never happens. Upload failures no longer render inline text inside the attachment editor: the editor reports the error to its host screen, which maps it with `uploadFailureFeedback` — oversize to `Component/Toast-ImageSizeError`, wrong format to `Component/Toast-FileFormatError`, rate limit to `Screen/Common/RateLimitModal`, and every other cause, including a failed file open, to `Screen/Common/UploadFailModal`. The post edit screen gained the toast and notice modal it previously lacked.

- 2026-09-17 notice wording correction (WP6/WP9): the notice tab and Home notice summaries share deadline formatting. Upcoming notices display `마감 D-N`, same-day notices display `마감 D-day`, and past/invalid/missing deadlines add no suffix. Expired notices show only their publication date, without a standalone `마감` label or empty separator. Schedule-card status labels keep their separate existing policy.

- 2026-09-17 WP5/WP9 club operation setting: administrator club create/edit forms expose `운영 중 / 운영 종료` independently of recruitment state. Missing legacy state defaults to `운영 중`. A recruitment-closed club remains selectable while operating. Operation-ended clubs disappear from new certification source choices, including source changes during edit, while an existing historical selection stays readable/editable. All source pages are loaded before filtering; an ended-only page cannot hide active clubs on later pages. Saving a guide invalidates the source-option cache along with its board posts.
