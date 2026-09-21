import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import { COMMUNITY_TAB_ROUTE, PARTICIPATION_TAB_ROUTE, postCreateCompletionRoute, postCreateFormBackDecision } from "../utils/appRoutes";

// Run the actual screen's header callback and focus subscription. Route-helper
// tests alone cannot catch Android Back falling through to the parent Home tab.
const source = ts.createSourceFile("create.tsx", readFileSync("app/(tabs)/board/post/create.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const form = source.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "PostCreateForm")!;
let headerBack: ts.Expression | undefined;
function findHeader(node: ts.Node) {
  if (ts.isJsxOpeningElement(node) && node.tagName.getText(source) === "Pressable") {
    const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
    if (attributes.some((attr) => attr.name.getText(source) === "accessibilityLabel" && attr.initializer?.getText(source) === '"닫기"')) {
      const onPress = attributes.find((attr) => attr.name.getText(source) === "onPress")?.initializer;
      if (onPress && ts.isJsxExpression(onPress)) headerBack = onPress.expression;
    }
  }
  ts.forEachChild(node, findHeader);
}
findHeader(form);
assert.ok(headerBack);
// removeConfirmed/pendingRemoveAction은 구조 분해라 이름이 정확히 일치하지 않는다.
const BACK_CALLBACKS = ["leaveCreateScreen", "handleCreateBack", "handleDiscardConfirm", "removeConfirmed", "pendingRemoveAction"];
const backStatements = form.body!.statements.filter((node) => {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.some((declaration) =>
      BACK_CALLBACKS.some((name) => declaration.name.getText(source).includes(name)));
  }
  if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
    const callee = node.expression.expression.getText(source);
    if (callee === "useFocusEffect" || callee === "usePreventRemove") return true;
    // 확인 후 실제 이동을 진행하는 effect만 가져온다.
    return callee === "useEffect" && node.getText(source).includes("removeConfirmed");
  }
  return false;
});
const code = ts.transpileModule(`${backStatements.map((node) => node.getText(source)).join("\n")}\nheaderCallback = ${headerBack.getText(source)};\ndiscardCallback = handleDiscardConfirm;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function harness(options: { platform?: string; returnTo?: string; canGoBack?: boolean; postId?: string; editOrigin?: string; createdPostId?: number; boardType?: string; selectionSheet?: string; datePickerOpen?: boolean; hasUnsavedChanges?: boolean; submitted?: boolean } = {}) {
  const routes: string[] = [];
  const cleared: string[] = [];
  const state = { selectionSheet: options.selectionSheet ?? null, datePickerOpen: options.datePickerOpen ?? false, discardPromptOpen: false, removeConfirmed: false };
  let listener: (() => boolean) | undefined;
  let focusEffect: (() => (() => void) | undefined) | undefined;
  let preventRemove: { prevent: boolean; callback: (event: { data: { action: unknown } }) => void } | undefined;
  const effects: (() => void)[] = [];
  const pendingRemoveRef = { current: null as unknown };
  const context = {
    boardId: 7,
    boardType: options.boardType ?? "resource",
    createdPostId: options.createdPostId ?? null,
    params: { returnTo: options.returnTo, postId: options.postId, editOrigin: options.editOrigin, fromBoardId: "7" },
    router: {
      canGoBack: () => options.canGoBack ?? true,
      back: () => routes.push("back"),
      navigate: (route: string) => routes.push(`navigate:${route}`),
      replace: (route: string) => routes.push(`replace:${route}`),
    },
    postCreateFormBackDecision,
    postCreateCompletionRoute,
    postId: options.postId ? Number(options.postId) : null,
    hasUnsavedChanges: options.hasUnsavedChanges ?? false,
    // 등록·저장에 성공하면 화면이 이 표시로 잠금을 먼저 푼다.
    submitted: options.submitted ?? false,
    setSelectionSheet: (value: string | null) => { state.selectionSheet = value; },
    setDatePickerOpen: (value: boolean) => { state.datePickerOpen = value; },
    setDiscardPromptOpen: (value: boolean) => { state.discardPromptOpen = value; },
    // 확인창에서 나가기를 고르면 잠금을 풀고, 풀린 뒤 effect가 이동을 진행한다.
    setRemoveConfirmed: (value: boolean) => {
      state.removeConfirmed = value;
      if (!value) return;
      render();
      effects.splice(0).forEach((effect) => effect());
    },
    useState: (initial: unknown) => [state.removeConfirmed || initial, rendered.setRemoveConfirmed],
    useRef: () => pendingRemoveRef,
    useEffect: (effect: () => void) => { effects.push(effect); },
    usePreventRemove: (prevent: boolean, callback: (event: { data: { action: unknown } }) => void) => {
      preventRemove = { prevent, callback };
    },
    navigation: { dispatch: (action: { type?: string }) => routes.push(`dispatch:${action?.type ?? "action"}`) },
    reset: () => { cleared.push("form"); },
    setAttachments: () => { cleared.push("attachments"); },
    setSelectedParticipants: () => { cleared.push("participants"); },
    setParticipantQuery: () => { cleared.push("participantQuery"); },
    setEvidenceLink: () => { cleared.push("evidenceLink"); },
    setEvidenceMode: () => { cleared.push("evidenceMode"); },
    setActivitySourcePostId: () => { cleared.push("activitySource"); },
    useCallback: (callback: unknown) => callback,
    useFocusEffect: (effect: typeof focusEffect) => { focusEffect = effect; },
    Platform: { OS: options.platform ?? "android" },
    BackHandler: {
      addEventListener(event: string, callback: () => boolean) {
        assert.equal(event, "hardwareBackPress");
        listener = callback;
        return { remove: () => { listener = undefined; } };
      },
    },
    headerCallback: undefined as (() => void) | undefined,
    discardCallback: undefined as (() => void) | undefined,
  };
  let rendered = { ...context, ...state };
  function render() {
    effects.length = 0;
    rendered = { ...context, ...state };
    runInNewContext(code, rendered);
  }
  render();
  return {
    navigation: routes,
    cleared,
    state,
    preventRemove: () => preventRemove,
    header: () => rendered.headerCallback!(),
    discard: () => rendered.discardCallback!(),
    focus: () => { render(); return focusEffect?.(); },
    hardware: () => listener?.(),
  };
}

for (const returnTo of [COMMUNITY_TAB_ROUTE, PARTICIPATION_TAB_ROUTE]) {
  test(`${returnTo} 글쓰기의 헤더와 Android Back은 이력 없이도 원래 탭으로 복귀한다`, () => {
    for (const canGoBack of [true, false]) {
      const h = harness({ returnTo, canGoBack });
      h.focus();
      assert.equal(h.hardware(), true, "The create screen must consume Android Back");
      h.header();
      assert.deepEqual(h.navigation, [`navigate:${returnTo}`, `navigate:${returnTo}`]);
    }
  });
}

test("수정 취소는 목록 returnTo보다 수정 전 게시글 상세를 우선한다", () => {
  const h = harness({ returnTo: COMMUNITY_TAB_ROUTE, postId: "42", editOrigin: "post-detail" });
  h.focus();
  assert.equal(h.hardware(), true);
  h.header();
  assert.deepEqual(h.navigation, ["back", "back"]);
});

test("독립 게시판 작성은 스택을 pop하고 이력이 없을 때 해당 게시판으로 대체한다", () => {
  for (const canGoBack of [true, false]) {
    const h = harness({ canGoBack });
    h.focus();
    assert.equal(h.hardware(), true);
    assert.deepEqual(h.navigation, [canGoBack ? "back" : "replace:/board/7"]);
  }
});

test("작성 화면을 벗어나면 Back 구독을 해제하고 재진입 시 다시 처리한다", () => {
  const h = harness({ returnTo: COMMUNITY_TAB_ROUTE });
  assert.equal(h.hardware(), undefined);
  const blur = h.focus();
  assert.equal(h.hardware(), true);
  blur?.();
  assert.equal(h.hardware(), undefined);
  h.focus();
  assert.equal(h.hardware(), true);
  assert.equal(h.navigation.length, 2);
});

test("웹과 iOS는 Android 구독 없이 기존 헤더 복귀를 유지한다", () => {
  for (const platform of ["web", "ios"]) {
    const h = harness({ platform, returnTo: COMMUNITY_TAB_ROUTE });
    assert.equal(h.focus(), undefined);
    assert.equal(h.hardware(), undefined);
    h.header();
    assert.deepEqual(h.navigation, [`navigate:${COMMUNITY_TAB_ROUTE}`]);
  }
});

test("등록 완료 화면의 Android Back도 기존 확인 버튼의 완료 경로로 이동한다", () => {
  const h = harness({ boardType: "suggestion", createdPostId: 42 });
  h.focus();
  assert.equal(h.hardware(), true);
  assert.deepEqual(h.navigation, [`replace:${postCreateCompletionRoute("suggestion", 42, 7)}`]);
});

test("등록 완료 후 남아 있는 선택기 상태는 확인과 Back 복귀를 막지 않는다", () => {
  const h = harness({ boardType: "activity_certification", createdPostId: 42, datePickerOpen: true, selectionSheet: "activity" });
  h.focus();
  h.hardware();
  h.header();
  const route = `replace:${postCreateCompletionRoute("activity_certification", 42, 7)}`;
  assert.deepEqual(h.navigation, [route, route]);
});

test("게시판 선택창이 펼쳐져 있으면 먼저 닫고 다음 Back에서 목록으로 돌아간다", () => {
  const h = harness({ returnTo: COMMUNITY_TAB_ROUTE, selectionSheet: "board" });
  h.focus();
  assert.equal(h.hardware(), true);
  assert.deepEqual(h.navigation, []);
  assert.equal(h.state.selectionSheet, null);
  h.focus();
  h.hardware();
  assert.deepEqual(h.navigation, [`navigate:${COMMUNITY_TAB_ROUTE}`]);
});

test("작성 중 펼친 날짜 선택기도 Back에서 먼저 닫는다", () => {
  const h = harness({ returnTo: PARTICIPATION_TAB_ROUTE, datePickerOpen: true });
  h.focus();
  h.hardware();
  assert.deepEqual(h.navigation, []);
  assert.equal(h.state.datePickerOpen, false);
  h.focus();
  h.hardware();
  assert.deepEqual(h.navigation, [`navigate:${PARTICIPATION_TAB_ROUTE}`]);
});

test("작성 중인 내용이 있으면 헤더와 Android Back이 곧바로 나가지 않고 확인창을 연다", () => {
  const h = harness({ returnTo: COMMUNITY_TAB_ROUTE, hasUnsavedChanges: true });
  h.focus();
  assert.equal(h.hardware(), true, "확인창을 열 때도 Android Back을 소비해야 한다");
  h.header();
  assert.deepEqual(h.navigation, [], "확인 전에는 이동하지 않는다");
  assert.equal(h.state.discardPromptOpen, true);
});

test("작성 취소를 확인하면 폼을 비우고 원래 탭으로 복귀한다", () => {
  const h = harness({ returnTo: COMMUNITY_TAB_ROUTE, hasUnsavedChanges: true });
  h.header();
  assert.equal(h.state.discardPromptOpen, true);
  h.discard();
  assert.equal(h.state.discardPromptOpen, false);
  assert.deepEqual(h.cleared, ["form", "attachments", "participants", "participantQuery", "evidenceLink", "evidenceMode", "activitySource"]);
  assert.deepEqual(h.navigation, [`navigate:${COMMUNITY_TAB_ROUTE}`]);
});

test("수정 취소를 확인하면 폼을 비우지 않고 수정 전 게시글 상세로 돌아간다", () => {
  const h = harness({ returnTo: COMMUNITY_TAB_ROUTE, postId: "42", editOrigin: "post-detail", hasUnsavedChanges: true });
  h.header();
  assert.equal(h.state.discardPromptOpen, true);
  h.discard();
  assert.deepEqual(h.cleared, [], "수정 화면은 pop되어 언마운트되므로 비우지 않는다");
  assert.deepEqual(h.navigation, ["back"]);
});

test("변경사항이 있어도 선택창과 날짜 선택기를 확인창보다 먼저 닫는다", () => {
  for (const options of [{ selectionSheet: "board" }, { datePickerOpen: true }]) {
    const h = harness({ returnTo: PARTICIPATION_TAB_ROUTE, hasUnsavedChanges: true, ...options });
    h.header();
    assert.deepEqual(h.navigation, []);
    assert.equal(h.state.discardPromptOpen, false, "선택기를 닫는 단계에서는 확인창을 열지 않는다");
    h.focus();
    h.header();
    assert.deepEqual(h.navigation, [], "확인창이 열린 동안에도 이동하지 않는다");
    assert.equal(h.state.discardPromptOpen, true);
  }
});

test("등록 완료 후에는 변경사항이 남아 있어도 확인창 없이 완료 경로로 간다", () => {
  const h = harness({ boardType: "suggestion", createdPostId: 42, hasUnsavedChanges: true });
  h.focus();
  assert.equal(h.hardware(), true);
  assert.equal(h.state.discardPromptOpen, false);
  assert.deepEqual(h.navigation, [`replace:${postCreateCompletionRoute("suggestion", 42, 7)}`]);
});

test("iOS 스와이프로 나가려 해도 확인창을 먼저 띄운다", () => {
  // UIKit이 직접 pop 해서 헤더·Android 핸들러를 타지 않는다. usePreventRemove가
  // native-stack의 preventNativeDismiss를 켜 그 제스처까지 막는다.
  const h = harness({ returnTo: COMMUNITY_TAB_ROUTE, hasUnsavedChanges: true });
  const prevented = h.preventRemove();
  assert.ok(prevented, "usePreventRemove를 걸어야 한다");
  assert.equal(prevented.prevent, true);

  prevented.callback({ data: { action: { type: "POP" } } });
  assert.equal(h.state.discardPromptOpen, true);
  assert.deepEqual(h.navigation, [], "확인 전에는 나가지 않는다");

  h.discard();
  // 제스처로 들어왔으면 원래 하려던 이동을 그대로 진행한다.
  assert.deepEqual(h.navigation, ["dispatch:POP"]);
});

test("작성 중인 내용이 없으면 스와이프를 막지 않는다", () => {
  const h = harness({ returnTo: COMMUNITY_TAB_ROUTE });
  assert.equal(h.preventRemove()?.prevent, false);
});

test("등록에 성공하면 잠금이 풀려 확인창 없이 이동한다", () => {
  // 완료 화면을 쓰지 않는 게시판은 createdPostId가 비어 있어, 이 표시가 없으면
  // 등록 직후의 router.replace까지 붙잡혀 작성 취소 확인창이 떴다.
  const h = harness({ returnTo: COMMUNITY_TAB_ROUTE, hasUnsavedChanges: true, submitted: true });
  assert.equal(h.preventRemove()?.prevent, false);
});

test("등록을 마친 뒤에는 스와이프를 막지 않는다", () => {
  const h = harness({ returnTo: COMMUNITY_TAB_ROUTE, hasUnsavedChanges: true, createdPostId: 11 });
  assert.equal(h.preventRemove()?.prevent, false);
});
