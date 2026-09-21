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
  // 참여 버튼 링크(application_url)는 이번 범위가 아니라 팝업을 그대로 쓴다.
  assert.match(createSource, /createFormNotice\("참여 버튼 링크"/);
});

test("나머지 안내는 아직 기존 팝업을 쓴다", () => {
  // 1단계 범위는 링크 2건이다. 나머지는 다음 단계에서 옮긴다.
  assert.match(createSource, /<FormNoticeModal notice=\{formNotice\}/);
  assert.match(createSource, /<Toast toast=\{toast\} onHide=\{hideToast\} \/>/);
});
