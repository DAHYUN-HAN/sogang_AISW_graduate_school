# Long-post dragging: report reopened — 2026-09-13

Later follow-up: the user clarified that the body must stop growing and scroll internally while the whole form also scrolls. That bounded-body behavior is now implemented and verified in Android APK 9; see `POST_BODY_NESTED_SCROLL_2026-09-13.md`. The investigation below records the earlier, expanding-body implementation and should not be read as the current implementation status.

WP5/WP9 P0. The user reports that the downloaded APK still cannot reach Register by dragging inside a long body after Android Back hides the keyboard. **Status: Phase 5 QA, awaiting reproduction on the reporting device. This is not a completed fix.** Earlier emulator passes do not establish resolution of this report.

## Installed APK and method

Pixel 7 emulator, Android 16/API 36, 1080×2400, density 420, Gboard, gesture navigation. Installed APK 8 (`AI-SW-CAMPUS-0.1.0-8-back-fix.apk`) was verified against the local artifact by the installed base APK's SHA-256: `0f151f5fdad2524191ed66a7fd880950889949553d42c94f9f402833f5803411`. Its composer is unchanged from APK 7; APK 8 changes the separate retained-Activity Back issue.

Entry: actual launcher icon → Community → Resources → +. The default lecture-review composer was used. The title remained empty and no post was submitted. ASCII lines used native text input and actual Enter events. Keyboard dismissal used a right-edge Back gesture; subsequent upward drags began inside the body, x540, y1700→1000 over 600 ms.

Evidence: `outputs/qa/long-post-scroll-2026-09-13/`, particularly `observations.json`, `verify_observations.py`, and the numbered PNG/XML captures.

| Condition | Observation |
| --- | --- |
| 30 numbered ASCII lines, font scale 1.0 | Back hides keyboard; inside-body drag reveals Register. All 30 lines retained. Captures 10–12. |
| Extend the same draft to 60 lines using Enter | Inside-body drag reveals Register; exact 60-line text retained. Captures 14–16. |
| Long prefilled Korean text, font scale 1.3 | Repeated inside-body drags reach Register. This deep-link prefill lost explicit newlines, so this case covers automatic wrapping, not pasted multiline text. Captures 18–25. |
| Add 10 actual Enter events to that Korean draft | Keyboard-hidden inside-body drag reaches Register. Captures 26–28. |
| Native diagnostic injection: Korean and emoji text, 60 paragraphs plus trailing blank lines | 182 native display lines; inside-body drag reaches Register. This is native `EditText.setText` injection, not a physical paste or Korean IME composition test. Captures 31–33 and `native-metrics.log`. |

In each recorded final capture the complete Register button is `[53,1912][1028,2038]`, inside the actual form viewport `[0,275][1080,2143]`; merely finding its accessibility label was not counted as visibility. Initial emulator System/Launcher ANRs were excluded from passing evidence.

## Native measurement and decision

A temporary, separately signed local instrumentation APK inspected the installed app without changing its binary. It reports geometry, text length/line count and scroll flags; it does not log body text. The final 182-line body has frame height 10082 px, native layout plus padding height 10079 px, `scrollY=0`, and all four `canScroll` directions false. During the inside drag the outer form scroll offset moves from 8558 to 9059 and reaches its bottom. A transient overflow immediately after programmatic replacement settles when Fabric updates the layout.

RN 0.81.5's `ReactEditText.onTouchEvent` can retain a drag if its input has any internal scroll range. However, persistent overflow was **not observed in the long body** in these checks. The current composer already grows through native/Fabric measurement. Adding explicit JS-controlled height would introduce another asynchronous layout update without a demonstrated mismatch to fix. The proposed height callback contract was therefore kept only as an experiment in the ignored evidence folder, not shipped as a regression test or application change. Read-only review reached the same evidence limit.

No composer change or new APK was produced. The prior APK 8 Back correction remains intact. Drafts were closed without submission; the temporary probe was removed and original font scale restored after testing.

## Missing reproduction inputs

The affected APK filename/version, phone model, Android version, keyboard app, display/font settings, and approximate/exact triggering text remain unknown. The user was asked for device and line-count information during the investigation. Repeat the user's full sequence with those conditions before selecting a fix or claiming resolution. No reporting physical device, iOS, or browser run was performed here.
