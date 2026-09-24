import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { activityParticipantsFromMetadata, activitySourcePostIdFromMetadata, withParticipantDuesState } from "../utils/activityCertification";
import { clubOperationStatus } from "../utils/participationGuide";
import { mutualAidEventTypeLabel, mutualAidRelationLabel, normalizeMutualAidEventDate } from "../utils/mutualAid";

import { resourcePostMetadata } from "../utils/resourcePostFields";

const edit = ts.createSourceFile("edit.tsx", readFileSync("app/(tabs)/board/post/edit/[postId].tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const create = ts.createSourceFile("create.tsx", readFileSync("app/(tabs)/board/post/create.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const mediaPickerSource = readFileSync("utils/mediaPicker.ts", "utf8");
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

test("activity edit restores its saved account once and does not overwrite an in-progress replacement", () => {
  const code = expression(create, (node) => ts.isArrowFunction(node) && ts.isCallExpression(node.parent)
    && node.parent.expression.getText(create) === "useEffect"
    && node.getText(create).includes("hydratedPostId.current === postId"));
  const form = { bankAccount: "" };
  const hydratedPostId = { current: null as number | null };
  const hydrate = runInNewContext(code, {
    postId: 42, hydratedPostId,
    board: { slug: "networking-activity" },
    existingPost: { id: 42, title: "Activity", content: "Reflection", metadata: { bank_account: "Test Bank 123-456" }, attachments: [] },
    reset: (values: typeof form) => Object.assign(form, values),
    activityParticipantsFromMetadata, activitySourcePostIdFromMetadata, withParticipantDuesState, clubOperationStatus,
    mutualAidEventTypeLabel, mutualAidRelationLabel, normalizeMutualAidEventDate,
    resourceFields: null, resourcePostFieldValues: () => ({}), unsavedBaseline: { current: null },
    setAttachments: () => {}, setEvidenceLink: () => {}, setEvidenceMode: () => {},
    setSelectedParticipants: () => {}, setParticipantQuery: () => {}, setActivitySourcePostId: () => {},
  });
  hydrate();
  assert.equal(form.bankAccount, "Test Bank 123-456");
  form.bankAccount = "New Bank 999-000";
  hydrate();
  assert.equal(form.bankAccount, "New Bank 999-000");
});

test("resource edit exposes existing mixed attachments and writes the user's removal back to form state", () => {
  let attachments = [{ id: 12, content_type: "image/png" }, { id: 34, content_type: "application/pdf" }];
  const code = expression(edit, (node) => ts.isConditionalExpression(node) && node.condition.getText(edit) === "isAdminParticipationPost || isAlbum");
  const rendered = runInNewContext(code, {
    isAdminParticipationPost: false, isAlbum: false, isResourceEdit: true, isStudyRecruit: false,
    board: { board_type: "resource", category: "resources", write_permission: "user" },
    attachments, PostAttachmentEditor: "AttachmentEditor", updateMutation: { isPending: false },
    setAttachments: (next: typeof attachments) => { attachments = next; }, setIsUploading: () => {},
    showUploadFailure: () => {},
    element: (type: string, props: Record<string, unknown>) => ({ type, props }),
  });
  assert.ok(rendered, "Resource edits must render an attachment editor");
  assert.equal(typeof rendered.props.onError, "function", "Upload and open failures reach the screen's toast/modal");
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

test("mutual-aid image mode uses the approved hint and removable thumbnail design", () => {
  let found: ts.ConditionalExpression | undefined;
  function visit(node: ts.Node) {
    if (!found && ts.isConditionalExpression(node) && node.condition.getText(create) === 'evidenceMode === "file"') found = node;
    ts.forEachChild(node, visit);
  }
  visit(create);
  assert.ok(found);
  const source = found.getText(create);

  assert.match(source, /※ 청첩장, 부고장 이미지를 첨부할 수 있어요 \(JPG, PNG\)/);
  assert.match(source, /MediaImageBackground/);
  assert.match(source, /original_filename} 삭제/);
  assert.equal((source.match(/accessibilityRole="button"/g) ?? []).length, 2);
  assert.doesNotMatch(source, /PostAttachmentEditor/);
});

test("mutual-aid evidence controls expose button roles, selected state, and picker guidance", () => {
  const source = create.getText();
  assert.match(source, /accessibilityState=\{\{ selected: active \}\}/);
  assert.match(source, /accessibilityHint=\{mode\.key === "file"/);
  assert.match(source, /key=\{mode\.key\}[\s\S]{0,300}accessibilityRole="button"/);
});

test("mutual-aid evidence starts neutral and image selection opens the private JPG/PNG picker", async () => {
  assert.match(create.getText(), /useState<"file" \| "link" \| null>\(null\)/);
  const pickerCode = expression(create, (node) => ts.isArrowFunction(node) && ts.isVariableDeclaration(node.parent) && node.parent.name.getText(create) === "selectMutualAidEvidenceImages");
  let pickerArgs: unknown[] = [];
  const selectImages = runInNewContext(pickerCode, {
    uploadAttachments: async (pick: () => Promise<unknown[]>) => pick(),
    pickAndUploadDocuments: (...args: unknown[]) => { pickerArgs = args; return Promise.resolve([]); },
  });
  await selectImages();
  assert.equal(pickerArgs[1], true);
  assert.deepEqual(JSON.parse(JSON.stringify(pickerArgs[2])), {
    multiple: true,
    accept: ".jpg,.jpeg,.png,image/jpeg,image/png",
    types: ["image/jpeg", "image/png"],
  });
});

test("document picker enforces allowed MIME types before both web and native uploads", () => {
  assert.equal((mediaPickerSource.match(/assertAllowedDocumentContentTypes\(/g) ?? []).length, 2);
});

test("mutual-aid evidence tabs keep image upload and link input mutually exclusive", () => {
  const code = expression(create, (node) => ts.isArrowFunction(node) && ts.isVariableDeclaration(node.parent) && node.parent.name.getText(create) === "handleEvidenceModeSelect");
  const events: string[] = [];
  const selectMode = runInNewContext(code, {
    setEvidenceMode: (mode: string) => events.push(`mode:${mode}`),
    setEvidenceLink: (value: string) => events.push(`link:${value}`),
    setAttachments: (value: unknown[]) => events.push(`attachments:${value.length}`),
    selectMutualAidEvidenceImages: () => events.push("pick:image"),
  });

  selectMode("file");
  assert.deepEqual(events, ["mode:file", "link:", "pick:image"]);
  events.length = 0;
  selectMode("link");
  assert.deepEqual(events, ["mode:link", "attachments:0"]);
});

test("mutual-aid saves explicit replacement with remaining file IDs and clears an old proof link", () => {
  const metadataCode = expression(create, (node) => ts.isArrowFunction(node) && ts.isVariableDeclaration(node.parent) && node.parent.name.getText(create) === "buildMetadata");
  const payloadCode = expression(create, (node) => ts.isObjectLiteralExpression(node) && ts.isVariableDeclaration(node.parent) && node.parent.name.getText(create) === "payload");
  const context = {
    isActivity: false, isMutualAid: true, isStudyRecruit: false, isAdminParticipationPost: false,
    isAlbum: false, isSuggestion: false, evidenceMode: "file", evidenceLink: "https://example.com/old-proof",
    clean: (value?: string) => value?.trim() || undefined,
    // 상조회는 자료공유 추가 입력이 없는 게시판이라 resourceFields가 null이다.
    resourceFields: null, resourcePostMetadata,
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
