# AI·SW CAMPUS Phase 2-4 Plan

2026-10-08 integration hardening (WP5/WP8/WP9): refresh locked account credentials before irreversible deletion; enforce the existing processing-author/admin mutual-aid evidence policy for media and post serialization; isolate administrator confirmations by authenticated session; route web notice edits through the dedicated body/poll editor. PostgreSQL board create/update/archive share one transaction advisory lock before board reads/locks; real concurrent reparent and child-create/archive regressions pass. The user authorized consolidating named branches, removing integrated branch refs, pushing main and updating GCP. Physical native QA remains Phase 5; no store release is included.

Source: Notion `App Development (New)` > `Community App Enhancement Schedule`.
Source plan checked on: 2026-04-25. Current implementation and release evidence checked on: 2026-07-27.
Scope: Phase 1 through Phase 4.

Policy update checked on 2026-07-05: `정책_정의서_260705.pdf`, `AISW UI.pdf`, and `AISW APP DESIGN GUIDE _ 260624.pdf` are the current product/UI override for implementation details. The app is member-only: non-members may access login, signup/email verification, password reset, token refresh, registration options, legal screens, and health/docs, but no content route.

QA 144 supersedes the 2026-08-02 D+2 decision: a new or changed mutual-aid event date is selectable from the current `Asia/Seoul` calendar date onward. KST today and future dates are allowed, and past days are rejected by both the mobile form and API. This replaces the earlier unconfirmed `event date ±30 days` proposal for the implemented lower bound; no maximum future horizon is introduced without a separate council policy decision.

Security/integration decision checked on 2026-07-27:

- The approved mobile IA keeps five bottom tabs: Home, Notices, Community, Participation, and Student Council.
- 2026-10-04 WP1/WP9 deployment decision: extend the existing GCP single-VM ingress with canonical `https://www.aisw-campus.com`; redirect the apex domain to it and retain the existing public-IP HTTPS endpoint for installed clients. Public domain identity is committed separately from operator-owned secrets; certificates remain in the existing durable volumes with automatic renewal.
- Per the 2026-09-17 user correction (WP5/WP9 P0), activity-certification authors can load their saved bank account in the authorized edit context and change it without re-entering it on every edit. Ordinary member list/detail responses still redact the account; other members cannot access the edit response.
- Mutual-aid application content is readable by authenticated members. Per the 2026-09-17 user decision (WP5/WP9 P0), the author may view, remove or replace existing evidence while their request is processing through an explicitly authorized edit response. Administrators retain evidence access; other members and non-processing requesters receive `404 NOT_FOUND` for evidence lookup. Ordinary member detail/list responses continue to omit evidence.
- Uploaded media is member-only. The public `/uploads` mount is not part of the launch architecture; browser-rendered images and file downloads use short-lived signed URLs issued only after authorization.
- Email is the login identifier. A separate "find ID" flow is intentionally omitted; the login and recovery copy tells users to use their school email and provides password reset.
- Account deletion is irreversible. An authenticated member uses `DELETE /api/users/me` with `current_password`; a signed-out member can use the non-enumerating email request/verify flow. Every authored post/comment, including draft, hidden, deleted-status, and mutual-aid content, remains with its writing-time name/cohort snapshot. Connected media remains after only the account ownership link is removed; unattached uploads and account-only activity are deleted. Migration `0021_account_deletion_receipts` stores only a non-identifying completion receipt, and `0025_author_content_snapshots` supplies the historical author display fields.

## Current Project State

2026-10-08 WP6/WP8/WP9 P0 poll usability follow-up: implement the user's
approved audit findings within the existing notice/poll flow. Administrators see
first-response lock and separate application-deadline/manual-close guidance,
draft status, and a read-only member layout preview before save. Close confirmation
identifies the saved question and loaded count with immediate irreversible effects.
Save errors preserve the API reason; confirmed targeted recovery reloads only poll
settings while keeping unsaved notice fields and guarding stale completions.
The protected admin post page exposes a batched poll summary with distinct
respondents. Members see saved-answer receipts and progress across currently
answerable cards. No schema/provider/deployment change. Evidence:
`docs/qa/POLL_USABILITY_2026-10-08.md`.

2026-10-08 WP6/WP8/WP9 P0 poll visual alignment: the user requested closer
KakaoTalk styling after reviewing the visual differences. Retain white/blue
branding, notice embedding and existing binary/admin-close behavior. Use compact
flat option rows, thin result bars, subdued horizontal actions and plain named
participant rows with circular cohort badges. Poll status uses a full-screen
view below 600px and a bounded dialog on larger screens. The shared Council
person-card default remains; polls opt into a plain variant. No route, API,
database, dependency or deployment change. Evidence:
`docs/qa/POLL_VISUAL_DESIGN_2026-10-08.md`.

2026-10-07 P0 Kakao poll parity follow-up (WP6/WP8/WP9): the user authorized
comparison, runtime verification and gap fixes without another approval pause.
Keep the approved binary/single-choice/admin-close rules. Add always-reachable
option counts, option/member/nonparticipant status views, administrator copy,
positive-vote winners, manual refresh and web keyboard/ARIA support. Nonparticipants
are current active accounts authorized to read the notice, not a chat membership
snapshot; expose only the existing public name/cohort profile. Stable per-card
identity preserves pending selections when another card changes. No new database
schema or provider. Public screenshot comparison and verification limits:
`docs/qa/KAKAO_POLL_PARITY_2026-10-07.md`.

2026-10-07 WP6/WP8/WP9 P0 notice-editor follow-up: the requested application
deadline uses the existing calendar/time controls and KST-to-UTC conversion.
Attached notice images can be inserted at a body cursor, followed by editable
text. Keep plain `posts.content`, protected post attachments and existing
metadata; `notice_body` version 1 stores only image IDs and UTF-16 text offsets.
No editor dependency, database change, or replacement of the app architecture.

2026-10-07 P0 attendance-poll correction (WP6/WP8/WP9), approved with “수정 진행”:
the AISW인의 밤 attendance use case supersedes the original generic P2 poll
settings below. One notice supports up to 20 independent cards, each with exactly
two editable text labels (default YES / NO), single choice, no automatic end date,
and administrator manual closure per card. Members may change their selection
until that card closes and inspect named choices in the existing Council cards.
First vote freezes only that card; other cards may be appended or edited. Migration
`0034_attendance_polls` adds per-card closure/first-vote fields and backfills legacy
manual closure/locks without changing IDs, ballots or media. Nonbinary/date/photo/
multiple-choice legacy results remain readable; old automatic deadlines no longer
apply. Notice application deadlines and body/image features remain separate.
Local preview only; PostgreSQL migration/deployment and native runtime checks remain
outside this change. Design/verification: `docs/qa/ATTENDANCE_POLLS_2026-10-07.md`.

Historical baseline, superseded above: requested P2 notice polls (WP6/WP8/WP9): the user requested the
KakaoTalk-style poll flow embedded only in notice posts. Administrators alone
create/configure/edit/close polls; members vote, change their votes, and inspect
who selected each option using the existing Council member-list card theme.
The user approved implementation with “구현”. The normalized poll domain,
administrator editor and member participation/results are implemented under
`0033_notice_polls`, preserving the existing post architecture. Settings freeze
after the first vote; deletion also requires the loaded revision. Local preview
uses its existing SQLite database; deployment and PostgreSQL migration are not
performed. Design and QA: `docs/superpowers/specs/2026-10-07-notice-polls-design.md`
and `docs/qa/NOTICE_POLLS_2026-10-07.md`.

2026-10-07 WP8/WP9 P0 participation follow-up: the user deferred the participation
button link until later. Club and networking guide registration/editing omits
the link field and accepts link-free saves. Keep existing stored URLs and API
support for earlier clients; preserve guide media requirements, operation-state
controls and activity-certification eligibility. This is a form/API requirement
correction within the existing board architecture.

2026-10-07 WP8/WP9 follow-up: user authorized implementation of all existing administrator tabs as separate web pages, preserving all operations and allowing provisional choices for later correction. Retain Expo Router and existing server/session/domain logic. Canonical nested admin routes share a persistent layout/controller; presentation is split by page. Old section links and native administration remain compatible. Dashboard receives daily content/detail and seven-day first-party member traffic from protected APIs; no external analytics provider. Implementation/decision ledger: `docs/superpowers/plans/2026-10-07-admin-pages.md` and `docs/qa/ADMIN_PAGES_DECISIONS_2026-10-07.md`.

Admin direction confirmed on 2026-10-07 (WP8/WP9): administrators will operate through the web. Preserve all current administration behavior while giving `/admin` a desktop console independent of the member app's 405px web frame. Reuse the existing Expo project, APIs, sessions, and domain rules; native administrators retain ordinary member features. The user approved the latest main-page mockup and requested implementation with “메인부터 작업 시작”. The main, desktop shell, protected daily overview, first-party member traffic and expanded audit coverage are implemented. Existing editors and dashboard remain reachable; their new designs remain under review in `docs/superpowers/specs/2026-10-07-web-only-admin-console-design.md`.

2026-10-07 admin main implementation (WP8/WP9): `/admin` defaults to main on web and shows seven daily metrics above pending work, paginated mutual-aid/suggestion lists and five recent administrator actions. SQL filters the complete dataset before pagination: old pending records remain, and completed/rejected/answered records require a current KST review/reply timestamp. Request processing uses existing protected APIs inside the web shell and refreshes the main/logs after success. Removed guidance and quick actions stay absent. Administrator post/comment changes now join existing control logs, with no-op processing preserving handling timestamps. Traffic is P1 basic statistics, uses authenticated ordinary-member app/web route events under the existing member-only access policy, and excludes administrators and guests. Apply Alembic `0032_admin_usage` before starting this backend. New seven-day dashboard trends and metric/date drilldown remain the next dashboard slice; the main's metric links currently open the existing dashboard. Verification and local PostgreSQL/Docker limitations: `docs/qa/ADMIN_MAIN_WEB_2026-10-07.md`.

This repository already has the correct broad architecture.

- Frontend: Expo Router, React Query, Zustand, React Hook Form + Zod direction.
- Backend: FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL.
- Implemented core: boards, posts, comments, likes, bookmarks, auth foundation, search foundation, media foundation, events, FAQ, notifications.
- Local release-engineering gate verified on 2026-07-27: SQLite and isolated PostgreSQL each passed 104/104 backend tests; the isolated Compose stack reached `0021_account_deletion_receipts`; clean, `0019`→head, `0021`→`0019`→`0021`, and exact unversioned `0001` recovery paths passed; unknown schemas remained fail-closed. PostgreSQL dump/restore and media tar/restore rehearsals also passed.
- An isolated Windows short-path rehearsal built a temporary unsigned Android release AAB from the same 115 frontend source files. Bundletool validation, API 36, 16 KB page alignment, release-manifest security, and an extracted-artifact Gitleaks scan passed. That disposable artifact contained placeholder identity/development strings and was not a signed production or store candidate.
- A provider-neutral operational-alert adapter now covers unhandled API exceptions, notification worker failures, and push send/ticket/receipt failures with structured non-PII context. Production startup requires an approved HTTPS webhook; provider selection, secret registration, routing, and live delivery remain external operations work.
- Store readiness is tracked separately. Android branding/native identity, 10 EAS public production values, and the new-registration upload key are prepared. On 2026-09-09 the user deferred remote push; strict checks pass with the explicit disabled flag and Firebase/FCM activation is later-release work. Signed AAB `outputs/android/AI-SW-CAMPUS-0.1.0-2.aab` was generated and passed bundle, signature, API 36, 16 KB alignment, and secret-scan checks. Final policy content, physical-device QA, Play submission, and iOS archive remain open; see `docs/qa/ANDROID_BRANDING_2026-09-08.md`.

### Navigation decision: one stack per bottom tab (2026-10-07)

The five bottom tabs no longer share a hidden `board` tab. `app/(tabs)/(home,notices,community,participation,council)/` is an Expo Router shared-route group: every tab owns its own native stack containing its root screen plus the board, post, create/edit, search, notifications, FAQ, and My Page (settings) screens. A screen opened from a tab is pushed onto that tab's stack, so the stack order is the order the user saw.

- Why: iOS edge-swipe back is performed by UIKit and pops whatever screen is underneath. With the shared hidden board stack, the screen underneath could be an unrelated earlier post (e.g. Participation post → Community post → swipe showed the Participation post), while header Back and Android Back followed `returnTo` to the correct list. Hidden-tab roots (search, notifications, FAQ, My Page) could not be swiped at all, and visited posts accumulated in the hidden stack.
- Rule: header Back, Android Back, iOS swipe, and browser Back all return to the previous screen in the current tab. `returnTo` remains only as a fallback when there is no screen underneath (web refresh, direct link).
- Tab press and tab-root navigation use `utils/tabNavigation.ts` (`navigateToTabRoot`), which switches the tab and pops its stack to the root. Plain `router.navigate("/(tabs)/<tab>")` must not be used inside tabs because it would push that tab's root onto the current stack.
- Screens with in-screen back states (post menus/sheets, board search/sort, cohort/past-council detail, create date picker and completion, edit board menu) intercept only the iOS swipe through `hooks/useSwipeBackInScreen.ts`, matching Android Back.
- A post opened from a push notification opens on the Home stack as Home → Notifications → post, matching the previous Android Back order.
- The bottom-tab highlight keeps the previous rule for board lists and posts: they highlight their board's category tab (a Community post opened from Home highlights Community) even though Back returns to Home. Other screens highlight the tab that owns the stack.
- The member account-deletion screen keeps the bottom tab bar, matching the shipped app. The 2026-08-16 rule to hide it there had never taken effect (the old highlight tab bar rendered the last visible tab's options) and was removed rather than activated by this restructure.
- My Page screens are pushed with the drawer still covering them; the drawer is lifted only after native-stack reports `transitionEnd`, so the underlying tab does not flash (600 ms fallback; web does not wait).

Phase 2 converted the Notion planning into concrete API, DB, auth, route, and implementation documents. Phase 3 and Phase 4 should now be treated as development sprints.

## Phase 2 Source Documents

- `docs/phase2/API_CONTRACT.md`
- `docs/phase2/DB_SCHEMA_DECISIONS.md`
- `docs/phase2/AUTH_PERMISSION_SPEC.md`
- `docs/phase2/FRONTEND_ROUTE_SPEC.md`
- `docs/phase2/IMPLEMENTATION_SEQUENCE.md`
- `docs/phase2/PHASE2_REVIEW_CHECKLIST.md`

## Phase 3 Notion Plan

| Task | Status in repo | Dates | Development meaning |
| --- | --- | --- | --- |
| Project initial setup | Implemented; policy/QA pending | 2026-05-01 to 2026-05-04 | CI, env examples, lint/test/typecheck/export commands, and backend/frontend separation exist. Branch policy remains repository administration. |
| DB build and initial data setup | Implemented; `0021` smoke and restore passed | 2026-05-01 to 2026-05-08 | Clean and legacy migration paths, reversible `0021`↔`0019` rehearsal, environment-scoped seed data, reset guards, 104 PostgreSQL tests, dump/restore fingerprints, and media checksum restore passed in isolation. Production startup creates no user and preserves operator-edited reference content; the first administrator is promoted through the one-time production bootstrap command. |
| Auth/login feature development | Implemented; deployment/device QA pending | 2026-05-04 to 2026-05-11 | Login, email verification, password reset UI/API, refresh/logout, Argon2id migration, and persistent rate limits exist. Production SMTP and physical-device session QA remain. |
| User profile feature development | Implemented; device QA pending | 2026-05-04 to 2026-05-11 | Profile/account UI and protected profile image upload exist. Signup names are real-name display fields and allow duplicates; email remains the unique account identity. Verify picker/session behavior on physical devices. |
| Core feature A: boards/community | Implemented; integration QA pending | 2026-05-18 to 2026-05-31 | Boards/posts/comments/reactions/search/protected media, pagination, and reports exist. Draft autosave is deferred; mobile route polish remains QA. |

## Phase 4 Notion Plan

| Task | Status in repo | Dates | Development meaning |
| --- | --- | --- | --- |
| Core feature B: notifications/notices | Implemented; device delivery QA pending | 2026-06-01 to 2026-06-14 | Notice workflows, notification triggers/settings, Expo push token/provider adapter, ticket/receipt tracking, and local fallback exist. Production FCM/APNs credentials and physical-device delivery remain. |
| Core feature C: schedule/events | Implemented; device QA pending | 2026-06-14 to 2026-06-21 | Event API, Home calendar, day/detail screens, admin CRUD, and idempotent D-day/D-1 hooks exist. Recurring events are deferred to v1.1. |
| Admin page development | Implemented; roster/payment split visually verified | 2026-06-14 to 2026-06-25 | Admin exposes separate `원우 명부` and `원우회비` tabs. The permanent roster import inserts new student numbers and overwrites name/major for existing student numbers without deleting omitted alumni. Each current-term payment import validates the whole workbook, then replaces every prior `ALL`/`ONCE` payment with the uploaded rows as `ALL`; individual payment editing assigns `ALL`, one activity-board `ONCE`, or `UNPAID` while identity remains read-only. Keep both the protected route and backend admin dependencies. Evidence is recorded under `docs/qa/evidence/roster-dues-separation/`. |
| Frontend-backend full integration | Local P0 hardening passed; store/device QA pending | 2026-06-21 to 2026-06-28 | Current-head PostgreSQL/API/production-Compose/web checks and an unsigned Android release-bundle rehearsal pass. Physical Android/iOS, production credentials, signed native release builds, live hosting, and store submission inputs remain. |

## Product Scope To Preserve

Target IA:

- Bottom tabs: Home, Notices, Community, Participation, Student Council.
- Notices: academic notices, event notices.
- Sogang life schedule: calendar.
- Community: event album, resource sharing.
- Resource sharing: lecture reviews, exam archive, comprehensive exam.
- Participation: clubs, study groups, mentor networking.
- Student council: FAQ, council introduction, accounting link, suggestions, mutual aid, cohort representatives. Per the 2026-09-10 user decision, remove the activity-history menu from the shared web/mobile council hub; retain existing content and administrator management.
- Settings.

P0 features:

- Password reset.
- Logout.
- School email verification.
- Required post title.
- Pinned/highlighted notice posts.
- Post CRUD.
- 2-depth comments/replies.
- Likes/bookmarks.
- Global search.
- Board-scoped search/filter.
- Search keyword highlighting.
- IA redesign.
- Quick menu.
- Implemented a permanent student roster plus a separate replaceable current-term payment table for subsidy activity-certification participants. Admin identity XLSX upserts never delete omitted alumni; each payment XLSX replaces all prior `ALL`/`ONCE` rows, while individual editing assigns `ALL`, one-board `ONCE`, or `UNPAID`. Board-specific black/gray presentation keeps every roster row selectable.

P1 features:

- Basic web-admin daily activity and traffic metrics requested on 2026-10-07: yesterday/today posts and comments, visits, visitors and page views. Design only; advanced analytics and external analytics providers remain outside this request.
- Draft autosave.
- Optimized image upload with progress.
- Recent search suggestions.
- Basic push notifications: deferred to a later release by the user on 2026-09-09. The first Android release keeps in-app notifications and polling; native permission/token registration is disabled with `expo.extra.pushNotificationsEnabled=false`. Firebase/FCM setup resumes when push is enabled.
- My activity history.

P2 features:

- Dark mode.
- Polls.
- Tags.
- Advanced filters.
- Mentions.

## Phase 3 Execution Order

1. Run Docker runtime smoke test: migration, seed, health, auth, board, post, media, search, event, FAQ, notification.
2. Add CI and env examples.
3. Finish password reset mobile UI and account/profile UI.
4. Wire profile image and post attachment upload into mobile screens.
5. Polish community UX: pagination, empty states, permission errors, anonymous display, report hooks.
6. Confirm the P0 permission matrix: guest content requests are denied, while authorized user/admin flows behave as specified.

## Phase 4 Execution Order

1. Add notification trigger rules and push-token model.
2. Add FCM/APNs provider adapter with local no-op fallback.
3. Add notice/admin workflows.
4. Add Home event calendar plus day/detail/admin screens.
5. Build admin surface for launch-critical content and moderation.
6. Run frontend-backend full integration checks.
7. Produce Phase 5 QA handoff with known issues and test matrix.

## Go/No-Go Gates

Phase 3 can start when:

- Phase 2 API/DB/auth/route documents are accepted.
- Docker runtime blocker is resolved or explicitly tracked.
- UI token/Figma gaps are either resolved or marked as implementation-safe.

Phase 4 can start when:

- Auth/session/profile/community core flows work end to end.
- Board, post, comment, like, bookmark, search, and media flows pass smoke testing.
- Permission behavior is verified from backend APIs.

Phase 5 QA can start when:

- All P0 mobile routes are reachable.
- Guest/user/admin permissions, mutual-aid owner scope, and media access are verified by API tests.
- Backend compile checks and frontend typecheck pass.
- Alembic has one head at `0029_roster_dues_separation`. The local migration/model regression passes; the latest isolated PostgreSQL rehearsal passed through `0024`, while the `0029` PostgreSQL rehearsal remains pending because Docker Desktop was unavailable during the 2026-09-23 verification.
- Known issues are tagged as `Phase 5 QA`, `v1.1`, or `blocked`.

Checked on 2026-07-27: these local entry conditions pass. This is not a store-release approval. Signed mobile artifacts, physical-device checks, live-host checks, the 18 external release inputs, and the frontend dependency-risk decision remain open and are tracked in `CODEX.md`.

Checked on 2026-08-02: the backend suite passes 185 tests, and isolated PostgreSQL clean upgrade plus
`0021`→`0022`→`0021`→`0022` migration rehearsal passes. Legacy source workbooks and CSV exports
remain local-only migration inputs because they contain personal data and the repository is public.

Checked on 2026-08-04: the local backend suite passes 203 tests, Alembic reports the single
`0024_faq_attachments` head, and the frontend typecheck/lint plus focused legacy-media display tests
pass. An isolated PostgreSQL database passed the clean upgrade and `0023`→`0024`→`0023`→`0024`
rehearsal. The full 605-file legacy source was imported into an isolated PostgreSQL review database;
594 supported files passed DB/filesystem verification and the live web review loaded the 14-image
deduplicated photo post plus the 1-image and 2-image FAQ entries successfully.
