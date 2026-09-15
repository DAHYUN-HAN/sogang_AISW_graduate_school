# 홈 종료·재실행 후 참여활동 뒤로가기 — 2026-09-13

WP5/WP9 P0 회귀. 사용자가 다운로드한 APK에서도 오류가 계속된다고 보고하여 이전 완료 판정을 다시 확인했다.

## 수정 전 재현

- Pixel 7 / Android 16(API 36), APK `0.1.0 (7)`, 로그인 데이터 유지.
- 테스트 준비 때만 앱을 force-stop하여 명령으로 만든 기존 태스크를 제거했다. 런처 앱 목록의 **AI·SW CAMPUS 아이콘을 실제로 탭**해서 실행했다.
- 홈 선택 확인 → 화면 아래 **시스템 Back 버튼 탭** → 런처 → 앱 아이콘 탭 → 참여활동 선택 → 시스템 Back 버튼 탭.
- 결과: 참여활동에서 홈이 아닌 **런처로 이탈**. 앱 크래시와 구분되는 잘못된 기본 Back 실행이다.
- `ActivityRecord{9052270 ... MainActivity t74}`가 홈 종료와 복귀 전후에 유지됐다. 최초 실행 주체도 `com.google.android.apps.nexuslauncher`였다.
- 증거: `outputs/qa/back-relaunch-2026-09-13/22-clean-loaded-home.*`, `23-clean-home-exit.*`, `23-clean-exit-activity.txt`, `25-retained-reopen.*`, `26-retained-participation.*`, `27-retained-back-result.*`, `actions.jsonl`.
- 앞선 명령 실행에서는 Activity가 새로 생성되어 증상이 가려졌다. 초기 부팅 ANR, 실패한 가장자리 스와이프, UI dump 실패 및 혼선이 있었던 `01`~`21` 준비 시도는 이 재현의 근거에 포함하지 않는다.

## 원인과 수정

Expo SDK 54는 기본적으로 predictive back을 비활성화하지만, 저장소에 커밋한 네이티브 manifest에는 그 설정이 없었다. targetSdk 36에서는 누락 시 predictive back이 활성화된다.

React Native 0.81.5의 `ReactActivity.invokeDefaultOnBackPressed()`는 기본 뒤로가기를 실행하며 자체 `mBackPressedCallback`을 비활성화한다. 기존 Activity가 백그라운드에서 복귀할 때 해당 콜백을 다시 활성화하지 않아 이후 시스템 Back이 JavaScript의 탭 복귀 정책을 우회할 수 있다. 홈에서 기본 동작으로 나간 뒤 재실행하는 조건에서 이를 재현했다.

- `frontend/app.json`: `android.predictiveBackGestureEnabled: false` 명시.
- `frontend/android/app/src/main/AndroidManifest.xml`: application에 `android:enableOnBackInvokedCallback="false"` 적용. 커밋된 네이티브 프로젝트이므로 app.json만 바꾸는 것으로는 충분하지 않다.
- `frontend/scripts/verify-android-release-manifest.mjs`: 병합된 release manifest에서 설정 누락/활성화 및 MainActivity의 상충 override를 거부한다. 기존 CI의 manifest 검증 단계에서 실행된다.
- JavaScript의 홈·상세·검색·마이페이지 Back 처리 순서는 유지한다.

공식 근거: [Expo SDK 54 기본 설정](https://expo.dev/changelog/sdk-54), [Android 16 뒤로가기 변경과 호환 설정](https://developer.android.com/about/versions/16/behavior-changes-16). Expo/RN 동작은 이 프로젝트에 설치된 54 / 0.81.5 소스에서도 확인했다.

## 검증

- release gate 회귀 테스트: 수정 전 2개 실패/1개 통과 → 수정 후 3개 통과. 이는 빌드 설정 검사이며 네이티브 재실행 검증을 대신하지 않는다.
- 전체 프런트엔드 테스트: 614/614 통과, 실패·스킵 없음 (`tests.log`).
- TypeScript 검사 및 변경 스크립트/테스트 ESLint 통과.
- 독립 코드 리뷰: 차단 이슈 없음.
- APK 8 생성 및 업데이트 설치 성공: `outputs/android/AI-SW-CAMPUS-0.1.0-8-back-fix.apk`, 0.1.0 / versionCode 8, arm64-v8a + x86_64, 기존 로컬 테스트 서명.
- SHA-256: `0f151f5fdad2524191ed66a7fd880950889949553d42c94f9f402833f5803411`.
- 최초 Gradle 빌드는 SDK Ninja의 Windows 긴 경로 처리에서 실패했다. Ninja 1.13.2로 두 ABI의 현재 CMake 타깃을 성공시킨 뒤 해당 app CMake 작업만 중복 실행하지 않고 Gradle의 JS·리소스·Kotlin·lint·서명·패키징을 완료했다 (`BUILD SUCCESSFUL in 7m 15s`). 실패 로그도 보존했다.
- 소스 307개 일치, 번들 소스 133개 일치, APK/Hermes 바이트 일치, 네이티브 산출물 8개 provenance, 서명, ZIP CRC 및 16 KiB 정렬 검증 통과. 실제 APK manifest의 back 호환 플래그도 false를 확인했다. JavaScript 번들 해시는 APK 7과 동일하므로 이번 수정 전후의 차이는 JavaScript 재수정으로 설명되지 않는다.
- 실제 3버튼 내비게이션: 사용자 순서 3회 연속 통과. 전후 동일 `ActivityRecord{16938395 ... MainActivity t75}`가 유지됐다. 공지사항·커뮤니티·원우회 Back도 각각 홈으로 복귀했다 (`fixed-button-result.json`, `runtime-button.log`).
- 실제 오른쪽 가장자리 제스처: 사용자 순서 3회 연속 통과. 전후 동일 `ActivityRecord{83111437 ... MainActivity t76}`가 유지됐으며 공지사항·커뮤니티·원우회 Back도 각각 홈으로 복귀했다 (`fixed-gesture-result.json`, `runtime-gesture.log`).
- 6회 재실행 모두 Activity record뿐 아니라 앱 프로세스와 Window도 전후 동일함을 별도로 확인했다 (`retained-instance-proof.json`). 새 Activity 생성으로 원래 오류가 가려지는 조건을 제외했다.
- 제스처 방식으로 마이페이지 열기 → Back → 기존 홈 유지, 원우회 → FAQ 상세 → Back → 원우회 → Back → 홈도 통과했다 (`50`~`55`).
- 자동화의 UI dump 재시도와 에뮬레이터 준비 중 System UI ANR/Wait 기록을 보존했다. 유효한 화면 트리와 선택 탭, 실제 Activity 상태를 얻은 뒤에만 통과 판정했다. 일부 홈 캡처에 공지 로드 오류가 표시되어 있으며, 이 문서의 판정 범위는 내비게이션이다.
- 종료 시 원래 제스처 내비게이션과 설치 버전 8을 확인하고 이 작업에서 실행한 에뮬레이터를 종료했다. 로그인 데이터와 설치 앱을 유지했다 (`cleanup.json`).

## 향후 재검증 조건

1. 런처 아이콘으로 새로 실행하고 홈 선택 상태를 확인한다.
2. 실제 시스템 Back 버튼 또는 가장자리 제스처로 홈에서 나간다.
3. `dumpsys activity activities`로 Activity가 백그라운드에 유지되는지 확인한다.
4. 아이콘으로 복귀한 뒤 같은 Activity인지 확인하고 참여활동 → 실제 Back → 홈을 검증한다.
5. 여러 번 반복하며 다른 탭, 상세 복귀, 마이페이지 닫기 순서도 확인한다.

검증 구간 중 force-stop, 내비게이션 모드 변경 또는 Activity 재생성을 끼워 넣지 않는다. 물리 기기에서 사용자가 받은 APK·Android 버전은 아직 확인되지 않았으므로 에뮬레이터 결과와 구분한다. Expo/RN 업그레이드 시에는 이 재현 절차를 통과한 뒤 predictive back 활성화를 검토한다.
