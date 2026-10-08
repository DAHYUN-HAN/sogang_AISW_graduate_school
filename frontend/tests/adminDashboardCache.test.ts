import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import ts from "typescript";

const source = ts.createSourceFile("usePosts.ts", readFileSync("hooks/usePosts.ts", "utf8"), ts.ScriptTarget.Latest, true);
function load(name: string) {
  const fn = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(fn);
  const code = ts.transpileModule(`${fn.getText(source).replace("export ", "")}; ${name}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return runInNewContext(code, { AGGREGATE_POST_FEED_QUERY_KEY: ["posts", "feed"], HOME_NOTICE_QUERY_KEY: ["home", "notices"] }) as (client: QueryClient, target: unknown) => Promise<void>;
}

for (const kind of ["post", "comment"] as const) test(`${kind} changes invalidate daily dashboard, main, audit and cumulative counts`, async () => {
  const client = new QueryClient();
  const keys = [["admin-dashboard", "2026-10-07", 1, 1], ["admin-dashboard", "2026-10-06", 2, 1], ["admin-main"], ["admin-audit-logs", "all"], ["admin-stats"]];
  keys.forEach((key) => client.setQueryData(key, { status: "success", data: {} }));
  const invalidate = load(kind === "post" ? "invalidatePostMutationCaches" : "invalidateCommentMutationCaches");
  await invalidate(client, kind === "post" ? { boardIds: [3] } : 20);
  keys.forEach((key) => assert.equal(client.getQueryState(key)?.isInvalidated, true, `stale ${key.join("/")}`));
  client.clear();
});
