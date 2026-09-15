# Bounded post body and whole-form scrolling — 2026-09-13

WP5/WP9 P0. The user clarified that the body must stop expanding indefinitely, scroll internally, and coexist with scrolling of the whole writing form. The previous investigation checked whether an expanding body could reveal Register; it did not satisfy this clarified interaction.

## Implementation

The shared `FormTextInput` in `frontend/app/(tabs)/board/post/create.tsx` now limits native multiline fields to 240 points while preserving their existing minimum heights. This covers resource/suggestion/study content, activity feedback, mutual-aid remarks and study contact fields; the shared create/edit form uses the same component.

- Android: a bounded native ScrollView contains the naturally sized TextInput. The inner and outer ScrollViews enable native nested scrolling, allowing movement at a body boundary to continue through the form. The TextInput remains unbounded inside the viewport so it does not introduce a third competing scroll range.
- The stationary viewport owns the border/background/radius. Inner minimum height compensates for border thickness, retaining the existing focus and error styling.
- iOS: the native scrolling TextInput itself is capped at 240 points, retaining UITextView's caret/selection behavior. It does not use the Android wrapper.
- Single-line fields and web retain their existing layout. No custom pan interception, input disabling, unconditional scroll-to-end, or new dependencies were added.

## APK and source verification

Artifact: `outputs/android/AI-SW-CAMPUS-0.1.0-9-post-scroll.apk`, version 0.1.0 / versionCode 9, arm64-v8a and x86_64, existing local debug signing key for direct-install testing.

SHA-256: `8a5ca7a01f94e5a59d77211b8fb4a5995fac07ff9dc51b7d2747db534370d80f`.

Evidence directory: `outputs/qa/post-nested-scroll-2026-09-13/`. Gradle assembleRelease succeeded in 8m33s. Both native ABI target checks succeeded using the existing Ninja 1.13.2 workaround before Gradle packaging. Verification covers 309 staged source files, 133 bundled current app sources, exact packaged Hermes bytes, native-library provenance, ZIP CRC, 16KB alignment and signing. The APK retains `enableOnBackInvokedCallback=false` from the separate APK 8 Back fix.

## Native results

Installed APK 9, Pixel 7 emulator, Android 16/API 36, 1080×2400 / density 420, font scale 1.0, Gboard. General resource composer: Community → Resources → +. The title stayed empty; temporary drafts were closed without submission. A separate local instrumentation APK measured native view geometry, scroll offsets and caret rectangles without changing the tested app binary.

The old APK 8 has no independent body viewport and grows the native editor to 10082 px for the earlier 182-display-line case (`native-baseline-red.json`). APK 9 keeps its body viewport at **630 px = 240 points**, while the content can grow and scroll inside it.

| Check | Result and evidence |
| --- | --- |
| Enter 30 numbered lines using actual native text/Enter events | Body viewport remains 630 px; editor is 1409 px. Typing follows the caret inside the viewport and above the keyboard. `07-thirty-typed`. |
| Drag upward inside body at its bottom | Whole-form offset changes 0→200; body offset remains 778. Register becomes fully visible at y1286–1412, above the form/keyboard boundary y1517. `07`→`08-body-edge-up`. |
| Drag downward inside the body | Body offset changes 778→468 while whole-form offset remains 200. `08`→`09-body-down`. |
| Real right-edge Android Back hides keyboard; drag body both directions | Keyboard stays hidden; inner offsets change while outer offset stays 0. Full Register remains visible at y1486–1612. `10`–`12`. |
| Tap existing middle text and type EDIT | Exact insertion at the tapped selection, no jump to the end, caret remains visible. `13`→`14-edit-middle-result`. |
| Clear long content | Native field returns to approximately 100 points (262 px); both scroll offsets reset to 0. `15-cleared`. |
| Replace with 60 Korean paragraphs plus trailing blank lines | 122 native display lines, editor 5549 px, viewport still 630 px; caret visible. This uses native diagnostic `setText`, not a physical paste/IME composition test. `16-korean-sixty`. |
| Drag outside body | Whole form moves independently; body offset stays unchanged. `17`→`18`. |
| Start body at its top and drag downward | Whole-form offset changes 200→0 while body offset remains unchanged. `23`→`24-body-top-to-form`. |

`verify_runtime.py` passes all ten recorded behavior/geometry checks. It checks complete button bounds, both scroll offsets, content preservation, keyboard state and caret visibility rather than treating an accessibility label as proof of visibility. Startup System UI ANR captures are excluded.

After stopping instrumentation, the separate Back regression also passes on APK 9: Home → real right-edge Back → launcher icon → Participation → right-edge Back returns to Home. The app PID remains 5810 across the sequence. Captures 28–32 and `back-regression.json` record this one-cycle check; APK 8's earlier multi-cycle evidence remains in its own QA document.

Cleanup: drafts were closed without submission, the temporary instrumentation package was uninstalled, and the owned headless emulator was stopped. The original font scale (1.0), display and gesture-navigation settings were preserved. APK 9 remains the installed test version in the emulator's saved data.

## Automated checks and limits

- New actual-component configuration tests: initial 4 failures / 1 pass, then all 5 pass. The iOS native-editor variant also failed its new expectation before correction.
- Full frontend suite: **619 passed**, zero failures/skips/cancellations. Typecheck passes. Scoped ESLint has zero errors and two pre-existing duplicate-import warnings at the start of the composer.
- Read-only code review found no actionable defect; its caret/gesture concerns were checked in the native run above.
- The native run uses the general resource composer. Other shared form variants and saved-post editing have source/configuration coverage, not separate end-to-end native runs here.
- `Phase 5 QA`: reporting physical Android device/keyboard combinations and iOS runtime validation remain unverified. The iOS change has source/type/configuration verification only. This APK is a local test artifact, not a store submission.
