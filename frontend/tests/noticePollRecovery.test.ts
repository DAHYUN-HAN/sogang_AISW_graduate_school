import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { noticePollDraft } from "../utils/noticePoll";

function reloadHandler(context: Record<string, unknown>) {
  const source = ts.createSourceFile("controller.tsx", readFileSync("components/admin/useAdminController.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer: ts.Expression | undefined;
  const visit = (node: ts.Node) => {if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handleReloadNoticePoll") initializer = node.initializer; ts.forEachChild(node, visit);};
  visit(source); assert.ok(initializer, "the notice editor offers targeted poll reload recovery");
  const operations = ts.createSourceFile("operations.tsx", readFileSync("components/admin/AdminBoardContentPanel.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result = operations.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "noticeEditorOperationResult")!;
  const compiled = ts.transpileModule(`const noticeEditorOperationResult = (${result.getText(operations).replace(/^export /, "")}); (${initializer.getText(source)})(origin)`, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText;
  return runInNewContext(compiled, {...context, noticePollDraft}) as Promise<void>;
}

test("targeted reload updates only poll data and preserves unsaved notice fields", async () => {
  const origin = {id: 1, kind: "save", boardId: 9, editingNoticeId: 50, generation: 1};
  const state = {title: "미저장 공지 제목", content: "미저장 본문", inline_images: [{media_id: 7, offset: 2}], poll: null, poll_revision: 1};
  const next: any[] = [];
  let finished = false;
  await reloadHandler({origin, currentNoticeEditorTarget: () => origin, startNoticeEditorOperation: () => ({...origin, id: 2, kind: "reload"}),
    finishNoticeEditorOperation: () => {finished = true;}, postApi: {getPostDetail: async () => ({data: {poll: {revision: 8, questions: [], my_answers: []}}})},
    setNoticeForm: (update: (value: unknown) => unknown) => next.push(update(state)), Alert: {alert: () => assert.fail("unexpected error")}});
  assert.equal(next[0].title, "미저장 공지 제목"); assert.equal(next[0].content, "미저장 본문");
  assert.deepEqual(next[0].inline_images, [{media_id: 7, offset: 2}]); assert.equal(next[0].poll_revision, 8);
  assert.equal(finished, true);
});

test("a reload finishing after the editor changes cannot overwrite the new draft", async () => {
  const origin = {id: 1, kind: "save", boardId: 9, editingNoticeId: 50, generation: 1};
  let current = origin;
  let resolve!: (value: unknown) => void;
  const pending = new Promise(r => {resolve = r;});
  const work = reloadHandler({origin, currentNoticeEditorTarget: () => current, startNoticeEditorOperation: () => ({...origin, kind: "reload"}),
    finishNoticeEditorOperation: () => {}, postApi: {getPostDetail: () => pending},
    setNoticeForm: () => assert.fail("new draft must be preserved"), Alert: {alert: () => assert.fail("stale notification")}});
  current = {...origin, editingNoticeId: 60, generation: 2}; resolve({data: {poll: null}});
  await work;
});
