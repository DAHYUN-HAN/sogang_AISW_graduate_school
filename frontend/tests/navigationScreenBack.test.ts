import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import * as routes from "../utils/appRoutes";

// Exercise the actual screen callbacks/subscriptions, not a second copy of the
// navigation policy. Native keyboard/parent-listener ordering is checked in APK QA.
function screenSource(path: string) {
  return ts.createSourceFile(path, readFileSync(`app/(tabs)/${path}.tsx`, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function declarations(source: ts.SourceFile, names: string[]) {
  const screen = source.statements.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) === true)!;
  return screen.body!.statements.filter((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((d) => names.includes(d.name.getText(source)))).map((node) => node.getText(source)).join("\n");
}

function harness(path: string, options: Record<string, unknown> = {}) {
  const source = screenSource(path);
  const navigation: string[] = [];
  const effects: (() => (() => void) | undefined)[] = [];
  const listeners: (() => boolean)[] = [];
  const state = { showSearch: false, sortMenuOpen: false, query: "keyword", queryInput: "draft", isBoardMenuOpen: false, ...options };
  const bindings = {
    ...routes,
    ...state,
    params: { returnTo: "/(tabs)/home" },
    isNoticeSearch: true,
    isTabRoot: true,
    board: undefined,
    post: undefined,
    postId: 42,
    pendingDeleteCommentId: null,
    showDeleteConfirm: false,
    reportTarget: null,
    showPostMenu: false,
    deleteCommentMutation: { isPending: false },
    deletePostMutation: { isPending: false },
    nestedBackHandlerRef: { current: null },
    // 수정 화면은 저장하지 않은 변경이 있을 때만 확인창을 띄운다. 여기서는
    // 확인창을 거치지 않는 경로(변경 없음)를 검사한다.
    hasUnsavedChanges: false,
    setDiscardPromptOpen: () => {},
    useCallback: (fn: unknown) => fn,
    useFocusEffect: (fn: typeof effects[number]) => effects.push(fn),
    Platform: { OS: "android" },
    BackHandler: { addEventListener(event: string, callback: () => boolean) {
      assert.equal(event, "hardwareBackPress");
      listeners.push(callback);
      return { remove: () => { listeners.splice(listeners.indexOf(callback), 1); } };
    } },
    Keyboard: { dismiss() {} },
    router: {
      canGoBack: () => true,
      back: () => navigation.push("back"),
      navigate: (route: string) => navigation.push(`navigate:${route}`),
      replace: (route: string) => navigation.push(`replace:${route}`),
    },
    setShowSearch: (value: boolean) => { state.showSearch = value; },
    setSortMenuOpen: (value: boolean) => { state.sortMenuOpen = value; },
    setQuery: (value: string) => { state.query = value; },
    setQueryInput: (value: string) => { state.queryInput = value; },
    setIsBoardMenuOpen: (value: boolean) => { state.isBoardMenuOpen = value; },
    ...options,
  };
  const focusStatements: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(source) === "useFocusEffect" && node.getText(source).includes("BackHandler")) focusStatements.push(node.getText(source));
    ts.forEachChild(node, visit);
  }
  visit(source);
  const code = declarations(source, ["closeSearch", "exitBoardDepth", "goBack", "leaveScreen", "requestClose", "handleBack", "handlePostBack"]) + "\n" + focusStatements.join("\n") + '\nheader = typeof handleBack !== "undefined" ? handleBack : typeof requestClose !== "undefined" ? requestClose : typeof goBack !== "undefined" ? goBack : typeof handlePostBack !== "undefined" ? handlePostBack : undefined;';
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let context: typeof bindings & { header?: () => void };
  function render() {
    effects.length = 0;
    context = { ...bindings, ...state };
    runInNewContext(js, context);
  }
  render();
  return {
    state, navigation,
    header: () => context.header?.(),
    focus: () => { render(); const cleanups = effects.map((effect) => effect()); return () => cleanups.forEach((cleanup) => cleanup?.()); },
    back: () => listeners.at(-1)?.(),
  };
}

for (const [path, options, expected] of [
  ["faq", {}, "navigate:/(tabs)/council"],
  ["search", { isNoticeSearch: true }, "navigate:/(tabs)/notices"],
  ["events/day/[date]", {}, "navigate:/(tabs)/home"],
  ["events/[eventId]", { params: { returnTo: "/(tabs)/notifications" } }, "navigate:/(tabs)/notifications"],
  ["board/post/[postId]", { params: { returnTo: "/(tabs)/community" } }, "navigate:/(tabs)/community"],
  ["board/post/edit/[postId]", { params: {} }, "back"],
] as const) {
  test(`${path}: header and Android Back share the origin even before data loads`, () => {
    const h = harness(path, options);
    assert.equal(h.back(), undefined);
    const blur = h.focus();
    assert.equal(h.back(), true, "focused screen must consume Back");
    h.header();
    assert.deepEqual(h.navigation, [expected, expected]);
    blur();
    assert.equal(h.back(), undefined, "blur removes the screen listener");
    h.focus();
    assert.equal(h.back(), true, "refocus reinstalls Back");
  });

  test(`${path}: iOS/web do not install an Android listener`, () => {
    for (const OS of ["ios", "web"]) {
      const h = harness(path, { ...options, Platform: { OS } });
      h.focus();
      assert.equal(h.back(), undefined);
    }
  });
}

test("board root: sort closes first, search closes/clears next, then tab Back falls through", () => {
  const h = harness("board/[boardId]", { showSearch: true, sortMenuOpen: true });
  let blur = h.focus();
  assert.equal(h.back(), true);
  assert.equal(h.state.sortMenuOpen, false);
  assert.equal(h.state.showSearch, true);
  assert.equal(h.state.query, "keyword");
  blur(); blur = h.focus();
  assert.equal(h.back(), true);
  assert.equal(h.state.showSearch, false);
  assert.equal(h.state.query, "");
  assert.equal(h.state.queryInput, "");
  assert.deepEqual(h.navigation, []);
  blur(); h.focus();
  assert.equal(h.back(), false);
});

test("nested board: search closes before the nested profile/board navigation", () => {
  let childBacks = 0;
  const h = harness("board/[boardId]", { isTabRoot: false, showSearch: true, nestedBackHandlerRef: { current: () => childBacks++ } });
  const blur = h.focus();
  assert.equal(h.back(), true);
  assert.equal(childBacks, 0);
  blur(); h.focus();
  h.back();
  assert.equal(childBacks, 1);
});

test("normal event details retain day history", () => {
  const h = harness("events/[eventId]", { params: {} });
  h.focus(); h.back(); h.header();
  assert.deepEqual(h.navigation, ["back", "back"]);
});

test("edit board menu closes before navigating to the post", () => {
  const h = harness("board/post/edit/[postId]", { params: {}, isBoardMenuOpen: true });
  const blur = h.focus();
  h.back();
  assert.equal(h.state.isBoardMenuOpen, false);
  assert.deepEqual(h.navigation, []);
  blur(); h.focus(); h.back();
  assert.deepEqual(h.navigation, ["back"]);
});

// Render real early-return JSX with lightweight host elements. These states
// previously returned only a spinner/error, hiding every header control.
for (const path of ["board/post/[postId]", "board/post/edit/[postId]", "events/[eventId]"]) {
  for (const isLoading of [true, false]) {
    test(`${path}: ${isLoading ? "loading" : "error"} keeps an actionable header`, () => {
      const source = screenSource(path);
      const screen = source.statements.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) === true)!;
      const guards = screen.body!.statements.filter((n) => ts.isIfStatement(n) && /^(isLoading|isError)/.test(n.expression.getText(source)));
      const code = `(function(){ ${declarations(source, ["navigationHeader"])}\n${guards.map((n) => n.getText(source)).join("\n")} })()`;
      const jsx = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
      let backs = 0;
      const result = runInNewContext(jsx, {
        React: { createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children }) },
        View: "View", Text: "Text", Pressable: "Pressable", IconButton: "IconButton", LoadingState: "LoadingState", BackIcon: "BackIcon", CloseIcon: "CloseIcon",
        styles: {}, COLORS: {}, insets: { top: 0 }, board: undefined, isStudyRecruit: false,
        isLoading, isError: true, post: undefined, event: undefined,
        handleBack: () => backs++, handlePostBack: () => backs++, goBack: () => backs++, requestClose: () => backs++,
      });
      const controls: { onPress?: () => void }[] = [];
      function visit(node: any) {
        if (!node || typeof node !== "object") return;
        if (["뒤로", "닫기"].includes(node.props?.accessibilityLabel ?? node.props?.label)) controls.push(node.props);
        node.children?.flat(Infinity).forEach(visit);
      }
      visit(result);
      assert.equal(controls.length, 1, "one usable header Back must remain in this state");
      controls[0].onPress?.();
      assert.equal(backs, 1);
    });
  }
}
