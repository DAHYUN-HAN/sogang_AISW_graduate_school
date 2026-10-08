# Integrate administrator console and notice polls

> **For agentic workers:** Use systematic-debugging, test-driven-development and verification-before-completion. The user has authorized implementation, merging all feature branches, deleting integrated branches, committing, pushing, and synchronizing GCP. Execute continuously; do not repeat approval menus.

**Goal:** Preserve every branch's work, correct confirmed predeployment defects, and deploy the verified merged main revision to GCP.

**Architecture:** Keep Expo Router, FastAPI, PostgreSQL and the existing protected administrator console. Fix authorization, credential refresh and navigation at their current boundaries. Add no external provider or mobile store release.

**Spec:** `PLAN.md`, `CODEX.md` WP5/WP8/WP9; phase-2 API, permission, schema and frontend-route contracts; `outputs/qa/undeployed-audit-2026-10-08/AUDIT.md`.

## Constraints and decisions

- Preserve dirty/untracked product work; ignore local evidence, environment secrets and private source data.
- All administrator mutations retain API authorization. Mutual-aid evidence permits administrators or the readable processing request author only.
- Reset/deletion must verify the newest credential after acquiring the user lock.
- Administrator confirmations belong to one authentication session. Clear callbacks without invoking them on session replacement.
- Every administrator notice edit entry uses the dedicated notice editor, preserving inline image anchors, deadline and poll state.
- PostgreSQL hierarchy mutations serialize before loading or locking boards, preventing cycles and archived-parent races.
- Merge named feature branches into main, verify their tips are ancestors, then delete local/remote references. Preserve existing worktree files; do not discard detached-worktree-only work.
- Run isolated PostgreSQL tests on GCP if local Docker is unavailable. Do not run fixture resets against production.
- Back up production DB/media using the existing `/srv/aisw-backups` convention, verify backups, then deploy the exact pushed SHA and verify migration/readiness/images.

## Tasks

1. **Credential and evidence fixes:** tests in `backend/tests/test_admin_password_reset.py` and media access tests first; fix `account_deletion.py` and `media_service.py`; verify old-password deletion rejection and peer/completed-author evidence denial.
2. **Administrator session and edit fixes:** failing tests for `adminDialogQueue`/authentication lifecycle and notice-detail routing; fix queue cleanup and shared admin edit route to open the dedicated editor. Verify ordinary post/native behavior remains as planned.
3. **Hierarchy concurrency:** failing PostgreSQL reproduction using real board handlers; acquire one transaction-level hierarchy lock in create/update/archive before reads; verify competing parent edits and create/archive interleaving.
4. **Git integration:** inspect all refs/worktrees, commit reviewed development and fixes, merge latest main and any unique named-branch commits, resolve conflicts preserving network-error handling and admin/poll behavior. Run full tests/typecheck/lint/web export and isolated PostgreSQL migration/API tests, then push main and remove fully integrated feature branches.
5. **GCP synchronization:** record previous SHA/images/head; build candidate before stopping services; coordinate verified DB/media backups; use existing HTTPS ingress configuration to deploy exact main; confirm head `0034_attendance_polls`, model parity, health, protected route responses, frontend bundle and worker revision. Record evidence and remaining native QA in `docs/qa/`.

## Progress

- [x] Credential/evidence fixes — focused 143 tests passed; cached credential and evidence regressions failed before fixes.
- [x] Administrator session/edit fixes — stable login generation, dedicated notice routes and actual-source lifecycle regressions; focused23 tests passed.
- [x] Hierarchy serialization — real PostgreSQL regressions: 2 failed before, 2 passed after shared transaction lock.
- [x] Merged-tree verification and Git cleanup — PostgreSQL629, frontend940, typecheck/lint, web build and independent session review; main pushed, local5/remote3 integrated branches removed, worktree files preserved.
- [x] Backup, deployment and live verification — real DB backup restore/upgrade rehearsed, codeb68acec deployed, production0034/model parity/HTTPS/source and bundle hashes verified. Documentation-only final revision is synchronized without changing runtime source.
