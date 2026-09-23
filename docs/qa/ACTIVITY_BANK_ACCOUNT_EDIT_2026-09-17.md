# Saved activity bank account editing — 2026-09-17

Scope: WP5/WP9 P0 activity-certification editing.

## Cause and behavior

The account was stored correctly, but ordinary member responses redacted it and the shared edit form always initialized the account field to an empty string. It was optional during edit, so leaving it blank already preserved the stored account, but the empty input looked like a reset.

- The existing `for_edit=true` endpoint now returns the saved account after author/admin edit authorization. No new endpoint or schema migration is needed.
- Only the account gains this edit exception. Other sensitive metadata, including study migration snapshots, keeps its existing restrictions.
- Ordinary member list/detail responses still redact accounts. Peer edit requests return 403; unauthenticated requests return 401.
- The shared club/study/networking activity form initializes the account from the authorized edit response. Existing one-time hydration and fresh edit-query behavior prevent background refreshes from overwriting in-progress changes.
- The input can be changed directly. Unchanged or blank input retains the existing account; a non-empty replacement is stored and loaded on the next edit.
- Per the user's follow-up, the account guidance box is hidden while editing. New-post account guidance and the account input behavior remain unchanged.

## Verification

- RED: API tests failed because the author's edit response lacked `bank_account`; the actual-screen hydration test received an empty account instead of the saved value.
- GREEN: related API suite 100/100; frontend regression suite 48/48; TypeScript typecheck passed.
- Scoped ESLint: 0 errors, 2 pre-existing duplicate-import warnings in the create screen. Backend compile and `git diff --check` passed.
- Authorization tests cover club/study/networking boards, author/admin edit access, peer/guest denial, ordinary list/detail redaction, and continued redaction of unrelated private study metadata.
- Existing-account preservation, replacement and reopening are tested through the API. The frontend executes the actual hydration callback and verifies that a later invocation does not overwrite a user's replacement.
- Local mobile web (390 x 844): logged in as the ordinary fixture author, opened club activity detail > Edit, and confirmed `테스트은행 123-456-789` was prefilled. Changed it to `QA Bank 999-000`, saved, reopened Edit and confirmed the replacement was prefilled. Ordinary detail continued to omit the account.
- The manually prepared fixture initially used a hyphen date, while the form's existing validator expects a dot date. Selected the same date through the calendar before saving and corrected the local fixture helper; no unrelated date behavior was changed.

Local ignored screenshots:

- `outputs/qa/image-viewer-2026-09-17/activity-bank-account-prefilled-mobile.png`
- `outputs/qa/image-viewer-2026-09-17/activity-bank-account-saved-mobile.png`

Only the isolated local QA database and synthetic bank-account values were used. Native device/package checks remain Phase 5 QA. This change is not deployed.
