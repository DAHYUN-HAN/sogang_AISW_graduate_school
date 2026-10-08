# AI·SW CAMPUS

## Stack
- FE: React Native (Expo Router, Zustand, React Query, React Hook Form + Zod)
- BE: FastAPI + SQLAlchemy 2.0 + Alembic
- DB: PostgreSQL 16

## Structure
- `backend/`: FastAPI server, SQLAlchemy models, Alembic migration
- `frontend/`: Expo app with tabs + board/post/comment screens
- `docker-compose.yml`: shared database, backend, and worker definitions
- `docker-compose.qa.yml`: isolated QA settings and live Expo web development
- `docker-compose.production.example.yml`: production-only security, storage, and ingress settings

## Quick Start

Prerequisite for the complete local web stack: Docker Desktop. Node.js 22 and
npm are needed only when running Expo directly on the host. For a host-only
backend run, use Python 3.12 and PostgreSQL 16.

1. Clone the repository and create local environment files. Example files contain placeholders only; never commit real secrets.

```powershell
git clone <repository-url>
cd AISW_app_renewal
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

2. Validate and start the isolated QA stack. This path does not require
`.env.production` or production secrets. It binds to this desktop only, keeps
the QA database/media in Docker volumes, and does not run demo-data seeding.

```powershell
.\scripts\qa-compose.ps1 -Action Config
.\scripts\qa-compose.ps1 -Action Up
```

The backend startup migration is safe for clean or recognized legacy databases. An unrecognized unversioned schema stops without stamping or changing data.

```powershell
docker compose --env-file .env.qa.example -p aisw_p0qa -f docker-compose.yml -f docker-compose.qa.yml exec backend alembic upgrade head
docker compose --env-file .env.qa.example -p aisw_p0qa -f docker-compose.yml -f docker-compose.qa.yml exec backend alembic heads
```

Expected single Alembic head: `0034_attendance_polls`.

3. Open `http://localhost:58081`. The QA frontend runs `npm ci` on every
container start and uses Expo Fast Refresh for changes under `frontend/`.

Use `.\scripts\qa-compose.ps1 -Action Logs` for API/frontend logs and
`.\scripts\qa-compose.ps1 -Action Down` to stop QA without deleting its data.
To test from another device on the same private network, copy
`.env.qa.example` to the ignored `.env.qa`, set `QA_BIND_ADDRESS=0.0.0.0`, and
replace `localhost` in `QA_PUBLIC_API_URL` with the desktop's private LAN IP.
Do not expose this QA configuration to the public internet.

To move an already-reviewed PostgreSQL database and its media into this
isolated QA stack, export a checksummed snapshot and restore it. Both the
snapshot and real `.env.qa` stay ignored by Git.

```powershell
.\scripts\qa-data.ps1 -Action Export `
  -SnapshotDirectory .codex-tmp\qa-data-snapshot `
  -SourceDatabase <review-database-name> `
  -PublicMediaDirectory <review-public-media-directory> `
  -PrivateMediaDirectory <review-private-media-directory>

.\scripts\qa-data.ps1 -Action Verify
.\scripts\qa-data.ps1 -Action Restore
```

`Restore` only replaces the `aisw_p0qa` project's `sogang_app_qa` database and
its two QA media volumes. It does not modify the source database. The package
may contain personal/review data, so keep it out of Git and do not use it as a
production dump until transient QA accounts, sessions, tokens, and logs have
been explicitly sanitized.

For Expo Go or native-device development, run Expo directly on the host:

```powershell
cd frontend
npm ci --legacy-peer-deps
npm run start
```

The mobile IA uses five bottom tabs: Home, Notices, Community, Participation, and Student Council. My Page opens from the profile action.

## Phase 2 Planning Docs

- `PLAN.md`: Phase 2 product and architecture plan
- `AGENTS.md`: agent/coding rules
- `CODEX.md`: implementation backlog
- `docs/phase2/`: API, DB, auth, frontend route, and implementation contracts
- `OPERATIONS.md`: production configuration, backup, restore, and worker operations

## Migration Notes

For an existing database, back it up and run Alembic migrations before starting the backend:

```bash
cd backend
alembic upgrade head
```

Do not use `Base.metadata.create_all()` as a migration substitute. Do not manually stamp an unknown database to head.

Migration `0015_p0_admin_alignment` moves mutual-aid evidence out of the public upload path. After upgrading, start the backend once so legacy evidence files are relocated from `uploads/` to `private_uploads/`. Private files are served only through short-lived signed download links for the post author or an admin.

Migrations `0020_account_hard_delete` and `0021_account_deletion_receipts` implement irreversible account deletion. Public published posts/comments can remain only with the author link removed; private, draft, hidden, mutual-aid content and private media are deleted. The completion receipt contains only a UUID, channel, result, and completion time. It does not contain a user ID, email, IP address, or deletion counts.

Migration `0024_faq_attachments` registers legacy FAQ illustrations in the protected media registry. FAQ and post images are served from persistent media storage through authorized signed URLs; the database stores stable media references rather than CDN URLs or file binaries.

The current media policy is member-only for ordinary attachments and profile images as well. `/uploads` is not a public static route. The client requests a short-lived signed access URL after the API verifies membership and, for post attachments, post read permission.

Upload defaults:

- `MEDIA_UPLOAD_DIR=uploads`
- `MEDIA_PRIVATE_UPLOAD_DIR=private_uploads`
- `MEDIA_UPLOAD_MAX_BYTES=10485760` (10 MiB)
- `MEDIA_UPLOAD_CHUNK_BYTES=1048576` (1 MiB streaming chunks)
- `MEDIA_ACCESS_URL_EXPIRE_SECONDS=300`
- `MEDIA_ALLOWED_EXTENSIONS` and `MEDIA_ALLOWED_MIME_TYPES` contain the explicit allowlists; copy the launch defaults from `backend/.env.example`.
- Empty, oversized, forbidden, or extension/MIME-mismatched files are rejected and partial temporary files are removed.

## Development Auth

The local seed admin account is:

- Email: `test@sogang.ac.kr`
- Password: `password123`

Authentication and password-reset codes are delivered only by email and are never returned by API responses.
Configure `SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, and set `SMTP_REQUIRED=true`
for production email verification and password reset. Use `SMTP_SECURITY=starttls`
with port 587 or `SMTP_SECURITY=ssl` with port 465, according to the provider.
Use `SMTP_AUTH=password` for normal providers. `SMTP_AUTH=none` is allowed only
for an explicitly approved IP-authenticated relay. Production rejects
plaintext SMTP and missing password credentials.

SMTP sender and recipient rules are separate:

- Recipients are restricted by the backend to `@sogang.ac.kr`.
- SMTP can use another provider account such as Gmail, Naver, SendGrid, AWS SES, or a custom domain.
- `SMTP_FROM_EMAIL` should be a sender address that the SMTP provider allows for that account. Do not spoof
  `@sogang.ac.kr` unless that domain is configured and authorized for the SMTP provider.
- `SMTP_FROM_NAME` controls the visible product name. `SMTP_REPLY_TO` is optional and defaults to
  `SMTP_FROM_EMAIL`; when set, it must be a monitored provider-authorized mailbox.
- Gmail SMTP deployments should keep `SMTP_FROM_EMAIL` identical to the authenticated Gmail account unless
  Google has explicitly verified the alias. SMTP acceptance does not guarantee inbox placement.

Local setup:

1. Copy or edit `backend/.env`.
2. Fill `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SMTP_FROM_EMAIL`.
3. Set `SMTP_REQUIRED=true`.
4. Restart the backend.

SMTP smoke test:

```bash
cd backend
python scripts/send_test_email.py --check-only
python scripts/send_test_email.py your-id@sogang.ac.kr
```

After a real inbox test, inspect the received message source and require `spf=pass`, `dkim=pass`, and
`dmarc=pass`. If all three pass but Sogang webmail still classifies the message as spam, record the
`Message-ID` and delivery time and ask the university mail administrator to review or allow the approved
sender. The application emits a single-line branded From header, Reply-To, Date, Message-ID,
`Auto-Submitted: auto-generated`, and an explicit SMTP envelope sender; recipient-side reputation and
filtering remain external release checks.

Run the same commands inside the deployed backend container. A Cloudflare
Tunnel exposes inbound HTTPS but does not carry outbound SMTP. The fixed-domain
server deployment, proxy, SMTP, restart, and signup checks are maintained in
`OPERATIONS.md`.

## Backend API (Phase 1)
- `GET /api/boards`
- `GET /api/boards/{board_id}`
- `GET /api/boards/{board_id}/posts`
- `GET /api/posts/{post_id}`
- `POST /api/boards/{board_id}/posts`
- `PUT /api/posts/{post_id}`
- `DELETE /api/posts/{post_id}`
- `POST /api/posts/{post_id}/like`
- `POST /api/posts/{post_id}/bookmark`
- `GET /api/posts/{post_id}/comments`
- `POST /api/posts/{post_id}/comments`
- `PUT /api/comments/{comment_id}`
- `DELETE /api/comments/{comment_id}`
- `GET /api/users/me`
- `PUT /api/users/me`

## Backend API (Phase 2 foundation)

Auth:
- `POST /api/auth/login`
- `POST /api/auth/register/request-verification`
- `POST /api/auth/register/verify-email`
- `POST /api/auth/register`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/verify-code`
- `POST /api/auth/password-reset/confirm`
- `POST /api/auth/account-deletion/request`
- `POST /api/auth/account-deletion/verify`
- `GET /api/admin/stats`
- `GET /api/admin/audit-logs`
- `POST /api/events/admin/dispatch-reminders`
- `POST /api/notifications/admin/push-receipts/sync`

Daily notification operations can also run without an HTTP admin session:

```bash
cd backend
python scripts/run_notification_jobs.py
```

The job is idempotent for event reminders and can safely be scheduled once per day in the `Asia/Seoul` timezone. It also synchronizes push receipts, removes stale rate-limit buckets, and purges expired non-identifying account-deletion receipts. Production backend and worker environments must use the same privacy-owner-approved `ACCOUNT_DELETION_RECEIPT_RETENTION_DAYS`.

Production also requires an approved HTTPS `OPERATIONS_ALERT_WEBHOOK_URL` in both backend and worker environments. The adapter posts structured non-PII alerts for unhandled API exceptions, notification-worker failures, and push send/ticket/receipt failures. Treat the webhook URL as a secret; do not commit or log it. `OPERATIONS_ALERT_TIMEOUT_SECONDS` defaults to 3 seconds.

Users:
- `PUT /api/users/me/password`
- `DELETE /api/users/me`

`DELETE /api/users/me` requires an authenticated Bearer session and JSON body `{"current_password":"..."}`. It returns a non-identifying receipt after the irreversible transaction commits. The two public account-deletion endpoints use school-email verification plus the current password, return the same request response for known and unknown accounts, and never expose the verification code.

Posts:
- `PUT /api/posts/{post_id}/pin`
- `GET /api/boards/{board_id}/posts?q=&category=&status=&sort=`

Search:
- `GET /api/search?q=`
- `GET /api/search/recent`

Events:
- `GET /api/events`
- `POST /api/events`
- `PUT /api/events/{event_id}`
- `DELETE /api/events/{event_id}`

FAQ:
- `GET /api/faqs`
- `POST /api/faqs`
- `PUT /api/faqs/{faq_id}`
- `DELETE /api/faqs/{faq_id}`

Notifications:
- `GET /api/notifications`
- `PUT /api/notifications/{notification_id}/read`
- `GET /api/notifications/settings/me`
- `PUT /api/notifications/settings/me`

## Notes

- The app is member-only. Only login, signup/verification, password reset, registration options, token refresh, legal documents, and health/docs are guest-capable; content APIs require a Bearer access token.
- Email is the login ID. v1 intentionally has no separate ID-finding API; use the school email and password reset.
- Non-production startup uses deterministic demo fixtures through `seed_initial_data`. Production startup uses non-authoritative `seed_reference_data`: it creates no user, never overwrites operator-edited reference content, and never deactivates custom boards.
- After an active member has registered in a new production deployment, run `python scripts/bootstrap_initial_admin.py --email <existing-active-member>` from the `backend` directory to promote exactly one initial administrator. The command is production-only, refuses to run when any active administrator already exists, serializes concurrent attempts with a PostgreSQL advisory lock, and records an audit event without details.
- API success/error payloads are normalized to `{status, data}` and `{status, message, code}`.

## Verification

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt -r requirements-test.txt
pytest -q
python scripts/verify_backend.py
alembic heads

cd ../frontend
npm run lint
npm run test
npm run typecheck
npm run doctor
npm run export:web
```

Run the backend test suite and the QA/production Compose checks above. Historical results at earlier revisions do not close the current `0034_attendance_polls` gate.

Checked on 2026-07-27 against the current worktree:

- backend: 104/104 tests on SQLite and 104/104 against isolated PostgreSQL; backend dependency audit reports zero known vulnerabilities;
- frontend: 7/7 tests, typecheck, Expo Doctor 17/17, web export, and lint with zero errors/zero warnings; after the lockfile update, clean `npm ci --legacy-peer-deps` revalidation again passed tests 7/7, typecheck, and lint 0/0;
- secret scan: checksum-verified Gitleaks 8.30.1 reported zero findings across 43 commits and 298 current non-ignored files; CI scans full history, while the final signed artifact scan remains outstanding;
- dependency/license review: validated CycloneDX 1.6 SBOMs cover 37 backend components and 809 frontend production component instances; forbidden, strong-copyleft-only, and unknown licenses are zero. Final signed native notices remain an artifact-level follow-up;
- migrations: clean database, `0019`→head, `0021`→`0019`→`0021`, exact unversioned `0001` recovery, and unknown-schema fail-closed behavior passed;
- backup/restore: PostgreSQL custom-format restore reproduced 30 tables with identical all-table counts and column/index/constraint fingerprints; media tar/restore checksums matched;
- containers: database and backend were healthy, the worker was running, and backend/worker ran as UID 10001; readiness, guest/user/admin HTTP checks, one-shot worker (`reminders=0`, `receipts=0`, `removed_rate_limits=0`, `removed_account_deletion_receipts=0`), production Compose build/config, and web `/healthz` plus deep-link fallback passed.
- Android local release rehearsal: the same 115 frontend source files built a temporary unsigned AAB in an isolated short-path workspace; bundletool 1.18.3 validation, target API 36, 16 KB page alignment, release-manifest restrictions, and an extracted-artifact Gitleaks scan passed. That disposable bundle was unsigned and contained placeholder identity/development strings, so it was not a production or store candidate.

These are local release-engineering results, not store approval. The strict release configuration check is still `BLOCKED_EXTERNAL` by 18 approved inputs. No EAS production variables, remote versions, signed production AAB, or iOS archive were created or inspected; the local unsigned bundle above does not close those gates. After the safe `postcss` 8.5.18 update, frontend runtime audit (`npm audit --omit=dev`) reports 33 affected entries: critical 0/high 19/moderate 14; the all-dependency audit reports 40: critical 0/high 26/moderate 14. Remaining remediation requires incompatible major overrides or a breaking Expo 57/React Native 0.86 decision, so store release remains `NO-GO`.

When `TEST_DATABASE_URL` is set, pytest drops and recreates all tables in that database. It refuses to run unless `APP_ENVIRONMENT=test`, `ALLOW_TEST_DB_RESET=1`, and the database name is exactly `test`, starts with `test_`, or ends with `_test`. Never point it at development or production data.
