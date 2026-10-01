# Shared typography verification — 2026-10-01

Scope: WP9 P0, apply the same Pretendard faces to app-owned text and inputs on native and web.

## Cause and implementation

The previous global font patch required `Text.render` / `TextInput.render`. Installed React Native 0.81.5 exports both as functions without that property, so its guard silently skipped native font application. React Native Web's forward-ref exports have `.render`, which explains the platform difference. This was reproduced with the installed module source and the production patch, then with regression tests: web passed while eight native typography checks failed.

`AppTypography.tsx` now sets font styles before rendering native/web Text and TextInput through their public interfaces. The original numeric weights select the six static faces and physical weight `normal`, preventing synthetic bold or an unintended native face selection. A local text context preserves nested logical weights and custom families. React 19 refs and other props pass to the native instance. Fifty-nine application consumers use the wrappers; an import audit checked 76 screen/component files and found no remaining app-owned raw Text/TextInput imports outside the wrapper.

Font assets are loaded only by the root through `fontAssets.ts` and the existing readiness gate. Style helpers no longer import binary files. Navigation header/tab labels have explicit font families; web antialiasing remains idempotent. Two obsolete source-string font checks were replaced by tests that execute the real wrapper and actual React Native Web renderer. Existing isolated screen tests recognize the new typography boundary while retaining their navigation/admin/attachment assertions.

## Verification

| Check | Result |
| --- | --- |
| Baseline frontend suite | 798/798 passed |
| Final frontend suite | 806/806 passed |
| TypeScript | `npm run typecheck` passed |
| ESLint | 0 errors; two existing MediaImage duplicate-import warnings in post detail |
| Web export | Passed, production JS bundle generated |
| Android export | Passed, native JS bundle generated with `--no-bytecode` |
| Exported assets | All six OTF assets in both exports match source SHA-256 |
| Native boundary tests | All weights, nested inheritance/override, style arrays, custom families, refs/events, caller-style immutability passed |
| Real React Native Web rendering | Text/input family selection and normal physical weight passed |
| Chromium runtime | Login/register fonts, all six face downloads, input focus/blur, zero page errors passed |
| Android 16 / Expo Go 54.0.8 | Login/register rendering, text entry and keyboard dismissal verified |
| Android live font registry | Inspector `getLoadedFonts()` returned all six expected Pretendard aliases |
| Read-only code review | No actionable findings |

## Runtime evidence

Local, ignored artifacts: `outputs/qa/typography-2026-10-01/`.

- `font-web-smoke.json`: registered/downloaded faces, computed input family/weight, focus/blur result and page errors. Expo registers unused web faces before their first download; the probe explicitly requests each face with Korean, Latin and numeric glyphs.
- `font-web-login.png`, `font-web-register.png`: Chromium viewport 405 × 900.
- `font-native-login.png`, `font-native-register.png`, `font-native-input.png` and matching UI XML: Android 16 emulator, 1080 × 2400, actual Expo Go native rendering.
- `native-font-inspector.json`: live Hermes font registry, app typography module initialized, native Text/TextInput `.render` still undefined as expected.
- `font-web-export/`, `font-android-export/`: exported bundles/assets. Build/test/lint logs are retained under `frontend/outputs/font-*.log`.

The existing first-visit migration guide and Expo Go welcome menu were dismissed before testing underlying inputs. The emulator's saved snapshot stayed offline; a software-rendered cold boot recovered, and an initial System UI ANR was dismissed with Wait before final captures. The in-app browser automation kernel could not initialize, so Chromium verification used the bundled Playwright runtime and an already-installed browser. These were local test-environment issues; no account was created or login submitted.

## Remaining QA

`Phase 5 QA`: physical Android rendering/font scaling, packaged APK/AAB, and iOS runtime. iOS native-boundary tests and shared source typecheck pass, but an iOS simulator/device was not available on Windows. Existing installed binaries and the deployed web site require their normal rebuild/deployment steps to receive this source change.
