# Phase 2 DB Schema Decisions

Status: implemented baseline through `0024_faq_attachments`, checked 2026-08-04

## 1. Core Decisions

### User Identity

Decision:

- Keep `nickname` as the public display field because the current code already uses it.
- Treat `nickname` as the signup real-name display field and allow duplicate values; `email` remains the unique account identity.
- Add `cohort` for the required signup field.
- Do not add `student_id` as required in Phase 2. It may be optional later.
- Keep `email` unique and required.

Reason:

- Notion signup requires cohort, name/nickname, password, and phone optional.
- Requiring student ID would block users who do not know or want to expose it.

### Author Snapshot

Decision:

- Store `author_nickname_snapshot VARCHAR(50) NULL` and `author_cohort_snapshot VARCHAR(20) NULL` on both `posts` and `comments`.
- Populate snapshots from the authenticated user at write time and from the legacy author during import.
- Prefer the live user profile while the account exists; after unlink/deletion, use the snapshot for historical display.

Reason:

- Account deletion must not erase the name and cohort shown on historical posts/comments.
- This is an intentional, narrowly scoped denormalization. Email, phone, major, company, account number, and other profile fields are not copied.

### Board Model

Decision:

- Keep `boards` as the IA seed source.
- Add `board_type`, `read_permission`, `write_permission`, and `allow_anonymous`.

Reason:

- Notion maps many menus to the same screen/function combinations.
- Board type lets the frontend choose layout and metadata.

### Post Metadata

Decision:

- Keep `posts` as the shared content table.
- Add common fields for anonymous, search, and moderation.
- Add extension tables only for content that needs structured fields.

## 2. Existing Tables To Keep

### `users`

Current:

- `id`
- `username`
- `password_hash`
- `nickname`
- `major`
- `phone`
- `company`
- `job_title`
- `position`
- `email`
- `profile_image_url`
- `role`
- `is_active`
- `created_at`
- `updated_at`

Phase 2 changes:

- Add `cohort VARCHAR(20) NULL` first, then make required after data backfill if needed.
- Add `last_login_at DATETIME NULL`.
- Add `privacy_policy_version VARCHAR(50) NULL` and `privacy_consented_at DATETIME NULL`; new registrations must populate both.
- Consider removing `username` later if email is the only login ID. Keep for now to avoid migration churn.
- `users.dues_status` is legacy-only. It is not exposed in the admin member response, cannot be changed by the general admin user API, and has no relationship to activity participant eligibility.

Indexes:

- Unique `email`
- Unique `username`
- Index `role`
- Index `is_active`

### `dues_payers`

The current dues-payer roster is intentionally independent from `users`; there is no user foreign key and no year/semester dimension.

- `id INTEGER PRIMARY KEY`
- `student_number VARCHAR(20) NOT NULL`, unique, normalized to `^A\d{5}$`
- `name VARCHAR(50) NOT NULL`, indexed for search
- `major VARCHAR(100) NOT NULL`
- `created_at DATETIME NOT NULL`
- `updated_at DATETIME NOT NULL`

The roster is populated only through the admin XLSX upsert. Raw workbooks and row-level PII never belong in migrations, seed data, or operational audit details. Activity-certification metadata stores ordered `participant_dues_payer_ids` plus a server-generated `participants` name snapshot, so clearing the current roster does not erase historical participant names.

### `boards`

Current:

- `id`
- `name`
- `slug`
- `category`
- `description`
- `sort_order`
- `is_active`
- `created_at`

Phase 2 changes:

- Add `board_type VARCHAR(50) NOT NULL DEFAULT 'post'`
- Add `allow_anonymous BOOLEAN NOT NULL DEFAULT false`
- Add `read_permission VARCHAR(20) NOT NULL DEFAULT 'user'`
- Add `write_permission VARCHAR(20) NOT NULL DEFAULT 'user'`
- Add `metadata JSONB NULL`

Activity-certification image presentation is an optional board-level concern
stored under `boards.metadata.activity_image_layout`; it does not add a column
or table. The version-1 object contains required `default` and nullable
`landscape`/`portrait` rules. Each rule stores nullable `max_width`, `height`,
and `max_height`, plus `fit` (`contain` or `cover`) and `expandable`. The board
admin API validates the complete object and allows the key only for a final
`board_type = activity_certification`. Missing keys use the frontend default,
so this additive JSONB contract requires neither an Alembic schema migration
nor a seed/data backfill.

Allowed `board_type`:

- `notice`
- `calendar`
- `album`
- `resource`
- `activity_certification`
- `guide`
- `faq`
- `organization_intro`
- `activity_history`
- `external_link`
- `suggestion`
- `mutual_aid`

### `posts`

Current:

- `id`
- `board_id`
- `author_id`
- `author_nickname_snapshot`
- `author_cohort_snapshot`
- `title`
- `content`
- `is_pinned`
- `is_notice`
- `view_count`
- `like_count`
- `comment_count`
- `created_at`
- `updated_at`

Phase 2 changes:

- Add `is_anonymous BOOLEAN NOT NULL DEFAULT false`
- Add `status VARCHAR(20) NOT NULL DEFAULT 'published'`
- Add `category VARCHAR(50) NULL`
- Add `metadata JSONB NULL`
- Add `deleted_at DATETIME NULL`

Indexes:

- `(board_id, is_pinned, created_at)`
- `(board_id, category)`
- `(author_id, created_at)`
- Optional PostgreSQL full-text index on `title`, `content`.

### `comments`

Current supports nested replies via `parent_id`.

Phase 2 rule:

- Enforce max depth 2 in application code.
- Keep DB flexible enough for future deeper nesting.
- Store `author_nickname_snapshot` and `author_cohort_snapshot` at creation/import time for historical display after account unlinking.

### `likes` and `bookmarks`

Keep current unique constraints:

- `uq_likes_user_post`
- `uq_bookmarks_user_post`

## 3. New Tables

### `refresh_tokens`

Purpose: logout and token rotation.

Columns:

- `id`
- `user_id FK users.id`
- `token_hash VARCHAR(255) UNIQUE NOT NULL`
- `expires_at DATETIME NOT NULL`
- `revoked_at DATETIME NULL`
- `created_at DATETIME NOT NULL`

Indexes:

- `user_id`
- `expires_at`

### `email_verification_tokens`

Columns:

- `id`
- `email VARCHAR(100) NOT NULL`
- `code_hash VARCHAR(255) NOT NULL`
- `purpose VARCHAR(30) NOT NULL`
- `expires_at DATETIME NOT NULL`
- `consumed_at DATETIME NULL`
- `attempt_count INT NOT NULL DEFAULT 0`
- `created_at DATETIME NOT NULL`

Allowed purpose:

- `register`
- `change_email`

### `password_reset_tokens`

Columns:

- `id`
- `user_id FK users.id`
- `token_hash VARCHAR(255) UNIQUE NOT NULL`
- `expires_at DATETIME NOT NULL`
- `consumed_at DATETIME NULL`
- `verified_at DATETIME NULL`
- `attempt_count INT NOT NULL DEFAULT 0`
- `created_at DATETIME NOT NULL`

### `media_assets`

Purpose: uploaded file registry.

Columns:

- `id`
- `owner_id FK users.id`
- `original_filename VARCHAR(255) NOT NULL`
- `stored_filename VARCHAR(255) NOT NULL`
- `content_type VARCHAR(100) NOT NULL`
- `file_size BIGINT NOT NULL`
- `url VARCHAR(500) NULL`
- `status VARCHAR(20) NOT NULL DEFAULT 'pending'`
- `created_at DATETIME NOT NULL`

Allowed status:

- `pending`
- `ready`
- `failed`

Security rules:

- `url` is a storage reference, not a public static URL.
- File delivery uses short-lived signed API URLs after object-level authorization.
- `is_private = true` is retained for mutual-aid evidence and other owner/admin-only assets.

### `post_attachments`

Columns:

- `id`
- `post_id FK posts.id ON DELETE CASCADE`
- `media_id FK media_assets.id`
- `sort_order INT NOT NULL DEFAULT 0`
- `created_at DATETIME NOT NULL`

Unique:

- `(post_id, media_id)`

### `faq_attachments`

Purpose: retain legacy FAQ illustrations without embedding CDN URLs in answer text.

Columns:

- `id`
- `faq_id FK faqs.id ON DELETE CASCADE`
- `media_id FK media_assets.id ON DELETE CASCADE`
- `sort_order INT NOT NULL DEFAULT 0`
- `created_at DATETIME NOT NULL`

Unique:

- `(faq_id, media_id)`

FAQ images use the same protected signed-media access flow as post attachments.

### `events`

Columns:

- `id`
- `title VARCHAR(200) NOT NULL`
- `description TEXT NULL`
- `location VARCHAR(200) NULL`
- `category VARCHAR(30) NOT NULL`
- `color VARCHAR(20) NULL`
- `start_at DATETIME NOT NULL`
- `end_at DATETIME NULL`
- `created_by FK users.id`
- `created_at DATETIME NOT NULL`
- `updated_at DATETIME NOT NULL`

Allowed category:

- `academic`
- `event`
- `exam`
- `council`
- `external`
- `other`

### `faqs`

Columns:

- `id`
- `question VARCHAR(500) NOT NULL`
- `answer TEXT NOT NULL`
- `category VARCHAR(50) NULL`
- `sort_order INT NOT NULL DEFAULT 0`
- `is_active BOOLEAN NOT NULL DEFAULT true`
- `created_at DATETIME NOT NULL`
- `updated_at DATETIME NOT NULL`

### `post_lecture_reviews`

Columns:

- `id`
- `post_id FK posts.id UNIQUE`
- `subject_name VARCHAR(100) NOT NULL`
- `professor VARCHAR(50) NULL`
- `semester VARCHAR(20) NULL`
- `difficulty SMALLINT NULL`
- `satisfaction SMALLINT NULL`

### `post_suggestions`

Columns:

- `id`
- `post_id FK posts.id UNIQUE`
- `suggestion_category VARCHAR(50) NULL`
- `status VARCHAR(20) NOT NULL DEFAULT 'received'`
- `admin_reply TEXT NULL`
- `replied_by FK users.id NULL`
- `replied_at DATETIME NULL`

Allowed status:

- `received`
- `reviewing`
- `answered`
- `closed`

### `post_mutual_aid`

Columns:

- `id`
- `post_id FK posts.id UNIQUE`
- `event_type VARCHAR(30) NOT NULL`
- `event_date DATE NOT NULL`
- `relation VARCHAR(50) NOT NULL`
- `status VARCHAR(20) NOT NULL DEFAULT 'processing'`
- `rejection_reason TEXT NULL`
- `reviewed_by FK users.id NULL`
- `reviewed_at DATETIME NULL`

Allowed status:

- `processing`
- `completed`
- `rejected`

### `notification_settings`

Columns:

- `id`
- `user_id FK users.id UNIQUE`
- `notify_comment BOOLEAN NOT NULL DEFAULT true`
- `notify_like BOOLEAN NOT NULL DEFAULT true`
- `notify_notice BOOLEAN NOT NULL DEFAULT true`
- `notify_event BOOLEAN NOT NULL DEFAULT true`
- `notify_council BOOLEAN NOT NULL DEFAULT true`
- `created_at DATETIME NOT NULL`
- `updated_at DATETIME NOT NULL`

### `notifications`

Columns:

- `id`
- `user_id FK users.id`
- `notification_type VARCHAR(30) NOT NULL`
- `message VARCHAR(500) NOT NULL`
- `post_id FK posts.id NULL`
- `event_id FK events.id NULL`
- `dedupe_key VARCHAR(255) UNIQUE NULL`
- `is_read BOOLEAN NOT NULL DEFAULT false`
- `created_at DATETIME NOT NULL`

Allowed type:

- `comment`
- `like`
- `notice`
- `event`
- `admin_reply`
- `council`

### `push_deliveries`

Purpose: durable Expo Push ticket/receipt and retry history.

Columns include notification/token references, token snapshot, status, attempt count, Expo ticket ID, error, and receipt timestamps.

### `operational_audit_logs`

Purpose: immutable record of protected administrator changes.

Columns include actor, action, target type/id, JSON details, and creation timestamp.

### `legacy_import_records`

Purpose: private provenance and exception ledger for the one-time Swing2App data reconciliation.

Columns include the source file/sheet/row identifier, entity and parent identifiers, a source-row
hash, import action/status, optional target table/id, bounded reason text, redacted JSON details,
and timestamps. Raw source rows are not copied into this table.

The combination `(source_file, source_sheet, entity_type, source_id)` is unique. Status/entity and
target table/id indexes support the admin-only review endpoints. The source XLSX/CSV files remain
local migration inputs and are excluded from Git because they may contain personal data.

### `search_histories`

Columns:

- `id`
- `user_id FK users.id`
- `keyword VARCHAR(100) NOT NULL`
- `created_at DATETIME NOT NULL`

Indexes:

- `(user_id, created_at)`

### `user_blocks`

Purpose: per-user author blocking for moderation and personal safety.

Columns:

- `id`
- `blocker_id FK users.id ON DELETE CASCADE`
- `blocked_user_id FK users.id ON DELETE CASCADE`
- `reason TEXT NULL`
- `created_at DATETIME NOT NULL`

Unique:

- `(blocker_id, blocked_user_id)`

Indexes:

- `(blocker_id, created_at)`
- `blocked_user_id`

### `major_options`

Purpose: administrator-managed signup major choices.

Columns:

- `id`
- `name VARCHAR(100) UNIQUE NOT NULL`
- `sort_order INT NOT NULL`
- `is_active BOOLEAN NOT NULL`
- `created_at`, `updated_at`

Existing user major text is preserved when an option is renamed or deactivated.

Migration `0023_registration_major_options` activates the current eight-option baseline while preserving administrator management after deployment:

- 데이터사이언스ㆍ인공지능
- 데이터사이언스
- 인공지능
- 소프트웨어공학
- 소프트웨어공학 및 컴퓨터시스템
- 정보보호
- 블록체인
- 보안 및 블록체인

### `privacy_policy_versions`

Purpose: preserve the active signup consent version and its activation history.

Columns:

- `id`
- `version VARCHAR(50) UNIQUE NOT NULL`
- `effective_at DATETIME NOT NULL`
- `is_active BOOLEAN NOT NULL`
- `created_by FK users.id NULL`
- `created_at`, `updated_at`

Only one version may be active. New users store the active version string and consent timestamp.

## 4. Seed IA

Use these board seeds in Phase 2.

| Category | Slug | Name | Type | Write |
| --- | --- | --- | --- | --- |
| `notices` | `academic-notices` | Academic Notices | `notice` | admin |
| `notices` | `event-notices` | Event Notices | `notice` | admin |
| `community` | `event-album` | Event Album | `album` | user |
| `resources` | `lecture-reviews` | Lecture Reviews | `resource` | user |
| `resources` | `exam-archive` | Exam Archive | `resource` | user |
| `resources` | `comprehensive-exam` | Comprehensive Exam | `resource` | user |
| `resources` | `graduation-thesis` | Graduation Thesis | `resource` | user |
| `participation` | `club-activity` | Club Activity Certification | `activity_certification` | user |
| `participation` | `study-activity` | Study Activity Certification | `activity_certification` | user |
| `participation` | `networking-activity` | Networking Activity Certification | `activity_certification` | user |
| `club` | `club-promo` | Club Promotion | `post` | admin |
| `study` | `study-recruit` | Study Recruitment | `post` | user |
| `alumni` | `networking-programs` | Networking Programs | `post` | admin |
| `council` | `council-activity` | Student Council Activity History | `activity_history` | admin |
| `council` | `accounting` | Accounting Link | `external_link` | admin |
| `council` | `suggestions` | Suggestions | `suggestion` | user |
| `council` | `mutual-aid` | Mutual Aid | `mutual_aid` | user |

FAQ, calendar, guide cards, and organization intro can use dedicated tables/routes rather than `boards`.

Seed execution is environment-specific:

- `seed_initial_data` is deterministic non-production fixture setup. It may create the documented local demo administrator and authoritatively synchronize fixture boards.
- Production startup calls `seed_reference_data` in non-authoritative mode. It creates no user, fills only missing reference boards/FAQs and an inactive image-less banner placeholder, does not overwrite operator-edited records, and does not deactivate custom boards. The placeholder is never member-visible until an administrator uploads at least one image and activates it.
- The first production administrator is not seeded. An existing active member is promoted once with `python scripts/bootstrap_initial_admin.py --email <existing-active-member>` under `APP_ENVIRONMENT=production`. The operation refuses when any active administrator exists, uses a PostgreSQL advisory transaction lock, and records `admin.bootstrap.initial` with no details.

`0018_club_posts_admin` aligns existing databases with the participation policy: `club-promo` and `networking-programs` are admin-writable, while `study-recruit` and every activity certification board are user-writable. Participation URLs remain in `posts.metadata.application_url`, while representative images use the existing `media_assets` and `post_attachments` tables.

The same migration normalizes `council`/`gsa` write permissions: only `suggestion` and `mutual_aid` remain user-writable. Current council introductions use `boards.metadata.council_introductions`; notice-to-activity linkage uses `posts.metadata.show_in_council_activity`, avoiding duplicated activity-history posts and attachments.
All three organization-introduction collections (`council_introductions`, `cohort_leaders`, and `past_councils`) support an ordered `photo_urls` array, greeting, introduction, and variable-length `members` array. The first `photo_urls` item is the representative image and is mirrored to `banner_image_url`. Readers prefer `photo_urls`, fall back to legacy `attachment_urls`, and then fall back to `banner_image_url`; `attachment_urls` remains a read-compatible legacy field. `council_introductions` retains an array envelope for compatibility but admin writes keep only the single active current-council entry. Each member stores name, cohort, role, and an optional profile image; legacy per-member introduction values remain readable but fixed profile cards do not render them. Cohort leaders additionally store the cohort, while past councils store the council number and activity lines. Admin writes dual-write the former `executives`, captain/vice-captain, and president/vice-president fields for older-client compatibility; readers prefer `members` and fall back to those legacy fields. The board admin API is the only write path. These additive JSONB metadata fields reuse the existing `boards.metadata` column and require no schema migration.
Past councils remain in the separate `gsa-past-councils` organization-intro board, and FAQ continues to use the dedicated `faqs` table. These additive JSONB fields do not require a relational schema migration.

`0020_account_hard_delete` changes the account-deletion foreign-key contract, and the current deletion policy uses that nullable contract without deleting authored content:

- `posts.author_id`, `comments.author_id`, and `media_assets.owner_id` are nullable with `ON DELETE SET NULL` so all authored content and connected media can survive without an account link.
- `likes.user_id` and `bookmarks.user_id` use `ON DELETE CASCADE`.
- operational ownership columns on banners, events, suggestion replies, and mutual-aid reviews use `ON DELETE SET NULL`.
- email-verification purpose accepts `account_delete`.
- the service fills missing author snapshots, clears every authored post/comment `author_id`, clears `owner_id` on every connected owned media asset, and preserves post/comment/extension/attachment rows and original filenames. Only unattached owned uploads are physically removed as part of account deletion.

The `0020` downgrade refuses to make author/owner columns non-null after irreversible anonymization has occurred. Operators must restore a pre-deletion backup rather than fabricate ownership.

`0021_account_deletion_receipts` adds `account_deletion_receipts`:

| Column | Type | Rule |
| --- | --- | --- |
| `receipt_id` | `VARCHAR(36)` | primary key, random UUID |
| `channel` | `VARCHAR(20)` | `authenticated` or `public_email` |
| `result` | `VARCHAR(20)` | only `completed` |

`0025_author_content_snapshots` adds the four nullable snapshot columns to `posts` and `comments` and backfills rows that still have a live `author_id`. A missing snapshot on an already orphaned historical row is never guessed; operations must use verified backup or legacy metadata evidence.
| `completed_at` | `DATETIME` | indexed |

The receipt deliberately has no user ID, email, IP address, free-form reason, or deletion counts. Production may expire receipts only after the privacy owner explicitly sets `ACCOUNT_DELETION_RECEIPT_RETENTION_DAYS`; the schema and application do not assert a fixed legal retention period.

## 5. Migration Order

1. Add nullable columns to existing tables.
2. Add token/auth tables.
3. Add media tables.
4. Add event/FAQ/notification/search tables.
5. Backfill board IA seed.
6. Switch app dependencies from fixed user to JWT user.
7. Add constraints only after backfill is validated.

## 6. Existing Database Bootstrap Safety

- The Alembic graph must have one head, currently `0024_faq_attachments`.
- A database without `alembic_version` is never stamped directly to `head` merely because a few tables or columns exist.
- The bootstrap helper may stamp only a revision whose complete, versioned schema signature is recognized. Known legacy signatures and their target revisions are covered by tests.
- An unknown or mixed signature fails without changing data and prints recovery guidance: back up the database, inspect the schema, and perform an explicit operator-approved stamp/migration.
- A clean database follows `alembic upgrade head` without any bootstrap stamp.

Checked on 2026-07-27: clean upgrade, `0019`→head, `0021`→`0019`→`0021`, exact unversioned `0001` recovery, and unknown-schema fail-closed behavior all passed against isolated PostgreSQL.

Checked on 2026-08-02: a clean isolated PostgreSQL database upgraded to `0022`, and the
`0021`→`0022`→`0021`→`0022` round trip passed. The current backend suite passes 185 tests.

Checked on 2026-08-04: the local backend suite passes 203 tests and Alembic reports the single
`0024_faq_attachments` head. The `0024` migration has SQLite create/drop regression coverage and
an isolated PostgreSQL database passed clean upgrade plus `0023`→`0024`→`0023`→`0024` rehearsal.

- 2026-09-17 WP5/WP9: club operational lifecycle uses the existing `posts.metadata` JSONB field on `club-promo` guides: `club_operation_status` is `active` or `ended`, independent of recruitment category/status. Missing legacy values mean active; no table, column, migration, or bulk backfill is required. The API validates explicit writes and preserves the value when older clients omit the key. Existing `activity_source_post_id` links retain historical certification access after operation ends.
