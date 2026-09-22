import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import * as myPageNavigation from "../utils/myPageNavigation";

function harness() {
  let focused = false;
  let effect: () => () => void;
  let back: (() => boolean) | undefined;
  let returns = 0;
  const ready: string[] = [];
  const frames = new Map<number, () => void>();
  let frameId = 0;
  const modules: Record<string, unknown> = {
    react: { useCallback: (fn: unknown) => fn, useRef: (initial: unknown) => ({ current: initial }) },
    "expo-router": {
      useNavigation: () => ({ isFocused: () => focused }),
      useFocusEffect: (fn: typeof effect) => { effect = fn; },
    },
    // iOS 가장자리 스와이프로 들어오는 제거를 막고 같은 복귀를 태운다.
    "@react-navigation/native": {
      usePreventRemove: (prevent: boolean, callback: () => void) => { preventRemove = { prevent, callback }; },
    },
    "react-native": { Platform: { OS: "android" }, BackHandler: {
      addEventListener: (_event: string, fn: () => boolean) => {
        back = fn;
        return { remove: () => { back = undefined; } };
      },
    } },
    "../components/MyPageDrawer": { useMyPageDrawer: () => ({
      returnToDrawer: () => { returns++; }, settingsDidLayout: (route: string) => ready.push(route),
    }) },
    "../utils/myPageNavigation": myPageNavigation,
  };
  let preventRemove: { prevent: boolean; callback: () => void } | undefined;
  const exports = {} as { useReturnToMyPageDrawer: (route: string) => { onLayout: () => void; returnToMyPageDrawer: () => void } };
  const code = ts.transpileModule(readFileSync("hooks/useReturnToMyPageDrawer.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(code, { exports, require: (name: string) => modules[name],
    requestAnimationFrame: (callback: () => void) => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  });
  const hook = exports.useReturnToMyPageDrawer("/settings/profile");
  return { hook, ready, frames, back: () => back?.(), returns: () => returns,
    preventRemove: () => preventRemove,
    frame: () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback()); },
    focus: () => { focused = true; return effect(); }, blur: () => { focused = false; } };
}

test("설정 화면이 먼저 배치되어도 포커스가 오기 전에는 패널을 숨기지 않는다", () => {
  const h = harness();
  h.hook.onLayout();
  assert.deepEqual(h.ready, []);
  h.focus();
  assert.deepEqual(h.ready, []);
  h.frame();
  assert.deepEqual(h.ready, []); // The native commit has a chance to paint first.
  h.frame();
  assert.deepEqual(h.ready, ["/settings/profile"]);
});

test("설정 화면이 먼저 포커스되어도 첫 배치를 기다리고 재포커스는 기존 배치를 사용한다", () => {
  const h = harness();
  const cleanup = h.focus();
  assert.deepEqual(h.ready, []);
  h.hook.onLayout();
  h.frame();
  h.frame();
  assert.deepEqual(h.ready, ["/settings/profile"]);
  assert.equal(h.back(), true);
  h.hook.returnToMyPageDrawer();
  assert.equal(h.returns(), 2);
  cleanup();
  h.blur();
  assert.equal(h.back(), undefined);
  h.focus();
  h.frame();
  h.frame();
  assert.deepEqual(h.ready, ["/settings/profile", "/settings/profile"]);
});

test("화면을 떠나면 표시 대기를 취소하여 다른 설정의 패널을 숨기지 않는다", () => {
  const h = harness();
  const cleanup = h.focus();
  h.hook.onLayout();
  h.frame();
  assert.equal(h.frames.size, 1);
  h.blur();
  cleanup();
  h.frame();
  assert.equal(h.frames.size, 0);
  assert.deepEqual(h.ready, []);
});

test("설정 하위에서 스와이프로 빠져나가는 것도 막고 마이페이지로 복귀한다", () => {
  // 이 화면들의 뒤로가기는 pop이 아니라 서랍으로 덮은 뒤 원래 탭으로 가는
  // 전환이다. iOS 제스처가 그냥 pop 하면 설정 목록으로 떨어진다.
  const h = harness();
  const prevented = h.preventRemove();
  assert.ok(prevented, "usePreventRemove를 걸어야 한다");
  assert.equal(prevented.prevent, true);
  assert.equal(h.returns(), 0);
  prevented.callback();
  assert.equal(h.returns(), 1, "헤더·안드로이드와 같은 복귀를 타야 한다");
});
