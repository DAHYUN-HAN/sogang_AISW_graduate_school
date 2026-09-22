import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  TOAST_DURATION_MS,
  TOAST_FADE_OUT_MS,
  TOAST_MESSAGES,
  nextToastState,
  toastHoldMs,
} from "../utils/toast";

const createSource = readFileSync("app/(tabs)/board/post/create.tsx", "utf8");
const toastSource = readFileSync("components/Toast.tsx", "utf8");

test("토스트 문구는 디자인에 적힌 문장을 그대로 쓴다", () => {
  assert.equal(TOAST_MESSAGES.linkFormatError, "올바른 링크 주소가 아니에요. 다시 확인해주세요");
  assert.equal(TOAST_MESSAGES.requiredFieldError, "필수 항목을 모두 입력해주세요");
  assert.equal(TOAST_MESSAGES.error, "오류가 발생했어요. 다시 시도해주세요");
});

test("토스트는 바로 떴다가 3초에 걸쳐 서서히 사라진다", () => {
  assert.equal(TOAST_DURATION_MS, 3000);
  // 전체 시간 = 머무는 시간 + 페이드 아웃
  assert.equal(toastHoldMs() + TOAST_FADE_OUT_MS, TOAST_DURATION_MS);
  // 전체 시간이 페이드보다 짧아도 머무는 시간이 음수가 되지 않는다.
  assert.equal(toastHoldMs(100), 0);
  // 오류 알림이라 등장은 즉시다. 페이드 인이 있으면 인지가 늦어진다.
  assert.match(toastSource, /opacity\.setValue\(1\)/);
  assert.match(toastSource, /toValue: 0/);
  // 끊기지 않게 네이티브 드라이버로 돌린다.
  assert.doesNotMatch(toastSource, /useNativeDriver: false/);
});

test("같은 문구가 다시 떠도 표시 시간이 처음부터 흐른다", () => {
  const first = nextToastState(null, TOAST_MESSAGES.linkFormatError);
  const second = nextToastState(first, TOAST_MESSAGES.linkFormatError);
  assert.equal(second.message, first.message);
  // id가 같으면 타이머가 이어져 토스트가 곧바로 사라진다.
  assert.notEqual(second.id, first.id);
});

test("토스트는 하단에 뜨고 입력을 막지 않는다", () => {
  assert.match(toastSource, /position: "absolute"/);
  assert.match(toastSource, /bottom: 0/);
  assert.match(toastSource, /pointerEvents="none"/);
  // 누를 것이 있으면 토스트가 아니라 팝업이다. 스스로 사라져야 한다.
  assert.doesNotMatch(toastSource, /<Pressable|Modal/);
});

test("증빙 링크 오류는 팝업 대신 토스트로 알린다", () => {
  assert.match(createSource, /showToast\(TOAST_MESSAGES\.linkFormatError\)/);
  assert.match(createSource, /showToast\(TOAST_MESSAGES\.requiredFieldError\)/);
  // 증빙서류 첨부의 옛 팝업이 남아 있으면 안 된다.
  assert.doesNotMatch(createSource, /createFormNotice\("증빙서류 첨부"/);
  assert.doesNotMatch(createSource, /청첩장·부고장 링크를 입력하세요/);
  // 참여 버튼 링크(관리자 전용)는 전환 대상이 아니라 문구·확인창 그대로다.
  assert.match(createSource, /title: "참여 버튼 링크"/);
  assert.match(createSource, /http:\/\/ 또는 https:\/\/로 시작하는 올바른 주소를 입력하세요/);
  assert.doesNotMatch(createSource, /createFormNotice/);
});

test("FormNoticeModal은 사라지고 토스트와 확인 모달만 남는다", () => {
  assert.doesNotMatch(createSource, /FormNoticeModal/);
  assert.match(createSource, /<Toast toast=\{toast\} onHide=\{hideToast\} \/>/);
  // 읽고 넘어가야 하는 안내(업로드 실패·요청 제한·부분 성공)는 확인 모달을 쓴다.
  assert.match(createSource, /<NoticeModal notice=\{notice\} onClose=\{\(\) => setNotice\(null\)\} \/>/);
});

test("업로드 실패는 원인별로 다르게 알린다", () => {
  const feedback = readFileSync("utils/uploadFeedback.ts", "utf8");
  // 하나로 뭉치면 횟수 제한·형식 문제일 때 계속 실패한다.
  assert.match(feedback, /status === 429 \|\| codeOf\(error\) === "RATE_LIMITED"/);
  assert.match(feedback, /status === 413 \|\| codeOf\(error\) === "FILE_TOO_LARGE"/);
  assert.match(feedback, /status === 415/);
  assert.match(createSource, /showUploadFailure\(error/);
});

test("필수 항목은 첫 항목에서 멈추지 않고 전부 모아 한 번에 표시한다", () => {
  // 디자인은 비어 있는 칸을 동시에 빨갛게 칠한다. 옛 requireValue(...) || requireValue(...)
  // 단락 구조로는 첫 항목만 알 수 있었다.
  assert.match(createSource, /const missing: \(keyof FormValues\)\[\] = \[\]/);
  assert.match(createSource, /for \(const name of missing\) setError\(name, \{ message: "" \}\)/);
  assert.doesNotMatch(createSource, /requireValue\(values\./);
});

test("강의후기는 교수명·난이도·만족도가 필수다", () => {
  assert.match(createSource, /if \(resourceFields\?\.professor\) requireField\("professor"/);
  assert.match(createSource, /if \(resourceFields\?\.difficulty\) requireField\("difficulty"/);
  assert.match(createSource, /if \(resourceFields\?\.satisfaction\) requireField\("satisfaction"/);
  // 필수라서 같은 등급을 다시 눌러 해제할 수 없다.
  assert.doesNotMatch(createSource, /field\.onChange\(selected \? "" : level\)/);
});

test("비어 있는 필수 칸은 문구 없이 테두리만 빨갛게 한다", () => {
  // setError의 message가 비어 있어야 칸 아래 문구가 뜨지 않는다.
  assert.match(createSource, /setError\(name, \{ message: "" \}\)/);
  // 폼 밖의 첨부·증빙은 별도 상태로 테두리를 켠다. 활동인증은 첨부 박스,
  // 상조회는 고른 쪽 증빙 탭이 같은 상태를 본다 — Figma MutualAidApply-*-Error.
  assert.match(createSource, /missingRequiredAttachment \? styles\.borderOnlyError : null/);
  assert.match(createSource, /showsError \? styles\.evidenceModeTabError : null/);
  // 링크 입력칸은 회색을 유지한다. 오류는 탭에만 띄운다.
  assert.doesNotMatch(createSource, /missingRequiredAttachment \? styles\.inputError : null/);
});

test("증빙을 아무 쪽도 고르지 않았으면 두 탭 모두 빨갛게 한다", () => {
  // 처음 들어오면 evidenceMode가 null이라 어느 탭도 active가 아니다. 고른 쪽에만
  // 띄우면 토스트만 뜨고 빨간 테두리는 어디에도 안 그려진다.
  assert.match(
    createSource,
    /const showsError = missingRequiredAttachment && \(active \|\| evidenceMode === null\);/,
  );
  assert.match(createSource, /const \[evidenceMode, setEvidenceMode\] = useState<"file" \| "link" \| null>\(null\)/);
});

test("도달할 수 없던 상조회 날짜 제한 안내를 제거했다", () => {
  // MUTUAL_AID_MIN_LEAD_DAYS가 0이라 달력이 과거 날짜를 이미 막는다.
  assert.doesNotMatch(createSource, /오늘 기준 2일 후인/);
  assert.doesNotMatch(createSource, /MUTUAL_AID_DATE_TOO_SOON/);
});

test("값을 고치면 인증 화면처럼 빨간 테두리가 바로 풀린다", () => {
  // register.tsx / login.tsx 는 onChangeText 에서 해당 오류를 지운다. 같은 감각을 맞춘다.
  assert.match(createSource, /const clearOnChange = \(name: keyof FormValues/);
  for (const name of ["title", "content", "professor", "bankAccount", "contact"]) {
    assert.ok(createSource.includes(`clearOnChange("${name}"`), `${name} 해제 누락`);
  }
  // 고르는 방식(시트·등급 버튼·참가자)도 같은 시점에 푼다.
  assert.match(createSource, /clearErrors\("category"\)/);
  assert.match(createSource, /clearErrors\("relation"\)/);
  assert.match(createSource, /clearErrors\("participants"\)/);
  assert.match(createSource, /clearErrors\(rating\.name\)/);
  // 첨부·증빙은 값이 생기는 시점에 해제한다.
  assert.match(createSource, /setMissingRequiredAttachment\(false\)/);
});

test("오류 테두리는 1px #D64545 이고 포커스보다 우선한다", () => {
  // Figma Write-LectureReview-Error(1479:116): 입력칸·등급 버튼 모두 border 1px #d64545.
  assert.match(createSource, /inputError: \{\r?\n\s+borderWidth: 1,\r?\n\s+borderColor: "#D64545"/);
  assert.match(createSource, /borderOnlyError: \{\r?\n\s+borderWidth: 1,\r?\n\s+borderColor: "#D64545"/);
  // FormTextInput 안에서 오류 스타일이 포커스 스타일보다 뒤에 온다.
  assert.match(createSource, /focused \? styles\.inputFocused : null,\r?\n\s+hasError \? styles\.inputError : null,/);
});
