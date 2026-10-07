import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import { commentSubmissionValue } from "../utils/commentKeyboard";

const source = ts.createSourceFile("detail.tsx", readFileSync("app/(tabs)/(home,notices,community,participation,council)/board/post/[postId].tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initializer: ts.Expression | undefined;
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handleCreateComment") initializer = node.initializer;
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(initializer);
const code = ts.transpileModule(`(${initializer.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function harness(parentId: number | null = null) {
  const actions: string[] = [];
  let callbacks: { onSuccess: () => void; onError: () => void; onSettled: () => void } | undefined;
  let payload: { content: string; parent_id: number | null } | undefined;
  const submit = runInNewContext(code, {
    requireLogin: () => true,
    commentText: "  작성한 댓글  ",
    commentSubmissionValue,
    commentSubmitLockRef: { current: false },
    replyComposer: { parentId },
    createCommentMutation: {
      isPending: false,
      mutate(value: typeof payload, handlers: typeof callbacks) { payload = value; callbacks = handlers; },
    },
    setCommentText: (value: string) => actions.push(`text:${value}`),
    setCommentInputHeight: (value: number) => actions.push(`height:${value}`),
    setReplyTarget: (value: unknown) => actions.push(`reply:${value}`),
    Keyboard: { dismiss: () => actions.push("keyboard:dismiss") },
    Alert: { alert: () => actions.push("error") },
  });
  return { actions, submit, payload: () => payload, succeed: () => callbacks!.onSuccess(), fail: () => callbacks!.onError() };
}

for (const parentId of [null, 42]) {
  test(`${parentId === null ? "댓글" : "답글"}은 서버 등록 성공 후에만 입력을 비우고 키보드 닫기를 요청한다`, () => {
    const h = harness(parentId);
    h.submit();
    assert.equal(h.payload()?.content, "작성한 댓글");
    assert.equal(h.payload()?.parent_id, parentId);
    assert.equal(h.actions.length, 0, "응답을 기다리는 동안 입력과 키보드를 유지한다");
    h.succeed();
    assert.ok(h.actions.includes("text:"));
    assert.ok(h.actions.includes("reply:null"));
    assert.equal(h.actions.filter((action) => action === "keyboard:dismiss").length, 1);
  });
}

test("댓글 등록 실패 시 작성 내용과 키보드를 유지해 재시도할 수 있다", () => {
  const h = harness();
  h.submit();
  h.fail();
  assert.deepEqual(h.actions, ["error"]);
});
