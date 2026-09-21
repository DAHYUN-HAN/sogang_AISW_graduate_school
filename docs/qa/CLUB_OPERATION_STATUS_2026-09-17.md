# Club operation status — 2026-09-17

Scope: WP5/WP9 P0 activity-certification source selection and administrator club settings.

## User decision

Recruitment closure and club operation ending are separate. Every published, non-deleted operating club is selectable, regardless of its name or recruitment state. Existing clubs default to operating. An operation-ended club cannot be newly selected, while its existing certifications remain readable and editable.

## Implementation

- Removed the previous seven-name allowlist from the shared certification create/edit form.
- Club guide create/edit exposes `운영 중 / 운영 종료`. The existing JSONB metadata stores `club_operation_status: active | ended`; no schema migration or data backfill is needed.
- All published source pages are loaded before operation-ended guides are filtered out. Recruitment category and `recruitment_status` do not affect eligibility.
- The API rejects new/changed links to operation-ended guides, validates explicit operation-state values, and preserves the stored state when older clients omit it.
- Existing historical links remain editable. Explicitly saving `active` resumes new certification eligibility.
- Source-option queries share the board-post cache prefix, so administrator saves invalidate their cached choices.

## Verification

- Frontend regressions first reproduced the missing new-club choices, operation-ended clubs incorrectly included in choices, and source caches missed by administrator-save invalidation. All now pass.
- API regressions first reproduced acceptance of operation-ended sources and invalid operation-state writes. Related club/guide/certification API tests pass 20/20.
- Full frontend suite passes. Full backend suite: 429 passed, 1 skipped; one existing Starlette/httpx deprecation warning.
- TypeScript typecheck passes; scoped ESLint has no errors and the two existing duplicate-import warnings in the create screen. Backend compile and `git diff --check` pass.
- Local mobile web (390×844): a legacy club initializes as operating; administrator saves operation ended; stored metadata is `ended`; the club disappears from the certification picker while the other operating club remains.
- Desktop web (1280×900): reopening the editor restores the selected operation-ended state. Switching back to operating saves successfully.
- API lifecycle test verifies recruitment-closed/operating certification creation, operation-end rejection, historical edits, omitted-key preservation, and explicit resumption.

Screenshots (local ignored QA artifacts):

- `outputs/qa/image-viewer-2026-09-17/club-operation-status-mobile.png`
- `outputs/qa/image-viewer-2026-09-17/club-operation-status-web.png`
- `outputs/qa/image-viewer-2026-09-17/club-operation-ended-excluded-mobile.png`

These checks used the isolated local QA database and test users. Production data was not modified. Native device/package verification remains Phase 5 QA; this change is not deployed.
