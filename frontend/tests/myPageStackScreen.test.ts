import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

// 2026-10-13 PLAN.md: 홈의 마이페이지는 홈 화면 안에 그리는 서랍이다. 홈은 멈춰 있고
// 마이페이지가 덮으며 들어온다. 하위 화면은 홈 탭 스택에 쌓이고, 서랍은 그동안 열린 채라
// pop 하면 그대로 보인다(iOS 튕김 없음). settings/index 경로는 아래 화면이 없을 때만 쓴다.
const GROUP = "app/(tabs)/(home,notices,community,participation,council)";
const read = (path: string) => readFileSync(path, "utf8");

test("예전 서랍의 닫았다 다시 여는 복귀 장치는 남아 있지 않다", () => {
  for (const path of ["components/MyPageDrawerOverlay.tsx", "hooks/useReturnToMyPageDrawer.ts"]) {
    assert.equal(existsSync(path), false, `${path}가 남아 있다`);
  }
  // 서랍은 탭 전체가 아니라 홈 화면 안에 그린다. 그래야 하위 화면이 서랍 위에 쌓인다.
  assert.doesNotMatch(read("app/(tabs)/_layout.tsx"), /MyPageDrawer/);
  const drawer = read("components/MyPageDrawer.tsx").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(drawer, /usePreventRemove|router\.(push|replace|back)/);
});

test("홈의 마이페이지 버튼은 홈 위를 덮는 서랍을 연다", () => {
  const home = read(`${GROUP}/home.tsx`);
  assert.match(home, /onPress=\{\(\) => \(isAuthenticated \? setMyPageOpen\(true\) : router\.push\("\/auth\/login" as never\)\)\}/);
  assert.match(home, /<MyPageDrawer open=\{myPageOpen\} onClose=\{closeMyPage\} \/>/);
});

test("서랍은 헤더·안드로이드 뒤로가기·iOS 가장자리 스와이프·홈 탭 누르기로 왼쪽으로 닫힌다", () => {
  const drawer = read("components/MyPageDrawer.tsx");
  assert.match(drawer, /<EdgeSwipeBack active onBack=\{close\}>\s+<MyPageContent onBack=\{close\} \/>/);
  assert.match(drawer, /BackHandler\.addEventListener\("hardwareBackPress", \(\) => \{\s+close\(\);\s+return true;/);
  assert.match(drawer, /addListener\("tabPress" as never, \(\) => \{[\s\S]*?if \(navigation\.isFocused\(\)\) close\(\);/);
  assert.match(drawer, /toValue: -width, duration: CLOSE_DURATION/);
});

test("다른 탭으로 가면 서랍을 닫아, 뒤로가기로 돌아오면 홈이 보인다", () => {
  const drawer = read("components/MyPageDrawer.tsx");
  assert.match(drawer, /tabStack\.addListener\("blur", \(\) => onClose\(\)\)/);
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

test("마이페이지 경로 화면의 헤더 뒤로가기와 가장자리 스와이프는 같은 뒤로가기를 쓴다", () => {
  const myPage = read(`${GROUP}/settings/index.tsx`);
  assert.match(myPage, /<EdgeSwipeBack onBack=\{goBack\}>\s+<MyPageContent onBack=\{goBack\} \/>/);
  assert.match(myPage, /accessibilityLabel="뒤로"\s+onPress=\{onBack\}/);
});

test("가장자리 스와이프는 iOS에서만, 왼쪽 가장자리에서 오른쪽으로 쓸었을 때만 실행한다", () => {
  const source = read("components/EdgeSwipeBack.tsx");
  assert.match(source, /const enabled = Platform\.OS === "ios" && active;/);
  assert.match(source, /\.enabled\(enabled\)/);
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
