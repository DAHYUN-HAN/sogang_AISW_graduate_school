# Phase 2 Auth and Permission Spec

2026-10-08 WP5/WP8/WP9 hardening: irreversible account deletion reloads the user after acquiring its row lock, so an administrator password reset invalidates a credential cached earlier in that request. Mutual-aid evidence serialization and media access enforce the existing processing-author/admin policy, including legacy public assets. Administrator web confirmation queues and delayed alert callbacks belong to one authenticated session and are discarded on session replacement/logout without executing their actions.

API requests retain their originating login generation in memory. A late 401 from an earlier login cannot replay a mutation with replacement credentials or clear the replacement session. Re-dispatch checks the same generation; refresh single-flight keys include generation and token. Normal token rotation and same-principal profile updates preserve the login generation, while logout/new login changes it. This adds no HTTP header or backend API field.

2026-10-07 WP6/WP8/WP9 notice polls: settings (including removal) and immediate
close require explicit backend administrator checks. Poll participation uses
only the authenticated account ID; request payloads cannot impersonate voters.
All readable-notice members may inspect named results/participants. Participant
responses exclude email, telephone, company and dues/roster fields. Read access
follows the parent notice; votes require published post/active board and an open
poll. Poll images use authenticated parent-post media authorization and existing
signed URLs. Account-specific React Query keys isolate poll/participant state.
P0 attendance correction: only one choice per card, independent revoting until
that card's administrator closure. First vote permanently freezes that card's
structure, including after all voters delete their accounts; other cards remain
editable/addable. Legacy date/multiple/photo/nonbinary cards are results-only.
Question-scoped participant queries expose only that card's answers and validate
option ownership. Stale setting/removal revisions are rejected by the server.

Kakao parity follow-up: `participation=not_voted` requires an owned question and
no option filter. Its audience excludes inactive accounts and that card's voters;
admin-only/inactive boards and unpublished notice visibility also restrict the
audience. Caller access still goes through the parent notice authorization.
Only user_id, nickname, cohort and empty answers are returned. No contact details
or general member-directory endpoint is added. Participant cache keys additionally
isolate question, option, participation mode and page. Administrator duplication
creates an unsaved new card and uses the existing protected post save; it cannot
copy ballot identities or reopen the source. Verification:
`docs/qa/KAKAO_POLL_PARITY_2026-10-07.md`.

2026-07-05 override: `정책_정의서_260705.pdf` changes the launch access model to a member-only app. `guest` users may use login, signup/email verification, password reset, public account-deletion request/verify, token refresh, registration options, legal/support screens, and health/docs only. Board, post, comment, search, event, FAQ, media, banner, notification, settings, and admin APIs require an authenticated user unless a later policy document explicitly re-opens a public route. A signed media file URL is a short-lived capability issued only after an authenticated authorization check.

Status: implemented baseline, checked 2026-07-27

## 1. Roles

| Role | Meaning |
| --- | --- |
| `guest` | Not logged in |
| `user` | Verified active student/alumni user |
| `admin` | Student council/admin operator |

Role hierarchy:

`admin` includes `user` permissions.

## 2. Session Strategy

Use:

- Short-lived JWT access token.
- Long-lived opaque refresh token stored hashed in DB.
- Refresh-token rotation on every refresh.
- Logout revokes refresh token.

Recommended expiry:

- Access token: 15 minutes.
- Refresh token: 30 days.
- Email verification code and resend cooldown: 5 minutes.
- Password reset token: 30 minutes.

## 3. Password Rules

Minimum:

- 8 characters.
- Include at least one ASCII letter, one number, and one special character.

Recommended:

- Reject common leaked passwords later.
- New and changed passwords use Argon2id.
- Existing PBKDF2 hashes remain readable and are upgraded to Argon2id after a successful login.

## 4. School Email Rules

Allowed domains:

- `sogang.ac.kr`

Implementation:

- Domain check is case-insensitive.
- Send a six-digit numeric verification code.
- Store only code hash.
- Never include verification or reset codes in API responses or client-visible development fields.
- Expire codes and block verification after five failed attempts.
- Rate limit request by email and IP.
- Registration requires the currently active administrator-managed major option.
- Registration requires the current privacy-policy version and stores both the accepted version and consent timestamp on the user.

## 5. Permission Matrix

| Feature | Guest | User | Admin |
| --- | --- | --- | --- |
| Read boards/content | No | Yes | Yes |
| Read post detail | No | Yes | Yes |
| Create regular post | No | Yes | Yes |
| Create activity certification | No | Yes | Yes |
| Search permanent roster with board-specific paid boolean | No | Yes | Yes |
| List permanent roster and current-term payments | No | No | Yes |
| Import roster upsert or full current-term payment replacement | No | No | Yes |
| Update one roster member to ALL, ONCE, or UNPAID | No | No | Yes |
| Create study recruitment | No | Yes | Yes |
| Create club/networking guide post | No | No | Yes |
| Create notice | No | No | Yes |
| Create/update club guide posts | No | No | Yes |
| Pin notice/post | No | No | Yes |
| Update own post | No | Yes | Yes |
| Update others' posts | No | No | Yes |
| Delete own post | No | Yes | Yes |
| Delete others' posts | No | No | Yes |
| Comment | No | Yes | Yes |
| Edit own comment | No | Yes | Yes |
| Delete own comment | No | Yes | Yes |
| Delete others' comments | No | No | Yes |
| Like/bookmark | No | Yes | Yes |
| Suggestion post | No | Yes | Yes |
| Official suggestion reply | No | No | Yes |
| Manage council content except suggestion/mutual aid submissions | No | No | Yes |
| FAQ admin CRUD | No | No | Yes |
| Event admin CRUD | No | No | Yes |
| Guide/admin content CRUD | No | No | Yes |
| Profile edit | No | Own only | Own/all if later needed |
| Notification settings | No | Own only | Own only |
| Read mutual-aid requests/comments | No | Yes | Yes |
| Read/open/download mutual-aid evidence | No | Own readable processing request only | Yes |
| Issue media access URL | No | Authorized media only | All |

## 6. Board Write Policy

`boards.write_permission` values:

- `guest`: public write. Avoid in Phase 2.
- `user`: verified users.
- `admin`: admins only.

Rules:

- Backend must enforce this, not frontend only.
- Frontend may hide buttons based on permission, but hidden UI is not security.
- The `club-promo` and `networking-programs` boards are seeded and migrated with `write_permission = admin`; the post API also applies an explicit admin guard for defense in depth.
- `study-recruit` and all activity certification boards remain user-writable. Activity bank-account metadata remains hidden from ordinary member list/detail responses. Per the 2026-09-17 user correction, `GET /api/posts/{id}?for_edit=true` returns the stored account to the authenticated post author or an administrator after edit authorization. Other members cannot request this edit context. Other sensitive metadata keeps its existing restrictions.
- Activity-certification participants are resolved only from the independent permanent `student_roster`. Member-account enrollment, activation, and legacy dues fields grant no participant eligibility. Only admins may list or upsert roster identities, list current-term payment details, replace the entire term payment table, or mutate one roster member to `ALL`/`ONCE`/`UNPAID`. The payment workflow cannot edit identity. Authenticated members receive bounded name-only results plus a board-specific `is_paid_for_board` boolean; raw scope and board assignment are not exposed. `UNPAID` and different-board `ONCE` rows remain selectable, and the post API validates roster existence rather than payment status.
- Every `council`/`gsa` board is admin-writable unless its board type is `suggestion` or `mutual_aid`.
- Cohort-leader registration is stored through the admin-only board management API; members can read the configured cohort introductions but cannot create or edit them.
- Past-council records use a separate admin-only board metadata area. FAQ remains a separate dedicated table/API; neither mutation path is available to members.
- Suggestions remain anonymous in member and admin presentation. Only the admin reply endpoint can set an official answer and `answered` requires reply text.
- Mutual-aid submission content and status are readable by authenticated members. Ordinary member list/detail responses omit evidence. An explicit `GET /api/posts/{id}?for_edit=true` authorizes the processing request owner or administrator before returning evidence files, filenames and `metadata.proof_url`. Other members cannot request this edit response; evidence metadata/access lookup returns `404 NOT_FOUND` for peers or non-processing requesters, including legacy non-private evidence.
- A requester may edit a mutual-aid submission only while it is `processing`. They may delete a `processing` or `rejected` submission, but never a `completed` submission; the API enforces the state rule even when called directly.
- Draft and hidden posts are author/admin only across the same paths, while `deleted` status is admin-only; changing a previously readable post to an unpublished state removes it from other members' activity history and media authorization.
- The backend does not mount the upload directory. It issues short-lived signed media URLs only after an authenticated metadata/access request passes object-level policy. Ordinary post attachments inherit post read policy; mutual-aid evidence is available to administrators or the readable processing request owner. Signed URLs already issued retain their original expiration; editing does not introduce token revocation. Removing an attachment detaches its post relation without physically deleting bytes.

## 7. Anonymous Writing

Rules:

- Allowed only when `boards.allow_anonymous = true`.
- Store real `author_id`.
- Return `author_id = null`, `author_nickname = "Anonymous"`, and no cohort to non-admin readers other than the author when `is_anonymous = true` or the board forces anonymous presentation. The author may receive their own ID for edit/delete controls, but their displayed name stays anonymous.
- Non-admin author-name search never matches an anonymous post. Author blocking is not applied to anonymous or forced-anonymous posts because appearance/disappearance would reveal identity; those posts remain reportable.
- Admins can still see moderation identity if needed.
- An anonymized account-deletion author is different from an anonymous post. After deletion the real user row no longer exists, `author_id` is null for retained public content, and every reader sees `Deleted user`; administrators cannot recover the deleted identity from the content row.

## 8. Comment Depth

Notion scope says 2-depth comments.

Rules:

- Root comment: `parent_id = null`.
- Reply: `parent_id` points to root comment.
- Reply to reply is rejected with `BAD_REQUEST`.

## 9. Backend Dependencies

Required FastAPI dependencies:

- `get_current_user_optional() -> User | None`
- `get_current_user() -> User`
- `require_admin() -> User`
- `require_post_owner_or_admin(post_id) -> User`
- `require_comment_owner_or_admin(comment_id) -> User`
- `require_board_write_permission(board_id) -> User`

Remove:

- Fixed `CURRENT_USER_ID = 1` for write operations.

## 10. Frontend Auth State

Store:

- `accessToken`
- `refreshToken`
- `user`
- `isAuthenticated`

Rules:

- Attach access token through Axios interceptor.
- On 401, attempt one refresh.
- If refresh fails, clear auth state and route to login.
- Logout clears local state and calls backend logout when possible.

## 11. Login Identifier Recovery

- The school email is the login ID.
- v1 does not expose a separate "find ID" API because it would duplicate the email identifier and could enable account enumeration.
- Users who know their school email use the password-reset flow; login/help copy explains this decision.

## 12. Account Deletion Security

- Authenticated deletion uses `DELETE /api/users/me` and requires the current password in the request body.
- Signed-out deletion uses `POST /api/auth/account-deletion/request` followed by `/verify`; verification requires the school-email code and current password.
- The request endpoint returns the same accepted response for existing and missing accounts. Invalid account, code, or password at verification returns one generic error.
- Both paths are rate-limited. Verification codes are hashed, have attempt and expiry limits, and are never returned by the API or logged.
- The operation hard-deletes account PII, sessions/tokens, user-specific activity, and unattached owned uploads in one database transaction with staged-file rollback protection.
- Every authored post/comment remains regardless of status or board type. Before the user row is removed, missing writing-time name/cohort snapshots are filled and `author_id` is cleared. Every connected owned media asset remains with its `owner_id` cleared; filenames and bytes are unchanged.
- Anonymous and forced-anonymous content remains anonymous to non-admin readers. Administrators may resolve its live author or historical snapshot. Mutual-aid evidence remains administrator-only after account deletion.
- Administrators must transfer operational responsibility and be demoted by another administrator before self-deletion.
- The completion receipt is deliberately non-identifying. There is no fixed application-level legal retention claim; any receipt or backup interval requires explicit privacy-owner approval.

2026-09-17 client isolation (WP5/WP9): the root query cache and mounted form state are replaced when the authenticated principal (ID/role) changes; retired caches are cleared. Private edit responses and signed media URLs cannot carry over to the next account. Edit forms wait for a fresh mount fetch before their one-time hydration.

2026-10-07 admin main (WP8/WP9): `GET /api/admin/main` uses `require_admin`, including queue summaries and daily metrics. Its suggestion author labels/cohorts remain anonymous even to administrators. Detail/evidence uses the existing object-authorized post/media endpoints. New `POST /api/usage/page-views` uses `get_current_user`; guests are rejected, administrators are ignored, and server-derived HMAC pseudonyms represent ordinary members. Clients supply only bounded screen categories and UUID retry/device identifiers, not another member's identity. The collector is best-effort and cannot block navigation. `USAGE_TRACKING_ENABLED=false` disables writes. Account deletion removes current-key member usage records in the same deletion transaction, preserving other members' records. The request panel waits for fresh authorized detail, keeps failed drafts, confirms unsaved close/navigation and registers the browser's reload/close warning.

2026-10-07 board console (WP8/WP9): board create/update and the new recoverable
`DELETE /api/boards/admin/{id}` use explicit `require_admin`; ordinary-member
deletion is rejected by the API. Board-set and notice-category filters on
`GET /api/posts/admin/all` retain the same administrator dependency. Hiding
a board also hides descendants, and activating a child requires active
ancestors. Existing post/media authorization, private evidence protection,
anonymous suggestion presentation and native administration remain in force.

2026-10-07 WP8/WP9 member management: existing `PUT /users/admin/users/{id}`
now accepts bounded profile corrections through `require_admin`. Email/account
identity, password, consent records and legacy dues status remain outside the
accepted payload. The web UI removes role conversion and presents member search
and profile/status editing. Existing backend self-deactivation/self-demotion
protection and older role clients remain. Profile corrections preserve historical
author snapshots, and operational records include changed field names rather than
profile/contact values.

2026-10-07 WP8/WP9 administrator password reset: dedicated
`PUT /api/users/admin/users/{id}/password` requires `require_admin` and the existing
password policy (8–1024 characters on this endpoint). Admins specify a new password
without retrieving or verifying the member's old password. Argon2 storage, target
refresh revocation, active push deactivation, previous reset-token consumption and
a secret-free `user.password_reset` audit commit together. Login, refresh, public
reset confirmation and authenticated password changes share the user row lock;
cached users/tokens are reloaded before validation so an in-flight old credential
cannot bypass the reset. Existing access JWTs are not immediately revoked and may
remain valid for up to their default 15-minute lifetime. Self-reset in the web
editor clears local session/push storage and returns to login. No schema change,
email-provider requirement or changes to the ordinary recovery route.
