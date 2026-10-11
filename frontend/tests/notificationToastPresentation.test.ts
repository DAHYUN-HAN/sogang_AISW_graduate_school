import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const notification = readFileSync("components/NotificationBootstrap.tsx", "utf8");

// 2026-10-11 사용자 요청: 상단바(시계·와이파이)와 겹치지 않게 그 아래 8에 띄운다.
test("토스트는 상단바 아래 8px에 뜬다", () => {
  assert.match(notification, /useSafeAreaInsets\(\)/);
  assert.match(notification, /position: "absolute",[\s\S]{0,120}top: insets\.top \+ 8,/);
});

// 2026-10-11 사용자 요청: 배너는 4초 뒤 서서히(페이드 아웃) 사라지고, 위·왼쪽·오른쪽으로 밀어서 치울 수 있다.
test("배너는 4초 뒤 서서히 사라지고 밀어서 치울 수 있다", () => {
  assert.match(notification, /BANNER_AUTO_HIDE_MS = 4_000/);
  assert.match(notification, /Animated\.timing\(opacity, \{ toValue: 0, duration: BANNER_FADE_OUT_MS/);
  assert.match(notification, /\}, BANNER_AUTO_HIDE_MS\);/);
  assert.match(notification, /<Animated\.View\s+\{\.\.\.panResponder\.panHandlers\}/);
  assert.match(notification, /onMoveShouldSetPanResponder: \(_, gesture\) => Math\.abs\(gesture\.dx\) > 8 \|\| gesture\.dy < -8/);
});

// 2026-10-11 사용자 요청: 앱 안 배너·웹 알림 창으로 연 글은 보던 탭 위에 열어 뒤로가기로 원래 화면에 돌아간다.
test("앱을 쓰다가 누른 알림은 보던 화면 위에 글을 연다", () => {
  assert.match(notification, /setVisibleNotification\(null\);\s*await openNotificationOverCurrentScreen\(target\);/);
  assert.match(notification, /showWebNotification\([^)]*\) => \{ void openNotificationOverCurrentScreen\(newest\); \}\);/);
  assert.match(notification, /async function openNotificationOverCurrentScreen[\s\S]{0,300}navigateToRoute\(route\.split\("\?"\)\[0\]\)/);
});
