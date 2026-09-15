# Four reported mobile issues — verification, 2026-09-12

2026-09-13 correction: the user reports that keyboard-hidden inside-body dragging still fails on the downloaded APK. The emulator passes below do not establish resolution on that device. The report is reopened; expanded APK 8 checks and native measurements are documented in `docs/qa/LONG_POST_SCROLL_RECHECK_2026-09-13.md`.

Follow-up: after this audit, the user authorized the comment keyboard and council-header corrections. Their source changes and Android captures are recorded below. A subsequent installed-APK run also completed both the exact restart/Participation/Back sequence and the keyboard-dismissal-first long-draft sequence; see the final section. The original audit below describes the earlier state.

WP5/WP9 P0 verification only. No application source was changed and no APK was built or installed.

Current source: `cf1be8c0865228460e09409c1029a133b7b600b6`. Installed Android package: `kr.ac.sogang.aisw.campus`, version `0.1.0` / versionCode `4`, last updated 2026-09-11. The comparison in `outputs/qa/four-issues-2026-09-12/source-check.json` confirms that the create screen, council board screen, Android Back hook/decision helper, and keyboard viewport match the version-4 build's recorded SHA-256 values. The current comment submission handler also matches the version-4 source HEAD; its surrounding file has the subsequent gallery-icon change.

| Report | Finding | Evidence and limits |
| --- | --- | --- |
| Keyboard remains after comment registration | The requested dismissal is not implemented. | Executed the current source's successful comment handler: it clears the text, resets the input height and reply target, but issues no keyboard dismissal or input blur. This is source-level confirmation; a new successful native comment submission was not completed today. |
| Replace 현재 원우회 with 원우회 임원진 소개 | Partially implemented; the detail header still needs correction. | Menu labels already use 원우회 임원진 소개. `ExecutiveIntroScreen` evaluates `council?.title` first: executing the actual expression with existing-style title data returns 현재 원우회; only absent title data uses the desired fallback. The screen source matches the installed APK. |
| Home Back → reopen → Participation → Back exits the app | Existing fix and packaged-APK pass are documented. | `APK_REGRESSION_2026-09-11.md`, row 7, records the exact sequence ending at Home. The current Back logic matches that build; all eight dedicated Back tests pass today. Today's new sequence reached Home → launcher, then system/launcher ANRs interrupted re-entry, so it is not counted as a new full runtime pass. |
| Long body → hide keyboard → inside-body drag cannot reach Register | Existing keyboard/scroll fix is present; the exact newly requested order remains unverified today. | `APK_REGRESSION_2026-09-11.md`, row 14, verifies 30 lines and an inside-body drag exposing Register above the open keyboard. This is related evidence, not the complete hide-keyboard-first sequence. Current composer and keyboard viewport hashes match the tested APK. |

## Checks performed today

- `tsx --test tests/androidTabBack.test.ts tests/postCreateBack.test.ts tests/commentKeyboard.test.ts tests/councilIntroductions.test.ts`: **45 passed**, zero failures/skips/cancellations. These existing tests do not establish that the two missing behaviors are implemented. Log: `outputs/qa/four-issues-2026-09-12/focused-tests.log`.
- An isolated probe executes the extracted current comment success handler and council title expression. Results: `source-probe.json`; reproducible script: `source-probe.cjs` in the same evidence directory. It does not simulate native keyboard visibility.
- Android screenshots and foreground activity inspection confirm the installed package and a Home Back returning to the Pixel launcher (`apk-exit-confirmed.txt`). The later captures contain System UI/Pixel Launcher ANRs and Expo connection/loading errors and are excluded from passing results.
- The development server's dependency metadata fetch failed with `Body is unusable`; an offline launch subsequently reached its listening state, but the Android development screen did not load for the intended interaction checks. A combined follow-up command for development-server connectivity/environment inspection and Expo reopening was rejected by automatic approval review with `blocked by policy` and no further reason; it was not retried. Source checks and existing packaged-APK evidence were used to finish the audit.
- A disposable post was prepared only in the isolated local SQLite fixture (`postId: 10`, `boardId: 8`). No production post or comment was created, edited, or deleted. No comment was submitted during the incomplete native run.

Conclusion: comment-success keyboard dismissal and the populated council detail header still need implementation. The Back issue has an existing exact APK pass. Long-form scrolling has existing related APK evidence, but the user's keyboard-dismissal-first order still needs a completed native check. Physical-device behavior is not established by this emulator audit.

## Authorized source corrections

- Add `Keyboard.dismiss()` to the existing comment mutation's success callback, after the composer and reply state are cleared. This shared path also covers replies. Pending and failed requests keep their existing behavior. The installed React Native implementation calls `TextInputState.blurTextInput` for the focused input, so an additional blur handler is unnecessary.
- Render the executive-introduction detail header as `원우회 임원진 소개` directly. Existing stored titles and introduction content are unchanged; member menu labels already use the same wording.
- Regression tests execute the actual screen's comment handler with controlled mutation completion. The two success cases failed before the change (zero dismissal requests) and pass afterward; the failure case preserves the composer without requesting dismissal. The focused comment/council suite passes 30/30.
- Full frontend suite: **588/588 passed**, zero failures/skips/cancellations; log: `outputs/qa/four-issues-2026-09-12/fix-full-tests.log`. Read-only code review found no actionable issues in the two changed screens and regression tests.
- Frontend typecheck and ESLint on both changed screens plus the new test: **passed**, exit 0, no lint warnings. Log: `outputs/qa/four-issues-2026-09-12/fix-typecheck-lint.log`. An initial type check exposed test-only empty-array narrowing; the assertion was corrected and the full tests/typecheck/lint were rerun successfully. `git diff --check` also passed.
- These corrections do not change the Back or long-form scrolling implementations. Source verification was followed by the Android runtime checks below. No new APK was generated or installed.

## Follow-up Android captures

The user requested screenshots of the completed work. The current uncommitted source was loaded through Expo Go on Pixel 7 / Android 16, using Metro on port 8086 and the isolated local FastAPI/SQLite fixture on port 8000. The capture run's source SHA-256 values match the files that passed 588 tests, typecheck and scoped lint. Display capture used 720×1600 / density 280, preserving the device's logical width. This verifies the development runtime, not the previously installed version-4 APK or a physical device.

Evidence directory: `outputs/qa/comment-council-captures-2026-09-12/`.

| Check | Result | Evidence |
| --- | --- | --- |
| Community → Resources → Exam Archive → post 10 → type comment | Passed: typed content and visible keyboard, focused composer, zero comments. | `07-comment-before.png`, matching XML, `07-keyboard-state.txt` (`mInputShown=true`). |
| Tap the comment registration button once | Passed: comment count becomes 1, submitted content appears, composer clears and loses focus, keyboard closes without Back or an outside tap. | `08-comment-after.png`, matching XML, `08-keyboard-state.txt` (`mInputShown=false`); local SQLite independently contains exactly the submitted comment. |
| Settled registered-comment screen | Passed: submitted comment remains and composer/tab layout is restored. | `13-comment-after-settled.png` and matching XML, captured after reopening the same post. The original immediate-after capture above is retained separately because it caught the layout during its keyboard-close transition. |
| Council → Executive Introduction | Passed: the detail app bar reads `원우회 임원진 소개`. Local fixture metadata has the nonempty title `제30대 원우회`, so the result does not rely on an empty-title fallback. | `09-council-menu.png`, `10-council-title.png` and matching XML. |

Only the disposable local post received a comment (`Keyboard check 2026-09-12`); no production content was written. Native reply/error scenarios were not repeated in this screenshot run; their success/failure callback coverage is included in the passing source regression suite. Back and long-form scrolling were not retested in this follow-up.

The initial emulator startup had a System UI ANR, and an attempted environment-override Metro launch was rejected by automatic approval review with `blocked by policy` and no additional reason. The existing normal offline Expo configuration then loaded the app successfully. Loading/error captures `00`–`01` are excluded from passing evidence.

## Follow-up: exact Back and keyboard-hidden scrolling sequences

Both scenarios passed on the installed Android APK in the user's follow-up recheck. This run used `kr.ac.sogang.aisw.campus`, version `0.1.0` / versionCode `4`, last updated 2026-09-11, on Pixel 7 / Android 16. It did not use Expo Go. Current HEAD `cb692f8` has identical SHA-256 values to the version-4 build for the post composer, Android Back hook/decision helper, keyboard viewport and root navigator; `outputs/qa/back-scroll-recheck-2026-09-12/source-check.json` records all five comparisons. No application code was changed, and no APK was built or installed during this recheck.

| Exact scenario | Observed result | Evidence in `outputs/qa/back-scroll-recheck-2026-09-12/` |
| --- | --- | --- |
| Home → Android Back → launch app again → Participation → Android Back | **Passed.** First Back returned to the Pixel launcher; after reopening, Participation Back returned to the app Home without exiting. | `03-home-back-launcher.png`, `03-exit-activity.txt`, `04-reopened-home.xml`, `05-participation.png/xml`, `06-participation-back-home.png/xml`, `06-return-activity.txt`. |
| Community → Resources → Exam Archive → + → enter 30 body lines using Enter → Android Back to hide keyboard → drag inside body | **Passed.** Keyboard changed from shown to hidden. Register was outside the viewport immediately after dismissal. One upward drag from `(360,1100)` to `(360,600)` over 600 ms, entirely inside the visible body, scrolled the form and exposed the complete Register button at `[35,1276][685,1360]`, above the content viewport bottom `1429`. The keyboard stayed hidden and all 30 lines were retained. | `12-long-draft-keyboard.png/xml`, `13-keyboard-hidden-before-drag.png/xml`, `14-inside-drag-register-visible.png/xml`; matching `12`/`13`/`14` keyboard-state text files. |

The source-level Android Back and composer Back tests also passed **18/18**, zero failures/skips/cancellations. The draft was closed without submission; production posts/comments were not created, changed or deleted. Capture display was temporarily 720×1600 / density 280, equivalent logical width to the original 1080×2400 / density 420. An initial System UI ANR was dismissed with Wait before the interaction sequence; startup/error captures are not pass evidence. These are installed-APK results on one Android emulator, with physical-device and iOS coverage still separate.
