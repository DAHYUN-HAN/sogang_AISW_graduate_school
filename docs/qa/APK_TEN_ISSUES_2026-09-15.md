# Android APK 10 — 보고 이슈 10건 실행 검증

WP5/WP9 P0 사용성 점검. 사용자의 명시적 요청에 따라 현재 작업 폴더를 APK로 빌드하고, 설치한 Android 앱에서 보고된 재현 절차를 수행했다.

## 결론

- 요청한 10건 중 **9건 통과, 9번은 부분 충족**이다. 상단바는 배너와 분리되지만 요청한 반투명 흰색이 아닌 불투명 흰색이다.
- 추가 발견: **사진첩·시험족보·동아리 상세의 제목 윗부분이 상태바 배경에 가려진다.** 수정이 필요한 공통 헤더 문제다.
- 추가 관찰: Android 3버튼 탐색에서 시스템 아이콘이 흰 배경과 거의 구분되지 않는다. 클릭/뒤로가기 동작은 정상이나 가시성 개선과 물리 기기 확인이 필요하다.
- 이번 결과는 **Pixel_7 에뮬레이터 / Android 16(API 36)** 기준이다. 사용자의 실제 휴대폰에서는 실행하지 않았다.
- 앱 코드는 수정하지 않았다. 이 APK는 현재 상태를 검증한 직접 설치용 테스트 APK이며, 아래 미해결 사항도 포함한다.

## APK와 실행 환경

| 항목 | 값 |
| --- | --- |
| 파일 | [AI-SW-CAMPUS-0.1.0-10-qa.apk](../../outputs/android/AI-SW-CAMPUS-0.1.0-10-qa.apk) |
| 버전 | 0.1.0 / versionCode 10 |
| 패키지 | `kr.ac.sogang.aisw.campus` |
| SHA-256 | `6ef247a0f88765274b288ad5ce96237b56c1ea7890b0df825101c8d6bd981d66` |
| 크기 | 78,581,619 bytes |
| ABI | arm64-v8a, x86_64 |
| 서명 | 기존 로컬 debug 키, release JS/Hermes 번들. 스토어 업로드용 서명이 아님 |
| 소스 | HEAD `8a95f7e1ae18f51e23957d4e0314ef285ce0b2eb` + 점검 시작 시 존재하던 미커밋 작업 |
| Android | Pixel_7 AVD, Android 16/API 36, x86_64, 1080×2400, density 420, fontScale 1.0 |
| 입력/탐색 | Gboard, 기본 제스처 및 추가 3버튼 탐색 |
| 서버/계정 | 기존 운영 API 연결과 로그인된 테스트용 원우회 세션 |

ADB로 APK를 업데이트 설치했다. Expo Go나 웹 미리보기가 아닌 설치된 APK를 조작했다. 설치된 `base.apk` 해시가 위 파일과 같음을 확인했다.

## 10건 전체 결과

아래 증거 이름은 `outputs/qa/apk-ten-issues-2026-09-15/` 아래 PNG/XML/JSON을 가리킨다. ‘통과’는 이 환경에서 해당 절차를 수행해 보고된 문제가 나타나지 않았다는 의미다.

| # | 문제 | 판정 | 실제 수행 및 결과 | 주요 증거 |
| --- | --- | --- | --- | --- |
| 1 | 사진첩 좌우 화살표 회색 배경 | 통과 | 행사 사진첩의 `26년 2학기 개강파티`를 열고 사진 양쪽의 반투명 회색 원형 배경을 확인했다. | `10-album-reopen`, `12-gallery-baseline` |
| 2 | 사진첩 왼쪽 화살표 터치 누락 | 통과 | 왼쪽 중앙 1회와 추가 좌측 5개·우측 3개 위치를 한 번씩 눌렀다. 가장자리 x=3/114도 포함해 9회 모두 기대한 사진으로 전환됐다. 1↔3 순환도 확인했다. | `11-left-center`, `gallery-taps.json`, `12-gallery-tap-01`~`08` |
| 3 | 댓글 등록 후 키보드 유지 | 통과 | 커뮤니티 → 자료공유 → 시험족보 → 임시 글 → 댓글 입력 → 댓글 등록을 한 번 눌렀다. 성공 직후 입력이 비워지고 포커스가 해제되며 `mInputShown=true→false`로 바뀌었다. Back이나 바깥 터치를 추가하지 않았다. | `29-comment-before`, `30-comment-after`, `31-comment-visible` |
| 4 | 달력 월 전환 시 원형 표시가 사각형으로 바뀜 | 통과 | 홈에서 다음 달 → 이전 달을 2회 반복했다. 9월 15일과 10월 1일 선택 표시가 원형을 유지했다. 네 캡처의 선택 배지 외곽도 원형으로 확인됐다. | `39-calendar-next`~`42-calendar-back-again` |
| 5 | 원우회 임원진 소개 제목 | 통과 | 하단 원우회 → 원우회 임원진 소개. 상단 제목이 정확히 `원우회 임원진 소개`이고 가려지지 않는다. | `43-council`, `44-council-intro` |
| 6 | 앱 종료·재실행 후 참여활동 Back이 앱 종료 | 통과 | 홈 → 실제 시스템 Back → 런처 → 실제 앱 아이콘 → 참여활동 → 실제 시스템 Back. 제스처 3회, 3버튼 3회 모두 홈으로 복귀했다. 각 반복에서 동일한 Activity가 유지됨을 확인했다. 공지사항·커뮤니티·원우회 Back도 각 방식에서 홈으로 돌아왔다. | `apk10-gesture-result.json`, `apk10-button-result.json` 및 각 단계 Activity 덤프 |
| 7 | 긴 글 본문 안쪽 드래그 및 등록 버튼 접근 | 통과 | 자료공유 → 시험족보 → +. 실제 Android 텍스트 입력/Enter로 30줄을 입력하고 시스템 Back으로 키보드를 숨겼다. 본문 안쪽에서 위아래로 드래그해 보이는 줄이 바뀌었다. 30줄은 보존되고 등록 버튼 전체가 노출됐으며 실제 등록도 성공했다. | `20-thirty-lines-keyboard`, `21-long-keyboard-hidden`, `22-body-down`, `23-body-up`, `24-register-temp-post` |
| 8 | 동아리 모집 글 사진 순서 | 통과 | 참여활동 → `SG_LLM (LLM구축)`. 이름 → 사진 2장 → 본문 → 가입 신청 순서다. 하단으로 스크롤해 가입 신청 버튼 전체가 보임을 확인했다. | `47-sg-llm`, `48-sg-llm-scroll`, `49-sg-llm-apply-visible` |
| 9 | 홈 상단바와 배너 분리 | **부분 충족** | 홈에서 배너가 상태바 뒤로 올라가도록 드래그했다. 시계/아이콘 뒤는 흰색으로 분리된다. 다만 `#FFFFFF`로 완전히 가려지므로 요청한 반투명 사양과 다르다. | `51-home-top`, `52-home-banner-under-status` |
| 10 | 공지 카테고리 전환 시 흰색 로딩 아이콘 | 통과 | 공지사항 → 학사 → 행사 → 기타 → 행사를 4회 반복했다. 최초 미캐시 로딩에는 파란 표시와 안내 문구가 나오고, 반복 전환에는 흰색 원형 RefreshControl이 나타나지 않았다. 직접 당겨 새로고침할 때에는 의도된 흰색 컨트롤이 정상 표시됐다. | `54-notice-step-1`~`4`, `55-notice-repeated-final`, `notice-transitions.mp4` |

### 공지 로딩 영상 확인

60초 원본 녹화에 순서대로 16번의 카테고리 탭과 수동 새로고침이 포함된다. 화면 변경 시 기록되는 가변 프레임 영상으로, 전체 149프레임 중 작업 구간 40초 이내 145프레임을 디코딩했다. 자동 후보 추출과 프레임 시각 확인을 함께 수행했다.

- 필터 전환 중 감지된 로딩은 파란 inline 표시다. 회색 픽셀 후보 28장은 파란 선의 경계 픽셀이었으며 `notice-gray-candidates.png`에서 전부 확인했다.
- 반복 전환은 목록만 교체된다. 직접 당겨 새로고침할 때는 흰 원형 컨트롤과 회색/검정 회전 표시가 보인다.
- 원본, full-frame 캡처, `notice-control-contact-1/2/3.png`, `notice-frame-analysis.json`, `notice-video-events.json`을 보관했다. 호스트의 조작 시각과 영상 PTS 시작에는 약간의 차이가 있어 밀리초 단위 동기화 자료로 취급하지 않는다.

## 미해결 사항 — Phase 5 QA

### P2: 상세 화면 제목 윗부분 잘림

재현: 사진첩 상세, 시험족보 글 상세 또는 SG_LLM 모집 상세를 연다. 화면 최상단의 제목 윗부분이 흰 상태바 마스크 아래로 가려진다. [SG_LLM 캡처](../../outputs/qa/apk-ten-issues-2026-09-15/47-sg-llm.png)와 [사진첩 캡처](../../outputs/qa/apk-ten-issues-2026-09-15/10-album-reopen.png)에서 확인 가능하다.

- 상세 제목의 실제 bounds: `[231,101][849,171]`; 상태바 마스크는 y=0~136을 덮는다. 제목 위쪽 35px가 마스크와 겹친다.
- 공통 상세 화면 `frontend/app/(tabs)/board/post/[postId].tsx:793`의 appBar는 위 safe-area padding을 포함하지만, `appBarTitle`(`:1424`)은 absolute 배치이며 그 padding 아래로 내려가는 위치가 없다.
- `frontend/components/StatusBarScrim.tsx:19`의 상단 overlay가 높은 z-order로 해당 영역을 덮는다. 캡처와 배치 코드를 근거로 한 원인 분석이다. 수정 후 같은 APK 경로로 재검증해야 한다.
- 원우회 임원진 소개의 제목은 bounds y=156~226으로 안전 영역 아래에 있어 5번은 별도로 통과한다.

### P2: 9번의 반투명 요청 미충족

`frontend/utils/statusBarScrim.ts:3`의 색상은 `#FFFFFF`다. 상태바 분리는 구현됐지만 반투명은 아니다. 위 제목 배치 문제와 함께 수정 후 확인할 항목으로 남긴다.

### P3 관찰: Android 3버튼 탐색 아이콘 대비 부족

3버튼 모드에서 뒤로/홈/최근 앱 아이콘이 흰색에 가까운 탐색바 위에 흰색으로 표시된다. 런처 재실행 3회 후에도 동일하다. [재실행 후 캡처](../../outputs/qa/apk-ten-issues-2026-09-15/apk10-button-cycle3-reopen.png)의 Back 중심은 RGB 255/255/255, 인접 배경은 251/251/251이다. 버튼 동작은 정상이다. 이 환경에서의 관찰로 기록하며 다른 물리 기기로 범위를 확인해야 한다. 이번 검증에서 원인 수정은 하지 않았다.

## 빌드와 검증 근거

- 현재 프런트엔드 312개 파일을 빌드 staging과 대조했고, 번들 source map의 실제 앱 소스 135개를 확인했다. 종료 시 다시 대조해 변경 0개를 확인했다.
- 기존 Windows 단축 경로 `C:\Temp\aiswq`를 이용했다. 두 ABI의 CMake/Ninja 출력을 먼저 검사한 뒤 Gradle에서 중복 CMake 실행만 제외했다. Gradle: **BUILD SUCCESSFUL**, 3분 55초, 731 tasks, 53 executed.
- `aapt` 버전/manifest, `apksigner` v2 서명, APK CRC, 16KB 정렬, 빌드 Hermes 번들과 APK 내 번들의 동일성, 설치된 APK SHA-256: 통과.
- 같은 소스에 대한 선행 전체 프런트엔드 테스트 **624/624**, TypeScript 검사 통과. 기록은 `outputs/qa/android-ten-issues-2026-09-15/frontend-tests.log`와 앞선 코드 점검 결과에 있다.
- 저장된 실행 증거의 24개 교차 검사 통과: 소스/파일 해시, 화살표 전환, IME, 임시 데이터 정리, 본문 보존/버튼 위치, 달력 배지, 원우회 제목, 두 탐색 방식 Back, 가입 신청 버튼, 상태바 분리, crash buffer. 이것은 위 미해결 UI 문제까지 통과했다는 뜻이 아니다.
- 이번 Android 앱의 crash buffer는 비어 있고, 재검증 구간에 새 앱 프로세스 종료 기록은 없다.
- 재실행 도구/로그: `outputs/qa/apk-ten-issues-2026-09-15/`의 `build.ps1`, `verify.py`, `driver.py`, `gallery_probe.py`, `notice_runtime.py`, `verify_back_runtime.py`, `verify_runtime_evidence.py`, `artifact-check.json`, `runtime-evidence-check.json`.

## 테스트 데이터와 환경 정리

- 게시글 `QA-APK10-20260915-TEMP`와 댓글 `QA-APK10-keyboard-check`만 새로 생성했다. 댓글 삭제 → 게시글 삭제 후 시험족보 목록에서 임시 글이 사라진 것을 확인했다. `33-comment-deleted`, `36-test-post-deleted`가 증거다.
- 초기 에뮬레이터 부팅의 System UI 대기와 WebView 자동 업데이트로 인한 앱 종료는 앱 결함 판정에서 제외했다. 실제 종료 사유는 `PACKAGE UPDATED / stop com.google.android.webview due to installPackageLI`이다. 영향받은 초기 갤러리 시도 `07-left-center`는 통과 횟수에 넣지 않고 다시 수행했다.
- 3버튼 검증 후 원래 제스처 탐색(mode 2)으로 복원했다. 로그인 데이터와 설치된 APK는 유지하고 이번 작업에서 띄운 에뮬레이터를 종료했다.
- 남은 범위: 사용자 물리 기기/OS·키보드 조합, 다른 화면 배율/글자 크기, 느리거나 끊기는 네트워크. 10건 밖의 앱 전체 기능 회귀나 iOS 검증을 수행한 것은 아니다.

선행 코드/APK 9 포함 여부 점검: [ANDROID_TEN_ISSUE_AUDIT_2026-09-15.md](ANDROID_TEN_ISSUE_AUDIT_2026-09-15.md). 본 문서가 후속 APK 10 실행 결과다.
