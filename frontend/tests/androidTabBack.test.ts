import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { TabRouter } from "@react-navigation/routers";
import ts from "typescript";

import { androidTabBackAction } from "../utils/androidTabBack";

test("홈에서만 기본 뒤로가기를 허용하고 다른 기본 탭은 이력과 무관하게 홈으로 돌아간다", () => {
  for (const canGoBack of [false, true]) {
    assert.equal(androidTabBackAction("/home", canGoBack, false), "default");
    for (const path of ["/notices", "/community", "/participation", "/council"]) {
      assert.equal(androidTabBackAction(path, canGoBack, false), "home");
    }
  }
});

test("종료·재진입 후 참여활동의 뒤로가기 이력이 없어도 홈 복귀를 처리한다", () => {
  const router = TabRouter({ initialRouteName: "home", backBehavior: "initialRoute" });
  const options = { routeNames: ["home", "participation"], routeParamList: {}, routeGetIdList: {} };
  const initial = router.getInitialState(options);
  const participation = router.getStateForAction(initial, { type: "NAVIGATE", payload: { name: "participation" } }, options)!;
  assert.ok(participation.stale === false);
  // A missing history must not cause an unhandled back event to reach Android.
  const withoutHistory = { ...participation, history: [participation.history.at(-1)!] };
  assert.equal(router.getStateForAction(withoutHistory, { type: "GO_BACK" }, options), null);
  assert.equal(androidTabBackAction("/participation", false, false), "home");
  const home = router.getStateForAction(withoutHistory, { type: "NAVIGATE", payload: { name: "home" } }, options)!;
  assert.ok(home.stale === false);
  assert.equal(home.routes[home.index].name, "home");
  assert.equal(router.getStateForAction(home, { type: "GO_BACK" }, options), null);
});

test("상세 화면의 정상 이력은 기존 화면별 뒤로가기 처리에 맡긴다", () => {
  for (const path of ["/board/17", "/board/post/42", "/board/post/create", "/settings/account", "/events/7"]) {
    assert.equal(androidTabBackAction(path, true, false), "default");
    assert.equal(androidTabBackAction(path, false, false), "home");
  }
});

test("홈 위를 포함해 열린 마이페이지 패널이 뒤로가기를 먼저 소비한다", () => {
  for (const path of ["/home", "/participation", "/settings/account"]) {
    for (const canGoBack of [false, true]) {
      assert.equal(androidTabBackAction(path, canGoBack, true), "close-drawer");
    }
  }
});

test("그룹 경로와 끝 슬래시도 같은 탭으로 처리한다", () => {
  assert.equal(androidTabBackAction("/(tabs)/participation/", false, false), "home");
  assert.equal(androidTabBackAction("/(tabs)/home/", false, false), "default");
  assert.equal(androidTabBackAction("/council/detail", true, false), "default");
});

function hookHarness(platform = "android") {
  let pathname = "/home";
  let canGoBack = false;
  let listener: (() => boolean) | undefined;
  let focusEffect: (() => (() => void) | undefined) | undefined;
  const calls: string[] = [];
  let stateRef: { current: unknown } | undefined;
  const moduleExports: { useAndroidTabBack?: (open: boolean, close: () => void) => void } = {};
  const code = ts.transpileModule(readFileSync("hooks/useAndroidTabBack.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const modules: Record<string, unknown> = {
    "expo-router": {
      router: { canGoBack: () => canGoBack, navigate: (route: string) => calls.push(route) },
      usePathname: () => pathname,
      useFocusEffect: (effect: typeof focusEffect) => { focusEffect = effect; },
    },
    react: {
      useCallback: (callback: unknown) => callback,
      useRef: (value: unknown) => (stateRef ??= { current: value }),
      useLayoutEffect: (effect: () => void) => effect(),
    },
    "react-native": {
      Platform: { OS: platform },
      BackHandler: {
        addEventListener: (event: string, callback: () => boolean) => {
          assert.equal(event, "hardwareBackPress");
          listener = callback;
          return { remove: () => { listener = undefined; } };
        },
      },
    },
    "../utils/androidTabBack": { androidTabBackAction },
    "../utils/tabNavigation": { navigateToTabRoot: (tab: string) => calls.push(`/(tabs)/${tab}`) },
  };
  runInNewContext(code, { exports: moduleExports, require: (name: string) => modules[name] });
  return {
    calls,
    focus(path: string, history = false, drawerOpen = false) {
      pathname = path;
      canGoBack = history;
      moduleExports.useAndroidTabBack!(drawerOpen, () => calls.push("close"));
      return focusEffect!();
    },
    press: () => listener?.(),
  };
}

test("Android 훅 구독은 홈 종료 후 재등록되어 참여활동 뒤로가기를 소비한다", () => {
  const h = hookHarness();
  const leaveHome = h.focus("/home");
  assert.equal(h.press(), false);
  leaveHome!();
  assert.equal(h.press(), undefined);
  const leaveParticipation = h.focus("/participation");
  assert.equal(h.press(), true);
  assert.deepEqual(h.calls, ["/(tabs)/home"]);
  leaveParticipation!();
  h.focus("/home");
  assert.equal(h.press(), false);
});

test("훅 구독은 패널 닫기를 우선하고 상세 뒤로가기는 다른 처리기에 전달한다", () => {
  const h = hookHarness();
  const close = h.focus("/home", false, true);
  assert.equal(h.press(), true);
  assert.deepEqual(h.calls, ["close"]);
  close!();
  h.focus("/board/post/42", true);
  assert.equal(h.press(), false);
  assert.deepEqual(h.calls, ["close"]);
});

test("iOS와 웹에는 Android 뒤로가기 구독을 등록하지 않는다", () => {
  for (const platform of ["ios", "web"]) {
    const h = hookHarness(platform);
    assert.equal(h.focus("/participation"), undefined);
    assert.equal(h.press(), undefined);
    assert.deepEqual(h.calls, []);
  }
});
