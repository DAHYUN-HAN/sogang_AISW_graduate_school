import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import * as routes from "../utils/appRoutes";

// Exercise the actual screen callbacks/subscriptions, not a second copy of the
// navigation policy. Native keyboard/parent-listener ordering is checked in APK QA.
function screenSource(path: string) {
  return ts.createSourceFile(path, readFileSync(`app/(tabs)/(home,notices,community,participation,council)/${path}.tsx`, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

// 글쓰기 화면(create.tsx)은 기본 내보내기가 폼을 감싸기만 하고 실제 처리는 PostCreateForm에 있다.
// 글 수정도 이 화면의 수정 모드(postId 있음)에서 한다.
const SCREEN_BODY_FUNCTION: Record<string, string> = { "board/post/create": "PostCreateForm" };

function screenFunction(source: ts.SourceFile) {
  const name = SCREEN_BODY_FUNCTION[source.fileName];
  return source.statements.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && (name
    ? n.name?.text === name
    : n.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) === true))!;
}

function declarations(source: ts.SourceFile, names: string[]) {
  const screen = screenFunction(source);
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
      canGoBack: () => options.canGoBack !== false,
      back: () => navigation.push("back"),
      navigate: (route: string) => navigation.push(`navigate:${route}`),
      replace: (route: string) => navigation.push(`replace:${route}`),
    },
    navigateToTabRoot: (tab: string) => navigation.push(`navigate:/(tabs)/${tab}`),
    navigateToRoute: (route: string) => navigation.push(`navigate:${route}`),
    replaceWithRoute: (route: string) => navigation.push(`replace:${route}`),
    setShowSearch: (value: boolean) => { state.showSearch = value; },
    setSortMenuOpen: (value: boolean) => { state.sortMenuOpen = value; },
    setQuery: (value: string) => { state.query = value; },
    setQueryInput: (value: string) => { state.queryInput = value; },
    setIsBoardMenuOpen: (value: boolean) => { state.isBoardMenuOpen = value; },
    selectionSheet: null as string | null,
    datePickerOpen: false,
    setSelectionSheet: (value: string | null) => { (state as Record<string, unknown>).selectionSheet = value; },
    setDatePickerOpen: (value: boolean) => { (state as Record<string, unknown>).datePickerOpen = value; },
    boardType: undefined,
    boardId: 7,
    ...options,
  };
  const focusStatements: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(source) === "useFocusEffect" && node.getText(source).includes("BackHandler")) focusStatements.push(node.getText(source));
    ts.forEachChild(node, visit);
  }
  visit(source);
  const code = declarations(source, ["closeSearch", "exitBoardDepth", "goBack", "leaveScreen", "requestClose", "handleBack", "handlePostBack", "leaveCreateScreen", "handleCreateBack"]) + "\n" + focusStatements.join("\n") + '\nheader = typeof handleBack !== "undefined" ? handleBack : typeof requestClose !== "undefined" ? requestClose : typeof goBack !== "undefined" ? goBack : typeof handlePostBack !== "undefined" ? handlePostBack : typeof handleCreateBack !== "undefined" ? handleCreateBack : undefined;';
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

// 화면들은 들어온 탭 스택 위에 쌓이므로 아래 화면이 있으면 pop 한다(iOS 스와이프와
// 같은 곳). 아래 화면이 없을 때만 원래 탭이나 returnTo로 간다.
for (const [path, options, expected] of [
  ["faq", {}, "back"],
  ["faq", { canGoBack: false }, "navigate:/(tabs)/council"],
  ["search", { isNoticeSearch: true }, "back"],
  ["search", { isNoticeSearch: true, canGoBack: false }, "navigate:/(tabs)/notices"],
  ["board/post/[postId]", { params: { returnTo: "/(tabs)/community" } }, "back"],
  ["board/post/[postId]", { params: { returnTo: "/(tabs)/community" }, canGoBack: false }, "navigate:/(tabs)/community"],
  // 글 수정(글쓰기 화면의 수정 모드)은 아래 화면이 있으면 상세로 pop, 없으면 상세로 교체한다.
  ["board/post/create", { params: { postId: "42", editOrigin: "post-detail" } }, "back"],
  ["board/post/create", { params: { postId: "42", editOrigin: "post-detail" }, canGoBack: false }, "replace:/board/post/42"],
  // 관리자 웹처럼 editOrigin 없이 열려도 같다.
  ["board/post/create", { params: { postId: "42", fromBoardId: "7" }, canGoBack: false }, "replace:/board/post/42?fromBoardId=7"],
] as const) {
  test(`${path}${"canGoBack" in options ? " (no history)" : ""}: header and Android Back share the origin even before data loads`, () => {
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

  test(`${path}${"canGoBack" in options ? " (no history)" : ""}: iOS/web do not install an Android listener`, () => {
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

// 기수 상세는 별도 화면으로 쌓이므로 게시판 목록의 뒤로가기는 검색창을 닫은 뒤 바로 나간다.
test("nested board: search closes before leaving the board", () => {
  const h = harness("board/[boardId]", { isTabRoot: false, showSearch: true });
  const blur = h.focus();
  assert.equal(h.back(), true);
  assert.deepEqual(h.navigation, []);
  blur(); h.focus();
  assert.equal(h.back(), true);
  assert.deepEqual(h.navigation, ["back"]);
});

test("edit board menu closes before navigating to the post", () => {
  const h = harness("board/post/create", { params: { postId: "42", editOrigin: "post-detail" }, selectionSheet: "board" });
  const blur = h.focus();
  h.back();
  assert.equal((h.state as Record<string, unknown>).selectionSheet, null);
  assert.deepEqual(h.navigation, []);
  blur(); h.focus(); h.back();
  assert.deepEqual(h.navigation, ["back"]);
});

// Render real early-return JSX with lightweight host elements. These states
// previously returned only a spinner/error, hiding every header control.
for (const path of ["board/post/[postId]", "board/post/create"]) {
  for (const isLoading of [true, false]) {
    test(`${path}: ${isLoading ? "loading" : "error"} keeps an actionable header`, () => {
      const source = screenSource(path);
      const screen = screenFunction(source);
      // 글쓰기 화면은 수정 모드(postId 있음)에서만 글을 불러오며 로딩·오류를 그린다.
      const guards = screen.body!.statements.filter((n) => ts.isIfStatement(n) && /^(isLoading|isError|postId && \(editPostQuery\.is(?:Loading|Error))/.test(n.expression.getText(source)));
      const code = `(function(){ ${declarations(source, ["navigationHeader"])}\n${guards.map((n) => n.getText(source)).join("\n")} })()`;
      const jsx = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
      let backs = 0;
      const result = runInNewContext(jsx, {
        React: { createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children }) },
        View: "View", Text: "Text", Pressable: "Pressable", BackButton: "BackButton", LoadingState: "LoadingState", NetworkErrorFallback: "NetworkErrorFallback", BackIcon: "BackIcon", CloseIcon: "CloseIcon", PostFormAppBar: "PostFormAppBar",
        styles: {}, COLORS: {}, insets: { top: 0 }, board: undefined, isStudyRecruit: false, isSuggestion: false,
        deletedBoardId: undefined, postDetailTitle: () => "게시글", EmptyCalendarIcon: "EmptyCalendarIcon",
        isLoading, isError: true, error: undefined, post: undefined, event: undefined,
        handleBack: () => backs++, handlePostBack: () => backs++, goBack: () => backs++, requestClose: () => backs++, handleCreateBack: () => backs++,
        postId: 42, editPostQuery: { isLoading, isError: true, error: undefined, refetch: () => {} }, isBoardsLoading: false, isBoardsError: false,
        boardsLoadError: undefined, refetchBoards: () => {}, existingPost: undefined, labels: { screenTitle: "글 수정" },
      });
      const controls: { onPress?: () => void }[] = [];
      function visit(node: any) {
        if (!node || typeof node !== "object") return;
        // BackButton은 라벨을 안쪽 Pressable에 들고 있어 겉에서는 보이지 않는다.
        if (node.type === "BackButton" || ["뒤로", "닫기"].includes(node.props?.accessibilityLabel ?? node.props?.label)) controls.push(node.props);
        // 글 수정 화면은 글쓰기와 같은 PostFormAppBar(닫기 = onClose)를 쓴다.
        if (node.type === "PostFormAppBar") controls.push({ onPress: node.props.onClose });
        node.children?.flat(Infinity).forEach(visit);
      }
      visit(result);
      assert.equal(controls.length, 1, "one usable header Back must remain in this state");
      controls[0].onPress?.();
      assert.equal(backs, 1);
    });
  }
}
