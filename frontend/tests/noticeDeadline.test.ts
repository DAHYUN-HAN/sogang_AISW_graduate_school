import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { koreaDateTimeInputToUtcISOString, utcApiDateTimeToKoreaInput } from "../utils/dateFormat";

function load(name: string, context: Record<string, unknown>) {
  const file = "components/admin/useAdminController.tsx";
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(source); assert.ok(found);
  return runInNewContext(ts.transpileModule(`(${found.getText(source)})`, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText, context);
}

test("notice edit hydrates an API deadline in Korean time instead of slicing UTC", async () => {
  let form: any;
  const edit = load("handleEditNotice", {
    noticeOperationRef: {current: null}, noticePollBusyRef: {current: false}, noticeEditRequestRef: {current: 0}, selectedNoticeBoardIdRef: {current: 1}, editingNoticeIdRef: {current: null},
    postApi: {getPostDetail: async () => ({data: {title: "제목", content: "내용", deadline_at: "2026-10-09T09:30:00Z", attachments: [], metadata: {}}})},
    setEditingNoticeId: () => {}, setEditingNoticeBoardId: () => {}, setNoticeForm: (value: unknown) => {form = value;},
    setNoticeAttachments: () => {}, setNoticeMetadata: () => {}, noticePollDraft: () => null,
    Platform: {OS: "web"}, normalizeNoticeCategoryValue: () => "event", utcApiDateTimeToKoreaInput,
    noticeBodyBlocks: () => [], noticeBodyDraft: () => ({images: []}), noticeBodySelectionRef: {current: null},
    Alert: {alert: () => {}},
  });
  assert.equal(await edit({id: 5, board_id: 1}), true);
  assert.equal(form.deadline_at, "2026-10-09T18:30");
});

function save(deadline: string) {
  const writes: any[] = [], alerts: string[] = [];
  const action = load("handleSaveNotice", {
    noticePollBusy: false, selectedNoticeBoardId: 1, editingNoticeId: null, editingNoticeBoardId: null,
    noticeForm: {title: "제목", content: "내용", deadline_at: deadline, category: "event"}, noticeAttachments: [], noticeMetadata: {},
    noticePollPayload: () => null, koreaDateTimeInputToUtcISOString, noticeBodyBlocks: () => [], noticeBodyDraft: () => ({content: "내용", images: []}),
    Alert: {alert: (title: string, message: string) => alerts.push(message)}, cleanOptional: (s: string) => s || undefined, cleanNullable: (s: string) => s || null,
    startNoticeEditorOperation: () => ({boardId: 1}), finishNoticeEditorOperation: () => {}, currentNoticeEditorTarget: () => ({}),
    runAdminMutation: async ({primary}: any) => {await primary(); return {};}, postApi: {createPost: async (_id: number, payload: unknown) => {writes.push(payload); return {data: {id: 6}};}},
    noticeEditorOperationResult: () => ({}),
  });
  return {action, writes, alerts};
}

test("notice save converts Korean deadline to UTC and preserves optional clearing", async () => {
  for (const [value, expected] of [["2026-10-09T18:30", "2026-10-09T09:30:00.000Z"], ["", null]]) {
    const run = save(value as string); await run.action();
    assert.equal(run.writes[0]?.deadline_at, expected);
  }
});

test("invalid notice calendar dates are rejected before any API write", async () => {
  const run = save("2026-02-30T18:30"); await run.action();
  assert.equal(run.writes.length, 0);
  assert.ok(run.alerts.length > 0);
});
