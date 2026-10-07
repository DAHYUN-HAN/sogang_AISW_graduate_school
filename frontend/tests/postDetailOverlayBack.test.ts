import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import { COMMUNITY_TAB_ROUTE, navigateFromPostDetail } from "../utils/appRoutes";

// Execute the screen's actual shared header/Android Back callback. Keeping the
// useCallback memoization also catches missing dependencies when a sheet opens.
const source = ts.createSourceFile(
  "postDetail.tsx",
  readFileSync("app/(tabs)/(home,notices,community,participation,council)/board/post/[postId].tsx", "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let initializer: ts.Expression | undefined;
function findBackHandler(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handlePostBack") {
    initializer = node.initializer;
  }
  ts.forEachChild(node, findBackHandler);
}
findBackHandler(source);
assert.ok(initializer, "Post detail must keep a shared Back handler");
const callbackCode = ts.transpileModule(`(${initializer.getText(source)})`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function harness() {
  const state = {
    reportTarget: null as { type: "post" | "comment"; id: number; label: string } | null,
    showPostMenu: false,
    showDeleteConfirm: false,
    pendingDeleteCommentId: null as number | null,
    commentDeleteError: null as string | null,
    deletingPost: false,
    deletingComment: false,
  };
  const navigation: string[] = [];
  const post = { id: 42, board_id: 7 };
  const board = { slug: "exam-archive", category: "resources", board_type: "resource" };
  const params = { fromBoardId: "7", returnTo: COMMUNITY_TAB_ROUTE };
  const router = {
    canGoBack: () => true,
    back: () => navigation.push("back"),
    navigate: (route: string) => navigation.push(route),
    replace: (route: string) => navigation.push(route),
  };
  let cached: { callback: () => void; dependencies: unknown[] } | undefined;
  const bindings = {
    post, board, params, router, navigateFromPostDetail,
    navigateToRoute: (route: string) => navigation.push(route),
    replaceWithRoute: (route: string) => navigation.push(route),
    setReportTarget: (target: typeof state.reportTarget) => { state.reportTarget = target; },
    setShowPostMenu: (show: boolean) => { state.showPostMenu = show; },
    setShowDeleteConfirm: (show: boolean) => { state.showDeleteConfirm = show; },
    setPendingDeleteCommentId: (id: number | null) => { state.pendingDeleteCommentId = id; },
    setCommentDeleteError: (error: string | null) => { state.commentDeleteError = error; },
    useCallback(callback: () => void, dependencies: unknown[]) {
      if (!cached || dependencies.some((value, index) => !Object.is(value, cached!.dependencies[index]))) {
        cached = { callback, dependencies };
      }
      return cached.callback;
    },
  };
  function render(): () => void {
    return runInNewContext(callbackCode, {
      ...bindings, ...state,
      deletePostMutation: { isPending: state.deletingPost },
      deleteCommentMutation: { isPending: state.deletingComment },
    });
  }
  render();
  return { state, navigation, back: () => render()() };
}

for (const type of ["post", "comment"] as const) {
  test(`${type} 신고 시트를 연 뒤 Back은 시트만 닫고 다음 Back에서 목록으로 돌아간다`, () => {
    const h = harness();
    h.state.reportTarget = { type, id: 42, label: "신고 대상" };
    h.back();
    assert.equal(h.state.reportTarget, null);
    assert.deepEqual(h.navigation, []);
    h.back();
    assert.deepEqual(h.navigation, ["back"]);
    // Returning to the retained detail cannot reveal the dismissed sheet.
    assert.equal(h.state.reportTarget, null);
  });
}

test("더보기 메뉴도 Back을 먼저 소비하고 게시글을 유지한다", () => {
  const h = harness();
  h.state.showPostMenu = true;
  h.back();
  assert.equal(h.state.showPostMenu, false);
  assert.deepEqual(h.navigation, []);
  h.back();
  assert.deepEqual(h.navigation, ["back"]);
});

test("게시글 삭제 확인은 Back으로 취소하되 삭제 요청 중에는 화면을 벗어나지 않는다", () => {
  const h = harness();
  h.state.showDeleteConfirm = true;
  h.state.deletingPost = true;
  h.back();
  assert.equal(h.state.showDeleteConfirm, true);
  assert.deepEqual(h.navigation, []);
  h.state.deletingPost = false;
  h.back();
  assert.equal(h.state.showDeleteConfirm, false);
  assert.deepEqual(h.navigation, []);
});

test("댓글 삭제 확인은 요청 종료 후 Back으로 닫고 이전 오류를 초기화한다", () => {
  const h = harness();
  h.state.pendingDeleteCommentId = 99;
  h.state.deletingComment = true;
  h.back();
  assert.equal(h.state.pendingDeleteCommentId, 99);
  assert.deepEqual(h.navigation, []);
  h.state.deletingComment = false;
  h.state.commentDeleteError = "삭제 실패";
  h.back();
  assert.equal(h.state.pendingDeleteCommentId, null);
  assert.equal(h.state.commentDeleteError, null);
  assert.deepEqual(h.navigation, []);
});

test("열린 창이 없으면 기존 게시글 목록 복귀 동작을 그대로 실행한다", () => {
  const h = harness();
  h.back();
  assert.deepEqual(h.navigation, ["back"]);
});
