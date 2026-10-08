import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";
import type { Board } from "../types";

const pagePath = join(process.cwd(), "components/admin/pages/AdminBoardsWebPage.tsx");
const pageRequire = createRequire(pagePath);
const react = pageRequire("react");
const board = (id: number, slug: string, type = "post", is_active = true): Board => ({
  id, slug, name: slug, board_type: type, category: "participation", sort_order: id,
  is_active, allow_anonymous: false, read_permission: "user", write_permission: "user",
});

function workspacePage(section: "club" | "networking", boards: Board[], boardId: number | null = null) {
  const pushes: unknown[] = [];
  const opened: string[] = [];
  const target = boards.find(b => b.id === boardId) ?? boards[0];
  let stateIndex = 0;
  const workspace = {
    boards, selectedManagedBoard: target, boardManagementBoardId: target.id,
    boardsQuery: {isSuccess: true}, boardManagementTab: "content",
    setPageOperationPending: () => {}, openManagedBoard: (slug: string) => opened.push(slug),
    handleBoardManagementScopeChange: () => {},
  };
  const compiled = ts.transpileModule(readFileSync(pagePath, "utf8"), {
    compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true},
  }).outputText;
  const module = {exports: {} as {default?: () => unknown}};
  const requirePage = (id: string) => {
    if (id === "react") return {...react,
      useCallback: (fn: unknown) => fn,
      useState: (initial: unknown) => [stateIndex++ === 0 ? {section, boardId} : typeof initial === "function" ? initial() : initial, () => {}],
      useEffect: () => {}, useRef: (current: unknown) => ({current}),
    };
    if (id === "react-native") return {View: "View", useWindowDimensions: () => ({width: 1200})};
    if (id.endsWith("/AppTypography")) return {AppText: "Text"};
    if (id === "expo-router") return {useLocalSearchParams: () => ({}), useRouter: () => ({push: (value: unknown) => pushes.push(value)})};
    if (id.endsWith("/hooks/usePosts")) return {usePostDetail: () => ({})};
    if (id === "@tanstack/react-query") return {useQueryClient: () => ({invalidateQueries: async () => {}})};
    if (id.endsWith("/services/api")) return {boardApi: {}};
    if (id.endsWith("/utils/adminAlert")) return {useAdminAlert: () => ({alert: () => {}})};
    if (id.endsWith("/stores/writeLeaveGuard")) return {requestWriteLeave: () => false, setWriteLeaveGuard: () => {}};
    if (id === "../AdminWorkspace") return {useAdminWorkspace: () => workspace};
    if (id === "../AdminControls") return {ActionButton: "ActionButton", Chip: "Chip", Panel: "Panel"};
    if (id === "../AdminBoardTheme") return {AdminBoardWebTheme: "Theme", BOARD_WEB_STYLES: {tabs: {}}};
    if (id === "../AdminBoardContentPanel") return {default: "ContentPanel", AdminBoardTargetQueryState: "QueryState"};
    if (id.startsWith("../Admin")) return {default: id};
    return pageRequire(id);
  };
  new Function("module", "exports", "require", compiled)(module, module.exports, requirePage);
  const root = module.exports.default!();
  const actions: {label: string; onPress: () => void}[] = [];
  function walk(node: unknown) {
    if (Array.isArray(node)) {node.forEach(walk); return;}
    if (!react.isValidElement(node)) return;
    const element = node as {type: unknown; props: {children?: unknown; label?: string; onPress?: () => void}};
    if (element.type === "ActionButton") actions.push(element.props as {label: string; onPress: () => void});
    walk(element.props.children);
  }
  walk(root);
  return {actions, pushes, opened};
}

for (const [section, guideSlug, activitySlug, label, guideId] of [
  ["club", "club-promo", "club-activity", "동아리 등록", 21],
  ["networking", "networking-programs", "networking-activity", "네트워킹 행사 등록", 22],
] as const) {
  test(`${section} aggregate registers the guide even when certification sorts first`, () => {
    const view = workspacePage(section, [board(1, activitySlug, "activity_certification"), board(guideId, guideSlug)]);
    const register = view.actions.find(action => action.label === label);
    assert.ok(register, "the registration action must be visible on the aggregate page");
    register.onPress();
    assert.deepEqual(view.pushes, [{pathname: "/admin/boards/create", params: {boardId: String(guideId)}}]);
    view.actions.find(action => action.label === "활동 인증 보기")!.onPress();
    assert.deepEqual(view.opened, [activitySlug]);
  });

  test(`${section} keeps certification writing on its own selected board`, () => {
    const view = workspacePage(section, [board(1, activitySlug, "activity_certification"), board(guideId, guideSlug)], 1);
    const certify = view.actions.find(action => action.label === "활동 인증 작성");
    assert.ok(certify);
    certify.onPress();
    assert.deepEqual(view.pushes, [{pathname: "/admin/boards/create", params: {boardId: "1"}}]);
  });
}

test("a hidden guide cannot turn registration into certification writing", () => {
  const view = workspacePage("club", [board(1, "club-activity", "activity_certification"), board(21, "club-promo", "post", false)]);
  assert.equal(view.actions.some(action => action.label === "동아리 등록" || action.label === "글 작성"), false);
  assert.ok(view.actions.find(action => action.label === "활동 인증 보기"));
});
