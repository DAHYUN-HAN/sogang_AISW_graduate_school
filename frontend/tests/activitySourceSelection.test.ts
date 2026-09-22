import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { QueryClient } from "@tanstack/react-query";

import * as activityCertification from "../utils/activityCertification";
import * as participationGuide from "../utils/participationGuide";

const source = ts.createSourceFile(
  "create.tsx",
  readFileSync("app/(tabs)/board/post/create.tsx", "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const initializers = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.initializer) {
    initializers.set(node.name.getText(source), node.initializer.getText(source));
  }
  ts.forEachChild(node, visit);
}
visit(source);

test("관리자가 동아리를 수정하면 활동인증 선택 목록 캐시도 갱신 대상으로 바뀐다", async () => {
  const queryExpression = initializers.get("activitySourceQuery");
  assert.ok(queryExpression);
  const queryOptions = runInNewContext(ts.transpileModule(`(${queryExpression})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    useQuery: (options: unknown) => options,
    activitySourceBoard: { id: 9, slug: "club-promo" },
    isActivity: true,
  });
  const hookSource = ts.createSourceFile("usePosts.ts", readFileSync("hooks/usePosts.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const invalidate = hookSource.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "invalidatePostMutationCaches");
  assert.ok(invalidate);
  const queryClient = new QueryClient();
  try {
    queryClient.setQueryData(queryOptions.queryKey, [{ id: 101, title: "파인튜닝 (커피)" }]);
    const invalidateCaches = runInNewContext(ts.transpileModule(
      `${invalidate.getText(hookSource).replace(/^export /, "")}; invalidatePostMutationCaches;`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText);
    await invalidateCaches(queryClient, { boardIds: [9] });
    assert.equal(queryClient.getQueryState(queryOptions.queryKey)?.isInvalidated, true);
  } finally {
    queryClient.clear();
  }
});

test("활동인증 작성·수정 선택창은 새 동아리와 이름이 바뀐 동아리를 원본 ID로 제공한다", async () => {
  const posts = await activityCertification.loadPublishedActivitySourcePosts(
    9,
    "club-promo",
    async (_boardId, page, _size, filters) => {
      assert.equal(filters.status, "published");
      return {
        status: "success",
        data: page === 1
          ? [{ id: 101, title: "파인튜닝 (커피)", created_at: "2026-09-17T00:00:00Z" }]
          : [{ id: 102, title: "새 이름으로 변경한 동아리", created_at: "2026-09-16T00:00:00Z" }],
        pagination: { page, size: 1, total: 2, total_pages: 2 },
      };
    },
    1,
  );
  const postsExpression = initializers.get("activitySourcePosts");
  const optionsExpression = initializers.get("activityOptions");
  assert.ok(postsExpression && optionsExpression);
  const code = ts.transpileModule(
    `const activitySourcePosts = ${postsExpression}; (${optionsExpression});`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const options = runInNewContext(code, {
    ...activityCertification,
    ...participationGuide,
    useMemo: (build: () => unknown) => build(),
    activitySourceQuery: { data: posts },
    activitySourceBoard: { id: 9, slug: "club-promo" },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(options)), [
    { key: "101", label: "파인튜닝 (커피)" },
    { key: "102", label: "새 이름으로 변경한 동아리" },
  ]);
});
