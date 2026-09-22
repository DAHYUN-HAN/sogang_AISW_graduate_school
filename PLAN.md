# AI·SW CAMPUS Phase 2-4 Plan

Source: Notion `App Development (New)` > `Community App Enhancement Schedule`.
Source plan checked on: 2026-04-25. Current implementation and release evidence checked on: 2026-07-27.
Scope: Phase 1 through Phase 4.

Policy update checked on 2026-07-05: `정책_정의서_260705.pdf`, `AISW UI.pdf`, and `AISW APP DESIGN GUIDE _ 260624.pdf` are the current product/UI override for implementation details. The app is member-only: non-members may access login, signup/email verification, password reset, token refresh, registration options, legal screens, and health/docs, but no content route.

QA 144 supersedes the 2026-08-02 D+2 decision: a new or changed mutual-aid event date is selectable from the current `Asia/Seoul` calendar date onward. KST today and future dates are allowed, and past days are rejected by both the mobile form and API. This replaces the earlier unconfirmed `event date ±30 days` proposal for the implemented lower bound; no maximum future horizon is introduced without a separate council policy decision.

Security/integration decision checked on 2026-07-27:

- The approved mobile IA keeps five bottom tabs: Home, Notices, Community, Participation, and Student Council.
- Mutual-aid application content is readable by authenticated members. Per the 2026-09-17 user decision (WP5/WP9 P0), the author may view, remove or replace existing evidence while their request is processing through an explicitly authorized edit response. Administrators retain evidence access; other members and non-processing requesters receive `404 NOT_FOUND` for evidence lookup. Ordinary member detail/list responses continue to omit evidence.
- Uploaded media is member-only. The public `/uploads` mount is not part of the launch architecture; browser-rendered images and file downloads use short-lived signed URLs issued only after authorization.
- Email is the login identifier. A separate "find ID" flow is intentionally omitted; the login and recovery copy tells users to use their school email and provides password reset.
- Account deletion is irreversible. An authenticated member uses `DELETE /api/users/me` with `current_password`; a signed-out member can use the non-enumerating email request/verify flow. Every authored post/comment, including draft, hidden, deleted-status, and mutual-aid content, remains with its writing-time name/cohort snapshot. Connected media remains after only the account ownership link is removed; unattached uploads and account-only activity are deleted. Migration `0021_account_deletion_receipts` stores only a non-identifying completion receipt, and `0025_author_content_snapshots` supplies the historical author display fields.

## Current Project State

This repository already has the correct broad architecture.

- Frontend: Expo Router, React Query, Zustand, React Hook Form + Zod direction.
- Backend: FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL.
- Implemented core: boards, posts, comments, likes, bookmarks, auth foundation, search foundation, media foundation, events, FAQ, notifications.
- Local release-engineering gate verified on 2026-07-27: SQLite and isolated PostgreSQL each passed 104/104 backend tests; the isolated Compose stack reached `0021_account_deletion_receipts`; clean, `0019`→head, `0021`→`0019`→`0021`, and exact unversioned `0001` recovery paths passed; unknown schemas remained fail-closed. PostgreSQL dump/restore and media tar/restore rehearsals also passed.
- An isolated Windows short-path rehearsal built a temporary unsigned Android release AAB from the same 115 frontend source files. Bundletool validation, API 36, 16 KB page alignment, release-manifest security, and an extracted-artifact Gitleaks scan passed. That disposable artifact contained placeholder identity/development strings and was not a signed production or store candidate.
- A provider-neutral operational-alert adapter now covers unhandled API exceptions, notification worker failures, and push send/ticket/receipt failures with structured non-PII context. Production startup requires an approved HTTPS webhook; provider selection, secret registration, routing, and live delivery remain external operations work.
- Store readiness is tracked separately. Android branding/native identity, 10 EAS public production values, and the new-registration upload key are prepared. On 2026-09-09 the user deferred remote push; strict checks pass with the explicit disabled flag and Firebase/FCM activation is later-release work. Signed AAB `outputs/android/AI-SW-CAMPUS-0.1.0-2.aab` was generated and passed bundle, signature, API 36, 16 KB alignment, and secret-scan checks. Final policy content, physical-device QA, Play submission, and iOS archive remain open; see `docs/qa/ANDROID_BRANDING_2026-09-08.md`.

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
| Admin page development | Implemented; QA pending | 2026-06-14 to 2026-06-25 | Admin surface covers launch-critical users, the independent dues-payer roster, notices, posts/comments, reports, FAQs, events, registration settings, and statistics. Keep both the protected route and backend admin dependencies. |
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
- Independent current dues-payer roster for subsidy activity-certification participants, with admin XLSX upsert and permanent-delete safeguards.

P1 features:

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
- Alembic has one head at `0024_faq_attachments`; the local migration/model regression and isolated PostgreSQL `0023`→`0024`→`0023`→`0024` rehearsal pass.
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
