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

test("닫힌 마이페이지는 화면을 덮지 않고 왼쪽 버튼의 탭과 작은 손떨림을 통과시킨다", () => {
  const h = harness("/board/post/1");
  const host = h.host();
  assert.deepEqual(nodes(host).map((node) => node.type), ["View", "Navigator"]);
  const start = host.props.onStartShouldSetResponder as (event: unknown, gesture: Gesture) => boolean;
  const capture = host.props.onStartShouldSetResponderCapture as (event: unknown, gesture: Gesture) => boolean;
  const move = host.props.onMoveShouldSetResponderCapture as (event: unknown, gesture: Gesture) => boolean;
  capture?.({ nativeEvent: { pageX: 16 } }, { x0: 0, dx: 0, dy: 0, numberActiveTouches: 1 });
  assert.equal(start({}, { x0: 16, dx: 0, dy: 0, numberActiveTouches: 1 }), false);
  assert.equal(move({}, { x0: 16, dx: 5, dy: 2, numberActiveTouches: 1 }), false);
  assert.equal(h.overlay(), undefined);
});

test("마이페이지는 왼쪽 가장자리의 한 손가락 가로 드래그만 인식한다", () => {
  const h = harness("/board/post/1");
  const move = h.host().props.onMoveShouldSetResponderCapture as (event: unknown, gesture: Gesture) => boolean;
  const capture = h.host().props.onStartShouldSetResponderCapture as (event: unknown, gesture: Gesture) => boolean;
  assert.equal(typeof move, "function");
  for (const gesture of [
    { x0: 24, dx: 60, dy: 0, numberActiveTouches: 1 },
    { x0: 16, dx: 14, dy: 0, numberActiveTouches: 1 },
    { x0: 16, dx: 20, dy: 30, numberActiveTouches: 1 },
    { x0: 16, dx: -60, dy: 0, numberActiveTouches: 1 },
    { x0: 16, dx: 60, dy: 0, numberActiveTouches: 2 },
  ]) {
    capture?.({ nativeEvent: { pageX: gesture.x0 } }, { ...gesture, x0: 0, dx: 0, dy: 0 });
    // Native PanResponder leaves x0 at zero until the responder is granted.
    assert.equal(move({}, { ...gesture, x0: 0 }), false, JSON.stringify(gesture));
  }
  capture?.({ nativeEvent: { pageX: 23 } }, { x0: 0, dx: 0, dy: 0, numberActiveTouches: 1 });
  assert.equal(move({}, { x0: 0, dx: 40, dy: 5, numberActiveTouches: 1 }), true);
});

test("가장자리 드래그가 충분히 진행된 뒤에만 마이페이지를 연다", () => {
  const h = harness("/board/post/1");
  const release = h.host().props.onResponderRelease as (event: unknown, gesture: Gesture) => void;
  const capture = h.host().props.onStartShouldSetResponderCapture as (event: unknown, gesture: Gesture) => boolean;
  assert.equal(typeof release, "function");
  capture({ nativeEvent: { pageX: 16 } }, { x0: 0, dx: 0, dy: 0, numberActiveTouches: 1 });
  release({ nativeEvent: { pageX: 46 } }, { x0: 16, dx: 0, dy: 0, numberActiveTouches: 0 });
  h.render();
  assert.equal(h.overlay(), undefined);
  // A quick swipe can release immediately after grant resets gesture.dx to zero.
  release({ nativeEvent: { pageX: 76 } }, { x0: 16, dx: 0, dy: 0, numberActiveTouches: 0 });
  h.render();
  assert.ok(h.overlay());
  const move = h.host().props.onMoveShouldSetResponderCapture as (event: unknown, gesture: Gesture) => boolean;
  assert.equal(move({}, { x0: 16, dx: 60, dy: 0, numberActiveTouches: 1 }), false);
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
