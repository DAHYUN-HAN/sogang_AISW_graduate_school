import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { adminBoardNavigationTransition } from "../utils/adminContentManagement";

const source = ts.createSourceFile("controller.tsx", readFileSync("components/admin/useAdminController.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function callback(predicate: (node: ts.Node) => boolean) {
  let found: ts.Node | undefined;
  function visit(node: ts.Node) { if (!found && predicate(node)) found = node; ts.forEachChild(node, visit); }
  visit(source);
  assert.ok(found);
  return ts.transpileModule(`(${found.getText(source)})()`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
}

test("actual legacy effect selects the calendar without navigating away from its edit query", () => {
  const code = callback((node) => ts.isArrowFunction(node) && node.getText(source).includes('type: "legacy"'));
  const selected: Record<string, unknown> = {};
  const navigations: string[] = [];
  runInNewContext(code, {
    adminBoardNavigationTransition, handledLegacySection: { current: null }, rawAdminSection: "events", rawAdminLinkKey: "events::42",
    boardsQuery: { isSuccess: true }, boards: [{ id: 9, slug: "academic-calendar", name: "일정", category: "notices", board_type: "calendar", sort_order: 1 }],
    pendingBoardNavigationIntentRef: { current: null }, boardManagementBoardIdRef: { current: null }, externalLinkBoardIdRef: { current: null },
    setPendingBoardNavigationIntent: () => {}, setSection: (section: string) => navigations.push(section),
    setSectionState: (section: string) => { selected.section = section; }, setBoardManagementScope: () => {},
    setBoardManagementBoardId: (id: number) => { selected.id = id; }, setBoardManagementTab: () => {}, setCreatingBoard: () => {},
  });
  assert.deepEqual(navigations, []);
  assert.deepEqual(selected, { section: "boardManagement", id: 9 });
});

test("actual member exit cancels deferred intent before leaving and respects an active save", () => {
  const code = callback((node) => ts.isArrowFunction(node) && ts.isVariableDeclaration(node.parent) && node.parent.name.getText(source) === "openMemberScreen");
  const actions: string[] = [];
  const locks = { current: false };
  const context = { boardSettingsSavingRef: locks, externalLinkSavingRef: { current: false }, noticeOperationRef: { current: null }, beginExplicitAdminNavigation: () => actions.push("cancel"), expoRouter: { push: (route: string) => actions.push(route) } };
  runInNewContext(code, context);
  assert.deepEqual(actions, ["cancel", "/(tabs)/home"]);
  locks.current = true;
  runInNewContext(code, context);
  assert.deepEqual(actions, ["cancel", "/(tabs)/home"]);
});
