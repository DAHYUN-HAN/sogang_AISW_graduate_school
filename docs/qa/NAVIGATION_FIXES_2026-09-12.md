# Android 뒤로가기 7건 수정·재검증 — 2026-09-12

WP5/WP9 P0 사용성 보완. [수정 전 감사](NAVIGATION_AUDIT_2026-09-12.md)의 NAV-01~07을 수정하고, **현재 소스로 새로 빌드한 APK에서 7건 모두 재검증했다.**

> 2026-09-13 정정: 아래 재실행 회귀는 `adb input keyevent 4`와 명령 기반 앱 실행을 사용했다. 실제 런처에서 실행한 Activity를 유지한 채 복귀하는 조건까지 통과했다는 근거로 사용할 수 없다. 사용자가 보고한 홈 Back → 재실행 → 참여활동 Back 종료를 APK 7에서 재현했다. 원인과 수정 검증은 [재실행 뒤로가기 재검증](BACK_RELAUNCH_2026-09-13.md)을 따른다.

## 실행 버전

- 기준 커밋: `cb692f87cfebc4bd05560028c1850f9efccc392c` + 이번 수정.
- Pixel 7 에뮬레이터 / Android 16, 로그인된 회원 세션 유지.
- 패키지 `kr.ac.sogang.aisw.campus`, 0.1.0 / **versionCode 6**, `adb install -r` 성공. 이전 9월 11일 버전 4의 결과를 재사용한 것이 아니다.
- APK: `outputs/android/AI-SW-CAMPUS-0.1.0-6-navigation-test.apk`.
- SHA-256: `2ab34cc069cb7d53def9ee53a86f416f68fba1bf1a7671a9793f1f5158435f28`.
- 로컬 검증용 서명과 버전만 임시 Gradle 설정으로 적용했다. 저장소의 출시 버전/서명 설정이나 서버는 변경하지 않았다.
- 캡처·XML·IME 상태·행동 로그: `outputs/qa/navigation-fixes-2026-09-12/` (Git 제외).

## 결과

| 항목 | 수정 및 APK 확인 결과 | 대표 캡처 |
| --- | --- | --- |
| NAV-01 FAQ | 상단/Android Back 모두 원우회 메뉴로 복귀 | [Android Back 후](../../outputs/qa/navigation-fixes-2026-09-12/F03-faq-android-back.png), [상단 Back 후](../../outputs/qa/navigation-fixes-2026-09-12/F05-faq-header-back.png) |
| NAV-02 커뮤니티·참여활동 검색 | 첫 Back은 키보드, 다음 Back은 검색만 닫음. 커뮤니티와 동아리·스터디·네트워킹 활동 인증에서 각각 확인. 검색을 다시 열면 입력이 비어 있고 기존 게시판/필터가 유지됨 | [커뮤니티](../../outputs/qa/navigation-fixes-2026-09-12/S04-community-close-search.png), [동아리](../../outputs/qa/navigation-fixes-2026-09-12/P08-club-search-close.png), [스터디](../../outputs/qa/navigation-fixes-2026-09-12/P13-study-close-search.png), [네트워킹](../../outputs/qa/navigation-fixes-2026-09-12/P18-network-close-search.png) |
| NAV-03 공지 검색 | 상단/Android Back 모두 기존 공지 목록으로 복귀 | [Android Back 후](../../outputs/qa/navigation-fixes-2026-09-12/S07-notice-system-back.png), [상단 Back 후](../../outputs/qa/navigation-fixes-2026-09-12/S09-notice-header-back.png) |
| NAV-04 홈 달력 | 9/1 → 상단 Back → 홈 → 9/2 → Android Back에서 과거 날짜 대신 홈 표시 | [두 번째 날짜](../../outputs/qa/navigation-fixes-2026-09-12/E03-day2.png), [홈 복귀](../../outputs/qa/navigation-fixes-2026-09-12/E04-day2-system-home.png) |
| NAV-05 자료공유 정렬 | Back은 정렬 메뉴만 닫고 자료공유/정렬 상태 유지 | [메뉴 열림](../../outputs/qa/navigation-fixes-2026-09-12/R03-sort-open.png), [메뉴 닫힘](../../outputs/qa/navigation-fixes-2026-09-12/R04-sort-back.png) |
| NAV-06 게시글·수정·일정 오류 | 세 화면 모두 로딩/오류에서 상단 탐색 버튼과 재시도 유지. 상단/Android Back을 각각 실행해 화면을 벗어남 | [게시글 오류](../../outputs/qa/navigation-fixes-2026-09-12/X02-post-error.png), [일정 오류](../../outputs/qa/navigation-fixes-2026-09-12/X07-event-error.png), [글 수정 오류](../../outputs/qa/navigation-fixes-2026-09-12/X12-edit-error.png) |
| NAV-07 알림 → 일정 | 상단/Android Back 모두 알림 목록으로 복귀 | [Android Back 후](../../outputs/qa/navigation-fixes-2026-09-12/N03-event-back-notifications.png), [상단 Back 후](../../outputs/qa/navigation-fixes-2026-09-12/N05-event-header-notifications.png) |

## 추가 회귀 확인

- 원래 1080×2400 / density 420 / 제스처 내비게이션으로 복원한 뒤 ADB 키 입력과 명령 기반 재실행에서 홈 복귀를 확인했다 (`Z01`~`Z11`). 제스처 내비게이션 설정이 실제 가장자리 제스처 입력을 의미하지 않으며, 이 11개 판정은 위의 Activity 유지 재실행 조건을 검증하지 못했다. [당시 캡처](../../outputs/qa/navigation-fixes-2026-09-12/Z05-tab-back-home.png).
- 시험족보 검색 화면 → 게시글 상세 → Back에서 검색과 시험족보 필터를 유지하고, 다음 Back에서 검색만 닫았다. 다시 검색을 열어 입력 초기화를 확인했다 (`PS01`~`PS10`). [필터 유지 캡처](../../outputs/qa/navigation-fixes-2026-09-12/PS07-close-retained-search.png).
- 검색 또는 정렬을 열고 마이페이지를 열었다 닫은 뒤에도 검색/메뉴가 탭 복귀보다 먼저 Back을 처리했다 (`DB01`~`DB09`).
- 리뷰에서 부모 탭의 Back 구독이 경로/마이페이지 상태 변경 때 다시 등록되어 화면 구독보다 먼저 실행되는 문제를 추가로 발견했다. 실제 훅 회귀 테스트에서 `overlay` 대신 `home`이 실행되는 실패를 확인한 뒤, 구독은 포커스 동안 유지하고 최신 상태만 ref로 읽도록 수정했다. Android 마이페이지 Modal의 `onRequestClose` 우선순위는 유지했다.
- 참여활동 검색에서 Android 홈 → 앱 복귀 후에도 검색을 유지했다. Android가 포커스된 입력의 키보드를 복원한 상태에서 Back으로 키보드, 검색 순서로 닫았다 (`P05`~`P08`).
- 9/3 날짜 목록 → 일반 일정 상세 → Android 홈 → 복귀 → Back은 정확히 9/3 목록으로, 다음 Back은 앱 홈으로 돌아갔다 (`E05`~`E10`). 알림 전용 복귀가 일반 일정 이력을 덮어쓰지 않는다.
- 존재하지 않는 ID `999999`를 사용한 읽기 전용 오류 재현에서 로딩 캡처 `X01/X06/X11`, 오류 캡처 `X02/X07/X12`, 상단/Android 복귀 `X03/X05`, `X08/X10`, `X13/X15`를 남겼다. 글 수정의 기존 X 버튼은 상세 화면으로 복귀했다.

## 소스·빌드 검증

- 신규 화면 회귀 22개: 수정 전 소스에서 16개 실패(구독 미연결, 메뉴 미닫힘, 헤더 없음), 수정 후 22개 통과. 별도 구독 우선순위 회귀 1개도 실패 재현 후 통과.
- 최종 전체 프런트엔드 테스트 **611/611 통과**, 실패/스킵 없음 (`frontend-tests-final.log`).
- `tsc --noEmit --incremental false` 통과 (`typecheck.log`). 변경 화면/훅/테스트 ESLint 통과, 오류·경고 0개 (`lint-final.log`).
- 독립 읽기 전용 코드 리뷰를 진행했고, 발견된 구독 우선순위와 기존 테스트 훅 모의 객체를 수정한 뒤 전체 테스트를 다시 통과했다.
- `:app:assembleRelease` **BUILD SUCCESSFUL**, 12분 37초 (`gradle-build.txt`). Windows 경로 길이 문제를 피하기 위해 기존 QA 전용 `C:/Temp/aiswq`를 현재 소스와 동기화했다. 기존과 동일한 네이티브 의존성/툴체인 캐시를 사용했다.
- 변경한 앱 파일 8개의 최종 소스가 번들 source map과 일치하며, 생성된 Hermes 번들이 APK 안의 번들과 바이트 단위로 일치한다 (`bundle-source-check.json`, `apk-check.json`). APK ZIP CRC, 서명, 16 KiB ZIP 정렬 검증 통과.

## 관찰 및 범위

- 원본 행동 로그의 실패도 보존했다. `D03-resource-drawer`는 Android 제스처 내비게이션이 왼쪽 가장자리 드래그를 시스템 Back으로 처리하여 검색이 닫힌 경우다. 마이페이지 왕복 검증은 3버튼 내비게이션으로 전환한 뒤 `DB` 시나리오에서 실행했다. 내비게이션 모드 변경으로 홈이 재생성된 직후 검색 버튼을 찾지 못한 준비 단계도 보존했다.
- `P06-search-resume`의 최초 판정은 키보드가 복원되어 숨겨진 하단 탭의 선택 표시까지 기대해 실패했다. `P06-resume-ime-state`에서 IME 표시를 직접 확인한 뒤, `P07/P08`에서 키보드/검색 닫기를 구분해 통과했다. 이를 앱이 홈으로 잘못 이동한 것으로 분류하지 않는다.
- 에뮬레이터 부팅 중 System UI ANR의 Wait를 눌렀다 (`A00/A01`). 앱 기능 통과 판정에 포함하지 않았다.
- 운영 게시물·댓글·신고·설정은 생성/수정/삭제하지 않았다. 읽기·검색·화면 이동만 사용했다.
- 이번 실행은 위 7건과 관련 회귀 흐름에 한정한다. 실물 Android 기기, 다른 OS 버전, iOS의 추가 확인은 Phase 5 QA로 남긴다.
- 최종 행동 로그에는 판정 71개(69개 통과, 위에 설명한 준비/판정 전제 불일치 2개)가 있다. 최종 7건의 근거와 재실행 11개 판정을 `evidence-summary.json`에서 별도로 검증했다.
- 종료 시 화면 크기·밀도·제스처 내비게이션과 Android 사용자 0을 확인하고, 이 작업에서 실행한 에뮬레이터를 종료했다 (`cleanup.json`). 로그인 데이터와 새 버전 6 APK는 유지했다.
