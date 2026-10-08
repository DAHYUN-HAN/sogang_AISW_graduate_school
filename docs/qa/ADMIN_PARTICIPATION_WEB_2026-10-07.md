# Participation management — 2026-10-07

Scope: WP8/WP9 P0 admin surface. The user asked where to register clubs and
networking events and make them available for activity certification.

## Changes

- The aggregate section previously resolved its create action from the first
  sorted board. In the preview this was `club-activity`, so `글 작성` did not
  open club registration. Added canonical active guide selection and explicit
  `동아리 등록` / `네트워킹 행사 등록` actions independent of sort order.
- Separate `활동 인증 보기` navigation; a selected certification board retains
  `활동 인증 작성`. Existing custom-child creation, settings, post operations,
  image replacement and native board management remain available. Hidden guide
  boards do not fall back to certification creation.
- Guide tabs now say `동아리 목록` / `행사 목록`. Added brief guidance showing
  where operation status controls certification eligibility.
- Networking guide create/edit now uses the same existing `operation_status`
  control and payload as club guides. Missing legacy status defaults to active.
  Ending a guide excludes new certification selection and leaves historical
  certifications editable; resuming restores eligibility. Recruitment state,
  participant/dues rules, application URL and image requirements remain.
- No new API, DB migration, authentication bypass or production configuration.
  The backend preserves its existing explicit admin-only guide rules.

## Verification

- Added five real page-action regression cases. All failed before the change
  and passed afterward: aggregate registration destination for club/networking,
  selected certification creation for both, and hidden-guide fallback prevention.
- Frontend typecheck and scoped ESLint passed.
- Frontend full suite: **854 passed**, zero failures. Log:
  `outputs/qa/admin-main-2026-10-07/participation-admin-frontend-tests.log`.
- Backend targeted guide/source suite: **42 passed**, one pre-existing
  Starlette/httpx deprecation warning. Added explicit admin networking
  active→ended→active API verification, including member denial and historical
  certification editing. Runs use isolated test SQLite, not preview data. Log:
  `outputs/qa/admin-main-2026-10-07/participation-admin-backend-tests.log`.
- Browser: club registration opened `/admin/boards/create?boardId=23` and
  networking registration opened `?boardId=27`; both rendered operation state.
  Confirmed the networking certification action selects its certification tab.
  Forms were closed without entering, uploading or saving content.
- Preview currently contains zero club/networking guide or certification posts.
  Existing-post edit hydration/save was covered by code/type/API checks rather
  than a real browser mutation; no preview roster/payment/post data was added.

## Evidence

- `outputs/qa/admin-main-2026-10-07/club-registration-controls.png`
- `outputs/qa/admin-main-2026-10-07/networking-registration-controls.png`
- `outputs/qa/admin-main-2026-10-07/participation-management-controls.png`

## Follow-up: participation link deferred

The user requested removing the participation-button link input until later.
Removed it from club/networking create/edit schemas, hydration, rendering and
required checks. Updated visible guide descriptions. Operation status is now
included independently of the URL; edits spread existing metadata so stored
links are preserved. The backend accepts absent/empty URLs and still rejects
non-HTTP(S) non-empty URLs. Existing guide image and admin-only policies remain.

Added four API cases covering club/networking link-free creation/editing,
operation-state persistence, member denial and invalid optional URL rejection.
The two no-link cases failed with `APPLICATION_URL_REQUIRED` before the change
and passed afterward. Updated existing frontend assertions that referenced the
removed field/guidance; unrelated evidence-link validation remains.

Verification: frontend **854 passed**, backend **587 passed / 1 existing skip**
and one existing Starlette/httpx deprecation warning; frontend typecheck and
scoped ESLint passed; backend compile passed. Logs:

- `outputs/qa/admin-main-2026-10-07/participation-link-deferred-frontend-tests.log`
- `outputs/qa/admin-main-2026-10-07/participation-link-deferred-backend-tests.log`

Restarted only the local preview API to apply validation; health returned 200.
Browser verification used a temporary background tab, preserving the user's
current member view. The networking create form visibly omits the link and
retains title, content, operating state and images. The club path uses the same
form and passed API/type checks; additional browser navigation redirected to
login, so a second rendered club capture was not taken. No preview post save, credential
change or media upload. Screenshot:
`outputs/qa/admin-main-2026-10-07/networking-registration-without-link.png`.
