# Phase 2 API Contract

2026-07-05 override: `정책_정의서_260705.pdf` supersedes Phase 2 guest-read assumptions for launch. Auth endpoints remain guest-capable, but content APIs now require a Bearer access token: boards, posts, comments, search, media, events, FAQs, banners, notifications, settings, reports, and admin APIs.

Status: implemented baseline, checked against the current code on 2026-07-27
Applies to: FastAPI backend and Expo frontend

## 1. Shared Rules

### Base URL

- Local: `http://localhost:8000/api`
- All endpoints below are relative to `/api`.

### Response Envelope

Success:

```json
{
  "status": "success",
  "data": {}
}
```

Paginated success:

```json
{
  "status": "success",
  "data": [],
  "pagination": {
    "page": 1,
    "size": 20,
    "total": 120,
    "total_pages": 6
  }
}
```

Error:

```json
{
  "status": "error",
  "message": "Human-readable message.",
  "code": "MACHINE_READABLE_CODE"
}
```

### Common Error Codes

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | Invalid input or invalid state transition |
| 401 | `UNAUTHORIZED` | Missing, expired, or invalid token |
| 403 | `FORBIDDEN` | Authenticated but not allowed |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate email, duplicate like, invalid uniqueness |
| 422 | `VALIDATION_ERROR` | Schema validation failed |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server failure |

### Auth Header

```http
Authorization: Bearer <access_token>
```

### Pagination

List endpoints use:

- `page`: integer, default `1`, min `1`
- `size`: integer, default `20`, min `1`, max `100`

### Date Format

- Datetime fields use unambiguous ISO 8601 UTC strings ending in `Z`; existing UTC instants are not shifted when serialized.
- Date-only fields use `YYYY-MM-DD`.

## 2. Auth

### POST `/auth/login`

Auth: guest

Request:

```json
{
  "email": "user@sogang.ac.kr",
  "password": "password123"
}
```

Response:

```json
{
  "access_token": "jwt",
  "refresh_token": "opaque-token",
  "token_type": "bearer",
  "expires_in": 900,
  "user": {
    "id": 1,
    "email": "user@sogang.ac.kr",
    "nickname": "Jinsan",
    "cohort": "72",
    "role": "admin"
  }
}
```

Errors:

- `UNAUTHORIZED`: wrong email or password
- `FORBIDDEN`: inactive account

### POST `/auth/register/request-verification`

Auth: guest

Request:

```json
{
  "email": "user@sogang.ac.kr"
}
```

Response:

```json
{
  "email": "user@sogang.ac.kr",
  "expires_in": 300,
  "resend_in": 300,
  "email_sent": true
}
```

Rules:

- Only approved school domains are accepted.
- Initial allowed domain: `sogang.ac.kr`.
- Verification codes are delivered only by email and are never included in the API response.
- Verification codes expire after five minutes, and the same email cannot request another code during that five-minute cooldown.
- Rate limit by email and IP.

Errors:

- `VALIDATION_ERROR`: invalid domain
- `CONFLICT`: already registered email
- `VERIFICATION_RESEND_COOLDOWN`: a code was already issued less than five minutes ago
- `RATE_LIMITED`: too many requests

### POST `/auth/register/verify-email`

Auth: guest

Request:

```json
{
  "email": "user@sogang.ac.kr",
  "code": "123456"
}
```

Response:

```json
{
  "verification_token": "short-lived-token",
  "expires_in": 900
}
```

Errors:

- `VERIFICATION_CODE_INVALID`: invalid code
- `VERIFICATION_EXPIRED`: expired code
- `VERIFICATION_ATTEMPTS_EXCEEDED`: five failed attempts

### POST `/auth/register`

Auth: guest

Request:

```json
{
  "verification_token": "short-lived-token",
  "password": "Password123!",
  "nickname": "Jinsan",
  "cohort": "72",
  "major": "인공지능",
  "phone": "01012345678",
  "privacy_policy_version": "2026-07-12",
  "privacy_consent": true,
  "company": "WithWe",
  "job_title": "Developer",
  "position": "Lead"
}
```

Response: same as login response.

Rules:

- `password`: min 8 characters including a letter, number, and special character.
- `nickname`: required, max 50, normalized for surrounding/repeated whitespace. Duplicate real names are allowed.
- `cohort`: required, one to three numeric characters.
- `major`: required and must match a currently active administrator-managed major option.
- `phone`: required, Korean mobile number without separators.
- `privacy_policy_version`: required and must match the current active policy version.
- `privacy_consent`: must be `true`; the server records the accepted version and consent timestamp.
- `company`, `job_title`, `position`: optional profile fields collected at signup or later profile edit.

Errors:

- `PRIVACY_CONSENT_REQUIRED`: consent was not provided
- `PRIVACY_POLICY_VERSION_MISMATCH`: the policy changed during signup and must be accepted again
- `VALIDATION_ERROR`: the selected major is no longer active

### GET `/registration/options`

Auth: guest

Returns active major options and the current privacy-policy version required for signup.

### Registration admin endpoints

Auth: admin

- `GET /registration/admin/majors`: list active and inactive options
- `POST /registration/admin/majors`: create an active option
- `PUT /registration/admin/majors/{major_id}`: rename, reorder, activate, or deactivate
- `GET /registration/admin/privacy-policy`: get the active version
- `PUT /registration/admin/privacy-policy`: activate a version and effective timestamp

At least one major option must remain active. All changes are recorded in operational audit logs.

### POST `/auth/refresh`

Auth: guest with refresh token

Request:

```json
{
  "refresh_token": "opaque-token"
}
```

Response:

```json
{
  "access_token": "jwt",
  "refresh_token": "rotated-opaque-token",
  "token_type": "bearer",
  "expires_in": 900
}
```

### POST `/auth/logout`

Auth: user

Request:

```json
{
  "refresh_token": "opaque-token"
}
```

Response:

```json
{
  "logged_out": true
}
```

### POST `/auth/password-reset/request`

Auth: guest

Request:

```json
{
  "email": "user@sogang.ac.kr"
}
```

Response:

```json
{
  "accepted": true,
  "expires_in": 300,
  "resend_in": 300,
  "email_sent": true
}
```

Rule:

- Always return `accepted: true` to avoid account enumeration.
- The six-digit code is delivered only by email and never included in the response.
- The code expires after five minutes, and another code is not issued for the same address during that period.

### POST `/auth/password-reset/verify-code`

Auth: guest

Request:

```json
{
  "email": "user@sogang.ac.kr",
  "code": "123456"
}
```

Response:

```json
{
  "verification_token": "short-lived-token",
  "expires_in": 900
}
```

Errors:

- `VERIFICATION_CODE_INVALID`: invalid code
- `VERIFICATION_EXPIRED`: expired code
- `VERIFICATION_ATTEMPTS_EXCEEDED`: five failed attempts

### POST `/auth/password-reset/confirm`

Auth: guest

Request:

```json
{
  "token": "reset-token",
  "new_password": "NewPassword123!"
}
```

Response:

```json
{
  "changed": true
}
```

Rule:

- A successful password reset revokes every active refresh token for the account.

## 3. Users

### GET `/users/me`

Auth: user

Response:

```json
{
  "id": 1,
  "email": "user@sogang.ac.kr",
  "nickname": "Jinsan",
  "cohort": "72",
  "major": "AI-SW",
  "phone": "010-0000-0000",
  "company": "WithWe",
  "job_title": "Dev Lead",
  "position": null,
  "profile_image_url": null,
  "profile_image_media_id": null,
  "role": "admin"
}
```

### PUT `/users/me`

Auth: user

Request:

```json
{
  "major": "AI-SW",
  "phone": "010-0000-0000",
  "company": "WithWe",
  "job_title": "Dev Lead",
  "position": null,
  "profile_image_url": null
}
```

Rules:

- A member cannot change their name/nickname or cohort through profile update.
- `major` must match a currently active administrator-managed major option.
- `profile_image_url` accepts only a ready, non-private image uploaded by the current member. The server stores its canonical `/api/media/{id}/access-url` reference; `null` or a blank value removes the profile image.
- `GET /users/me` returns the resolved `profile_image_media_id` so clients can request a fresh signed display URL.

Response:

```json
{
  "id": 1
}
```

### PUT `/users/me/password`

Auth: user

Request:

```json
{
  "current_password": "oldPassword123",
  "new_password": "newPassword123"
}
```

A successful password change revokes active refresh sessions and deactivates all registered push tokens. Account deletion removes the user's refresh and push records as part of the irreversible transaction.

### DELETE `/users/me`

Auth: user

Request:

```json
{
  "current_password": "currentPassword123!"
}
```

Response:

```json
{
  "deleted": true,
  "receipt_id": "c2467e45-494d-4e9a-b0cc-39a920a80d85",
  "completed_at": "2026-07-27T08:15:00"
}
```

Rules:

- The server verifies the current password; UI-only verification is never trusted.
- The operation is irreversible and rate-limited.
- Every authored post and comment remains regardless of board type, visibility, or `draft`/`published`/`hidden`/`deleted` status. The service fills missing writing-time name/cohort snapshots and then sets `author_id` to null.
- API author fields prefer a live user while present, then the stored snapshot, and use `Deleted user` only for legacy orphan rows that have neither. Anonymous/forced-anonymous responses remain `Anonymous` with no cohort for non-admin readers.
- Every owned media asset connected through `post_attachments` remains with `owner_id` set to null. The original filename and stored bytes are preserved; only unattached owned uploads are removed.
- Mutual-aid posts, `post_mutual_aid` data, evidence relations/files, and `proof_url` remain. Evidence metadata and access URLs are administrator-only.
- Sessions, reset/verification tokens, likes, bookmarks, reports, search history, blocks, notifications/settings, push tokens/deliveries, and account-linked rate-limit subjects are removed.
- Administrator self-deletion returns `409 ADMIN_ACCOUNT_DELETION_FORBIDDEN` until responsibilities are transferred and another administrator demotes the account.
- The receipt is non-identifying and contains no user ID, email, IP address, free-form reason, or deletion counts.

### POST `/auth/account-deletion/request`

Auth: guest

Request:

```json
{
  "email": "member@sogang.ac.kr"
}
```

Response for both known and unknown accounts:

```json
{
  "accepted": true,
  "expires_in": 300,
  "resend_in": 300
}
```

Rules:

- The endpoint is rate-limited by normalized email and request IP.
- It never returns a verification code or reveals whether an account exists.
- A code is retained only when SMTP delivery succeeds.

### POST `/auth/account-deletion/verify`

Auth: guest

Request:

```json
{
  "email": "member@sogang.ac.kr",
  "code": "123456",
  "current_password": "currentPassword123!"
}
```

Success response is the same `deleted`, `receipt_id`, and `completed_at` object as authenticated deletion.

Unknown account, invalid/expired code, and invalid password all return the same normalized error:

```json
{
  "status": "error",
  "message": "Invalid or expired account deletion request.",
  "code": "ACCOUNT_DELETION_INVALID"
}
```

### GET `/users/me/activity`

Auth: user

Query:

- `type`: optional, one of `posts`, `comments`, `bookmarks`
- `page`, `size`

Response item:

```json
{
  "type": "bookmark",
  "id": 45,
  "post_id": 123,
  "title": "Post title",
  "board_id": 1,
  "author_nickname": "Jinsan",
  "author_cohort": "72",
  "created_at": "2026-04-25T00:00:00Z"
}
```

Rules:

- For bookmark items, `created_at` is the bookmarked post's creation time. Bookmark ordering may still use the time at which the bookmark was saved.
- Anonymous or deleted authors return `author_cohort: null`.

### GET `/users/search`

Auth: user

Query:

- `q`: required, min length 1, searches nickname/cohort/major
- `size`: optional, default `8`, max `20`

Response item:

```json
{
  "id": 1,
  "nickname": "Jinsan",
  "cohort": "72",
  "major": "AI-SW"
}
```

Rule:

- Retained as a generic legacy member lookup; activity certification participant selection does not call this endpoint.
- Does not return email, phone, company, or account status.

### GET `/dues-payers/search`

Auth: user

Query: required `q` (name substring), required `board_id` (active `activity_certification` board), and optional `size` (default `8`, max `20`). Missing, inactive, unknown, or non-activity boards return `422 INVALID_DUES_BOARD`. Every name-matching row in the permanent `student_roster` table is returned as `{id, name, major, student_number, is_paid_for_board}`. The safe boolean is true only when the current-term `dues_payments` row is `ALL` or is `ONCE` for the requested board. The member response never exposes `payment_scope` or `once_board_id`; a missing payment row and a different-board `ONCE` row remain searchable and selectable with `is_paid_for_board: false`. User enrollment, activation, and legacy `users.dues_status` do not affect results.

### GET `/dues-payers/admin/roster`

Auth: admin

Query: optional `q`, `page`, and `size` (max `100`). Search matches name, student number, or major. Returns `{id, name, major, student_number}` with the shared pagination envelope; payment fields are intentionally absent.

### POST `/dues-payers/admin/roster/import`

Auth: admin. Multipart field: `file`, restricted to `.xlsx`.

The first sheet is read without a header as `name`, `major`, `student_number`. A valid workbook is an identity upsert keyed by normalized student number: it creates new roster rows, overwrites name and major on existing rows, keeps every row omitted from the workbook, and never changes `dues_payments`. Success returns `{created, updated, unchanged, total_rows}`. A concurrent conflicting roster write returns `422 ROSTER_IDENTITY_CONFLICT` without a partial commit.

### GET `/dues-payers/admin/payments`

Auth: admin

Query: optional `q`, `page`, and `size` (max `100`). Search matches roster name, student number, or major. The outer-joined roster result is `{id, name, major, student_number, payment_scope, once_board_id, once_board_name}`. `payment_scope` is `ALL`, `ONCE`, or derived `UNPAID` when no payment row exists. Board names are joined at read time, so renames are immediate. Deleting a referenced activity board cascades its `ONCE` payment row and makes that roster member read as `UNPAID`.

### POST `/dues-payers/admin/payments/import`

Auth: admin. Multipart field: `file`, restricted to `.xlsx`.

This endpoint replaces the complete current-term payment snapshot. Before any deletion, every workbook row must match an existing roster row by normalized student number and exact trimmed name; otherwise the entire upload returns `422 DUES_IMPORT_ROSTER_MISMATCH` and the previous payment table remains unchanged. After validation, every existing `ALL` and `ONCE` row is deleted and each uploaded roster member receives one `ALL` row. Success returns `{cleared, registered, total_rows}`. An empty workbook is rejected, so clearing the term is never an accidental upload side effect.

Both imports share the fixed global 10 MiB (`10485760` bytes) file limit used by media uploads. Any partial blank row, non-`A` plus five-digit student number, populated fourth column, duplicate normalized student number, empty workbook, malformed workbook, or oversized upload rejects the entire operation. Parser validation codes are `DUES_IMPORT_EMPTY_VALUE`, `DUES_IMPORT_INVALID_STUDENT_NUMBER`, `DUES_IMPORT_DUPLICATE_STUDENT_NUMBER`, `INVALID_DUES_WORKBOOK`, and `PAYLOAD_TOO_LARGE`. Audit details contain aggregate counts only.

All administrator roster/payment mutations (both imports and individual payment updates) share one transaction-scoped PostgreSQL advisory lock so a full payment replacement cannot interleave with a roster upsert or individual scope edit.

### PUT `/dues-payers/admin/payments/{roster_member_id}`

Auth: admin

Request: `{payment_scope, once_board_id}`. Roster identity is read-only. `payment_scope` is `ALL`, `ONCE`, or `UNPAID`; `ONCE` requires one active activity-certification `once_board_id`, while the other scopes require null. `ALL` upserts a payment row and clears its board, `ONCE` upserts one board-specific row, and `UNPAID` deletes the payment row. Missing roster members return `404 ROSTER_MEMBER_NOT_FOUND`; invalid scope/board pairs return `422 INVALID_DUES_SCOPE` or `422 INVALID_DUES_BOARD`. Success returns the joined administrator payment item. Audit details contain only roster ID and scope fields, never name, major, or student number.

### GET `/users/me/blocks`

Auth: user

Response item:

```json
{
  "id": 1,
  "blocked_user_id": 2,
  "blocked_user_nickname": "Blocked user",
  "reason": "post_detail",
  "created_at": "2026-06-21T00:00:00Z"
}
```

### POST `/users/me/blocks`

Auth: user

Request:

```json
{
  "blocked_user_id": 2,
  "reason": "post_detail"
}
```

Response:

```json
{
  "id": 1,
  "blocked_user_id": 2,
  "duplicate": false
}
```

Rules:

- Users cannot block themselves.
- Post lists, post search, and comment lists hide content from blocked authors for the authenticated user.

### DELETE `/users/me/blocks/{blocked_user_id}`

Auth: user

Response:

```json
{
  "blocked_user_id": 2,
  "blocked": false
}
```

### GET `/users/admin/users`

Auth: admin

Query:

- `q`: optional email, nickname, or cohort keyword
- `role`: optional `user` or `admin`
- `is_active`: optional boolean
- `page`, `size`

Response item:

```json
{
  "id": 1,
  "email": "user@sogang.ac.kr",
  "nickname": "Jinsan",
  "cohort": "72",
  "role": "admin",
  "is_active": true,
  "last_login_at": "2026-06-21T00:00:00Z",
  "created_at": "2026-04-25T00:00:00Z"
}
```

### PUT `/users/admin/users/{user_id}`

Auth: admin

Request:

```json
{
  "role": "admin",
  "is_active": true
}
```

Rules:

- Admins cannot remove their own admin role or deactivate themselves through this endpoint.
- `dues_status` is not an accepted field; extra fields are rejected. The legacy database column is not a roster-management API.

## 4. Boards and IA

### GET `/boards`

Auth: user

Response:

```json
[
  {
    "category": "notices",
    "label": "Notices",
    "boards": [
      {
        "id": 1,
        "name": "Academic Notices",
        "slug": "academic-notices",
        "board_type": "notice",
        "description": "...",
        "sort_order": 1,
        "permissions": {
          "read": "user",
          "write": "admin"
        }
      }
    ]
  }
]
```

### GET `/boards/{board_id}`

Auth: user

Response:

```json
{
  "id": 1,
  "name": "Academic Notices",
  "slug": "academic-notices",
  "category": "notices",
  "board_type": "notice",
  "description": "...",
  "sort_order": 1,
  "allow_anonymous": false,
  "is_active": true
}
```

### POST `/boards/admin` and PUT `/boards/admin/{board_id}`

Auth: admin

Activity-certification boards may store an optional image-layout contract in
`metadata.activity_image_layout`:

```json
{
  "version": 1,
  "default": {
    "max_width": null,
    "height": 400,
    "max_height": null,
    "fit": "contain",
    "expandable": true
  },
  "landscape": {
    "max_width": null,
    "height": 240,
    "max_height": null,
    "fit": "contain",
    "expandable": true
  },
  "portrait": {
    "max_width": null,
    "height": 400,
    "max_height": null,
    "fit": "contain",
    "expandable": true
  }
}
```

`default` is required. `landscape` and `portrait` are either the same rule
shape or `null`. Rule fields are required; `fit` is `contain` or `cover`,
`max_width` and `height` are nullable integers from 120 through 1600, and
`max_height` is a nullable integer from 120 through 2000. A non-null `height`
requires `max_height: null`. Unknown keys inside the layout or a rule are
rejected. The metadata key is accepted only when the board's final
`board_type` is `activity_certification`; malformed values and use on another
board type return `422 INVALID_ACTIVITY_IMAGE_LAYOUT`.

`max_width: null` means the available width, `height: null` means the source
aspect-ratio height, and `max_height: null` means no height cap. A matching
landscape or portrait rule wins over `default`; square images and unreadable
source dimensions use `default`. `fit` controls how the image is placed inside
the resulting frame. Per the 2026-09-12 user correction, participation images
do not expose a full-view button or viewer. `expandable` remains a required
boolean in the version-1 wire format for compatibility, but the current app
ignores its value and the administrator UI no longer offers this setting.

The key may be omitted. The app fallback uses full
available width, a fixed 400px default/portrait frame, a fixed 240px landscape
frame, `contain`, and `expandable: false`. Square images and images whose dimensions
cannot be read use the 400px default frame. Other board metadata keys remain
unrestricted. PUT retains its existing whole-metadata replacement semantics:
when `metadata` is present, callers must include every metadata key they intend
to preserve.

## 5. Posts

### GET `/boards/{board_id}/posts`

Auth: user

Query:

- `page`, `size`
- `q`: optional search keyword; activity-certification boards search title, content, and the displayed activity badge for all roles, excluding author names and participant metadata. Club badges use the current linked club-promo title, then a specific stored category or legacy activity name; networking badges use their category. Study cards have no badge and search title/content only. Other board search behavior is unchanged.
- `category`: optional type-specific category
- `status`: optional, used by suggestions
- `from_date`, `to_date`: optional date filter
- `sort`: `latest`, `popular`, `views`

Response item:

```json
{
  "id": 10,
  "board_id": 1,
  "title": "Notice title",
  "content_preview": "Preview text",
  "author_id": 1,
  "author_nickname": "Admin",
  "is_anonymous": false,
  "is_pinned": true,
  "is_notice": true,
  "view_count": 10,
  "like_count": 2,
  "comment_count": 1,
  "created_at": "2026-04-25T00:00:00Z",
  "highlights": {
    "title": "Notice <mark>title</mark>",
    "content_preview": "Preview text"
  }
}
```

Rules:

- When authenticated, posts written by blocked authors are excluded from the list.

### GET `/posts/feed`

Auth: user

Query:

- `scope`: required; `notices`, `resources`, or `council_activity`
- `page`: default `1`, minimum `1`
- `size`: default `20`, minimum `1`, maximum `100`
- `q`: optional non-empty search keyword
- `notice_category`: optional; `academic`, `event`, or `other`, valid only when `scope=notices`
- `sort`: `latest` (default), `popular`, or `views`
- `pin_priority`: boolean, default `true`; set `false` only when a caller needs pure sort-field order such as the Home two-row preview

Scope rules:

- `notices` combines active boards whose `board_type` is `notice`. Calendar boards are excluded. `notice_category` uses the client-visible academic, event/webinar, and other classifier. An explicit post category takes precedence over the board slug; blank or null categories fall back to the board slug. The `other` classifier recognizes `all`, `general`, `other`, and values containing `전체` or `기타`.
- `resources` combines active boards whose category is `resources`.
- `council_activity` combines legacy `council-activity` and `gsa-activity` board posts with notice posts whose `metadata.show_in_council_activity` value is `true`.

The response uses the shared paginated success envelope and the same post-list item fields as `GET /boards/{board_id}/posts`. The total is calculated after scope, active-board, read-permission, publication-status, soft-delete, search, notice-category, and blocked-author filters are applied. Author-name search and blocked-author filtering preserve anonymous and forced-anonymous board identity rules.

Ordering is deterministic across all selected boards:

- `latest`: `is_pinned DESC, created_at DESC, id DESC`
- `popular`: `is_pinned DESC, like_count DESC, comment_count DESC, created_at DESC, id DESC`
- `views`: `is_pinned DESC, view_count DESC, created_at DESC, id DESC`

When `pin_priority=false`, only the leading `is_pinned DESC` term is omitted; the remaining sort and ID tie-break rules are unchanged. The Home notice preview requests `scope=notices&page=1&size=2&sort=latest&pin_priority=false`. Notice and board list feeds retain the default pinned-first order.

Supplying `notice_category` for a non-notice scope returns normalized `422 VALIDATION_ERROR`.

### GET `/posts/{post_id}`

Auth: user

Response:

```json
{
  "id": 10,
  "board_id": 1,
  "title": "Notice title",
  "content": "Full content",
  "author_id": 1,
  "author_nickname": "Admin",
  "is_anonymous": false,
  "is_pinned": true,
  "is_notice": true,
  "view_count": 11,
  "like_count": 2,
  "comment_count": 1,
  "is_liked": false,
  "is_bookmarked": false,
  "attachments": [],
  "metadata": {},
  "created_at": "2026-04-25T00:00:00Z",
  "updated_at": "2026-04-25T00:00:00Z"
}
```

Rules:

- Content routes are member-only; missing or invalid credentials return normalized `401 UNAUTHORIZED`.
- A mutual-aid post owned by another member is returned as `404 NOT_FOUND`, not `403`, to avoid object-existence disclosure. Administrators can read all requests.
- Draft or hidden posts are readable only by their author and administrators; `deleted` status is administrator-only. The same rule applies to lists, detail, global search, activity history, comments, reactions, reports, and attached media.

### POST `/boards/{board_id}/posts`

Auth: user or admin, depending on board permissions

Request:

```json
{
  "title": "Post title",
  "content": "Post content",
  "is_anonymous": false,
  "attachment_ids": [1, 2],
  "metadata": {
    "category": "academic",
    "semester": "2026-1"
  }
}
```

Response:

```json
{
  "id": 10
}
```

Rules:

- `title` is trimmed, required for all boards, and limited to 100 characters.
- `content` is a required request field, is trimmed, and is limited to 10,000 characters. Its trimmed value must be non-empty except for `mutual_aid`, where it stores the optional remarks and an empty string is accepted. Image-only album storage may omit the persisted body only after the request has passed this validation.
- Anonymous writing is allowed only when `boards.allow_anonymous = true`.
- For anonymous or forced-anonymous posts, non-admin readers other than the author receive `author_id: null`, `author_nickname: "Anonymous"`, and no cohort. Author-name search and block-based filtering do not act as identity side channels; anonymous content remains reportable.
- `club-promo` and `networking-programs` posts are admin-only even if a stale board configuration says otherwise.
- Club guides expose a separate administrator-only `metadata.club_operation_status`: `active` (운영 중) or `ended` (운영 종료). Omitted legacy values default to active. Explicit null, unsupported strings, or non-string values return `422 INVALID_CLUB_OPERATION_STATUS`. Omitting this key on update preserves the stored status. The guide remains readable after operation ends; an unchanged existing certification link remains editable, but new selections are rejected. Admins can explicitly resume operations by saving `active`.
- These administrator-managed participation guide posts require at least one ready image attachment. The first image is the list-only representative thumbnail; later images are ordered detail images returned in `attachments` for display below the body. Create/update preserves the submitted attachment order.
- Their metadata requires an HTTP(S) `application_url`; the mobile detail CTA opens this administrator-managed URL. A legacy body line formatted as `참여 링크`, `가입 링크`, or `신청 링크` followed by an HTTP(S) URL is exposed only through `metadata.application_url` and is omitted from member-facing content. Create/edit canonicalizes the same duplicate line out of stored content, so the URL is rendered only by the CTA.
- `study-recruit` remains user-writable, so every authenticated member may create and manage their own study recruitment post.
- Club, study, and networking activity certification boards keep `write_permission = user`, so every authenticated member may submit an activity certification.
- Activity certifications require at least one ready image and reject non-image attachments.
- New activity certifications require a non-empty ordered list of unique positive `metadata.participant_dues_payer_ids`. Every ID must exist in the current roster; otherwise the API returns `422 INVALID_DUES_PAYER`. The server ignores client-supplied participant names, stores roster names in `metadata.participants`, and removes legacy `participant_user_ids`.
- A new `club-activity` certification, or an edit that changes its club source, requires a positive decimal-string `metadata.activity_source_post_id` that references a published, non-deleted post on the active `club-promo` board. The source must not have `metadata.club_operation_status = "ended"`; missing status means `active`. Recruitment closure (`category = 마감` or `recruitment_status = closed`) does not end club operations or prevent certification. The server ignores the client club category and stores the referenced guide post title; an invalid source returns `422 INVALID_ACTIVITY_SOURCE`.
- `club-activity` list/detail responses include nullable `activity_source_title`. The API resolves it from the linked `club-promo` post in bulk for lists, so an administrator rename is reflected in existing certification tags. An unchanged historical link may still resolve its last official title after the guide post is hidden or soft-deleted; a link to another board resolves to `null`.
- Activity-certification detail responses include ordered `activity_participants[]` entries with the stored display `label`, roster `id`, and nullable `is_paid_for_board`. Legacy name-only snapshots use `id: null` and `is_paid_for_board: null`.
- `is_paid_for_board` is a historical snapshot, not a live lookup. Support is granted on the activity as it stood, so a participant who was unpaid when the certification was written must keep the unpaid presentation after paying later. Whenever `metadata.participant_dues_payer_ids` is submitted, the server recomputes each participant's state against that board (`ALL` or matching `ONCE` is `true`) and stores it as `metadata.participant_dues_paid`, a boolean list parallel to the payer IDs. Client-supplied values for this key are ignored. An edit that leaves the participant list unchanged carries the stored snapshot over, so editing other fields never rewrites history. Detail reads never consult `dues_payments`; they return the stored list verbatim.
- Certifications written before `metadata.participant_dues_paid` existed, or whose stored list no longer matches the payer IDs, report `is_paid_for_board: null` for every participant. Their state at the time is unrecoverable: `dues_payments` keeps one row per member that is deleted when the member returns to unpaid, and the audit log records only the value after each change. Reporting `null` rather than recalculating keeps those posts fixed instead of drifting whenever payments change, and clients already render `null` with the paid styling. Reselecting the participants on such a post stores a fresh snapshot from that moment.
- `metadata.bank_account` is returned to admins and, only in an authorized `GET /api/posts/{id}?for_edit=true` response, the activity-certification author. Ordinary member list/detail responses still remove it. Unauthorized edit requests return `403 FORBIDDEN` (unauthenticated requests return `401`); this exception does not expose other sensitive metadata.
- Council/GSA boards are admin-managed except `suggestion` and `mutual_aid` board types; the post API applies this rule even if board permission data is stale.
- Suggestion list items expose `suggestion.status` as `received` or `answered`. Only admins can write the official reply; `answered` is rejected unless a non-empty official reply is supplied. A new or changed reply notifies the anonymous author without exposing their identity in the UI.
- Mutual-aid request content/status is member-readable. At least one private evidence attachment or evidence link is required, while `content` stores optional remarks and accepts an empty string. Ordinary member responses omit attachments and `metadata.proof_url`. `GET /api/posts/{id}?for_edit=true` requires the author/admin and an editable request state, and exposes existing evidence to the processing request author. Evidence metadata/access requests also allow this owner; peers and non-processing requesters receive `404 NOT_FOUND`. Legacy non-private evidence is subject to the same policy.
- A new mutual-aid `metadata.event_date` must be today or later in the current `Asia/Seoul` calendar date. Past dates return `422 MUTUAL_AID_DATE_TOO_SOON`; today and future dates are accepted. Both `YYYY-MM-DD` and the mobile form's `YYYY.MM.DD` storage value are parsed.
- Admin notice posts may set `metadata.show_in_council_activity = true`. Linked notices require an image in the admin UI and are reused as photo/text entries in the council activity history.
- Organization-introduction boards use administrator-managed structured metadata. `gsa-executives` stores one active entry in `boards.metadata.council_introductions[]` with `title`, `greeting`, `intro`, ordered `photo_urls[]`, `banner_image_url`, and a variable-length `members[]`; `gsa-cohort-leaders` and `gsa-past-councils` use the same detail fields under `cohort_leaders[]` and `past_councils[]`, keyed by cohort/council number. The first `photo_urls[]` item is the representative image and is mirrored to `banner_image_url`. Readers resolve organization-introduction images in this order: `photo_urls[]`, legacy `attachment_urls[]`, then `banner_image_url`. Every member stores `name`, `cohort`, `role`, and optional `image_url`; legacy `intro` values remain readable but are not rendered in fixed profile cards. Admin saves also retain the legacy fixed executive/captain/president fields so older mobile clients remain readable during rollout.
- Notice boards are admin-write only.
- Album posts require 1-20 image attachments, reject non-image attachments, and store no body text. Both create and update reject more than 20 attachments with HTTP `400` and error code `ALBUM_IMAGE_LIMIT_EXCEEDED`.

### PUT `/posts/{post_id}`

Auth: author or admin

Request: same as create, with an optional target board for resource-sharing edits.

```json
{
  "board_id": 12,
  "title": "Updated resource title",
  "content": "Updated resource content",
  "is_anonymous": false,
  "attachment_ids": [1, 2]
}
```

Response:

```json
{
  "id": 10
}
```

`board_id` may differ from the current board only when both the source and target are active boards with `category = resources` and `board_type = resource`. The API verifies the caller's target-board read/write permission and preserves the post ID, attachments, comments, likes, and bookmarks. Other cross-board moves return `400 BAD_REQUEST`.

For resource boards, the resolved target board is authoritative for `category`: `lecture-reviews`, `exam-archive`, `comprehensive-exam`, and `graduation-thesis` store `강의후기`, `시험족보`, `종합시험`, and `졸업논문` respectively. A stale or missing client category cannot override this mapping.

For mutual-aid requests, changing `metadata.event_date` applies the same KST-today minimum as creation. An unchanged historical date may be retained while other editable fields are updated, so an existing processing request does not become uneditable merely because time passed.
Members may update their own mutual-aid request only while its workflow status is `processing`. A `completed` or `rejected` request is immutable; administrators change workflow status only through the dedicated mutual-aid endpoint.

For activity certifications, authors can update `metadata.activity_date`, `metadata.participant_dues_payer_ids`, and `metadata.activity_source_post_id`; the server regenerates `metadata.participants` from the roster. For `club-activity`, a changed source must satisfy the current published-source rule above, while an unchanged hidden or soft-deleted historical source remains editable and re-canonicalizes the stored category from its last title. An unchanged historical record without dues-payer IDs may retain its old participant snapshot while other fields are edited, but changing that legacy participant list requires complete reselection from the current roster. The authorized edit response supplies the existing `metadata.bank_account` for prefilling. Omitting this key on update preserves the stored value; explicitly providing it updates the account. The form preserves the stored account when its input is left blank.

Existing `club-activity` rows can be audited without writes using `python scripts/normalize_club_activity_sources.py` from `backend/`. The command accepts an optional exact-match alias JSON file and changes data only with `--apply`; source-list problems or unmatched rows prevent guessed mappings and are reported for operator review.

### PUT `/posts/{post_id}/representative-image`

Auth: admin

Request:

```json
{
  "media_id": 42
}
```

Response:

```json
{
  "post_id": 10,
  "media_id": 42
}
```

This endpoint is limited to `club-promo` and `networking-programs`. The media must be a ready, public image. It replaces the first image attachment used by list thumbnails while preserving the post title, body, metadata, anonymity, deadline, ordered detail images, and every other attachment. The representative image is not rendered in guide detail. The endpoint intentionally does not run the full post-update validation, so an administrator can repair the representative image of a readable legacy guide whose stored metadata predates `application_url`.

### PUT `/posts/{post_id}/mutual-aid`

Auth: admin

Request:

```json
{
  "status": "rejected",
  "rejection_reason": "관계를 확인할 수 있는 증빙서류가 필요합니다."
}
```

Allowed status:

- `processing`
- `completed`
- `rejected`

### DELETE `/posts/{post_id}` mutual-aid policy

For a member deleting their own mutual-aid request, `processing` and `rejected` are allowed. A `completed` request returns `403 FORBIDDEN` and remains stored. The API enforces this independently of whether the mobile UI displays the delete action. Administrator moderation keeps its existing delete authority.

Rules:

- `rejection_reason` is required when status is `rejected`.
- A status change creates a council notification for the applicant.
- Activity-certification bank-account metadata is omitted from member-facing post list/detail responses. It is available only through the protected admin post list and admin detail reads; the admin UI renders it only in the selected activity-certification board's content-management list.

### DELETE `/posts/{post_id}`

Auth: author or admin

Response:

```json
{
  "id": 10
}
```

### PUT `/posts/{post_id}/pin`

Auth: admin

Request:

```json
{
  "is_pinned": true
}
```

### POST `/posts/{post_id}/like`

Auth: user

Response:

```json
{
  "post_id": 10,
  "is_liked": true,
  "like_count": 3
}
```

### POST `/posts/{post_id}/bookmark`

Auth: user

Response:

```json
{
  "post_id": 10,
  "is_bookmarked": true
}
```

## 6. Comments

### GET `/posts/{post_id}/comments`

Auth: user

Response item:

```json
{
  "id": 1,
  "post_id": 10,
  "author_id": 1,
  "author_nickname": "Jinsan",
  "author_cohort": "72",
  "parent_id": null,
  "content": "Comment",
  "created_at": "2026-04-25T00:00:00Z",
  "updated_at": "2026-04-25T00:00:00Z",
  "children": []
}
```

Rules:

- When authenticated, comments written by blocked authors are excluded from the response tree.
- A deleted or otherwise hidden comment author returns `author_cohort: null`.
- `lecture-reviews` is a forced-anonymous board that supports comments. User-facing post responses mask the post author as `Anonymous`, while comment authors follow the normal comment-author rules.
- `exam-archive` exposes the post author under the normal post-author rules and supports comments.

### POST `/posts/{post_id}/comments`

Auth: user

Request:

```json
{
  "content": "Comment",
  "parent_id": null
}
```

Rules:

- Maximum depth is 2.
- `content` is trimmed, required, and limited to 500 characters.
- If `parent_id` points to a reply, return `BAD_REQUEST`.
- The shared post-read policy is evaluated before all comment reads and mutations. Another member's mutual-aid comment tree is hidden with `404 NOT_FOUND`.

### PUT `/comments/{comment_id}`

Auth: author or admin

Request:

```json
{
  "content": "Updated comment"
}
```

### DELETE `/comments/{comment_id}`

Auth: author or admin

Response:

```json
{
  "id": 1,
  "deleted_count": 2
}
```

## 7. Search

### GET `/search`

Auth: user

Query:

- `q`: required, min length 2
- `scope`: `all`, `board`, `notices`, `community`, `participation`, `council`
- `board_id`: required when `scope = board`
- `notice_category`: optional when `scope = notices`; one of `academic`, `event`, `other`
- `page`, `size`

Response item:

```json
{
  "type": "post",
  "id": 10,
  "board_id": 1,
  "board_name": "Academic Notices",
  "board_slug": "academic-notices",
  "category": "academic",
  "title": "Matched title",
  "content_preview": "Matched preview",
  "author_nickname": "Jinsan",
  "author_cohort": "72",
  "created_at": "2026-04-25T00:00:00Z",
  "highlights": {
    "title": "<mark>Matched</mark> title",
    "content_preview": "Matched preview"
  }
}
```

Rules:

- When authenticated, results written by blocked authors are excluded.
- Anonymous, forced-anonymous, deleted, or otherwise hidden authors return `author_cohort: null`.
- `exam-archive` search results expose author nickname and cohort under the normal post-author rules; `lecture-reviews` remains forced-anonymous for non-admin users.
- Mutual-aid results are owner-scoped for members. Administrators can search every request.

### GET `/search/recent`

Auth: user

Response:

```json
[
  {
    "keyword": "exam",
    "searched_at": "2026-04-25T00:00:00Z"
  }
]
```

## 8. Media

### POST `/media/uploads`

Auth: user

Content-Type: `multipart/form-data`

Form fields:

- `file`: binary file

```json
{
  "id": 1,
  "original_filename": "photo.jpg",
  "stored_filename": "generated-token.jpg",
  "content_type": "image/jpeg",
  "file_size": 123456,
  "url": "/api/media/1/access-url",
  "access_url": "/api/media/1/access-url",
  "status": "ready"
}
```

Rules:

- The server streams the upload to a temporary file in chunks and deletes partial files after every failure.
- The fixed maximum size is 10 MiB (`10485760` bytes). `MEDIA_UPLOAD_MAX_BYTES` defaults to 10 MiB and cannot exceed it; streaming chunks default to 1 MiB via `MEDIA_UPLOAD_CHUNK_BYTES`.
- Non-admin uploads retain the production throttle of 20 requests per account and 60 requests per client IP in each 3600-second window. Admin-role uploads bypass this request-count throttle, but still pass every size, type, signature, privacy, storage, and attachment validation.
- Allowed extensions and MIME pairs are defined by `MEDIA_ALLOWED_EXTENSIONS` and `MEDIA_ALLOWED_MIME_TYPES`. The launch defaults are `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.heic`, `.heif`, `.pdf`, `.doc`, `.xls`, `.ppt`, `.docx`, `.xlsx`, `.pptx`, `.hwp`, `.zip`, `.txt`, and `.ipynb`, paired with the MIME values in `backend/.env.example`.
- Storage directories are configured with `MEDIA_UPLOAD_DIR` and `MEDIA_PRIVATE_UPLOAD_DIR` and must not be exposed by a web server.
- Images, PDF, office/HWP documents, ZIP archives, plain text, and valid Jupyter notebooks are accepted. ZIP structure, notebook JSON shape, HWP's internal signature, and other supported file signatures are validated; empty, oversized, forbidden, or mismatched files are rejected.
- Stored URLs are never public `/uploads` paths.

### GET `/media/{media_id}`

Auth: user

Returns metadata only after the caller passes media access policy.

### GET `/media/{media_id}/access-url`

Auth: user

Returns a short-lived signed file URL:

```json
{
  "url": "/api/media/files/1?expires=...&signature=...",
  "expires_in": 300
}
```

Rules:

- Unattached ordinary media is available to its owner and administrators; member-facing profile/banner media may be issued to authenticated members.
- A post attachment requires read permission for at least one attached post.
- Mutual-aid evidence requires administrator role after it is attached to a request. The upload owner may access a still-unattached private upload, but attachment immediately switches it to the administrator-only evidence policy.
- An unauthorized object-level request returns `404 NOT_FOUND`.

### GET `/media/access-url?path=...`

Auth: user

Compatibility resolver for a server-relative stable reference (`/api/media/{id}/access-url`) or legacy `/uploads/{stored_filename}` value already stored in profile/banner/board metadata. It applies the same object-level policy and rejects absolute, external, traversal, query-bearing, or unknown paths. New code should prefer the media ID endpoint.

### GET `/media/files/{media_id}`

Auth: short-lived signed URL

The signature is scoped to the media object and expiry. Missing, expired, or altered signatures are rejected. `/uploads/*` is not mounted. When a legacy row declares Word/`.doc` but the stored OLE bytes carry the HWP document signature, the response uses the HWP MIME and an `.hwp` download filename without updating the legacy media row or renaming the stored file.

## 9. Events

### GET `/events`

Auth: user

Query:

- `from_date`: required or default first day of current month
- `to_date`: required or default last day of current month
- `category`: optional

Date bounds use `Asia/Seoul` calendar boundaries with overlap semantics: an event is returned when it starts before the exclusive end of the requested range and its `end_at` (or `start_at` when no end exists) is on or after the range start. Date-only `to_date` values include that full Korean calendar day, so month and single-day queries include multi-day events that began earlier and are still in progress. Event writes normalize timezone-aware inputs to UTC before storing them, and D-day dispatch uses the same Korean calendar-day boundaries.

Response item:

```json
{
  "id": 1,
  "title": "Midterm snack event",
  "description": "...",
  "location": "Sogang",
  "category": "event",
  "color": "#2563eb",
  "start_at": "2026-04-20T09:00:00Z",
  "end_at": "2026-04-20T10:00:00Z"
}
```

Admin CRUD:

- `POST /events`
- `PUT /events/{event_id}`
- `DELETE /events/{event_id}`
- `POST /events/admin/dispatch-reminders`: idempotently creates D-day and D-1 notifications for the selected date.

## 10. FAQ and Guide-backed Boards

FAQ:

- `GET /faqs` user
- `POST /faqs` admin
- `PUT /faqs/{faq_id}` admin
- `DELETE /faqs/{faq_id}` admin
- FAQ response items include ordered `attachments` using the normal media payload. Active FAQ
  images are member-readable through `/api/media/{id}/access-url`; no CDN or public static URL is returned.

Guide content does not have a separate `/guides` domain in v1. Club and networking guides use protected board/post APIs and administrator dependencies; study recruitment uses the member-writable board policy. A dedicated guide CRUD domain is deferred to v1.1.

## 10.1 Home Banners

- `GET /banners` returns only active, currently visible banners that contain at least one registered image. `include_inactive=true` remains available to the administrator screen for repairing legacy placeholders.
- `POST /banners` and `PUT /banners/{banner_id}` are administrator-only and require the resulting banner to retain at least one non-empty `image_url` or responsive `image_urls` entry.
- Missing all images returns `422 BANNER_IMAGE_REQUIRED`.
- Member clients render the selected responsive image as the complete banner artwork. Text, badge, deadline, theme, and gradient overlays are not synthesized by the app.

## 11. Notifications

### GET `/notifications`

Auth: user

Query: `page`, `size`

Response item:

```json
{
  "id": 1,
  "notification_type": "comment",
  "message": "New comment",
  "post_id": 10,
  "is_read": false,
  "created_at": "2026-04-25T00:00:00Z"
}
```

### PUT `/notifications/{notification_id}/read`

Auth: user

Council workflow notifications use `notification_type: "council"` and respect the user's `notify_council` setting.

New notice posts create `notice` notifications immediately. Event reminders use a per-user deduplication key so scheduled work can be retried safely.

### GET `/notifications/settings/me`

Auth: user

Response:

```json
{
  "notify_comment": true,
  "notify_like": true,
  "notify_notice": true,
  "notify_event": true,
  "notify_council": true
}
```

### PUT `/notifications/settings/me`

Auth: user

Request: same as response.

### POST `/notifications/admin/push-receipts/sync`

Native push delivery uses Expo push tokens and the Android `default` channel. Notification preference filtering occurs before both the notification-center record and push delivery are created. Web browser notifications reuse the authenticated notification list and do not register Expo push tokens.

Auth: admin

Synchronizes Expo delivery receipts, records failures, and disables tokens rejected as `DeviceNotRegistered`.

## 11.1 Admin Operations

- `GET /admin/stats`: active users, posts, comments, notices, events, reports, and push-delivery metrics.
- `GET /admin/audit-logs?page=1&size=30`: recent protected administrator actions.
- `GET /admin/legacy-import/summary`: grouped legacy-import counts by entity type, status, and action.
- `GET /admin/legacy-import/records?page=1&size=50`: paginated private reconciliation records.

Both legacy-import endpoints require `admin`. The records endpoint accepts optional `status`,
`entity_type`, and `source_id` filters and returns provenance, target linkage, bounded reason text,
and redacted details only. It does not return the raw spreadsheet row or unredacted legacy content.

### GET `/users/nickname-availability`

Auth: user

Query: `nickname`

This endpoint remains for older clients and reports a nonblank normalized name as available. Names are real-name display fields, so duplicates are valid; email is the unique account identifier.

## 12. Reports and Moderation

### POST `/posts/{post_id}/report`

Auth: user

Request:

```json
{
  "reason": "inappropriate",
  "detail": "optional detail"
}
```

Response:

```json
{
  "id": 1,
  "status": "open",
  "duplicate": false
}
```

### POST `/comments/{comment_id}/report`

Auth: user

Request and response: same as post report.

### GET `/admin/reports`

Auth: admin

Query:

- `status`: `open`, `reviewing`, `resolved`, `dismissed`, or `all`
- `page`, `size`

Response item:

```json
{
  "id": 1,
  "target_type": "post",
  "target_id": 10,
  "reason": "privacy",
  "detail": "optional detail",
  "status": "open",
  "reporter_id": 1,
  "reporter_nickname": "Jinsan",
  "target": {
    "target_exists": true,
    "target_deleted": false,
    "post_id": 10,
    "board_id": 1,
    "title": "Post title",
    "content_preview": "Preview",
    "author_id": 2,
    "author_nickname": "Author"
  }
}
```

### PUT `/admin/reports/{report_id}`

Auth: admin

Request:

```json
{
  "status": "resolved"
}
```

Rules:

- Status values are `open`, `reviewing`, `resolved`, and `dismissed`.
- Target deletion still uses the existing admin-authorized post/comment delete APIs.

### 2026-09-17 member attachment editing (WP5/WP9 P0)

- `GET /api/posts/{id}` adds optional `for_edit=false`. With `true`, author/admin authorization is required; mutual-aid requests must be processing. Ordinary member response redaction remains unchanged.
- `PUT /api/posts/{id}` adds `replace_evidence: boolean = false`. New mutual-aid edit clients send `true`, explicit `attachment_ids` (remaining/replacement IDs in display order), and `metadata.proof_url` (empty string to clear the previous link). Missing IDs/proof field returns `422 VALIDATION_ERROR`.
- Explicit removal is allowed only when at least one evidence file or a valid HTTP(S) proof link remains. Files/link switching clears the replaced representation. Validation failure preserves the stored record and relations.
- New evidence must be a ready private upload owned by the requester (or submitted by an administrator). Existing linked evidence, including old admin-uploaded or non-private evidence, may be retained. Removal changes attachment relations only.
- Legacy clients omitting/setting false on `replace_evidence` retain the existing behavior for empty hidden evidence lists. There is no database migration. Signed URLs keep their existing expiration semantics.
