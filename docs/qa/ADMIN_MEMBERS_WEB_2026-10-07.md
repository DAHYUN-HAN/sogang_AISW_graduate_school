# Web member management — 2026-10-07

Scope: WP8/WP9 P0. The user requested the main console theme, removal of web
administrator conversion, member search/list and member information editing.
Existing native administration and unrelated in-progress work are preserved.

## Implemented behavior and provisional choices

- `/admin/accounts` and its navigation entry read `회원 관리`. White table rows,
  thin dividers, blue underline filters and compact actions follow the main.
- Search by real display name, email or cohort; Enter/search and reset are
  supported. All/active/inactive filters and 20-row server pagination are used.
  A successful refresh clamps the current page when editing removes matches.
- `정보 수정` opens a right drawer for name, cohort, registered major, phone,
  enrollment and activation. Changes are saved
  together. Email is read-only because it is the verified account identity.
  Role conversion is absent from the web list/editor; existing role APIs and
  the native card remain. Consent, join date and last login remain visible.
- Major choices use active entries in 가입 설정. An existing retired/legacy
  major can remain unchanged; absence of active choices is explained in the UI.
- Only changed fields are submitted. The protected existing update endpoint
  bounds field lengths, normalizes names/optional blanks, rejects explicit null
  required fields and validates changed majors before mutating the member.
  Email, username, password, consent and legacy dues fields cannot be updated
  through the generic profile endpoint. Password reset uses the dedicated API below.
  Duplicate real names remain allowed; author name/cohort snapshots are retained.
- Actual updates produce `user.update` records with changed field names and
  role/status values only. Profile/contact values are not copied into logs;
  unchanged saves do not produce records. Self-deactivation remains forbidden.
- Failed saves preserve input. Close/discard and reload protection are present.
  The drawer lives in the persistent administrator layout: browser Back between
  admin pages may change the background page but keeps the drawer/draft mounted.
  Member saving has its own navigation-lock flag, independent of board operations.
  Confirmed discard clears the drawer before continuing navigation.

## Verification

- Backend: `python -m pytest -q --tb=short` — **568 passed, 1 skipped**;
  one existing Starlette/httpx deprecation warning. New member regressions cover
  protected list/update access, validation/atomic rejection, legacy/inactive majors,
  all filtered pages, immutable identity/snapshots, no-op logging and safe audits.
  Initial implementation tests failed for missing profile support, untrimmed search
  and null statuses, then passed after the changes.
- Frontend: `npm test` — **846/846 passed**. Four member editing regressions cover
  changed-field normalization, clearing, exclusion of role/email, status updates,
  retained legacy majors and shrinking page results. The paging regression failed
  before the helper was added. Typecheck and scoped ESLint passed.
- Actual local browser: authorized preview sign-in, email Enter-search, no results,
  reset, inactive filter, opening/reopening the editor, read-only email, disabled
  self-deactivation, required-name validation, save feedback and persistence,
  continue editing, confirmed discard and two operational records were verified.
- A temporary preview-only position value was saved, reopened and restored to its
  original empty value. Discarded test drafts were not submitted. Other profile
  values and existing preview boards/posts were left intact.
- Settled dirty-draft Back initially lost the route-local drawer. After moving it
  into the existing layout, Back from Accounts to Audit retained the drawer and its
  `뒤로가기 확인` input. No custom browser history implementation was introduced.
- Escape initially cancelled a confirmation on keydown and reopened it on keyup.
  Removing duplicate keydown handling lets React Native Web Modal own Escape;
  one Escape now cancels the confirmation and retains the editor.
- Browser console error list was empty; default viewport/page widths both measured
  1169px, with no page-level horizontal overflow. No viewport override was applied.
- A focused read-only reviewer identified the page-shrink and route-local draft
  issues; fixes and independent member-save lock ownership were incorporated.

Evidence:

- `outputs/qa/admin-main-2026-10-07/member-list.png`
- `outputs/qa/admin-main-2026-10-07/member-editor.png`
- `outputs/qa/admin-main-2026-10-07/member-frontend-tests.log`
- `outputs/qa/admin-main-2026-10-07/member-backend-tests.log`

No schema migration, production data changes, deployment or release was performed.
Tests/interactive preview use isolated SQLite; PostgreSQL/Docker and native-device
runtime verification were not rerun for this web-only change.

## Password reset continuation

The user requested member passwords also be changeable. The existing drawer adds
a white `비밀번호 관리` section, initially collapsed, with masked new password and
confirmation inputs and a separate action/confirmation naming the member. The
existing letter/digit/special-character rule applies; passwords are not trimmed.
Profile saves remain independent. Failed changes retain input; successful changes
clear inputs and invalidate member/main/operating-record queries. Unsaved passwords
participate in leave/reload protection, and confirmation/pending mutation prevents
competing discard navigation. Self-reset requires saving pending profile changes
first, then clears the local session/push storage and returns to login.

The dedicated protected API preserves role/profile/activation, hashes with Argon2
and revokes only the selected member's refresh tokens, active push tokens and all
unconsumed password-reset tokens in one transaction. One audit records the three
counts, never credentials. Existing JWT access tokens expire normally (default
15 minutes); this is refresh revocation, not immediate remote access revocation.
No password is retrieved, logged, stored in query caches or persisted as a draft.

Review found stale-credential races between reset and refresh/password writers.
Login, refresh, reset confirmation and authenticated password changes now serialize
on the same User row. Cached credentials are re-read after acquisition; login
rehash no longer commits before session issuance. Deterministic API interleaving
regressions simulate a reset between token loading and the user serialization
point; a stale self-password-change object is also rejected. Actual PostgreSQL
blocking/deadlock checks remain **Phase 5 QA** because this preview/tests use
SQLite, which ignores `FOR UPDATE`. Request/code-verification flows are unchanged.

Password feature tests initially failed for the missing endpoint/validator/label.
Two stale-token regressions failed before the serialization/re-read fix and passed
after it. Browser verification used only empty inputs: both render `type=password`,
empty submission shows the policy error, and the profile-save button remains
disabled. No actual local account password was entered or changed.

Final verification: backend **582 passed, 1 existing skip**, with the existing
Starlette/httpx deprecation warning; frontend **849/849 passed**; frontend
typecheck/scoped ESLint and backend compile passed. Local API health and web
accounts route returned 200. Focused read-only review confirmed the shared
credential locks/rechecks and competing discard guards, with no remaining
material finding. Browser console error list was empty. The blank expanded form
was left open for review; preview member data and password are unchanged.

Evidence:

- `outputs/qa/admin-main-2026-10-07/member-password-editor.png`
- `outputs/qa/admin-main-2026-10-07/member-password-frontend-tests.log`
- `outputs/qa/admin-main-2026-10-07/member-password-backend-tests.log`

## Affiliation removal follow-up

Per the user's request, removed the web drawer's entire `소속 정보` section
(company/affiliation, job and position). Current signup does not collect these
values. Existing database/API fields and stored values remain; this is a screen
removal only. Basic information, password reset, member status and consent records
remain visible. Typecheck and scoped ESLint passed. Actual browser hot reload and
reopening showed no affiliation inputs in either collapsed or expanded password
states, with the other sections retained and profile save disabled for unchanged
data. No member or password mutation was submitted.

Evidence: `outputs/qa/admin-main-2026-10-07/member-editor-without-affiliation.png`.
