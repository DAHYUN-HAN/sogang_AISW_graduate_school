import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import { currentKoreaMonth } from "../utils/eventCalendar";
import { enabledRefetch, refreshQueries } from "../utils/pullToRefresh";

const source = ts.createSourceFile(
  "home.tsx", readFileSync("app/(tabs)/home.tsx", "utf8"),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
);
const home = source.statements.find(
  (node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "HomeScreen",
)!;
let control: ts.JsxSelfClosingElement | undefined;
function findControl(node: ts.Node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "RefreshControl") {
    control = node;
  }
  ts.forEachChild(node, findControl);
}
findControl(home);
assert.ok(control);
function controlExpression(name: string) {
  const attribute = control!.attributes.properties.find(
    (node): node is ts.JsxAttribute => ts.isJsxAttribute(node) && node.name.getText(source) === name,
  )!;
  assert.ok(attribute.initializer && ts.isJsxExpression(attribute.initializer));
  return attribute.initializer.expression!.getText(source);
}

// Node에서는 네이티브 화면을 마운트할 수 없어, 실제 화면의 상태/콜백과
// RefreshControl에 전달하는 표현식을 실행한다. 요청 완료 처리는 실제 유틸을 쓴다.
const declarations = home.body!.statements.filter((node) => {
  if (!ts.isVariableStatement(node)) return false;
  return node.declarationList.declarations.some((declaration) =>
    ["isHomeLoading", "isRefreshing", "refreshHome"].includes(declaration.name.getText(source))
    || (declaration.initializer && ts.isCallExpression(declaration.initializer)
      && declaration.initializer.expression.getText(source) === "useState"),
  );
}).map((node) => node.getText(source));
const code = ts.transpileModule(`
  function render() {
    ${declarations.join("\n")}
    return {
      refreshing: ${controlExpression("refreshing")},
      onRefresh: ${controlExpression("onRefresh")},
    };
  }
  render;
`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function buildRefresh() {
  const events = deferred();
  const album = deferred();
  const readyQuery = () => ({ isLoading: false, isRefetching: false, refetch: async () => undefined });
  const context = {
    boardsLoading: false,
    boardsRefetching: false,
    bannersQuery: readyQuery(),
    noticesQuery: readyQuery(),
    eventsQuery: { ...readyQuery(), refetch: () => events.promise },
    albumQuery: { ...readyQuery(), refetch: () => album.promise },
    notificationQuery: readyQuery(),
    refetchBoards: async () => undefined,
    isAuthenticated: true,
    albumBoardId: 1,
    currentKoreaMonth,
    enabledRefetch,
    refreshQueries,
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (next: unknown) => { states[index] = next; }];
    },
  };
  const states: unknown[] = [];
  let cursor = 0;
  const render = runInNewContext(code, context) as () => { refreshing: boolean; onRefresh: () => void };
  return {
    context, events, album,
    render() { cursor = 0; return render(); },
  };
}

test("홈 달 변경의 일정 재조회는 당겨서 새로고침 표시를 켜지 않는다", () => {
  const screen = buildRefresh();
  assert.equal(screen.render().refreshing, false);
  screen.context.eventsQuery.isRefetching = true;
  assert.equal(screen.render().refreshing, false);
  screen.context.eventsQuery.isRefetching = false;
  assert.equal(screen.render().refreshing, false);
});

test("홈의 다른 백그라운드 조회도 당겨서 새로고침 표시를 켜지 않는다", () => {
  const screen = buildRefresh();
  screen.context.boardsRefetching = true;
  screen.context.bannersQuery.isRefetching = true;
  screen.context.noticesQuery.isRefetching = true;
  screen.context.albumQuery.isRefetching = true;
  screen.context.notificationQuery.isRefetching = true;
  assert.equal(screen.render().refreshing, false);
});

test("홈을 당기면 표시가 켜지고 모든 요청이 끝날 때 개별 실패에도 꺼진다", async () => {
  const screen = buildRefresh();
  screen.render().onRefresh();
  assert.equal(screen.render().refreshing, true);
  screen.events.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(screen.render().refreshing, true, "사진첩 요청이 아직 진행 중이다");
  screen.album.reject(new Error("offline"));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(screen.render().refreshing, false);
});

test("홈 최초 로딩과 당겨서 새로고침 표시가 겹치지 않는다", async () => {
  const screen = buildRefresh();
  screen.context.eventsQuery.isLoading = true;
  screen.render().onRefresh();
  assert.equal(screen.render().refreshing, false);
  screen.events.resolve();
  screen.album.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(screen.render().refreshing, false);
});
