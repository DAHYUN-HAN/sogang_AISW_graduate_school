import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import { noticeRefreshControlRefreshing } from "../utils/pullToRefresh";

const source = ts.createSourceFile("notices.tsx", readFileSync("app/(tabs)/notices.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let expression: string | undefined;
function visit(node: ts.Node) {
  if (ts.isJsxAttribute(node) && node.name.getText(source) === "refreshing" && node.initializer && ts.isJsxExpression(node.initializer)) {
    expression = node.initializer.expression?.getText(source);
  }
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(expression);

test("새 공지 필터의 첫 로딩은 pull 새로고침과 겹쳐도 pull 로딩을 추가하지 않는다", () => {
  const refreshing = runInNewContext(expression!, {
    boardsLoading: false,
    pullRefreshing: true,
    postsQuery: { isLoading: true },
    noticeRefreshControlRefreshing,
  });
  assert.equal(refreshing, false);
});

test("사용자가 당겨서 시작한 새로고침은 pull 로딩을 유지한다", () => {
  const refreshing = runInNewContext(expression!, {
    boardsLoading: false,
    pullRefreshing: true,
    postsQuery: { isLoading: false },
    noticeRefreshControlRefreshing,
  });
  assert.equal(refreshing, true);
});

test("탭 진입 시 자동으로 도는 백그라운드 refetch는 pull 로딩을 켜지 않는다", () => {
  const refreshing = runInNewContext(expression!, {
    boardsLoading: false,
    pullRefreshing: false,
    postsQuery: { isLoading: false, isRefreshingFirstPage: true },
    boardsRefetching: true,
    noticeRefreshControlRefreshing,
  });
  assert.equal(refreshing, false);
});
