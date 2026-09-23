# Phase 2 Implementation Sequence

Status: historical execution plan with implemented baseline checked 2026-07-27

## Step 0. Freeze Decisions

Input:

- `PLAN.md`
- `docs/phase2/API_CONTRACT.md`
- `docs/phase2/DB_SCHEMA_DECISIONS.md`
- `docs/phase2/AUTH_PERMISSION_SPEC.md`
- `docs/phase2/FRONTEND_ROUTE_SPEC.md`

Output:

- Agreement that Phase 2 contracts are the implementation source.

## Step 1. Backend Schema Foundation

Tasks:

- Add `cohort` to users.
- Add board permission/type fields.
- Add post anonymous/status/category/metadata fields.
- Add auth token tables.
- Add media/event/FAQ/notification/search tables.
- Update seed IA.

Verification:

- Alembic migration applies from empty DB.
- Non-production startup creates deterministic demo fixtures and target boards.
- Production startup creates no user and only fills missing reference records without overwriting operator edits or deactivating custom boards.
- The one-time production bootstrap promotes an existing active member only when no active administrator exists.
- Existing board/post APIs still work.

## Step 2. Auth Foundation

Tasks:

- Password hashing.
- JWT access token.
- Refresh token storage and rotation.
- Login.
- Register email verification.
- Password reset.
- Authenticated and public account deletion.
- Logout.
- Replace fixed current user.

Verification:

- Guest content reads return normalized `401`; authenticated members can read allowed boards/posts.
- User can write allowed boards.
- Admin can write notice/admin boards.
- Unauthorized write returns 401 or 403.

## Step 3. API Completion For P0

Tasks:

- Board permission metadata.
- Post list filters/search.
- Post create/update with metadata and anonymous option.
- Admin pin endpoint.
- Comment max-depth enforcement.
- Global search.

Verification:

- API contract examples pass manually or with tests.
- Response envelope remains stable.

## Step 4. Frontend Auth and Route Reconciliation

Tasks:

- Auth store.
- Axios token interceptor.
- Login/register/password reset screens.
- Route guards.
- Logout.
- Settings profile/account screens.
- Public support, privacy, and account-deletion screens.

Verification:

- Refresh flow works after access token expiry.
- Guest write attempts route to login.

## Step 5. IA and Board UX

Tasks:

- Update tabs/hubs to target IA.
- Update board list UI controls.
- Add quick menu.
- Add permission-aware create buttons.
- Add search/filter controls.

Verification:

- Target board seeds are visible.
- Existing post list/detail flows are not broken.

## Step 6. Media and Attachments

Tasks:

- Media upload endpoints.
- Attachment metadata.
- Create/edit post attachment linking.
- Frontend upload progress.
- Post detail attachment display.

Verification:

- Upload, attach, view, and download work.

## Step 7. Calendar, FAQ, Notifications

Tasks:

- Events API and calendar/list screens.
- FAQ API and accordion screen.
- Notification settings and notification list.
- Notification creation for comments/notices.

Verification:

- P1 notification settings are user-specific.
- Admin event/FAQ CRUD is protected.

## Step 8. Phase 2 Review

Checklist:

- API contract implemented or intentionally deferred item-by-item.
- DB matches models, migrations, and seed data.
- Permissions are backend-enforced.
- Frontend routes match screen catalog.
- Known deferrals are moved to Phase 3 backlog.

2026-07-27 implementation addendum:

- At the 2026-07-27 checkpoint, the Alembic head was `0024_faq_attachments`; later addenda supersede it.
- Account deletion uses server-verified current-password hard deletion and a non-enumerating public email flow; it is not account deactivation.
- SQLite and isolated PostgreSQL each pass 104/104 backend tests.
- Local production Compose, web deep-link, migration, and backup/restore rehearsals pass.
- Signed mobile builds, physical devices, live hosting, and store-console checks remain separate release gates and are not implied by Phase 2 completion.

2026-08-02 migration addendum: the local backend suite passes 185 tests, and an isolated PostgreSQL
clean upgrade plus `0021`→`0022`→`0021`→`0022` round trip passed. Legacy XLSX/CSV inputs are
local-only personal-data-bearing migration sources; only the importer, redacted provenance ledger,
tests, and operator documentation belong in Git.

2026-08-04 migration addendum: the local suite passes 203 tests and the single head is
`0024_faq_attachments`. Local attachment sources are copied into protected persistent storage and
verified with a DB/filesystem manifest. An isolated PostgreSQL database passed clean upgrade plus
`0023`→`0024`→`0023`→`0024` rehearsal, and a full local-data review passed API and web rendering.

2026-09-23 roster/payment addendum: migration `0029_roster_dues_separation` replaces the combined
`dues_payers` table with permanent `student_roster` identities and sparse current-term
`dues_payments`. Delivery order was migration/model coverage, atomic roster/payment services,
separate admin/member API contracts, activity-post validation, client contracts, then the two admin
tabs and native-width visual verification. The roster import is a non-destructive identity upsert;
the payment import validates first and then replaces every prior `ALL`/`ONCE` row. SQLite migration
coverage and the full backend/frontend suites passed; a live PostgreSQL Alembic rehearsal remains an
environmental follow-up because Docker Desktop was unavailable during this local verification.

## Recommended First Pull Requests

1. `docs`: commit Phase 2 source-of-truth documents.
2. `backend`: schema migration and IA seed update.
3. `backend`: auth dependencies and login/register.
4. `frontend`: auth store and login/register screens.
5. `backend`: search/filter and permission-aware posts.
6. `frontend`: IA route/navigation update.
