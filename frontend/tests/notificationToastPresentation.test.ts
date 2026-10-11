import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const notification = readFileSync("components/NotificationBootstrap.tsx", "utf8");

// 2026-10-11 사용자 요청: 상단바(시계·와이파이)와 겹치지 않게 그 아래 8에 띄운다.
test("토스트는 상단바 아래 8px에 뜬다", () => {
  assert.match(notification, /useSafeAreaInsets\(\)/);
  assert.match(notification, /position: "absolute",[\s\S]{0,120}top: insets\.top \+ 8,/);
});
