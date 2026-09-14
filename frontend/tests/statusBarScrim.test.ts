import assert from "node:assert/strict";
import test from "node:test";

import { statusBarScrimHeight } from "../utils/statusBarScrim";

test("웹에서는 상태바 막을 그리지 않는다", () => {
  assert.equal(statusBarScrimHeight(44, "web", undefined), 0);
});

test("Android는 루트 safe-area가 0으로 보고돼도 네이티브 상태바 높이를 쓴다", () => {
  assert.equal(statusBarScrimHeight(0, "android", 24), 24);
});

test("Android 상태바 높이를 알 수 없으면 safe-area 값으로 대체한다", () => {
  assert.equal(statusBarScrimHeight(30, "android", undefined), 30);
  assert.equal(statusBarScrimHeight(30, "android", 0), 30);
});

test("iOS는 safe-area 상단 값을 그대로 쓰고 음수는 0으로 막는다", () => {
  assert.equal(statusBarScrimHeight(59, "ios", undefined), 59);
  assert.equal(statusBarScrimHeight(-1, "ios", undefined), 0);
});
