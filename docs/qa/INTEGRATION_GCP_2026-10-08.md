# Administrator console and polls integration — 2026-10-08

Scope: approved WP5/WP6/WP8/WP9 development, named-branch integration and GCP synchronization. Mobile store publication is outside this request.

## Integration decisions

- Preserve the latest main design/calendar and network-error recovery work together with the administrator workspace, usage reporting and independent notice polls.
- Include migrations `0032_admin_usage`, `0033_notice_polls`, and `0034_attendance_polls` in version control and upgrade the production `0031_operation_status_only` database through Alembic.
- Reload the current user credential under its deletion lock. A password reset in another session must invalidate the old deletion password.
- Mutual-aid evidence is accessible to administrators or the readable processing request author. Completed request authors and other members cannot retrieve proof URLs or attachments.
- Administrator dialogs belong to an authentication generation. Ordinary token rotation retains dialogs; logout/new login discards callbacks and late prompts. Notice entry points use the dedicated body/poll editor with retryable lookup failures.
- Serialize PostgreSQL board hierarchy mutations before reading or locking boards. Competing reparenting and parent archival cannot create cycles or active children below archived roots.
- Delete only named branches whose tips are contained in main. Keep detached worktree commits and every existing worktree directory/file.

## Verification before main integration

- Backend: **626 passed, 3 skipped** on local SQLite. Two PostgreSQL-only concurrency tests and one existing environment-specific test were skipped; one existing Starlette/httpx warning remains.
- Frontend: **917 passed** before the final token-refresh refinement; typecheck passed. The subsequent merged-tree results below supersede these preliminary results.
- Real PostgreSQL hierarchy regression: **2 failed before / 2 passed after** the transaction advisory lock, using isolated temporary containers on the GCP VM.
- Cached-password and mutual-aid evidence failures were reproduced before their fixes; focused backend validation passed **143 tests**.
- Independent review found a normal-refresh/dialog regression, accepted for correction. No additional concrete P0/P1/P2 issue was found in poll validation, evidence authorization, notice routing or hierarchy handlers.
- Product-source secret scan: no leaks. Local evidence, environment files, backups and private data remain ignored.

## Merged-tree verification

Pending final merge, full suites, typecheck/lint, web export and isolated PostgreSQL migration/API validation.

## GCP synchronization

Pending exact main revision deployment, coordinated PostgreSQL/public-media/private-media backup validation and live verification. Production test fixture resets are prohibited; runtime/migration tests use separate disposable databases.

## Remaining QA

`Phase 5 QA`: physical Android/iOS, accessibility font scaling, native keyboard, and browser Back with an unsaved administrator draft. These are not asserted by automated web/backend checks. Existing deprecation warnings are tracked separately from test failures.

Detailed red/green logs and review evidence are in ignored `outputs/qa/integration-deploy-2026-10-08/`.
