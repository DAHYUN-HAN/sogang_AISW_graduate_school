# Android Back and Home Navigation Audit Plan

**Goal:** Check every implemented route family and relevant navigation state, recording wrong destinations, lost state and awkward transitions.

**Architecture:** Read-only audit of current Expo Router source plus the installed Android APK. Use a separate temporary Android user for safe initial authentication states; inspect mutation-dependent completion states from source and label runtime limits. Record source findings separately from runtime reproductions.

**Tech stack:** React Native / Expo Router, Android 16 Pixel 7 emulator, ADB screenshots/UI hierarchy/video, existing TypeScript regression tests.

**Spec:** User-requested broad Back/Home audit; `docs/phase2/FRONTEND_ROUTE_SPEC.md`, WP5/WP9 in `CODEX.md`.

## Constraints

- Preserve unrelated working-tree edits and current production login.
- Do not submit posts, comments, reports, deletions, account changes or administrator changes to production as part of navigation testing.
- Compare header Back, Android Back, in-app Home/tab selection, and Android Home/resume where applicable.
- Check keyboard, dialogs, sheets, expanded nested content and repeated visits before declaring a route family covered.
- Do not claim arbitrary permutations or physical-device coverage. Explicitly inventory 35 route files and mark equivalent, unreachable, local-only or blocked states.
- This request is an audit; record actionable defects and reproduction steps without silently changing application behavior.

## Execution

- [x] Inventory all route files, Back handlers, overlays and differences between current source and the installed APK.
- [x] Verify all five tab roots: Back, repeated tab selection, app Home round trips and Android Home/resume.
- [x] Verify Home entry points: notices, calendar day/event detail, album, notifications, drawer; compare return paths.
- [x] Verify community/resources: category, search, detail, album controls, More/report/delete-cancel overlays, comment keyboard, create/edit and selector cancellation.
- [x] Verify participation: club/study/networking tabs, guide/list/detail, activity certification, recruitment/create selectors and return state.
- [x] Verify all seven Council menu entries and nested past-council/cohort selections, FAQ expansion, mutual-aid/suggestion forms.
- [x] Verify drawer from each tab; profile, notifications, account, activity, nested settings, legal pages, and repeated header/hardware returns.
- [x] Verify Android Home/resume with a detail, keyboard, unsent draft, drawer and native modal; verify exit/reopen separately.
- [x] Inspect authentication, completion and administrator routes; exercise safe reachable initial states in a separate Android user and explicitly record unexecuted mutation-dependent states.
- [x] Record short native transition videos for suspected flashes, inspect frames and distinguish app behavior from emulator startup/ANR limitations.
- [x] Run existing navigation regression suites and executable source probes for discrepancies; report their scope separately from APK results.
- [x] Produce a coverage matrix, severity/reproduction list, screenshots and remaining explicit limits; restore temporary emulator display settings.

## Outcome

Audit report: `docs/qa/NAVIGATION_AUDIT_2026-09-12.md`. All 35 routes inventoried; 32 reached in the installed APK and 3 reviewed from source only. Seven main findings, 124 recorded XML checks (113 pass / 11 differing from expectation), and 107 existing navigation unit tests passed. These are bounded audit results, not exhaustive state-combination coverage. Secondary-user System UI/automation failures and unexecuted authentication, completion, administrator and comment-edit combinations are listed in the report. Original login, display settings and gesture navigation restored; temporary user removed and task-owned emulator stopped. No app source change, build, deployment, commit or push.
