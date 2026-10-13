import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

// 2026-10-13 PLAN.md: 마이페이지는 서랍이 아니라 탭 스택에 쌓이는 settings/index 화면이다.
const GROUP = "app/(tabs)/(home,notices,community,participation,council)";
const read = (path: string) => readFileSync(path, "utf8");

test("마이페이지 서랍과 그 복귀 장치는 남아 있지 않다", () => {
  for (const path of ["components/MyPageDrawer.tsx", "components/MyPageDrawerOverlay.tsx", "hooks/useReturnToMyPageDrawer.ts"]) {
    assert.equal(existsSync(path), false, `${path}가 남아 있다`);
  }
  assert.doesNotMatch(read("app/(tabs)/_layout.tsx"), /MyPageDrawer/);
});

test("홈의 마이페이지 버튼은 지금 탭 스택에 마이페이지 화면을 쌓는다", () => {
  assert.match(read(`${GROUP}/home.tsx`), /router\.push\(\(isAuthenticated \? "\/settings" : "\/auth\/login"\) as never\)/);
});

test("마이페이지만 왼쪽에서 들어오고 iOS 기본 스와이프를 끈다", () => {
  const layout = read(`${GROUP}/_layout.tsx`);
  assert.match(layout, /MY_PAGE_SCREEN_OPTIONS = \{ animation: "slide_from_left", gestureEnabled: false \}/);
  assert.match(layout, /route\.name === "settings\/index" \? MY_PAGE_SCREEN_OPTIONS : null/);
  // 그 밖의 화면과 상위 레이아웃은 iOS 기본 스와이프를 그대로 쓴다.
  for (const path of ["app/_layout.tsx", "app/(tabs)/_layout.tsx"]) {
    assert.doesNotMatch(read(path), /gestureEnabled: false/, `${path}에서 기본 제스처를 껐다`);
  }
});

test("마이페이지의 헤더 뒤로가기와 가장자리 스와이프는 같은 뒤로가기를 쓴다", () => {
  const myPage = read(`${GROUP}/settings/index.tsx`);
  assert.match(myPage, /<EdgeSwipeBack onBack=\{goBack\}>/);
  assert.match(myPage, /accessibilityLabel="뒤로"\s+onPress=\{goBack\}/);
});

test("가장자리 스와이프는 iOS에서만, 왼쪽 가장자리에서 오른쪽으로 쓸었을 때만 실행한다", () => {
  const source = read("components/EdgeSwipeBack.tsx");
  assert.match(source, /\.enabled\(Platform\.OS === "ios"\)/);
  assert.match(source, /\.hitSlop\(\{ left: 0, width: EDGE_WIDTH \}\)/);
  assert.match(source, /event\.translationX >= TRIGGER_DISTANCE \|\| event\.velocityX >= TRIGGER_VELOCITY/);
});

test("마이페이지 하위 화면은 일반 pop으로 마이페이지에 돌아간다", () => {
  for (const name of ["profile", "activity", "notifications", "account"]) {
    const source = read(`${GROUP}/settings/${name}.tsx`);
    assert.match(source, /onPress=\{backToMyPage\}/, `${name}의 헤더 뒤로가기`);
    assert.doesNotMatch(source, /usePreventRemove|onLayout=\{onLayout\}/, `${name}에 서랍 복귀 장치가 남았다`);
  }
  assert.match(read(`${GROUP}/settings/profile.tsx`), /queueToastForNextScreen\(TOAST_SUCCESS_MESSAGES\.profileSaved, "success"\);\s+backToMyPage\(\);/);
});
