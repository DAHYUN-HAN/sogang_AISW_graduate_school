# Phase 2 Review Checklist

Use this before entering Phase 3 development.

## Product Fit

- [x] Target IA maps to actual routes and seed data.
- [x] P0 features are all represented in API and DB.
- [x] P1 features are either scoped or explicitly deferred.
- [x] P2 features are not blocking MVP.

## API

- [x] Every endpoint has method, path, auth, request, response, errors.
- [x] Pagination is consistent.
- [x] Error envelope is consistent.
- [x] Guest/user/admin behavior is clear.
- [x] Search/filter rules are clear.
- [x] Upload strategy is clear.

## DB

- [x] Current models and target schema are reconciled.
- [x] User identity fields are final.
- [x] Board seed data matches IA.
- [x] Comment max depth is handled.
- [x] Auth token lifecycle tables exist.
- [x] Media/event/FAQ/notification tables are implemented.
- [x] Alembic migration order and exact legacy detection are verified.

## Auth and Permissions

- [x] Fixed `user_id=1` is removed from protected flows.
- [x] JWT/refresh/logout strategy is implemented.
- [x] Email verification is implemented with a local SMTP fallback policy.
- [x] Admin-only actions are backend protected.
- [x] Anonymous writing and identity-side-channel rules are enforced server-side.

## Frontend

- [x] Route map matches screen catalog.
- [x] Auth screens exist.
- [x] Route guards exist.
- [x] Board list has search/filter/sort/create states.
- [x] Post detail has comments, reactions, attachments, owner/admin actions.
- [x] Loading, empty, error, and permission states exist.

## Design

- [x] Design gate is explicitly deferred for Phase 3 UI polish.
- [ ] Figma has final colors.
- [ ] Figma has typography.
- [ ] Figma has reusable components.
- [ ] Figma covers core screens.
- [ ] Frontend implementation follows the design system.

Note: The design gate is not blocking Phase 3 entry by product decision. Current frontend uses implementation-safe local tokens and should be reconciled with final Figma assets during Phase 3/4 polish.

## Current Review Result

Checked on: 2026-08-02.

- [x] Original Docker Compose runtime smoke test passed historically.
- [x] Current Alembic head is `0029_roster_dues_separation`; local migration/model tests pass. The latest isolated PostgreSQL rehearsal passed through `0024` on 2026-08-04, and the `0029` PostgreSQL rehearsal is tracked below as an environmental follow-up.
- [x] Unknown unversioned schema remains fail-closed without stamping or mutation.
- [x] Seed board IA is present.
- [x] Production startup creates no demo user, preserves operator-edited reference content, and does not deactivate custom boards.
- [x] Initial administrator promotion is production-only, one-time, advisory-lock protected, and audited without free-form details.
- [x] Automated owner/admin regression covers mutual-aid search, detail, comments, reactions, attachments, activity, and reports.
- [x] Public `/uploads` is removed and signed member-only media access is verified.
- [x] Required post/comment validation and normalized FastAPI errors are verified.
- [x] Frontend route map has concrete screens for Phase 2 catalog routes.
- [x] Native secure session persistence uses SecureStore.
- [x] Production rate limiting is implemented for protected high-risk actions.
- [x] Protected local storage is accepted for v1; object storage remains a future deployment enhancement.
- [x] Authenticated account deletion verifies the current password and irreversibly removes the account; the public email flow is non-enumerating.
- [x] Public published content is anonymized; private/draft/hidden/mutual-aid content and private media are deleted; migration `0021` stores only a non-identifying receipt.
- [x] Backend tests pass 104/104 on SQLite and 104/104 on isolated PostgreSQL.
- [x] Frontend tests pass 7/7; typecheck, Expo Doctor 17/17, web export, and lint with zero errors/zero warnings pass. Clean `npm ci --legacy-peer-deps` revalidation after the lockfile update re-passed tests, typecheck, and lint.
- [x] PostgreSQL dump/restore fingerprints and media tar/restore checksums match.
- [x] Daily worker uses the approved deletion-receipt retention value and reports the account-deletion receipt cleanup count.
- [x] Operational-alert adapter sends structured non-PII events and does not expose the webhook secret in delivery-failure logs.
- [x] A local unsigned Android release AAB compiles and passes bundletool, API 36, 16 KB page-alignment, release-manifest, and extracted-artifact secret checks.
- [x] Migration `0029` separates the permanent `student_roster` from sparse current-term `dues_payments` while preserving legacy IDs and scopes.
- [x] Roster XLSX upserts identities without deleting omitted rows or mutating payments; payment XLSX validates before replacing all prior `ALL`/`ONCE` rows.
- [x] Admin `원우 명부` and `원우회비` tabs and activity participant black/gray states were visually verified on 2026-09-23 with committed evidence.
- [ ] Rehearse `0029` against isolated PostgreSQL when Docker Desktop is available; SQLite migration tests passed during the feature verification.

The approved frontend baseline has five tabs. Email is the login ID; a separate ID-finding API is intentionally omitted to avoid duplicate recovery behavior and account enumeration.

## Go/No-Go

Go to Phase 3 only when:

- All P0 contract gaps are closed.
- Remaining gaps have owner and target date.
- Any deliberate shortcut is documented in `CODEX.md`.

Current result: Phase 3/4 implementation is complete enough for **Phase 5 QA Conditional GO**. Store release remains **NO-GO**: the local Android AAB is unsigned and non-candidate, the strict release configuration check is blocked by 18 approved external inputs, the frontend high-severity dependency risk has no owner decision, and signed builds/device/store/live-host checks remain open in `CODEX.md`.
