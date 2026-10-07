# Account Deletion UI Alignment Design

**Date:** 2026-08-16
**Priority:** P0 account-management UX alignment
**Scope:** Signed-in account-deletion acknowledgement states and completion presentation

## Problem

The signed-in account-deletion content already matches the supplied mobile reference for its unchecked and checked states: it has the warning header, blue and amber retention notices, acknowledgement checkbox, disabled gray action, and enabled destructive action. Browser comparison found that the surrounding tab layout still exposes the bottom navigation, while the reference is a full-screen account flow. The other visible mismatch is the completion state. Authenticated deletion currently redirects to the public account-deletion route, which renders a public-flow header, detailed retention copy, a login-specific button label, and a privacy-policy link.

The reference instead shows a minimal completion state containing only an outlined green check, `탈퇴가 완료되었어요!`, and a primary `확인` button. The reference does not show current-password verification, but the backend contract requires it for authenticated deletion and it must remain.

## Approved Design

### Pre-deletion states

- Preserve the current signed-in screen because its unchecked and checked states already match the reference.
- Hide the bottom tab bar only on `/settings/account-deletion`; keep it on the account screen, My Page, and all primary tabs.
  - 2026-10-07 superseded: the shipped app never hid it (the category-highlight tab bar rendered the last visible tab's options), and the user chose to keep that shipped behavior. The tab bar now stays visible on `/settings/account-deletion`; the helper and its test were removed. See `PLAN.md` navigation decision.
- Keep the exact blue and amber retention notices, acknowledgement checkbox, disabled gray button, and enabled destructive-red `탈퇴하기` button.
- Keep the current-password modal after selecting `탈퇴하기`. It is a required security step, not an optional visual detail.
- Preserve existing validation, retry feedback, rate-limit handling, administrator restriction, push-token cleanup, and session cleanup.

### Authenticated completion state

- Treat the existing `completed=1` query parameter as the explicit authenticated-completion signal.
- Render the existing shared `CompletionState` for this signal.
- Use the title `탈퇴가 완료되었어요!`, button label `확인`, and confirmation destination `/auth/login`.
- Do not render an app bar, descriptive paragraph, or privacy-policy link in this state.
- Keep the shared component's outlined green check icon, centered layout, and primary-blue fixed-width button.

### Public email-deletion completion

- Preserve the current public completion screen after email-code verification.
- Keep its detailed retention explanation, login link, and privacy-policy link because signed-out deletion needs the additional context.
- Do not infer the compact member completion from authentication store state; only `completed=1` selects it. This prevents stale session state from changing the public flow.

## Architecture

Add a small pure presentation selector to `frontend/utils/accountDeletion.ts`. It maps only the explicit completion query value to the compact member-completion title, button label, and destination. The public route consumes this selector before its existing public success branch and renders `CompletionState` only when the selector returns a value. Add a focused tab-visibility helper consumed by the tab layout so the account-deletion path becomes full-screen without changing sibling routes.

No backend, API, database, authentication, or deletion-policy change is required.

## Error and Navigation Behavior

Deletion errors remain on the signed-in screen or password modal. A successful authenticated deletion clears the stored push token and session before navigating to `completed=1`, exactly as it does now. Selecting `확인` on the compact completion screen replaces the route with `/auth/login`, so the deleted session cannot return to protected settings through Back navigation.

## Testing

- A pure behavior test verifies that only `completed=1` selects the compact member presentation.
- A route behavior test verifies that only `/settings/account-deletion` hides the tab bar. (Removed 2026-10-07 with the tab-bar hiding.)
- The test verifies the approved title, button label, and login destination using hand-derived literals.
- Existing account-deletion security and retention tests remain unchanged.
- Full frontend tests, typecheck, lint, and a 360px browser capture verify the integrated result.

## Considered Approaches

### 1. Conditional reuse of `CompletionState` (selected)

This gives the closest reference match with the smallest change and preserves the public deletion flow.

### 2. Replace the shared public success screen

This is simpler conditionally, but it would remove important context from signed-out email deletion and change a separate flow the reference does not cover.

### 3. Add a new authenticated completion route

This would isolate the layout, but it duplicates an existing completion component and adds navigation surface without changing behavior.
