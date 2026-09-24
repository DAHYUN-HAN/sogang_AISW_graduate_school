import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import { requestWriteLeave, setWriteLeaveGuard, writeLeaveGuard } from "../stores/writeLeaveGuard";

const layoutSource = readFileSync("app/(tabs)/_layout.tsx", "utf8");
const createSource = readFileSync("app/(tabs)/board/post/create.tsx", "utf8");
const editSource = readFileSync("app/(tabs)/board/post/edit/[postId].tsx", "utf8");

test("가로채기가 없으면 부르는 쪽이 평소대로 이동한다", () => {
  setWriteLeaveGuard(null);
  let moved = 0;
  assert.equal(requestWriteLeave(() => { moved += 1; }), false);
  assert.equal(moved, 0, "false를 받은 쪽이 직접 옮겨야 한다");
});

test("가로채기가 걸려 있으면 곧바로 옮기지 않고 넘긴다", () => {
  let handed: (() => void) | null = null;
  setWriteLeaveGuard((proceed) => { handed = proceed; });
  let moved = 0;
  assert.equal(requestWriteLeave(() => { moved += 1; }), true);
  assert.equal(moved, 0, "확인 전에는 옮기면 안 된다");
  handed!();
  assert.equal(moved, 1, "확인한 뒤에는 원래 가려던 곳으로 옮긴다");
  setWriteLeaveGuard(null);
  assert.equal(writeLeaveGuard(), null);
});

// 탭바가 실제로 등록하는 핸들러를 그대로 돌린다.
function runTabPress(guarded: boolean) {
  const source = ts.createSourceFile("_layout.tsx", layoutSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const handler = source.statements.find(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === "handleTabRootPress",
  )!;
  const code = ts.transpileModule(`${handler.getText(source)}\nhandleTabRootPress("community", { preventDefault: () => { prevented += 1; } });`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const navigated: string[] = [];
  const reset: string[] = [];
  let held: (() => void) | null = null;
  const context = {
    prevented: 0,
    tabRootPressAction: () => ({ route: "/(tabs)/community", resetTab: "community" }),
    requestTabRootReset: (tab: string) => reset.push(tab),
    router: { navigate: (route: string) => navigated.push(route) },
    requestWriteLeave: (proceed: () => void) => {
      if (!guarded) return false;
      held = proceed;
      return true;
    },
  };
  runInNewContext(code, context);
  return { navigated, reset, prevented: context.prevented, proceed: () => held?.() };
}

test("글을 쓰지 않는 중에는 탭을 누르면 바로 그 탭으로 간다", () => {
  const h = runTabPress(false);
  assert.equal(h.prevented, 1, "기본 탭 이동은 항상 막고 직접 옮긴다");
  assert.deepEqual(h.navigated, ["/(tabs)/community"]);
  assert.deepEqual(h.reset, ["community"]);
});

test("글쓰기 중이면 탭을 눌러도 확인 전에는 옮기지 않는다", () => {
  const h = runTabPress(true);
  assert.deepEqual(h.navigated, [], "확인창을 거치기 전에는 이동이 없다");
  assert.deepEqual(h.reset, [], "탭 초기화도 확인 후에 일어나야 한다");
  h.proceed();
  assert.deepEqual(h.navigated, ["/(tabs)/community"], "누른 그 탭으로 간다");
  assert.deepEqual(h.reset, ["community"]);
});

test("작성·수정 화면이 확인창을 거쳐 누른 탭으로 옮긴다", () => {
  for (const [name, source] of [["작성", createSource], ["수정", editSource]] as const) {
    assert.match(source, /setWriteLeaveGuard\(\(proceed\) => \{\s*pendingTabLeave\.current = proceed;\s*setDiscardPromptOpen\(true\);/, name);
    // 화면을 떠날 때 반드시 풀어야 다른 화면에서 확인창이 샌다.
    assert.match(source, /return \(\) => setWriteLeaveGuard\(null\);/, name);
    // 확인 후에는 헤더·스와이프 경로보다 탭 이동을 먼저 본다.
    assert.match(source, /if \(tabLeave\) tabLeave\(\);\s*else if \(action\)/, name);
  }
});

test("바꿀 내용이 없으면 가로채기를 걸지 않는다", () => {
  assert.match(createSource, /const blocksLeaving = hasUnsavedChanges && !createdPostId && !removeConfirmed;/);
  // 저장에 성공하면 폼은 기준선과 다른 채로 남으므로 submitted로 잠금을 먼저 푼다.
  assert.match(editSource, /const blocksLeaving = hasUnsavedChanges && !submitted && !removeConfirmed;/);
  for (const source of [createSource, editSource]) {
    assert.match(source, /if \(!blocksLeaving\) return undefined;/);
  }
});
