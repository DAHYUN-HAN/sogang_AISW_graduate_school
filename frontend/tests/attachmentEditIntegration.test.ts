import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const edit = ts.createSourceFile("edit.tsx", readFileSync("app/(tabs)/board/post/edit/[postId].tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const create = ts.createSourceFile("create.tsx", readFileSync("app/(tabs)/board/post/create.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function expression(source: ts.SourceFile, find: (node: ts.Node) => boolean) {
  let found: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (!found && find(node)) found = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(found, "Production expression exists");
  return ts.transpileModule(`(${found.getText(source).replace(/^export /, "")})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: "element" },
  }).outputText;
}

test("resource edit exposes existing mixed attachments and writes the user's removal back to form state", () => {
  let attachments = [{ id: 12, content_type: "image/png" }, { id: 34, content_type: "application/pdf" }];
  const code = expression(edit, (node) => ts.isConditionalExpression(node) && node.condition.getText(edit) === "isAdminParticipationPost || isAlbum");
  const rendered = runInNewContext(code, {
    isAdminParticipationPost: false, isAlbum: false, isResourceEdit: true, isStudyRecruit: false,
    board: { board_type: "resource", category: "resources", write_permission: "user" },
    attachments, PostAttachmentEditor: "AttachmentEditor", updateMutation: { isPending: false },
    setAttachments: (next: typeof attachments) => { attachments = next; }, setIsUploading: () => {},
    element: (type: string, props: Record<string, unknown>) => ({ type, props }),
  });
  assert.ok(rendered, "Resource edits must render an attachment editor");
  assert.equal(rendered.type, "AttachmentEditor");
  assert.deepEqual(rendered.props.attachments.map((item: { id: number }) => item.id), [12, 34]);
  rendered.props.onChange([attachments[1]]);
  assert.deepEqual(attachments.map((item) => item.id), [34]);
});

test("edit detail requests private editing context in a cache distinct from ordinary detail", () => {
  const hooks = ts.createSourceFile("hooks.ts", readFileSync("hooks/usePosts.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const code = expression(hooks, (node) => ts.isFunctionDeclaration(node) && node.name?.text === "usePostDetail");
  const calls: unknown[][] = [];
  const hook = runInNewContext(code.replace("export ", ""), {
    useQuery: (options: unknown) => options,
    postApi: { getPostDetail: (...args: unknown[]) => { calls.push(args); } },
  });
  const regular = hook(9, true, false);
  const editable = hook(9, true, true);
  assert.notDeepEqual(editable.queryKey, regular.queryKey);
  editable.queryFn();
  assert.deepEqual(calls, [[9, true]]);
});

test("reopening edit waits for fresh data before hydrating cached attachments", () => {
  const hooks = ts.createSourceFile("hooks.ts", readFileSync("hooks/usePosts.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const code = expression(hooks, (node) => ts.isFunctionDeclaration(node) && node.name?.text === "usePostDetail");
  let fetched = false;
  const hook = runInNewContext(code, {
    useQuery: (options: unknown) => ({ ...options as object, data: { attachments: [fetched ? 2 : 1] }, isFetchedAfterMount: fetched, isLoading: false }),
    postApi: {},
  });
  const opening = hook(9, true, true);
  assert.equal(opening.data, undefined);
  assert.equal(opening.isLoading, true);
  assert.equal(opening.refetchOnMount, "always");
  assert.equal(hook(Number.NaN, true, true).isLoading, false);
  assert.equal(hook(0, true, true).isLoading, false);
  fetched = true;
  assert.deepEqual(hook(9, true, true).data.attachments, [2]);
});

test("mutual-aid file mode renders the existing evidence in a private attachment editor", () => {
  const code = expression(create, (node) => ts.isConditionalExpression(node) && node.condition.getText(create) === 'evidenceMode === "file"');
  const attachments = [{ id: 20, content_type: "image/png" }, { id: 21, content_type: "application/pdf" }];
  const rendered = runInNewContext(code, {
    evidenceMode: "file", attachments, setAttachments: () => {}, setIsUploading: () => {},
    createMutation: { isPending: false }, updateMutation: { isPending: false }, PostAttachmentEditor: "AttachmentEditor",
    element: (type: string, props: Record<string, unknown>) => ({ type, props }),
  });
  assert.equal(rendered.type, "AttachmentEditor");
  assert.equal(rendered.props.isPrivate, true);
  assert.equal(rendered.props.attachments, attachments);
});

test("mutual-aid saves explicit replacement with remaining file IDs and clears an old proof link", () => {
  const metadataCode = expression(create, (node) => ts.isArrowFunction(node) && ts.isVariableDeclaration(node.parent) && node.parent.name.getText(create) === "buildMetadata");
  const payloadCode = expression(create, (node) => ts.isObjectLiteralExpression(node) && ts.isVariableDeclaration(node.parent) && node.parent.name.getText(create) === "payload");
  const context = {
    isActivity: false, isMutualAid: true, isStudyRecruit: false, isAdminParticipationPost: false,
    isAlbum: false, isSuggestion: false, evidenceMode: "file", evidenceLink: "https://example.com/old-proof",
    clean: (value?: string) => value?.trim() || undefined,
  };
  const buildMetadata = runInNewContext(metadataCode, context);
  const payload = runInNewContext(payloadCode, {
    ...context, buildMetadata, values: { category: "결혼", eventDate: "2026.09.17", relation: "본인", content: "변경" },
    postId: 77, generatedMutualAidTitle: "결혼 상조회 신청", attachmentIds: [21],
  });
  assert.equal(payload.replace_evidence, true);
  assert.deepEqual(Array.from(payload.attachment_ids), [21]);
  assert.equal(payload.metadata.proof_url, "");
  const linked = runInNewContext(metadataCode, { ...context, evidenceMode: "link", evidenceLink: " https://example.com/new-proof " });
  assert.equal(linked({}).proof_url, "https://example.com/new-proof");
});
