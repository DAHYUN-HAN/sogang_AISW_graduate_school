# Operation status key consolidation — 2026-09-30

Work packages: WP5 and WP9 in `CODEX.md`.

## Production data before migration

Read-only PostgreSQL audit on 2026-09-30 found 20 `club-promo` posts with only
`metadata.club_operation_status`: 13 `ended`, 7 `active`. No post had both keys
or an invalid old-key value. `study-recruit` and `networking-programs` already
use the new key where a status is explicit; missing values mean `active`.

## Change

Migration `0031_operation_status_only` copies the effective old status into
`metadata.operation_status` once and removes `metadata.club_operation_status`.
If a row contains both keys, the new key wins. Only the exact `ended` value
remains ended. The migration leaves posts without either key unchanged.

The API and mobile source picker read only `operation_status`. New requests
that send `club_operation_status` to an activity source guide receive
`422 INVALID_CLUB_OPERATION_STATUS`. Editing a guide without sending the new
key preserves its stored status. Existing certification links remain editable.

## Verification

- Backend: 500 passed, 1 skipped; one third-party TestClient deprecation warning.
- Frontend: 798 passed; typecheck passed; lint 0 errors and 2 pre-existing
  duplicate-import warnings in `frontend/app/(tabs)/board/post/[postId].tsx`.
- PostgreSQL rehearsal: extracted the exact migration UPDATE from the new
  Alembic file and ran it against a temporary table inside a rolled-back
  transaction. Verified old `ended` and `active`, both-key precedence, an
  unknown old value, unaffected new-only/missing rows, preserved unrelated
  metadata, and absence of the old key afterward.
- Coordinated production backup completed immediately before deployment at
  `/srv/aisw-backups/20260930T021759Z` on the GCP VM. The PostgreSQL dump,
  public-media tar, and private-media tar passed format/list checks and all
  three SHA-256 checks. The backend and worker restarted healthy afterward.
- Deployment: PR #28 passed Backend, Frontend, and Docker build CI and merged
  as `41cb4ee6db73c154f468f670f5fe7eb6a07496a6`. The GCP VM runs that
  commit. Docker reports backend, frontend-web, database, nginx, worker, and
  certificate renewer healthy. `/health`, `/health/ready`, `/healthz`,
  `/legal/privacy`, and `/(tabs)/home` returned HTTPS 200.
- Production migration: `0031_operation_status_only (head)`; `alembic check`
  reported no new upgrade operations. Across all posts, the old key occurs
  zero times. All 20 `club-promo` posts now have `operation_status`, and the
  13 previously ended posts remain ended. Study and networking ended counts
  remain 11 and 1 respectively.
- Mobile release: Android AAB and APK version `1.0.2` code `11`, iOS IPA
  version `1.0.2` build `13`. AAB and APK package/manifest, signatures,
  archive integrity, and APK 16 KB alignment passed. IPA bundle identifier,
  version, and archive integrity passed. Apple reports iOS build 13 as
  `VALID` and `READY_FOR_BETA_TESTING` in TestFlight.
