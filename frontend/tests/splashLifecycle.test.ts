import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import { MINIMUM_SPLASH_DURATION_MS, shouldShowSplash } from "../utils/splash";

type Element = { type: unknown; props: Record<string, unknown> };

function findElement(node: unknown, type: string): Element | undefined {
  if (!node || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    return node.map((child) => findElement(child, type)).find(Boolean);
  }
  const element = node as Element;
  return element.type === type ? element : findElement(element.props?.children, type);
}

// Execute the real root layout with native modules at the boundary replaced.
function layoutHarness(platform: "android" | "ios" | "web") {
  const calls: string[] = [];
  const state = { hasHydrated: false, fontsLoaded: false, isAuthenticated: true,
    user: null, hydrateSession: () => { calls.push("hydrate"); } };
  const values: unknown[] = [];
  const cleanups: (() => void)[] = [];
  const timers = new Map<number, () => void>();
  let stateIndex = 0;
  let mounted = false;
  const effects: (() => void | (() => void))[] = [];
  const jsx = (type: unknown, props: Element["props"]): Element => ({ type, props });
  const modules: Record<string, unknown> = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useMemo(factory: () => unknown) {
        const index = stateIndex++;
        if (!mounted) values[index] = factory();
        return values[index];
      },
      useState(initial: unknown) {
        const index = stateIndex++;
        if (!mounted) values[index] = typeof initial === "function" ? initial() : initial;
        return [values[index], (value: unknown) => { values[index] = value; }];
      },
      useEffect(effect: () => void | (() => void)) {
        if (!mounted) effects.push(effect);
      },
    },
    "react-native": { Platform: { OS: platform }, View: "View", Image: "Image",
      StyleSheet: { create: (styles: unknown) => styles }, useWindowDimensions: () => ({ width: 400 }) },
    "expo-font": { useFonts: () => [state.fontsLoaded] },
    "expo-router": { Stack: Object.assign("Stack", { Protected: "Protected", Screen: "Screen" }) },
    "expo-status-bar": { StatusBar: "StatusBar" },
    "expo-splash-screen": {
      preventAutoHideAsync: () => { calls.push("prevent"); return Promise.resolve(true); },
      hide: () => { calls.push("hide"); },
    },
    "@tanstack/react-query": { QueryClient: class { clear() {} }, QueryClientProvider: "QueryClientProvider" },
    "../components/NotificationBootstrap": { default: "NotificationBootstrap" },
    "../components/StatusBarScrim": { default: "StatusBarScrim" },
    "../components/KeyboardViewport": { default: "KeyboardViewport" },
    "../stores/userStore": { useUserStore: (select: (store: typeof state) => unknown) => select(state) },
    "../utils/fonts": { APP_FONTS: {}, patchDefaultFontFamily: () => {} },
    "../utils/permissions": { isAdminUser: () => false },
    "../utils/splash": { MINIMUM_SPLASH_DURATION_MS, shouldShowSplash },
    "../assets/splash-logo.png": "splash-artwork",
  };
  const exports = {} as { default: () => Element | null };
  const code = ts.transpileModule(readFileSync("app/_layout.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(code, {
    exports,
    require: (name: string) => {
      assert.ok(name in modules, `Unexpected module: ${name}`);
      return modules[name];
    },
    setTimeout: (callback: () => void, delay: number) => {
      assert.equal(delay, 1_500);
      timers.set(1, callback);
      return 1;
    },
    clearTimeout: (id: number) => timers.delete(id),
  });
  return {
    calls, state, timers,
    render() {
      stateIndex = 0;
      const tree = exports.default();
      mounted = true;
      for (const effect of effects.splice(0)) {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
      }
      return tree;
    },
    elapseMinimum() {
      assert.equal(timers.size, 1);
      const callback = timers.get(1)!;
      timers.clear();
      callback();
    },
    unmount: () => cleanups.forEach((cleanup) => cleanup()),
  };
}

for (const platform of ["android", "ios"] as const) {
  test(`${platform}: 앱 준비 중 네이티브 스플래시를 유지하고 두 번째 로고를 그리지 않는다`, () => {
    const h = layoutHarness(platform);
    assert.deepEqual(h.calls, ["prevent"]); // Must happen before the first render.
    assert.equal(h.render(), null);
    h.state.hasHydrated = true;
    h.state.fontsLoaded = true;
    assert.equal(h.render(), null); // Minimum duration still pending.
    assert.deepEqual(h.calls, ["prevent", "hydrate"]);
    h.unmount();
    assert.equal(h.timers.size, 0);
  });

  test(`${platform}: 세션·폰트·최소 시간 이후 본 화면이 배치되어야 네이티브 스플래시를 닫는다`, () => {
    const h = layoutHarness(platform);
    h.render();
    h.elapseMinimum();
    assert.equal(h.render(), null);
    h.state.hasHydrated = true;
    assert.equal(h.render(), null);
    h.state.hasHydrated = false;
    h.state.fontsLoaded = true;
    assert.equal(h.render(), null);
    h.state.hasHydrated = true;
    const tree = h.render();
    assert.ok(findElement(tree, "Screen"));
    assert.equal(findElement(tree, "Image"), undefined);
    assert.deepEqual(h.calls, ["prevent", "hydrate"]);
    const viewport = findElement(tree, "View")!;
    assert.equal(typeof viewport.props.onLayout, "function");
    (viewport.props.onLayout as () => void)();
    assert.deepEqual(h.calls, ["prevent", "hydrate", "hide"]);
  });
}

test("웹은 기존 이미지와 준비 시간을 유지하며 네이티브 스플래시를 제어하지 않는다", () => {
  const h = layoutHarness("web");
  assert.deepEqual(h.calls, []);
  const splash = findElement(h.render(), "Image")!;
  assert.equal(splash.props.source, "splash-artwork");
  assert.equal(splash.props.resizeMode, "contain");
  (splash.props.onLoadEnd as (() => void) | undefined)?.();
  assert.deepEqual(h.calls, ["hydrate"]);
  h.state.hasHydrated = true;
  h.state.fontsLoaded = true;
  assert.ok(findElement(h.render(), "Image"));
  h.elapseMinimum();
  const tree = h.render();
  assert.ok(findElement(tree, "Screen"));
  assert.equal(findElement(tree, "Image"), undefined);
  (findElement(tree, "View")?.props.onLayout as (() => void) | undefined)?.();
  assert.deepEqual(h.calls, ["hydrate"]);
});
