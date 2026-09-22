import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import * as navigation from "../utils/myPageNavigation";
import * as userLabel from "../utils/userLabel";

type Element = { type: string; props: Record<string, unknown> };
type Context = { openDrawer: () => void; closeDrawer: () => void; returnToDrawer: () => void;
  settingsDidLayout: (route: string) => void };
type Gesture = { x0: number; dx: number; dy: number; numberActiveTouches: number };
type ResponderConfig = Record<string, ((event: unknown, gesture: Gesture) => unknown) | undefined>;

function nodes(tree: unknown): Element[] {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  const node = tree as Element;
  return [node, ...nodes(node.props?.children)];
}

function harness(origin = "/home") {
  let pathname = origin;
  let index = 0;
  const slots: unknown[] = [];
  const effects: (() => void)[] = [];
  const calls: string[] = [];
  const timers: (() => void)[] = [];
  const animations: { toValue: number; done?: (result: { finished: boolean }) => void }[] = [];
  const slot = (initial: () => unknown) => {
    const current = index++;
    if (!(current in slots)) slots[current] = initial();
    return current;
  };
  const jsx = (type: string, props: Element["props"]) => ({ type, props });
  class Value {
    constructor(public value: number) {}
    setValue(value: number) { this.value = value; }
    interpolate() { return 1; }
    stopAnimation() {}
  }
  const modules: Record<string, unknown> = {
    react: {
      createContext: () => ({ Provider: "Provider" }),
      useContext: () => undefined,
      useState: (initial: unknown) => { const i = slot(() => initial); return [slots[i], (value: unknown) => { slots[i] = value; }]; },
      useRef: (initial: unknown) => slots[slot(() => ({ current: initial }))],
      useEffect: (effect: () => void) => { effects.push(effect); },
      useMemo: (factory: () => unknown) => factory(),
      useCallback: (callback: unknown) => callback,
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      Platform: { OS: "android" }, View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView",
      StyleSheet: { create: (styles: unknown) => styles }, useWindowDimensions: () => ({ width: 400 }),
      PanResponder: { create: (config: ResponderConfig) => ({ panHandlers: {
        onStartShouldSetResponder: config.onStartShouldSetPanResponder,
        onStartShouldSetResponderCapture: config.onStartShouldSetPanResponderCapture,
        onMoveShouldSetResponderCapture: config.onMoveShouldSetPanResponderCapture,
        onResponderRelease: config.onPanResponderRelease,
      } }) },
      Animated: { Value, View: "AnimatedView", timing: (_value: Value, config: { toValue: number }) => ({
        start: (done?: (result: { finished: boolean }) => void) => animations.push({ toValue: config.toValue, done }),
      }) },
    },
    "expo-router": { usePathname: () => pathname, router: {
      push: (route: string) => calls.push(`push:${route}`), navigate: (route: string) => calls.push(`navigate:${route}`),
    } },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 24 }) },
    "@expo/vector-icons": { Ionicons: "Icon" },
    "../hooks/useApi": { useMeQuery: () => ({ data: { data: { nickname: "프로필" } } }) },
    "../hooks/useAndroidTabBack": { useAndroidTabBack: () => {} },
    "../stores/userStore": { useUserStore: (select: (state: object) => unknown) => select({ isAuthenticated: true }) },
    "../services/api": {}, "../utils/pushTokenStorage": {},
    "../utils/myPageNavigation": navigation,
    "../utils/userLabel": userLabel,
    "./ProfileAvatar": { default: "Avatar" }, "./icons": { BackIcon: "BackIcon", ChevronRightIcon: "ChevronRightIcon" },
    "./MyPageDrawerOverlay": { default: "Overlay" },
  };
  const exports = {} as { MyPageDrawerProvider: (props: object) => Element };
  const code = ts.transpileModule(readFileSync("components/MyPageDrawer.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(code, { exports, require: (name: string) => {
    assert.ok(name in modules, name); return modules[name];
  }, setTimeout: (callback: () => void) => timers.push(callback) });
  let tree: Element;
  const render = () => {
    index = 0;
    tree = exports.MyPageDrawerProvider({ children: jsx("Navigator", {}) });
    for (const effect of effects.splice(0)) effect();
  };
  render();
  return {
    calls, timers, animations, render,
    context: () => tree.props.value as Context,
    overlay: () => nodes(tree).find((node) => node.type === "Overlay"),
    host: () => tree.props.children as Element,
    path: (path: string) => { pathname = path; render(); },
    press(label: string) {
      const button = nodes(tree).find((node) => node.type === "Pressable" &&
        nodes(node).some((child) => child.type === "Text" && child.props.children === label));
      assert.ok(button, label);
      (button.props.onPress as () => void)();
      render();
    },
    open() {
      (tree.props.value as Context).openDrawer();
      render();
      for (const animation of animations.splice(0)) animation.done?.({ finished: true });
      render();
    },
  };
}

for (const [label, route] of [["프로필", "/settings/profile"], ["알림 설정", "/settings/notifications"], ["계정 설정", "/settings/account"]]) {
  test(`${label}: 같은 화면에서 연 패널은 재이동이나 새 배치를 기다리지 않는다`, () => {
    const h = harness(route);
    h.open();
    h.press(label);
    assert.equal(h.overlay(), undefined);
    assert.deepEqual(h.calls, []);
    assert.equal(h.animations.length, 0);
    assert.equal(h.timers.length, 0);
  });

  test(`${label}: 이동 중 패널을 닫지 않고 목적 화면의 배치를 기다린다`, () => {
    const h = harness("/participation");
    h.open();
    h.press(label);
    assert.ok(h.overlay());
    assert.deepEqual(h.calls, [`push:${route}`]);
    assert.equal(h.animations.length, 0);
    assert.equal(h.timers.length, 0);
    h.press(label); // Repeated taps cannot stack navigation while covered.
    assert.equal(h.calls.length, 1);
    h.context().settingsDidLayout("/settings/password");
    h.render();
    assert.ok(h.overlay());
    h.path(route);
    h.context().settingsDidLayout(route);
    h.render();
    assert.equal(h.overlay(), undefined);
    h.context().returnToDrawer();
    h.render();
    const overlay = h.overlay()!;
    assert.ok(overlay);
    assert.equal(h.animations.length, 0); // Do not slide in over the underlying tab.
    assert.deepEqual(h.calls, [`push:${route}`]);
    (overlay.props.onShow as () => void)();
    assert.deepEqual(h.calls, [`push:${route}`, "navigate:/(tabs)/participation"]);
    (overlay.props.onShow as () => void)();
    assert.equal(h.calls.length, 2);
    h.path("/participation");
    assert.ok(h.overlay());
    h.context().closeDrawer();
    assert.equal(h.animations.length, 1); // Explicit close still slides away.
  });
}

test("작성 글과 스크랩을 반복해서 열어도 필터를 보존하고 한 번에 원래 패널로 돌아온다", () => {
  const h = harness("/participation");
  h.open();
  for (const [label, type] of [["내가 쓴 글", "posts"], ["스크랩한 글", "bookmarks"], ["내가 쓴 글", "posts"]]) {
    h.calls.length = 0;
    h.press(label);
    assert.deepEqual(h.calls, [`push:/settings/activity?type=${type}`]);
    assert.equal(h.timers.length, 0);
    assert.equal(h.animations.length, 0);
    assert.ok(h.overlay());
    h.path("/settings/activity");
    h.context().settingsDidLayout("/settings/activity");
    h.render();
    assert.equal(h.overlay(), undefined);
    h.context().returnToDrawer();
    h.render();
    const overlay = h.overlay()!;
    assert.ok(overlay);
    (overlay.props.onShow as () => void)();
    assert.deepEqual(h.calls, [`push:/settings/activity?type=${type}`, "navigate:/(tabs)/participation"]);
    h.path("/participation");
  }
});

test("닫힌 마이페이지는 화면을 덮지 않고 어떤 제스처도 가로채지 않는다", () => {
  // 왼쪽 가장자리 드래그로 서랍을 열던 동작을 없앴다. iOS의 기본 스와이프
  // 뒤로가기와 같은 구역을 다퉜고, 네이티브 제스처는 JS 반응자가 막을 수
  // 없어 뒤로가기와 서랍이 번갈아 걸렸다.
  const h = harness("/board/post/1");
  const host = h.host();
  assert.deepEqual(nodes(host).map((node) => node.type), ["View", "Navigator"]);
  for (const handler of [
    "onStartShouldSetResponder",
    "onStartShouldSetResponderCapture",
    "onMoveShouldSetResponderCapture",
    "onResponderRelease",
  ]) {
    assert.equal(host.props[handler], undefined, `${handler}가 남아 있으면 스와이프 뒤로가기와 다툰다`);
  }
  assert.equal(h.overlay(), undefined);
});

test("서랍에는 여닫는 스와이프가 없다", () => {
  const source = readFileSync("components/MyPageDrawer.tsx", "utf8");
  assert.doesNotMatch(source, /PanResponder/);
  assert.doesNotMatch(source, /panHandlers/);
});

test("iOS 기본 스와이프 뒤로가기는 꺼두지 않는다", () => {
  // 예전 오작동은 서랍이 같은 구역에 자체 PanResponder를 걸어 다퉜기 때문이고,
  // 그 자체 제스처를 없애서 해결했다. 플랫폼 기본 제스처까지 끄지 않는다.
  for (const layout of [
    "app/_layout.tsx",
    "app/(tabs)/board/_layout.tsx",
    "app/(tabs)/events/_layout.tsx",
    "app/(tabs)/settings/_layout.tsx",
  ]) {
    assert.doesNotMatch(readFileSync(layout, "utf8"), /gestureEnabled: false/, `${layout}에서 기본 제스처를 껐다`);
  }
});

test("활동 목록 위의 패널에서 다른 필터를 선택해도 쿼리를 잃거나 대기가 멈추지 않는다", () => {
  const h = harness("/settings/activity");
  h.open();
  h.press("스크랩한 글");
  assert.deepEqual(h.calls, ["push:/settings/activity?type=bookmarks"]);
  h.context().settingsDidLayout("/settings/activity");
  h.render();
  assert.equal(h.overlay(), undefined);
});
