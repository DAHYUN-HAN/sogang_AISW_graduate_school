import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import { COMMUNITY_TAB_ROUTE, navigateFromPostDetail } from "../utils/appRoutes";

// Exercise the screen's deletion callback, including success/error timing.
const source = ts.createSourceFile("detail.tsx", readFileSync("app/(tabs)/(home,notices,community,participation,council)/board/post/[postId].tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initializer: ts.Expression | undefined;
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === "confirmDeletePost") initializer = node.initializer;
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(initializer);
const code = ts.transpileModule(`(${initializer.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

function harness(returnTo?: string, canGoBack = true) {
  const actions: string[] = [];
  let callbacks: { onSuccess: () => void; onError: () => void } | undefined;
  const confirm = runInNewContext(code, {
    post: { id: 42, board_id: 7 },
    board: { id: 7, slug: "exam-archive", category: "resources", board_type: "resource" },
    params: { fromBoardId: "7", returnTo },
    navigateFromPostDetail,
    router: {
      canGoBack: () => canGoBack,
      back: () => actions.push("back"),
      navigate: (route: string) => actions.push(`navigate:${route}`),
      replace: (route: string) => actions.push(`replace:${route}`),
      dismissTo: (route: string) => actions.push(`dismissTo:${route}`),
    },
    navigateToRoute: (route: string) => actions.push(`navigate:${route}`),
    replaceWithRoute: (route: string) => actions.push(`replace:${route}`),
    setShowDeleteConfirm: (show: boolean) => actions.push(`confirm:${show}`),
    setShowPostMenu: (show: boolean) => actions.push(`menu:${show}`),
    deletePostMutation: { mutate: (_: undefined, next: typeof callbacks) => { callbacks = next; } },
    Alert: { alert: () => actions.push("error") },
  }) as () => void;
  return { actions, confirm, succeed: () => callbacks!.onSuccess(), fail: () => callbacks!.onError() };
}

// 글은 들어온 탭 스택 위에 있으므로 삭제 뒤에는 pop 해서 아래 목록으로 돌아간다.
// 아래 화면이 없을 때만 출발지(returnTo)로 간다.
for (const origin of [COMMUNITY_TAB_ROUTE, "/(tabs)/settings/activity?type=posts"]) {
  test(`삭제 성공은 ${origin} 목록을 복원하며 새 게시판 화면을 만들지 않는다`, () => {
    for (const canGoBack of [true, false]) {
      const h = harness(origin, canGoBack);
      h.confirm();
      assert.deepEqual(h.actions, []);
      h.succeed();
      assert.deepEqual(h.actions, ["confirm:false", "menu:false", canGoBack ? "back" : `navigate:${origin}`]);
    }
  });
}

test("독립 게시판에서 삭제하면 기존 목록으로 pop하고 직접 진입은 게시판으로 대체한다", () => {
  for (const canGoBack of [true, false]) {
    const h = harness(undefined, canGoBack);
    h.confirm();
    h.succeed();
    assert.deepEqual(h.actions, ["confirm:false", "menu:false", canGoBack ? "back" : "replace:/board/7"]);
  }
});

test("실제 독립 게시판 returnTo는 navigate로 목록을 새로 쌓지 않고 기존 목록까지 닫는다", () => {
  for (const canGoBack of [true, false]) {
    const h = harness("/board/7", canGoBack);
    h.confirm();
    h.succeed();
    assert.deepEqual(h.actions, ["confirm:false", "menu:false", canGoBack ? "back" : "dismissTo:/board/7"]);
  }
});

test("삭제 실패는 확인창과 현재 화면을 유지해 재시도할 수 있다", () => {
  const h = harness(COMMUNITY_TAB_ROUTE);
  h.confirm();
  h.fail();
  assert.deepEqual(h.actions, ["error"]);
});
