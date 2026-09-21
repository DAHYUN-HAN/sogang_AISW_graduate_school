import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import { postCreateFormInstanceKey, postCreateRouteFromBoardList } from "../utils/appRoutes";

function parse(path: string) {
  return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function compile(code: string) {
  return ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: "element" },
  }).outputText;
}

const create = parse("app/(tabs)/board/post/create.tsx");
const screen = create.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "PostCreateScreen");
assert.ok(screen);
const screenCode = compile(`(${screen.getText(create).replace("export default ", "")})()`);

function renderScreen(isFocused: boolean, postId?: string) {
  return runInNewContext(screenCode, {
    useLocalSearchParams: () => ({ boardId: "7", category: "시험족보", postId }),
    useIsFocused: () => isFocused,
    postCreateFormInstanceKey,
    PostCreateForm: "PostCreateForm",
    element: (type: string, props: object) => ({ type, props }),
  });
}

test("새 글 작성을 벗어나면 폼을 제거하여 내용과 첨부파일을 다음 작성에 재사용하지 않는다", () => {
  assert.equal(renderScreen(true)?.type, "PostCreateForm");
  assert.equal(renderScreen(false), null);
  assert.equal(renderScreen(true)?.type, "PostCreateForm");
});

test("기존 글 수정은 포커스 전환만으로 작성 중인 폼을 초기화하지 않는다", () => {
  assert.equal(renderScreen(false, "42")?.type, "PostCreateForm");
});

test("목록에서 글쓰기를 열면 검색 입력과 결과를 초기화하고 선택한 분류는 유지한다", () => {
  const board = parse("app/(tabs)/board/[boardId].tsx");
  const expressions = new Map<string, string>();
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.initializer) expressions.set(node.name.getText(board), node.initializer.getText(board));
    ts.forEachChild(node, visit);
  }
  visit(board);
  assert.ok(expressions.has("closeSearch") && expressions.has("openCreate"));
  const state = { showSearch: true, query: "첨부파일", queryInput: "첨부파일", selectedFilter: "시험족보" };
  let destination = "";
  const openCreate = runInNewContext(compile(`const closeSearch = ${expressions.get("closeSearch")}; (${expressions.get("openCreate")});`), {
    ...state,
    isAuthenticated: true, boardId: 8, isTabRoot: true, isActivityCards: false,
    feedMode: "board", board: { category: "resources" },
    detailReturnRoute: "/(tabs)/community",
    postCreateRouteFromBoardList,
    useCallback: (fn: unknown) => fn,
    setShowSearch: (value: boolean) => { state.showSearch = value; },
    setQuery: (value: string) => { state.query = value; },
    setQueryInput: (value: string) => { state.queryInput = value; },
    router: { push: (route: string) => { destination = route; } },
  });
  openCreate();
  assert.deepEqual(state, { showSearch: false, query: "", queryInput: "", selectedFilter: "시험족보" });
  assert.match(destination, /boardId=8&category=%EC%8B%9C%ED%97%98%EC%A1%B1%EB%B3%B4/);
});

test("자료공유 전체에서 글쓰기를 열면 게시판을 정하지 않고 그룹만 넘긴다", () => {
  // 전체는 여러 게시판을 모아 보는 상태다. 마지막으로 들른 게시판이 그대로
  // 선택돼 있으면 사용자가 의도하지 않은 게시판에 글이 올라간다.
  const board = parse("app/(tabs)/board/[boardId].tsx");
  const expressions = new Map<string, string>();
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.initializer) expressions.set(node.name.getText(board), node.initializer.getText(board));
    ts.forEachChild(node, visit);
  }
  visit(board);
  let destination = "";
  const openCreate = runInNewContext(compile(`const closeSearch = ${expressions.get("closeSearch")}; (${expressions.get("openCreate")});`), {
    showSearch: false, query: "", queryInput: "", selectedFilter: "전체",
    isAuthenticated: true, boardId: 8, isTabRoot: true, isActivityCards: false,
    feedMode: "resources", board: { category: "resources" },
    detailReturnRoute: "/(tabs)/community",
    postCreateRouteFromBoardList,
    useCallback: (fn: unknown) => fn,
    setShowSearch: () => undefined,
    setQuery: () => undefined,
    setQueryInput: () => undefined,
    router: { push: (route: string) => { destination = route; } },
  });
  openCreate();
  assert.doesNotMatch(destination, /boardId=/);
  assert.match(destination, /boardGroup=resources/);
});
