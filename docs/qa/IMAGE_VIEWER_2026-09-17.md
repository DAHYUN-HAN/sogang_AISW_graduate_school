# Image viewer — 2026-09-17

WP5/WP9, requested community/participation image interaction update. The user explicitly superseded the earlier no-viewer decision with a request for an in-app zoomable modal and mobile/web captures.

## Implementation

- Image attachments no longer call the external media opener. Community documents and actual website/application links retain their prior behavior.
- Shared `ImageViewerModal` opens at the tapped photo. It supports aspect-fit presentation, 1–4x pinch zoom, double-tap zoom/fit, bounded dragging, fitted-scale horizontal paging, previous/next controls and a counter. Changing photos resets the transform. The user's subsequent visual follow-ups remove the bottom zoom/percentage/fit controls and gesture hint; web keyboard shortcuts remain.
- Native Modal Back and web Esc close only the viewer. Post route and scroll state remain underneath.
- Club/networking guide galleries exclude the list-only representative image. Notice images, including notices linked to council activity, remain inert. (2026-09-24: superseded — notice, mutual-aid evidence and council-introduction images now open the same modal; see `docs/phase2/FRONTEND_ROUTE_SPEC.md`.)
- Media resolution reuses authorized signed URLs, with loading/error/retry UI. No API/schema/dependency changes.
- Gesture review caught and fixed cancelled pans advancing photos and Android focal jumps when a finger lifts. Tests execute the production gesture callbacks and attachment click handler.
- The modal reuses the Android status-bar scrim so dark system icons remain readable. The final native capture and all three gesture tests were repeated after reloading the latest bundle.

## Environment and evidence

Evidence directory: `outputs/qa/image-viewer-2026-09-17/` (local, ignored).

- Web: Chromium in the Codex browser, 1280 × 720, current local Expo development bundle.
- Mobile: Pixel 7 Android 16 emulator, 1080 × 2400, Expo Go with the current source. This is a native Android capture, not a resized web page.
- Isolated SQLite API on localhost:8000 with a generated test member and local fixture posts/images. No production data was edited. Expo uses the normal development API configuration.
- Android SDK UI Automator injected actual two-pointer gestures and double taps. `android-gestures.log` reports **3/3 passed** (pinch to 400%, pinch back to 100%, double tap to 250%). The runner needs the device's existing `android.test.base.jar` on its classpath.
- Initial harness attempts failed because the legacy runner omitted that jar, then because a generic pinch started on overlaid gallery controls. Final test coordinates target the image canvas; the full gesture test source is preserved in `ViewerGestures.java`.

## Initial runtime checks (before the visual follow-up)

| Check | Result |
| --- | --- |
| Community second attachment opens selected photo | Android/web: 2 / 3, same post, no browser transition |
| Zoom controls | Android/web: 100 → 150 → 200% |
| Pinch, double tap | Android: native tests above; web double click: 250% |
| Drag while zoomed | Image moves while photo index stays unchanged |
| Swipe when fitted | Previous/next photo, transform resets to 100% |
| Close / Esc / Android Back | Returns to the underlying post |
| Guide representative exclusion | Club: 2 detail photos from 3 attachments; web networking also checked |
| Other detail renderers | Web: activity certification, photo album, study recruitment open the same viewer |

Initial captures: `mobile.png` (native Android, 200%) and `web.png` (desktop web, 200%). Additional states and UI XML are retained beside them. Geometry and integration tests cover portrait/landscape fit, pan boundaries, focal zoom, rejected vertical/short/zoomed swipes, notice exclusion, and cancelled-gesture behavior.

Initial source verification: frontend **632/632 tests passed**, `npm run typecheck` passed, and changed-file ESLint passed without errors or warnings. Logs: `frontend-tests.log`, `typecheck.log`, `lint.log`. Read-only code review findings were fixed and re-reviewed.

## Visual follow-up: remove bottom scale controls

- Removed the minus/percentage/fit/plus toolbar and its unused React scale state. The footer now contains only the gesture hint and shrinks from 104 to 44 points, making 60 more points available for the image.
- Existing pinch, double-tap, bounded pan, paging and web keyboard handlers remain. No additional dependency or regression test was needed for this UI removal.
- Re-ran the 15 image-viewer/presentation tests, typecheck and changed-file ESLint: all passed. Focused test log: `no-controls-tests.log`.
- Current Android and web accessibility trees contain no scale controls. Android double tap expands the image bounds from 675 to 1687 pixels high (2.5x); web double click also visibly expands the image.
- Updated captures: `mobile-no-controls.png` (Android Expo Go) and `web-no-controls.png` (desktop web), both after double-tap/click enlargement. Earlier gesture runner/logs above document the initial toolbar version.

## Remaining scope

Latest visual follow-up: removed the gesture hint and its 44-point footer entirely from the shared web/native viewer. The image uses all available height below the header, retaining the device safe area. Existing gesture logic is unchanged. The 15 relevant tests, typecheck and scoped ESLint passed again (`no-footer-tests.log`). Android modal reopening confirms the footer is absent; capture: `mobile-no-footer.png`.

`Phase 5 QA`: physical Android, iOS runtime, packaged APK/AAB and release-device gesture checks. No replacement APK, deployment, or production migration was performed in this task.
