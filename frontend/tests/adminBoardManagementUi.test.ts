import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

import type { Board, MediaAsset } from "../types";
import type { AdminBoardCapability } from "../utils/adminContentManagement";

const navigatorSource = readFileSync(
  join(process.cwd(), "components", "admin", "AdminBoardManagementNavigator.tsx"),
  "utf8",
);
const settingsSource = readFileSync(
  join(process.cwd(), "components", "admin", "AdminBoardSettingsPanel.tsx"),
  "utf8",
);
const adminSource = readFileSync(join(process.cwd(), "app", "admin", "index.tsx"), "utf8");
const contentPanelSource = readFileSync(
  join(process.cwd(), "components", "admin", "AdminBoardContentPanel.tsx"),
  "utf8",
);
const nodeRequire = createRequire(import.meta.url);

function loadNavigatorModule() {
  const compiled = ts.transpileModule(navigatorSource, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  const categories: Record<string, string[]> = {
    notices: ["notices"],
    community: ["community", "resources"],
    participation: ["participation", "club", "study", "alumni"],
    council: ["council", "gsa"],
  };
  const mockRequire = (id: string) => {
    if (id === "react-native") return { Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", View: "View" };
    if (id === "../../utils/adminContentManagement") {
      return {
        adminBoardsForScope: (boards: Board[], scope: string) => scope === "all" ? boards : boards.filter((board) => categories[scope]?.includes(board.category)),
        adminScopeForBoard: (board: Board) => Object.entries(categories).find(([, values]) => values.includes(board.category))?.[0] ?? "all",
        nextAdminBoardSelection: (boards: Board[], currentBoardId: number | null, scope: string) => {
          if (scope === "all") return null;
          const visible = boards.filter((board) => categories[scope]?.includes(board.category));
          return visible.some((board) => board.id === currentBoardId) ? currentBoardId : visible[0]?.id ?? null;
        },
      };
    }
    return nodeRequire(id);
  };
  new Function("module", "exports", "require", compiled)(module, module.exports, mockRequire);
  return module.exports as Record<string, (...args: unknown[]) => unknown>;
}

function loadContentPanelModule() {
  const compiled = ts.transpileModule(contentPanelSource, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  const mockRequire = (id: string) => {
    if (id === "react-native") {
      return { ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", Text: "Text", View: "View" };
    }
    return nodeRequire(id);
  };
  new Function("module", "exports", "require", compiled)(module, module.exports, mockRequire);
  return module.exports as Record<string, (...args: unknown[]) => unknown>;
}

function loadSettingsPanelModule() {
  const compiled = ts.transpileModule(settingsSource, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  const mockRequire = (id: string) => {
    if (id === "react-native") return { Pressable: "Pressable", Text: "Text", TextInput: "TextInput", View: "View" };
    return nodeRequire(id);
  };
  new Function("module", "exports", "require", compiled)(module, module.exports, mockRequire);
  return module.exports as Record<string, (...args: unknown[]) => unknown>;
}

function loadExternalLinkDraftTransitions() {
  const start = adminSource.indexOf("export type ExternalLinkDraftState");
  const end = adminSource.indexOf("function Panel", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const transitionSource = adminSource.slice(start, end);
  const compiled = ts.transpileModule(transitionSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  new Function("module", "exports", compiled)(module, module.exports);
  return module.exports as Record<string, (...args: unknown[]) => unknown>;
}

const board = (id: number, category: string): Board => ({
  id,
  name: `게시판 ${id}`,
  slug: `board-${id}`,
  category,
  board_type: "post",
  sort_order: id,
  allow_anonymous: false,
  read_permission: "user",
  write_permission: "user",
  is_active: true,
});

const media = (id: number): MediaAsset => ({
  id,
  original_filename: `${id}.jpg`,
  content_type: "image/jpeg",
  file_size: 1024,
  url: `/media/${id}`,
  is_private: false,
  status: "ready",
  created_at: "2026-09-21T00:00:00Z",
});

type RenderedElement = {
  type?: unknown;
  props?: { children?: unknown; disabled?: boolean; onPress?: () => void };
};

function renderedElements(node: unknown): RenderedElement[] {
  if (Array.isArray(node)) return node.flatMap(renderedElements);
  if (!node || typeof node !== "object") return [];
  const element = node as RenderedElement;
  return [element, ...renderedElements(element.props?.children)];
}

test("통합 탐색기는 그룹 게시판 콘텐츠 운영설정 탭을 제공한다", () => {
  assert.match(navigatorSource, /전체/);
  assert.match(navigatorSource, /커뮤니티·자료/);
  assert.match(navigatorSource, /accessibilityRole="tab"/);
  assert.match(navigatorSource, /콘텐츠/);
  assert.match(navigatorSource, /운영 설정/);
});

test("관리자 화면은 통합 선택 상태를 하나만 소유한다", () => {
  assert.match(adminSource, /boardManagementScope/);
  assert.match(adminSource, /boardManagementBoardId/);
  assert.match(adminSource, /boardManagementTab/);
});

test("게시판 관련 사이드 메뉴는 게시판 관리 하나만 남는다", () => {
  const sectionsSource = adminSource.slice(
    adminSource.indexOf("const SECTIONS"),
    adminSource.indexOf("const ADMIN_SECTION_KEYS"),
  );
  assert.match(sectionsSource, /key: "boardManagement", label: "게시판 관리"/);
  for (const label of ["공지사항", "게시판", "원우회 소개", "기장단", "역대 원우회", "게시글", "건의사항", "상조회", "FAQ", "일정"]) {
    assert.doesNotMatch(sectionsSource, new RegExp(`label: "${label}"`));
  }
  for (const [key, label] of [
    ["dashboard", "콘솔"],
    ["banners", "배너"],
    ["boardManagement", "게시판 관리"],
    ["accounts", "계정"],
    ["studentRoster", "원우 명부"],
    ["duesPayments", "원우회비"],
    ["reports", "신고"],
    ["registration", "가입 설정"],
  ]) {
    assert.match(sectionsSource, new RegExp(`key: "${key}", label: "${label}"`));
  }
  assert.equal((sectionsSource.match(/key: "boardManagement"/g) ?? []).length, 1);
});

test("통합 전용 화면은 제거된 게시판 목록 편집 상태와 최상위 렌더 조건을 남기지 않는다", () => {
  assert.doesNotMatch(adminSource, /const \[editingBoardId, setEditingBoardId\]/);
  assert.doesNotMatch(adminSource, /function BoardCard/);
  for (const legacySection of ["notices", "boards", "executives", "cohortLeaders", "pastCouncils", "posts", "suggestions", "mutualAid", "faqs", "events"]) {
    assert.doesNotMatch(adminSource, new RegExp(`section === "${legacySection}"`));
  }
});

test("레거시 section query는 게시판 조회 완료 후 raw 링크별 한 번씩 통합 선택으로 변환한다", () => {
  assert.match(adminSource, /const handledLegacySection = useRef<string \| null>\(null\)/);
  assert.match(adminSource, /adminBoardNavigationTransition\([\s\S]*?type: "legacy"[\s\S]*?boardsReady: boardsQuery\.isSuccess/);
  assert.match(adminSource, /handledLegacySection\.current = transition\.handledSection/);
  assert.match(adminSource, /setSection\("boardManagement"\)/);
  assert.match(adminSource, /setBoardManagementScope\(transition\.destination\.scope\)/);
  assert.match(adminSource, /setBoardManagementBoardId\(transition\.destination\.boardId\)/);
  assert.match(adminSource, /setBoardManagementTab\(transition\.destination\.tab\)/);
  assert.match(adminSource, /adminBoardNavigationTransition\([\s\S]*?type: "explicit"/);
});

test("이벤트 로드와 누락 후속 effect는 명시적 이동 취소 게이트를 먼저 통과한다", () => {
  assert.match(adminSource, /const deferredEventNavigationRef = useRef/);
  assert.match(adminSource, /type: "sync",\s*rawLinkKey: rawAdminLinkKey/);
  const explicitNavigation = adminSource.slice(
    adminSource.indexOf("const beginExplicitAdminNavigation"),
    adminSource.indexOf("const openAdminSection"),
  );
  assert.match(explicitNavigation, /adminDeferredEventGateTransition/);
  assert.match(explicitNavigation, /type: "cancel"/);

  const missingEventEffect = adminSource.slice(
    adminSource.indexOf("if (!editEventMissing)"),
    adminSource.indexOf("const event = editEventQuery.data?.data"),
  );
  assert.match(missingEventEffect, /adminDeferredEventGateTransition/);
  assert.match(missingEventEffect, /type: "apply"/);
  assert.ok(missingEventEffect.indexOf("shouldApply") < missingEventEffect.indexOf("router.replace"));

  const loadedEventEffect = adminSource.slice(
    adminSource.indexOf("const event = editEventQuery.data?.data"),
    adminSource.indexOf("const currentBanners = bannersQuery.data?.data"),
  );
  assert.match(loadedEventEffect, /adminDeferredEventGateTransition/);
  assert.match(loadedEventEffect, /type: "apply"/);
  assert.ok(loadedEventEffect.indexOf("shouldApply") < loadedEventEffect.indexOf('setSection("boardManagement")'));
});

test("대시보드 게시판 카드는 실제 slug를 통합 선택 함수에 전달한다", () => {
  for (const slug of [
    "all-notices",
    "gsa-executives",
    "gsa-cohort-leaders",
    "gsa-past-councils",
    "suggestions",
    "mutual-aid",
    "club-promo",
    "networking-programs",
    "gsa-faq",
    "academic-calendar",
  ]) {
    assert.match(adminSource, new RegExp(`openManagedBoard\\("${slug}"`));
  }
  assert.match(adminSource, /const openManagedBoard = \(slug: string, tab: AdminBoardManagementTab = "content"\)/);
});

test("운영 설정은 구조 식별자와 잠긴 정책을 읽기 전용으로 표시한다", () => {
  assert.match(settingsSource, /구조 식별자 · 변경 불가/);
  assert.match(settingsSource, /settingKey/);
  assert.match(navigatorSource, /새 게시판 등록/);
});

test("읽기 권한은 비회원 guest를 포함하고 쓰기 권한은 기존 선택지를 유지한다", () => {
  const settingsModule = loadSettingsPanelModule();
  assert.deepEqual(settingsModule.adminBoardPermissionOptions("read"), ["guest", "user", "admin"]);
  assert.deepEqual(settingsModule.adminBoardPermissionOptions("write"), ["user", "admin"]);
  assert.match(adminSource, /adminBoardPermissionOptions\("read"\)\.map/);
});

test("통합 탐색기와 설정 패널은 부모가 소유한 선택과 draft만 사용한다", () => {
  assert.doesNotMatch(navigatorSource, /useState/);
  assert.doesNotMatch(settingsSource, /useState/);
  assert.match(adminSource, /adminBoardScopeTransition\(boards, boardManagementBoardId, nextScope\)/);
  assert.match(adminSource, /adminBoardSelectionTransition\(boardId\)/);
  assert.match(adminSource, /adminBoardCreateTransition\(\)/);
  assert.match(adminSource, /setBoardManagementTab\(transition\.tab\)/);
});

test("기존 게시판 저장은 구조 식별자를 제외하는 공통 payload 경계를 사용한다", () => {
  const saveSettingsHandler = adminSource.slice(
    adminSource.indexOf("const handleSaveBoardSettings"),
    adminSource.indexOf("const handleCancelBoardForm"),
  );
  assert.match(saveSettingsHandler, /adminBoardSettingsPayload\(/);
  assert.match(saveSettingsHandler, /updateAdminBoard\(\s*targetBoardId,\s*payload/);
  assert.match(settingsSource, /allow_anonymous: "allowAnonymous"/);
  assert.match(settingsSource, /write_permission: "writePermission"/);
  assert.match(settingsSource, /read_permission: "readPermission"/);
  assert.match(settingsSource, /disabled=\{saving \|\| lockedDraftFields\.has\("allowAnonymous"\)\}/);
});

test("탐색 모델은 전체 가상 선택과 실제 게시판이 없는 운영 설정을 구분한다", () => {
  const navigatorModule = loadNavigatorModule();
  const boards = [board(1, "notices"), board(2, "community")];
  const allModel = navigatorModule.adminBoardNavigatorModel(boards, "all", null, false) as {
    boardOptions: { id: number | null; label: string }[];
    tabs: { key: string }[];
  };
  assert.deepEqual(allModel.boardOptions.map((option) => option.id), [null, 1, 2]);
  assert.equal(allModel.boardOptions[0]?.label, "모든 게시판");
  assert.deepEqual(allModel.tabs.map((tab) => tab.key), ["content"]);

  const orphanModel = navigatorModule.adminBoardNavigatorModel(boards, "notices", 999, false) as { tabs: { key: string }[] };
  assert.deepEqual(orphanModel.tabs.map((tab) => tab.key), ["content"]);
  const selectedModel = navigatorModule.adminBoardNavigatorModel(boards, "notices", 1, false) as { tabs: { key: string }[] };
  assert.deepEqual(selectedModel.tabs.map((tab) => tab.key), ["content", "settings"]);
});

test("그룹·게시판 전환과 새 게시판 생성 생명주기는 명시적인 상태 전이를 사용한다", () => {
  const navigatorModule = loadNavigatorModule();
  const boards = [board(1, "notices"), board(2, "community")];
  assert.deepEqual(navigatorModule.adminBoardScopeTransition(boards, 2, "notices"), {
    scope: "notices", boardId: 1, tab: "content", creatingBoard: false,
  });
  assert.deepEqual(navigatorModule.adminBoardSelectionTransition(2), {
    boardId: 2, tab: "content", creatingBoard: false,
  });
  assert.deepEqual(navigatorModule.adminBoardCreateTransition(), { tab: "settings", creatingBoard: true });
  assert.deepEqual(navigatorModule.adminBoardCreateCancelTransition(), { tab: "content", creatingBoard: false });
  assert.deepEqual(navigatorModule.adminBoardCreatedTransition(board(2, "community")), {
    scope: "community", boardId: 2, tab: "settings", creatingBoard: false,
  });

  const creationResult = navigatorModule.adminBoardCreationResult(
    [board(1, "notices"), board(2, "community")],
    { ...board(3, "community"), name: "새 게시판" },
  ) as { boards: Board[]; transition: { scope: string; boardId: number | null; tab: string; creatingBoard: boolean } };
  assert.deepEqual(creationResult.boards.map((item) => item.id), [1, 2, 3]);
  assert.equal(creationResult.boards[2]?.name, "새 게시판");
  assert.equal(creationResult.transition.boardId, 3);
  const createdModel = navigatorModule.adminBoardNavigatorModel(
    creationResult.boards,
    creationResult.transition.scope,
    creationResult.transition.boardId,
    creationResult.transition.creatingBoard,
  ) as { tabs: { key: string }[] };
  assert.deepEqual(createdModel.tabs.map((tab) => tab.key), ["content", "settings"]);
  const deduplicated = navigatorModule.adminBoardsWithCreatedBoard(
    creationResult.boards,
    { ...board(3, "community"), name: "갱신된 새 게시판" },
  ) as Board[];
  assert.deepEqual(deduplicated.map((item) => item.id), [1, 2, 3]);
  assert.equal(deduplicated[2]?.name, "갱신된 새 게시판");
});

test("설정 저장은 대상 게시판 일치 여부를 확인하고 네비게이션과 draft를 보호한다", () => {
  const navigatorModule = loadNavigatorModule();
  assert.equal(navigatorModule.isBoardSettingsTargetCurrent(1, 1), true);
  assert.equal(navigatorModule.isBoardSettingsTargetCurrent(1, 2), false);
  const originalDraft = { name: "기존 draft" };
  const savedDraft = { name: "서버 응답" };
  assert.deepEqual(navigatorModule.boardSettingsSaveResult(1, 1, originalDraft, savedDraft, "success"), {
    nextDraft: savedDraft,
    applyDraft: true,
    notification: "success",
  });
  assert.deepEqual(navigatorModule.boardSettingsSaveResult(1, 2, originalDraft, savedDraft, "success"), {
    nextDraft: originalDraft,
    applyDraft: false,
    notification: null,
  });
  assert.deepEqual(navigatorModule.boardSettingsSaveResult(1, 1, originalDraft, savedDraft, "failure"), {
    nextDraft: originalDraft,
    applyDraft: false,
    notification: "failure",
  });
  const rendered = navigatorModule.default({
    boards: [board(1, "notices")],
    scope: "notices",
    selectedBoardId: 1,
    selectedTab: "settings",
    creatingBoard: false,
    disabled: true,
    onScopeChange: () => undefined,
    onBoardChange: () => undefined,
    onTabChange: () => undefined,
    onCreateBoard: () => undefined,
  });
  const navigationButtons = renderedElements(rendered).filter((element) => element.type === "Pressable");
  assert.ok(navigationButtons.length > 0);
  assert.equal(navigationButtons.every((element) => element.props?.disabled === true), true);

  const saveHandler = adminSource.slice(
    adminSource.indexOf("const handleSaveBoardSettings"),
    adminSource.indexOf("const handleCancelBoardForm"),
  );
  assert.match(saveHandler, /const targetBoardId = selectedManagedBoard\.id/);
  assert.equal((saveHandler.match(/boardSettingsSaveResult\(/g) ?? []).length, 2);
  assert.match(saveHandler, /invalidateQueries\(\{ queryKey: \["admin-boards"\] \}\)/);
  assert.match(saveHandler, /invalidateQueries\(\{ queryKey: \["boards"\] \}\)/);
  assert.match(adminSource, /disabled=\{managedNavigationLocked \|\| !boardsQuery\.isSuccess\}/);
  assert.match(adminSource, /setQueryData<AdminBoardsQueryData>/);
  assert.match(adminSource, /setOptimisticManagedBoard\(\{ board: created\.data, insertedGeneration \}\)/);
  assert.match(adminSource, /shouldClearOptimisticCreatedBoard\(/);
  assert.match(settingsSource, /editable=\{!saving\}/);
  const catchClause = saveHandler.slice(saveHandler.lastIndexOf("} catch {"), saveHandler.indexOf("} finally"));
  assert.doesNotMatch(catchClause, /setBoardSettingsDraft/);
});

test("생성 게시판 overlay는 생성 이후 성공한 서버 refresh에서만 해제한다", () => {
  const navigatorModule = loadNavigatorModule();
  const createdBoard = board(3, "community");
  assert.equal(navigatorModule.shouldClearOptimisticCreatedBoard(3, 10, 10, "success", [createdBoard]), false);
  assert.equal(navigatorModule.shouldClearOptimisticCreatedBoard(3, 10, 11, "error", [createdBoard]), false);
  assert.equal(navigatorModule.shouldClearOptimisticCreatedBoard(3, 10, 11, "success", [board(1, "notices")]), false);
  assert.equal(navigatorModule.shouldClearOptimisticCreatedBoard(3, 10, 11, "success", [createdBoard]), true);
});

test("콘텐츠 패널은 capability kind에 맞는 renderer 하나만 실행한다", () => {
  const contentPanelModule = loadContentPanelModule();
  const calls: string[] = [];
  const capability: AdminBoardCapability = {
    kind: "notice",
    contentAvailable: true,
    canReplaceRepresentativeImage: false,
    lockedPolicies: [],
  };
  const rendered = contentPanelModule.default({
    board: board(1, "notices"),
    capability,
    renderers: {
      posts: () => {
        calls.push("posts");
        return "게시글";
      },
      notice: () => {
        calls.push("notice");
        return "공지";
      },
    },
  }) as { props?: { children?: unknown } };

  assert.deepEqual(calls, ["notice"]);
  assert.equal(rendered.props?.children, "공지");
});

test("비활성 공지도 통합 화면에서는 admin endpoint 정책을 사용한다", () => {
  const contentPanelModule = loadContentPanelModule();
  const inactiveNotice = {
    ...board(77, "notices"),
    board_type: "notice",
    is_active: false,
  };
  const unifiedPolicy = contentPanelModule.adminBoardContentQueryPolicy({
    section: "boardManagement",
    tab: "content",
    kind: "notice",
    board: inactiveNotice,
    targetStatus: "board",
  });
  assert.deepEqual(unifiedPolicy, {
    isManagedContentActive: true,
    showsStandardPosts: false,
    noticeSource: "admin",
    noticeBoardId: 77,
    showsSuggestions: false,
    suggestionBoardId: undefined,
    showsMutualAid: false,
    mutualAidBoardId: undefined,
    showsActivityHistory: false,
  });

  const legacyPolicy = contentPanelModule.adminBoardContentQueryPolicy({
    section: "notices",
    tab: "content",
    kind: "notice",
    board: inactiveNotice,
    targetStatus: "board",
  }) as { noticeSource: string; noticeBoardId?: number };
  assert.equal(legacyPolicy.noticeSource, "public");
  assert.equal(legacyPolicy.noticeBoardId, undefined);
});

test("public 공지 소비자는 비활성 선택을 첫 활성 공지로 보정한다", () => {
  const contentPanelModule = loadContentPanelModule();
  const inactiveNotice = { ...board(77, "notices"), board_type: "notice", is_active: false };
  const activeNotice = { ...board(88, "notices"), board_type: "notice", is_active: true };
  assert.equal(contentPanelModule.publicNoticeBoardSelection([inactiveNotice, activeNotice], 77), 88);
  assert.equal(contentPanelModule.publicNoticeBoardSelection([inactiveNotice, activeNotice], 88), 88);
  assert.equal(contentPanelModule.publicNoticeBoardSelection([inactiveNotice], 77), null);
});

test("공지 게시판 전환은 다른 게시판의 편집 상태만 초기화한다", () => {
  const contentPanelModule = loadContentPanelModule();
  assert.deepEqual(contentPanelModule.noticeEditorBoardTransition(1, 2, 1), {
    selectedBoardId: 2,
    shouldResetEditor: true,
  });
  assert.deepEqual(contentPanelModule.noticeEditorBoardTransition(1, 2, 2), {
    selectedBoardId: 2,
    shouldResetEditor: false,
  });
  assert.deepEqual(contentPanelModule.noticeEditorBoardTransition(2, 2, 2), {
    selectedBoardId: 2,
    shouldResetEditor: false,
  });
});

test("콘텐츠 쿼리 상태는 오류를 빈 상태보다 우선하고 재시도를 실행한다", () => {
  const contentPanelModule = loadContentPanelModule();
  let retries = 0;
  const errorState = contentPanelModule.AdminBoardContentQueryState({
    isLoading: false,
    isError: true,
    isEmpty: true,
    emptyMessage: "비어 있음",
    onRetry: () => {
      retries += 1;
    },
  });
  const errorElements = renderedElements(errorState);
  const retryButton = errorElements.find((element) => element.type === "Pressable");
  assert.ok(retryButton?.props?.onPress);
  retryButton.props.onPress();
  assert.equal(retries, 1);
  assert.equal(JSON.stringify(errorState).includes("불러오지 못했습니다"), true);
  assert.equal(JSON.stringify(errorState).includes("비어 있음"), false);

  const loadingState = contentPanelModule.AdminBoardContentQueryState({
    isLoading: true,
    isError: false,
    isEmpty: true,
    emptyMessage: "비어 있음",
    onRetry: () => undefined,
  });
  assert.equal(renderedElements(loadingState).some((element) => element.type === "ActivityIndicator"), true);

  const emptyState = contentPanelModule.AdminBoardContentQueryState({
    isLoading: false,
    isError: false,
    isEmpty: true,
    emptyMessage: "비어 있음",
    onRetry: () => undefined,
  });
  assert.equal(JSON.stringify(emptyState).includes("비어 있음"), true);
});

test("공지 건의 상조회는 통합 콘텐츠 renderer map으로 연결한다", () => {
  assert.match(adminSource, /"notice": renderNoticeContent/);
  assert.match(adminSource, /"suggestion": renderSuggestionContent/);
  assert.match(adminSource, /"mutual-aid": renderMutualAidContent/);
  assert.doesNotMatch(adminSource, /\.dedicatedSection/);
  assert.match(contentPanelSource, /renderers\[capability\.kind\]/);
});

test("비게시글 게시판도 통합 콘텐츠 패널에서 관리한다", () => {
  assert.match(adminSource, /"organization-intro": renderOrganizationIntroContent/);
  assert.match(adminSource, /calendar: renderCalendarContent/);
  assert.match(adminSource, /faq: renderFaqContent/);
  assert.match(adminSource, /"external-link": renderExternalLinkContent/);
  assert.match(adminSource, /guide: renderGuideContent/);
});

test("원우회 소개는 선택 게시판 slug로 기존 전용 편집기를 고른다", () => {
  assert.match(adminSource, /case "gsa-executives":\s*return renderExecutivesContent\(\)/);
  assert.match(adminSource, /case "gsa-cohort-leaders":\s*return renderCohortLeadersContent\(\)/);
  assert.match(adminSource, /case "gsa-past-councils":\s*return renderPastCouncilsContent\(\)/);
  assert.match(adminSource, /default:\s*return <UnsupportedBoardContent board=\{selectedManagedBoard\}/);
});

test("일정과 FAQ는 대시보드 집계와 통합 콘텐츠에서 조회하고 직접 일정 수정 링크를 유지한다", () => {
  assert.match(adminSource, /enabled: isAdmin && adminCalendarQueryEnabled\(/);
  assert.match(adminSource, /enabled: isAdmin && adminFaqQueryEnabled\(/);
  assert.match(adminSource, /eventsQuery\.refetch/);
  assert.match(adminSource, /faqsQuery\.refetch/);
});

test("외부 링크 저장은 대상 게시판과 draft를 보호하고 두 게시판 캐시를 갱신한다", () => {
  assert.match(adminSource, /externalLinkMetadata/);
  assert.match(adminSource, /validateExternalHttpUrl/);
  assert.match(adminSource, /externalLinkBoardIdRef/);
  assert.match(adminSource, /const targetBoardId = selectedManagedBoard\.id/);
  assert.match(adminSource, /const targetDraft = externalLinkDraft\.trim\(\)/);
  assert.match(adminSource, /boardApi\.updateAdminBoard\(targetBoardId, \{[\s\S]*?metadata: externalLinkMetadata\(selectedManagedBoard, targetDraft\)/);
  assert.match(adminSource, /invalidateQueries\(\{ queryKey: \["admin-boards"\] \}\)/);
  assert.match(adminSource, /invalidateQueries\(\{ queryKey: \["boards"\] \}\)/);
  assert.match(adminSource, /외부 링크를 저장하지 못했습니다/);
});

test("외부 링크 draft 전이는 같은 게시판 refresh를 무시하고 선택과 저장 성공만 동기화한다", () => {
  const transitions = loadExternalLinkDraftTransitions();
  const initial = { boardId: null, draft: "" };
  const accounting = {
    ...board(40, "gsa"),
    metadata: { notion_url: "https://notion.example.com/accounting", keep: "yes" },
  };
  const selected = transitions.externalLinkBoardTransition(initial, accounting) as { boardId: number | null; draft: string };
  assert.deepEqual(selected, { boardId: 40, draft: "https://notion.example.com/accounting" });

  const dirty = { ...selected, draft: "https://draft.example.com/unsaved" };
  const refreshed = transitions.externalLinkBoardTransition(
    dirty,
    { ...accounting, metadata: { external_url: "https://server.example.com/refreshed" } },
  );
  assert.equal(refreshed, dirty);

  const switched = transitions.externalLinkBoardTransition(
    dirty,
    { ...board(41, "gsa"), metadata: { external_url: "https://other.example.com" } },
  );
  assert.deepEqual(switched, { boardId: 41, draft: "https://other.example.com" });
  assert.deepEqual(
    transitions.externalLinkSaveTransition(switched, 41, "  https://other.example.com/saved  "),
    { boardId: 41, draft: "https://other.example.com/saved" },
  );
  assert.equal(
    transitions.externalLinkSaveTransition(dirty, 41, "https://stale.example.com"),
    dirty,
  );
});

test("외부 링크 저장 중 탐색은 동기적으로 거절하고 허용된 선택은 즉시 응답 가드를 바꾼다", () => {
  const transitions = loadExternalLinkDraftTransitions();
  assert.deepEqual(transitions.externalLinkNavigationTransition(40, 41, true), {
    accepted: false,
    boardId: 40,
  });
  assert.deepEqual(transitions.externalLinkNavigationTransition(40, 41, false), {
    accepted: true,
    boardId: 41,
  });
  const boardBAfterAcceptedSelection = { boardId: 41, draft: "https://b.example.com/dirty" };
  assert.equal(
    transitions.externalLinkSaveTransition(boardBAfterAcceptedSelection, 40, "https://a.example.com/saved"),
    boardBAfterAcceptedSelection,
  );

  assert.match(adminSource, /boardSettingsSavingRef\.current \|\| externalLinkSavingRef\.current/);
  assert.match(adminSource, /disabled=\{managedNavigationLocked \|\| !boardsQuery\.isSuccess\}/);
  assert.match(adminSource, /syncExternalLinkNavigationBoardId\(transition\.boardId\)/);
  assert.match(adminSource, /syncExternalLinkNavigationBoardId\(item\.board_id\)/);
});

test("가이드는 읽기 전용 안내만 표시하고 metadata 저장값을 만들지 않는다", () => {
  assert.match(adminSource, /이 가이드는 별도 콘텐츠 저장 형식을 사용하지 않습니다\. 이름, 설명, 노출과 권한은 운영 설정에서 관리할 수 있습니다\./);
  const guideRenderer = adminSource.slice(
    adminSource.indexOf("const renderGuideContent"),
    adminSource.indexOf("const managedContentRenderers"),
  );
  assert.doesNotMatch(guideRenderer, /updateAdminBoard|metadata:/);
});

test("숨겨진 게시판 콘텐츠 쿼리는 실행하지 않고 대시보드 집계는 유지한다", () => {
  assert.match(adminSource, /const isManagedContentActive = section === "boardManagement" && boardManagementTab === "content"/);
  assert.match(adminSource, /enabled: isAdmin && \(section === "dashboard" \|\| showsStandardPosts\)/);
  assert.match(adminSource, /adminPostListQueryParams\(\{/);
  assert.match(adminSource, /boardId: managedStandardPostsBoardId/);
  assert.match(adminSource, /unifiedNoticePostsQuery[\s\S]*?postApi\.getAdminPosts/);
  assert.match(adminSource, /noticeQueryPolicy\.noticeSource === "admin"/);
});

test("활동내역 공지 편집은 통합 게시판 선택을 실제 공지 게시판으로 전환한다", () => {
  assert.match(adminSource, /board_type: "notice"/);
  assert.match(adminSource, /show_in_council_activity === true/);
  assert.match(adminSource, /setSelectedNoticeBoardId\(item\.board_id\)/);
  assert.match(adminSource, /setBoardManagementScope\("notices"\)/);
  assert.match(adminSource, /setBoardManagementBoardId\(item\.board_id\)/);
  assert.match(adminSource, /setBoardManagementTab\("content"\)/);
});

test("건의와 상조회 통합 쿼리는 선택한 실제 게시판 ID를 사용하고 대시보드는 집계한다", () => {
  const contentPanelModule = loadContentPanelModule();
  const suggestionPolicy = contentPanelModule.adminBoardContentQueryPolicy({
    section: "boardManagement",
    tab: "content",
    kind: "suggestion",
    board: { ...board(14, "council"), board_type: "suggestion" },
    targetStatus: "board",
  }) as { showsSuggestions: boolean; suggestionBoardId?: number };
  assert.equal(suggestionPolicy.showsSuggestions, true);
  assert.equal(suggestionPolicy.suggestionBoardId, 14);

  const mutualAidPolicy = contentPanelModule.adminBoardContentQueryPolicy({
    section: "boardManagement",
    tab: "content",
    kind: "mutual-aid",
    board: { ...board(15, "council"), board_type: "mutual_aid" },
    targetStatus: "board",
  }) as { showsMutualAid: boolean; mutualAidBoardId?: number };
  assert.equal(mutualAidPolicy.showsMutualAid, true);
  assert.equal(mutualAidPolicy.mutualAidBoardId, 15);

  const dashboardPolicy = contentPanelModule.adminBoardContentQueryPolicy({
    section: "dashboard",
    tab: "content",
    kind: "aggregate-posts",
    targetStatus: "loading",
  }) as { suggestionBoardId?: number; mutualAidBoardId?: number };
  assert.equal(dashboardPolicy.suggestionBoardId, undefined);
  assert.equal(dashboardPolicy.mutualAidBoardId, undefined);
});

test("실제 선택 게시판이 없는 통합 범위는 어떤 콘텐츠 쿼리도 활성화하지 않는다", () => {
  const contentPanelModule = loadContentPanelModule();
  assert.deepEqual(contentPanelModule.adminBoardContentQueryPolicy({
    section: "boardManagement",
    tab: "content",
    kind: "aggregate-posts",
    targetStatus: "missing",
  }), {
    isManagedContentActive: false,
    showsStandardPosts: false,
    noticeSource: null,
    noticeBoardId: undefined,
    showsSuggestions: false,
    suggestionBoardId: undefined,
    showsMutualAid: false,
    mutualAidBoardId: undefined,
    showsActivityHistory: false,
  });
});

test("공지 저장과 업로드 결과는 시작한 게시판·편집·generation이 현재일 때만 반영한다", () => {
  const contentPanelModule = loadContentPanelModule();
  const operation = { id: 1, kind: "save", boardId: 10, editingNoticeId: 100, generation: 4 };
  assert.deepEqual(contentPanelModule.beginNoticeEditorOperation(null, operation), { accepted: true, operation });
  assert.deepEqual(contentPanelModule.beginNoticeEditorOperation(operation, { ...operation, id: 2 }), {
    accepted: false,
    operation,
  });
  assert.deepEqual(contentPanelModule.noticeEditorOperationResult(operation, {
    boardId: 10,
    editingNoticeId: 100,
    generation: 4,
  }, "success"), { apply: true, notification: "success" });
  assert.deepEqual(contentPanelModule.noticeEditorOperationResult(operation, {
    boardId: 11,
    editingNoticeId: null,
    generation: 5,
  }, "success"), { apply: false, notification: null });
  assert.deepEqual(contentPanelModule.noticeEditorOperationResult(operation, {
    boardId: 11,
    editingNoticeId: null,
    generation: 5,
  }, "failure"), { apply: false, notification: null });
});

test("공지 다중 이미지 추가는 기존 첨부를 유지하고 새 이미지를 선택 순서대로 중복 없이 붙인다", () => {
  const contentPanelModule = loadContentPanelModule();
  const current = [media(1), media(2)];
  const uploaded = [media(2), media(3), media(4), media(3)];

  const next = contentPanelModule.mergeNoticeAttachments(current, uploaded) as MediaAsset[];

  assert.deepEqual(next.map((item) => item.id), [1, 2, 3, 4]);
  assert.equal(next[0], current[0]);
  assert.equal(next[1], current[1]);
  assert.deepEqual(current.map((item) => item.id), [1, 2]);
});

test("공지 이미지 교체는 선택한 자리만 바꾸고 없는 대상에는 손대지 않는다", () => {
  const contentPanelModule = loadContentPanelModule();
  const current = [media(1), media(2), media(3)];
  const replacement = media(9);

  const next = contentPanelModule.replaceNoticeAttachment(current, 2, replacement) as MediaAsset[];
  const missing = contentPanelModule.replaceNoticeAttachment(current, 99, replacement) as MediaAsset[];

  assert.deepEqual(next.map((item) => item.id), [1, 9, 3]);
  assert.equal(next[0], current[0]);
  assert.equal(next[2], current[2]);
  assert.deepEqual(missing.map((item) => item.id), [1, 2, 3]);
  assert.deepEqual(current.map((item) => item.id), [1, 2, 3]);
});

test("공지 다중 업로드 실패 안내는 실패한 사진이 있을 때만 표시한다", () => {
  const contentPanelModule = loadContentPanelModule();

  assert.equal(contentPanelModule.noticeImageUploadIssueMessage({ uploadedCount: 2, failedCount: 1 }), "2장은 추가했고 1장은 업로드하지 못했습니다.");
  assert.equal(contentPanelModule.noticeImageUploadIssueMessage({ uploadedCount: 2, failedCount: 0 }), null);
});

test("공지 이미지 업로드 오류는 웹에서도 보이는 접근 가능한 화면 요소로 표시한다", () => {
  const contentPanelModule = loadContentPanelModule();
  const rendered = contentPanelModule.NoticeImageUploadFeedback({ message: "1장은 업로드하지 못했습니다." }) as {
    type: string;
    props: { accessibilityRole: string; children: string };
  };

  assert.equal(rendered.type, "Text");
  assert.equal(rendered.props.accessibilityRole, "alert");
  assert.equal(rendered.props.children, "1장은 업로드하지 못했습니다.");
  assert.equal(contentPanelModule.NoticeImageUploadFeedback({ message: null }), null);
});

test("공지 다중 업로드는 개별 사진의 100%를 전체 완료율처럼 표시하지 않는다", () => {
  const contentPanelModule = loadContentPanelModule();

  assert.equal(contentPanelModule.noticeUploadButtonLabel(null), "업로드 중");
  assert.equal(contentPanelModule.noticeUploadButtonLabel(40), "업로드 40%");
});

test("관리자 게시판 대상은 전체/null만 집계하고 loading, error, orphan, 빈 그룹을 구분한다", () => {
  const navigatorModule = loadNavigatorModule();
  const boards = [board(1, "notices"), board(2, "community")];
  assert.deepEqual(navigatorModule.adminBoardContentTarget(boards, "all", null, "success"), { status: "aggregate" });
  assert.deepEqual(navigatorModule.adminBoardContentTarget(boards, "notices", 1, "success"), { status: "board", board: boards[0] });
  assert.deepEqual(navigatorModule.adminBoardContentTarget(boards, "notices", null, "success"), { status: "missing", reason: "selection" });
  assert.deepEqual(navigatorModule.adminBoardContentTarget(boards, "notices", 999, "success"), { status: "missing", reason: "selection" });
  assert.deepEqual(navigatorModule.adminBoardContentTarget([], "notices", null, "success"), { status: "missing", reason: "empty" });
  assert.deepEqual(navigatorModule.adminBoardContentTarget([], "all", null, "pending"), { status: "loading" });
  assert.deepEqual(navigatorModule.adminBoardContentTarget([], "all", null, "error"), { status: "error" });
});

test("대시보드 바로가기 intent는 게시판 조회 성공 전 대기하고 성공 후 원래 slug로 해석한다", () => {
  const navigatorModule = loadNavigatorModule();
  const intent = { slug: "board-2", tab: "settings" };
  assert.deepEqual(navigatorModule.adminBoardNavigationIntentResolution(intent, [], "pending"), { status: "pending" });
  assert.deepEqual(navigatorModule.adminBoardNavigationIntentResolution(intent, [], "error"), { status: "error" });
  assert.deepEqual(navigatorModule.adminBoardNavigationIntentResolution(intent, [board(1, "notices"), board(2, "community")], "success"), {
    status: "resolved",
    destination: { scope: "community", boardId: 2, tab: "settings" },
  });
  assert.deepEqual(navigatorModule.adminBoardNavigationIntentResolution(intent, [board(1, "notices")], "success"), { status: "missing" });
});

test("게시판 조회 상태는 로딩·오류 재시도·선택 없음 안내를 접근 가능하게 표시한다", () => {
  const contentPanelModule = loadContentPanelModule();
  let retries = 0;
  const errorState = contentPanelModule.AdminBoardTargetQueryState({
    status: "error",
    onRetry: () => { retries += 1; },
  });
  const retryButton = renderedElements(errorState).find((element) => element.type === "Pressable");
  assert.ok(retryButton?.props?.onPress);
  retryButton.props.onPress();
  assert.equal(retries, 1);
  assert.equal(JSON.stringify(errorState).includes("게시판 목록을 불러오지 못했습니다"), true);
  assert.equal(JSON.stringify(contentPanelModule.AdminBoardTargetQueryState({ status: "loading", onRetry: () => undefined })).includes("게시판 목록을 불러오는 중"), true);
  assert.equal(JSON.stringify(contentPanelModule.AdminBoardTargetQueryState({ status: "missing", missingReason: "selection", onRetry: () => undefined })).includes("선택한 게시판을 찾을 수 없습니다"), true);
  assert.equal(JSON.stringify(contentPanelModule.AdminBoardTargetQueryState({ status: "missing", missingReason: "empty", onRetry: () => undefined })).includes("등록된 게시판이 없습니다"), true);
  assert.equal(contentPanelModule.AdminBoardTargetQueryState({ status: "aggregate", onRetry: () => undefined }), null);
  assert.equal(contentPanelModule.AdminBoardTargetQueryState({ status: "board", onRetry: () => undefined }), null);
});
