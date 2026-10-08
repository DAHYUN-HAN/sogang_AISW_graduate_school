import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

function pageHarness(params: {editNoticeId?: string; createNoticeBoardId?: string}, editSuccess=true) {
  const path = resolve("components/admin/pages/AdminBoardsWebPage.tsx"), nativeRequire = createRequire(path), react = nativeRequire("react");
  const slots: any[] = [], effects: (() => unknown)[] = [], opened: string[] = [], edited: number[] = [], drafts: string[] = [], cleared: unknown[] = [];
  let cursor = 0;
  const board = {id: 9, slug: "notices", board_type: "notice", name: "공지", category: "notices", is_active: true};
  const post = {id: 88, board_id: 9, title: "제목", content: "ABCDEF", is_notice: true};
  const workspace = {
    boards: [board], boardManagementBoardId: null as number | null, selectedNoticeBoardId: null as number | null, boardManagementTab: "content",
    selectedManagedBoard: board, boardsQuery: {isSuccess: true}, setPageOperationPending: () => {},
    openManagedBoard: (slug: string) => {opened.push(slug); workspace.boardManagementBoardId = 9; workspace.selectedNoticeBoardId = 9;},
    handleEditNotice: async (item: typeof post) => {edited.push(item.id); return editSuccess;},
    startWebNoticeDraft: (category: string) => drafts.push(category), renderNoticeEditor: () => react.createElement("DedicatedNoticeEditor"),
  };
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const module = {exports: {} as {default: () => unknown}};
  new Function("module", "exports", "require", compiled)(module, module.exports, (id: string) => {
    if (id === "react") return {...react,
      useCallback: (fn: unknown) => fn,
      useRef: (value: unknown) => {const index = cursor++; return slots[index] ?? (slots[index] = {current: value});},
      useState: (initial: any) => {const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], (value: any) => {slots[index] = typeof value === "function" ? value(slots[index]) : value;}];},
      useEffect: (effect: () => unknown, deps: unknown[]) => {const index = cursor++; const old = slots[index]; if (!old || deps.some((value, i) => value !== old[i])) {slots[index] = deps; effects.push(effect);}},
    };
    if (id === "expo-router") return {useLocalSearchParams: () => params, useRouter: () => ({setParams: (value: unknown) => cleared.push(value)})};
    if (id.endsWith("/hooks/usePosts")) return {usePostDetail: () => ({data: params.editNoticeId ? {data: post} : undefined,refetch:async()=>{}})};
    if (id === "react-native") return {View: "View", useWindowDimensions: () => ({width: 1200})};
    if (id === "@tanstack/react-query") return {useQueryClient: () => ({})};
    if (id.endsWith("/AppTypography")) return {AppText: "Text"};
    if (id.endsWith("/services/api")) return {boardApi: {}};
    if (id.endsWith("/utils/adminAlert")) return {useAdminAlert: () => ({alert: () => {}})};
    if (id.endsWith("/stores/writeLeaveGuard")) return {requestWriteLeave: () => false, setWriteLeaveGuard: () => {}};
    if (id === "../AdminWorkspace") return {useAdminWorkspace: () => workspace};
    if (id === "../AdminControls") return {ActionButton: "ActionButton", Chip: "Chip", Panel: "Panel"};
    if (id === "../AdminBoardTheme") return {AdminBoardWebTheme: "Theme", BOARD_WEB_STYLES: {tabs: {}}};
    if (id === "../AdminBoardContentPanel") return {default: "ContentPanel", AdminBoardTargetQueryState: "QueryState"};
    if (id === "../AdminPostRouteState") return {default: "RouteError"};
    if (id.startsWith("../Admin")) return {default: id};
    return nativeRequire(id);
  });
  const render = () => {cursor = 0; const tree = module.exports.default(); effects.splice(0).forEach(fn => fn()); return tree;};
  const types = (tree: any): unknown[] => Array.isArray(tree) ? tree.flatMap(types) : react.isValidElement(tree) ? [tree.type, ...types(tree.props.children)] : [];
  return {render, types, opened, edited, drafts, cleared};
}

test("edit query waits for managed-board alignment before loading and showing the dedicated notice editor", async () => {
  const page = pageHarness({editNoticeId: "88"});
  page.render(); page.render(); await new Promise(resolve => setImmediate(resolve));
  const tree = page.render();
  assert.deepEqual(page.opened, ["notices"]);
  assert.deepEqual(page.edited, [88]);
  assert.ok(page.types(tree).includes("DedicatedNoticeEditor"));
  assert.equal(page.cleared.length, 1, "consume the edit intent so Back/list navigation cannot reopen it");
});
test("create query selects its notice board and opens a fresh dedicated draft", () => {
  const page = pageHarness({createNoticeBoardId: "9"});
  page.render(); page.render(); const tree = page.render();
  assert.deepEqual(page.opened, ["notices"]);
  assert.equal(page.drafts.length, 1);
  assert.ok(page.types(tree).includes("DedicatedNoticeEditor"));
  assert.equal(page.cleared.length, 1);
});

test("a failed dedicated edit load retains its intent and presents an actionable retry",async()=>{
  const page=pageHarness({editNoticeId:"88"},false);
  page.render();page.render();await new Promise(resolve=>setImmediate(resolve));
  const tree=page.render() as any;
  assert.equal(page.cleared.length,0,"failed edit must not consume its route intent");
  assert.equal(tree.type,"RouteError");
  assert.equal(typeof tree.props.onRetry,"function");
});
