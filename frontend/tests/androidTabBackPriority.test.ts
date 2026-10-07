import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import { androidTabBackAction } from "../utils/androidTabBack";
import { HOME_TAB_ROUTE } from "../utils/appRoutes";

const source = ts.createSourceFile("tabBack.ts", readFileSync("hooks/useAndroidTabBack.ts", "utf8"), ts.ScriptTarget.Latest, true);
const hook = source.statements.find(ts.isFunctionDeclaration)!;
const code = ts.transpileModule(`(function(drawerOpen, closeDrawer) ${hook.body!.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

test("tab fallback retains lower priority after detail return, drawer close and callback changes", () => {
  const listeners: (() => boolean)[] = [];
  const actions: string[] = [];
  let path = "/board/post/42";
  let overlayOpen = true;
  let memo: { fn: () => unknown; deps: unknown[] } | undefined;
  let installed: unknown;
  let cleanup: (() => void) | undefined;
  let ref: { current: unknown } | undefined;
  const render = runInNewContext(code, {
    HOME_TAB_ROUTE, androidTabBackAction,
    usePathname: () => path,
    useRef: (value: unknown) => (ref ??= { current: value }),
    useLayoutEffect: (effect: () => void) => effect(),
    useCallback(fn: () => unknown, deps: unknown[]) {
      if (!memo || deps.some((v, i) => !Object.is(v, memo!.deps[i]))) memo = { fn, deps };
      return memo.fn;
    },
    useFocusEffect(effect: () => (() => void) | undefined) {
      if (installed !== effect) { cleanup?.(); cleanup = effect(); installed = effect; }
    },
    Platform: { OS: "android" },
    BackHandler: { addEventListener(_event: string, fn: () => boolean) {
      listeners.push(fn);
      return { remove: () => { listeners.splice(listeners.indexOf(fn), 1); } };
    } },
    router: { canGoBack: () => true },
    navigateToTabRoot: () => actions.push("home"),
  });
  const closeDrawer = () => actions.push("drawer");
  render(false, closeDrawer);
  // Returning screen focuses before the parent pathname update. A retained
  // search/sort handler must stay ahead of the tab's fallback subscription.
  const child = () => {
    if (!overlayOpen) return false;
    overlayOpen = false; actions.push("overlay"); return true;
  };
  listeners.push(child);
  path = "/community";
  render(false, closeDrawer);
  render(true, closeDrawer);
  // Native Modal consumes drawer Back through onRequestClose, then updates
  // the provider. No child refocus or overlay state change happens here.
  render(false, () => actions.push("new drawer callback"));
  function hardwareBack() {
    for (const handler of [...listeners].reverse()) if (handler()) return;
  }
  hardwareBack();
  assert.deepEqual(actions, ["overlay"]);
  hardwareBack();
  assert.deepEqual(actions, ["overlay", "home"]);
  path = "/home";
  render(false, closeDrawer);
  hardwareBack();
  assert.deepEqual(actions, ["overlay", "home"], "latest Home path falls through to Android");
  cleanup?.();
  assert.deepEqual(listeners, [child]);
});
