import assert from "node:assert/strict";
import test from "node:test";

import type { Board } from "../types";
import * as adminContentManagement from "../utils/adminContentManagement";
import {
  adminActivityCertificationBankAccount,
  adminDeferredEventGateInitialState,
  adminDeferredEventGateTransition,
  adminBoardCapability,
  adminBoardContentControl,
  adminBoardDestinationForLegacySection,
  adminBoardDestinationForSlug,
  adminBoardNavigationTransition,
  adminBoardsForScope,
  adminCalendarQueryEnabled,
  adminFaqQueryEnabled,
  adminScopeForBoard,
  adminContentBoards,
  nextAdminBoardSelection,
  nextAdminContentSelection,
} from "../utils/adminContentManagement";

type AdminPostListQueryParams = (input: {
  isDashboard: boolean;
  page: number;
  search: string;
  boardId?: number;
  mode: "all" | "notice" | "pinned";
}) => Record<string, unknown>;

type AdminPostPageForContext = (
  state: { contextKey: string; page: number },
  contextKey: string,
) => number;

type AdminPostPageAfterDelete = (input: {
  currentPage: number;
  currentItemCount: number;
}) => number;

type RunAdminPostDelete = (input: {
  postId: number;
  currentPage: number;
  currentItemCount: number;
  deletePost: (postId: number) => Promise<void>;
  afterDelete: () => Promise<void>;
}) => Promise<number>;

function board(overrides: Partial<Board> & Pick<Board, "id" | "name" | "slug" | "category" | "board_type">): Board {
  return {
    sort_order: overrides.id,
    allow_anonymous: false,
    read_permission: "public",
    write_permission: "user",
    ...overrides,
  };
}

const boards: Board[] = [
  board({ id: 20, name: "임원진 소개", slug: "gsa-executives", category: "gsa", board_type: "organization_intro" }),
  board({ id: 21, name: "기장단 소개", slug: "gsa-cohort-leaders", category: "gsa", board_type: "organization_intro" }),
  board({ id: 22, name: "역대 원우회", slug: "gsa-past-councils", category: "gsa", board_type: "organization_intro" }),
  board({ id: 12, name: "네트워킹 안내", slug: "networking-programs", category: "alumni", board_type: "post", sort_order: 40, write_permission: "admin" }),
  board({ id: 2, name: "학사 일정", slug: "academic-calendar", category: "notices", board_type: "calendar" }),
  board({ id: 8, name: "스터디 모집", slug: "study-recruit", category: "study", board_type: "post", sort_order: 30 }),
  board({ id: 1, name: "학사 공지", slug: "academic-notices", category: "notices", board_type: "notice", write_permission: "admin" }),
  board({ id: 5, name: "동아리 활동 인증", slug: "club-activity", category: "participation", board_type: "activity_certification", sort_order: 10 }),
  board({ id: 6, name: "동아리 홍보", slug: "club-promo", category: "club", board_type: "post", sort_order: 20, write_permission: "admin" }),
  board({ id: 11, name: "시험족보", slug: "exam-archive", category: "resources", board_type: "resource" }),
  board({ id: 10, name: "행사 사진첩", slug: "event-album", category: "community", board_type: "album" }),
  board({ id: 13, name: "원우회 활동내역", slug: "council-activity", category: "council", board_type: "activity_history", write_permission: "admin" }),
  board({ id: 14, name: "건의사항", slug: "suggestions", category: "council", board_type: "suggestion" }),
  board({ id: 15, name: "상조회", slug: "mutual-aid", category: "council", board_type: "mutual_aid" }),
  board({ id: 16, name: "건의사항 피드백", slug: "gsa-feedback", category: "gsa", board_type: "post", write_permission: "admin" }),
  board({ id: 17, name: "FAQ", slug: "gsa-faq", category: "gsa", board_type: "faq", write_permission: "admin" }),
];

const registryBoards: Board[] = [
  board({ id: 1, name: "전체 공지", slug: "all-notices", category: "notices", board_type: "notice" }),
  board({ id: 2, name: "학사 일정", slug: "academic-calendar", category: "notices", board_type: "calendar" }),
  board({ id: 3, name: "회계", slug: "accounting", category: "council", board_type: "external_link" }),
  board({ id: 4, name: "임원진 소개", slug: "gsa-executives", category: "gsa", board_type: "organization_intro" }),
  board({ id: 5, name: "FAQ", slug: "gsa-faq", category: "gsa", board_type: "faq" }),
  board({ id: 6, name: "로드맵", slug: "gsa-roadmap-benefits", category: "gsa", board_type: "guide" }),
  board({ id: 7, name: "알 수 없는 게시판", slug: "future-board", category: "future", board_type: "future" }),
];

const capabilityBoards: Board[] = [
  board({ id: 8, name: "강의 후기", slug: "lecture-reviews", category: "community", board_type: "post" }),
  board({ id: 9, name: "시험 족보", slug: "exam-archive", category: "resources", board_type: "resource" }),
  board({ id: 10, name: "네트워킹", slug: "networking-programs", category: "alumni", board_type: "post" }),
];

const allFixtureBoards = [...boards, ...registryBoards, ...capabilityBoards];
const boardBySlug = (slug: string): Board => {
  const found = allFixtureBoards.find((item) => item.slug === slug);
  assert.ok(found, `missing board fixture: ${slug}`);
  return found;
};

test("관리자 게시글 목록은 선택한 서버 페이지를 10개 단위로 요청한다", () => {
  const buildParams = (adminContentManagement as Record<string, unknown>)
    .adminPostListQueryParams as AdminPostListQueryParams | undefined;
  assert.equal(typeof buildParams, "function");
  assert.deepEqual(buildParams?.({
    isDashboard: false,
    page: 3,
    search: "  사진첩  ",
    boardId: 10,
    mode: "pinned",
  }), {
    page: 3,
    size: 10,
    q: "사진첩",
    board_id: 10,
    is_notice: undefined,
    is_pinned: true,
  });
});

test("관리자 게시글의 게시판·검색·필터 컨텍스트가 바뀌면 1페이지부터 조회한다", () => {
  const pageForContext = (adminContentManagement as Record<string, unknown>)
    .adminPostPageForContext as AdminPostPageForContext | undefined;
  assert.equal(typeof pageForContext, "function");
  assert.equal(pageForContext?.({ contextKey: "album::all::", page: 4 }, "album::all::"), 4);
  assert.equal(pageForContext?.({ contextKey: "album::all::", page: 4 }, "album::pinned::"), 1);
});

test("관리자 게시글의 마지막 행을 삭제하면 비어 버릴 현재 페이지 대신 이전 페이지로 이동한다", () => {
  const pageAfterDelete = (adminContentManagement as Record<string, unknown>)
    .adminPostPageAfterDelete as AdminPostPageAfterDelete | undefined;
  assert.equal(typeof pageAfterDelete, "function");
  assert.equal(pageAfterDelete?.({ currentPage: 3, currentItemCount: 1 }), 2);
  assert.equal(pageAfterDelete?.({ currentPage: 3, currentItemCount: 2 }), 3);
  assert.equal(pageAfterDelete?.({ currentPage: 1, currentItemCount: 1 }), 1);
});

test("관리자 게시글 삭제는 API 성공 후 목록을 갱신하고 보정된 페이지를 반환한다", async () => {
  const runDelete = (adminContentManagement as Record<string, unknown>)
    .runAdminPostDelete as RunAdminPostDelete | undefined;
  assert.equal(typeof runDelete, "function");
  const trace: string[] = [];
  const nextPage = await runDelete?.({
    postId: 42,
    currentPage: 3,
    currentItemCount: 1,
    deletePost: async (postId) => { trace.push(`delete:${postId}`); },
    afterDelete: async () => { trace.push("invalidate"); },
  });
  assert.deepEqual(trace, ["delete:42", "invalidate"]);
  assert.equal(nextPage, 2);
});

test("그룹은 표준 게시글이 없는 게시판까지 모두 포함한다", () => {
  assert.deepEqual(adminBoardsForScope(registryBoards, "notices").map((item) => item.slug), ["all-notices", "academic-calendar"]);
  assert.deepEqual(adminBoardsForScope(registryBoards, "council").map((item) => item.slug), ["accounting", "gsa-executives", "gsa-faq", "gsa-roadmap-benefits"]);
});

test("알 수 없는 category는 전체에만 표시한다", () => {
  assert.deepEqual(adminBoardsForScope(registryBoards, "all").map((item) => item.slug), [
    "all-notices", "academic-calendar", "accounting", "gsa-executives", "gsa-faq", "gsa-roadmap-benefits", "future-board",
  ]);
  assert.equal(adminBoardsForScope(registryBoards, "community").some((item) => item.slug === "future-board"), false);
});

test("게시판 유형은 기존 전용 편집기 capability로 연결된다", () => {
  assert.equal(adminBoardCapability(boardBySlug("academic-calendar")).kind, "calendar");
  assert.equal(adminBoardCapability(boardBySlug("accounting")).kind, "external-link");
  assert.equal(adminBoardCapability(boardBySlug("gsa-executives")).kind, "organization-intro");
  assert.equal(adminBoardCapability(boardBySlug("gsa-faq")).kind, "faq");
  assert.deepEqual(adminBoardCapability(boardBySlug("gsa-roadmap-benefits")), { kind: "guide", contentAvailable: false, canReplaceRepresentativeImage: false, lockedPolicies: [] });
});

test("모든 지원 게시판 유형은 literal capability를 제공한다", () => {
  assert.equal(adminBoardCapability().kind, "aggregate-posts");
  assert.equal(adminBoardCapability(boardBySlug("all-notices")).kind, "notice");
  assert.equal(adminBoardCapability(boardBySlug("lecture-reviews")).kind, "posts");
  assert.equal(adminBoardCapability(boards.find((item) => item.slug === "event-album")).kind, "album");
  assert.equal(adminBoardCapability(boardBySlug("exam-archive")).kind, "resource");
  assert.equal(adminBoardCapability(boards.find((item) => item.slug === "club-activity")).kind, "activity-certification");
  assert.equal(adminBoardCapability(boards.find((item) => item.slug === "council-activity")).kind, "activity-history");
  assert.equal(adminBoardCapability(boards.find((item) => item.slug === "suggestions")).kind, "suggestion");
  assert.equal(adminBoardCapability(boards.find((item) => item.slug === "mutual-aid")).kind, "mutual-aid");
});

test("커뮤니티 개인정보 정책은 잠긴 상태로 노출된다", () => {
  assert.deepEqual(adminBoardCapability(boardBySlug("lecture-reviews")).lockedPolicies.map((policy) => policy.key), ["forced-anonymous", "comments-enabled"]);
  assert.deepEqual(adminBoardCapability(boardBySlug("exam-archive")).lockedPolicies.map((policy) => policy.key), ["author-visible", "comments-enabled"]);
  assert.deepEqual(adminBoardCapability(boards.find((item) => item.slug === "suggestions")).lockedPolicies.map((policy) => policy.key), ["allow-anonymous"]);
  assert.deepEqual(adminBoardCapability(boards.find((item) => item.slug === "club-promo")).lockedPolicies.map((policy) => policy.key), ["admin-only-write"]);
  assert.deepEqual(adminBoardCapability(boardBySlug("networking-programs")).lockedPolicies.map((policy) => policy.key), ["admin-only-write"]);
});

test("대표 이미지 교체 capability는 동아리와 네트워킹에만 활성화된다", () => {
  for (const item of allFixtureBoards) {
    assert.equal(
      adminBoardCapability(item).canReplaceRepresentativeImage,
      item.slug === "club-promo" || item.slug === "networking-programs",
      item.slug,
    );
  }
});

test("category는 모든 화면에서 같은 관리자 scope로 계산한다", () => {
  assert.equal(adminScopeForBoard(boardBySlug("exam-archive")), "community");
  assert.equal(adminScopeForBoard(boardBySlug("networking-programs")), "participation");
  assert.equal(adminScopeForBoard(boardBySlug("gsa-executives")), "council");
});

test("전체는 모든 게시판 가상 선택을 유지하고 실제 그룹은 유효한 첫 게시판을 선택한다", () => {
  assert.equal(nextAdminBoardSelection(registryBoards, 99, "all"), null);
  assert.equal(nextAdminBoardSelection(registryBoards, null, "notices"), boardBySlug("all-notices").id);
  assert.equal(nextAdminBoardSelection([...registryBoards, ...capabilityBoards], boardBySlug("lecture-reviews").id, "community"), boardBySlug("lecture-reviews").id);
});

test("기존 관리자 section 링크는 모든 통합 게시판 목적지로 변환한다", () => {
  const cases = [
    ["notices", "all-notices"],
    ["executives", "gsa-executives"],
    ["cohortLeaders", "gsa-cohort-leaders"],
    ["pastCouncils", "gsa-past-councils"],
    ["suggestions", "suggestions"],
    ["mutualAid", "mutual-aid"],
    ["faqs", "gsa-faq"],
    ["events", "academic-calendar"],
  ] as const;

  for (const [section, slug] of cases) {
    const target = boardBySlug(slug);
    assert.deepEqual(adminBoardDestinationForLegacySection(section, allFixtureBoards), {
      scope: adminScopeForBoard(target),
      boardId: target.id,
      tab: "content",
    });
  }
});

test("전체 게시글과 기존 게시판 설정 링크는 통합 가상 선택과 정렬된 첫 게시판을 사용한다", () => {
  assert.deepEqual(adminBoardDestinationForLegacySection("posts", allFixtureBoards), {
    scope: "all",
    boardId: null,
    tab: "content",
  });
  assert.deepEqual(adminBoardDestinationForLegacySection("boards", registryBoards), {
    scope: "all",
    boardId: boardBySlug("all-notices").id,
    tab: "settings",
  });
});

test("레거시 대상 게시판이 없으면 전체 콘텐츠로 안전하게 대체하고 알 수 없는 section은 무시한다", () => {
  assert.deepEqual(adminBoardDestinationForLegacySection("events", []), {
    scope: "all",
    boardId: null,
    tab: "content",
  });
  assert.equal(adminBoardDestinationForLegacySection("dashboard", allFixtureBoards), null);
  assert.equal(adminBoardDestinationForLegacySection("unknown", allFixtureBoards), null);
});

test("raw 레거시 section 전이는 게시판 준비 후 링크별 한 번만 실행한다", () => {
  const transition = (
    rawSection: string,
    handledSection: string | null,
    boardsReady: boolean,
    rawLinkKey: string = rawSection,
  ) => adminBoardNavigationTransition(handledSection, {
    type: "legacy",
    rawSection,
    boards: allFixtureBoards,
    boardsReady,
    rawLinkKey,
  });
  assert.equal(transition("events", null, false), null);
  const events = transition("events", null, true);
  assert.deepEqual(events, {
    handledSection: "events",
    destination: {
      scope: "notices",
      boardId: boardBySlug("academic-calendar").id,
      tab: "content",
    },
  });
  assert.equal(transition("events", "events", true), null);
  assert.deepEqual(transition("events", "events:1", true, "events:2"), {
    handledSection: "events:2",
    destination: {
      scope: "notices",
      boardId: boardBySlug("academic-calendar").id,
      tab: "content",
    },
  });
  assert.deepEqual(transition("faqs", "events", true), {
    handledSection: "faqs",
    destination: {
      scope: "council",
      boardId: boardBySlug("gsa-faq").id,
      tab: "content",
    },
  });
  assert.deepEqual(transition("dashboard", "events", true), {
    handledSection: "dashboard",
    destination: null,
  });
  assert.deepEqual(transition("events", "dashboard", true), {
    handledSection: "events",
    destination: {
      scope: "notices",
      boardId: boardBySlug("academic-calendar").id,
      tab: "content",
    },
  });
});

test("명시적 이동은 대기 중인 레거시 링크를 먼저 승인해 늦은 게시판 응답이 목적지를 덮어쓰지 않는다", () => {
  const rawLinkKey = "notices::";
  assert.equal(adminBoardNavigationTransition(null, {
    type: "legacy",
    rawSection: "notices",
    rawLinkKey,
    boards: allFixtureBoards,
    boardsReady: false,
  }), null);

  for (const explicitDestination of [
    { type: "section", section: "banners" },
    { type: "managed", scope: "council", boardId: boardBySlug("gsa-executives").id, tab: "content" },
  ] as const) {
    const acknowledgement = adminBoardNavigationTransition(null, { type: "explicit", rawLinkKey });
    assert.deepEqual(acknowledgement, { handledSection: rawLinkKey, destination: null });
    let activeDestination: object = explicitDestination;
    const lateLegacy = adminBoardNavigationTransition(acknowledgement.handledSection, {
      type: "legacy",
      rawSection: "notices",
      rawLinkKey,
      boards: allFixtureBoards,
      boardsReady: true,
    });
    if (lateLegacy?.destination) activeDestination = lateLegacy.destination;
    assert.equal(lateLegacy, null);
    assert.deepEqual(activeDestination, explicitDestination);
  }
});

test("변경되지 않은 레거시 링크는 최초 한 번 변환되고 URL 변경 뒤 재방문하면 다시 변환된다", () => {
  const eventLink = "events::41";
  const initial = adminBoardNavigationTransition(null, {
    type: "legacy",
    rawSection: "events",
    rawLinkKey: eventLink,
    boards: allFixtureBoards,
    boardsReady: true,
  });
  assert.deepEqual(initial, {
    handledSection: eventLink,
    destination: {
      scope: "notices",
      boardId: boardBySlug("academic-calendar").id,
      tab: "content",
    },
  });
  assert.equal(adminBoardNavigationTransition(initial.handledSection, {
    type: "legacy",
    rawSection: "events",
    rawLinkKey: eventLink,
    boards: allFixtureBoards,
    boardsReady: true,
  }), null);

  const changed = adminBoardNavigationTransition(initial.handledSection, {
    type: "legacy",
    rawSection: "dashboard",
    rawLinkKey: "dashboard::",
    boards: allFixtureBoards,
    boardsReady: true,
  });
  assert.deepEqual(changed, { handledSection: "dashboard::", destination: null });
  assert.deepEqual(adminBoardNavigationTransition(changed.handledSection, {
    type: "legacy",
    rawSection: "events",
    rawLinkKey: eventLink,
    boards: allFixtureBoards,
    boardsReady: true,
  }), initial);
});

test("이벤트 딥링크는 최초 로드되고 명시적 이동 뒤 늦은 로드·누락 결과는 취소된다", () => {
  const eventLink = "events::41";
  const legacy = adminBoardNavigationTransition(null, {
    type: "legacy",
    rawSection: "events",
    rawLinkKey: eventLink,
    boards: allFixtureBoards,
    boardsReady: true,
  });
  assert.equal(legacy?.destination?.boardId, boardBySlug("academic-calendar").id);

  const initialState = adminDeferredEventGateInitialState(eventLink);
  const initialLoad = adminDeferredEventGateTransition(initialState, { type: "apply", rawLinkKey: eventLink });
  assert.equal(initialLoad.shouldApply, true);

  const cancelledForBanners = adminDeferredEventGateTransition(initialState, { type: "cancel", rawLinkKey: eventLink });
  assert.equal(adminDeferredEventGateTransition(cancelledForBanners.state, {
    type: "apply",
    rawLinkKey: eventLink,
  }).shouldApply, false);

  const cancelledForManagedShortcut = adminDeferredEventGateTransition(initialState, { type: "cancel", rawLinkKey: eventLink });
  assert.equal(adminDeferredEventGateTransition(cancelledForManagedShortcut.state, {
    type: "apply",
    rawLinkKey: eventLink,
  }).shouldApply, false);
});

test("이벤트 URL 발생 회차는 다른 raw key를 거친 뒤 같은 문자열로 재방문하면 새로 허용된다", () => {
  const eventLink = "events::41";
  const cancelled = adminDeferredEventGateTransition(
    adminDeferredEventGateInitialState(eventLink),
    { type: "cancel", rawLinkKey: eventLink },
  );
  const away = adminDeferredEventGateTransition(cancelled.state, { type: "sync", rawLinkKey: "banners::" });
  const revisited = adminDeferredEventGateTransition(away.state, { type: "sync", rawLinkKey: eventLink });
  assert.equal(revisited.state.occurrence, cancelled.state.occurrence + 2);
  assert.equal(adminDeferredEventGateTransition(revisited.state, {
    type: "apply",
    rawLinkKey: eventLink,
  }).shouldApply, true);
});

test("대시보드 게시판 바로가기는 실제 slug와 탭을 통합 목적지로 계산한다", () => {
  assert.deepEqual(adminBoardDestinationForSlug("club-promo", allFixtureBoards), {
    scope: "participation",
    boardId: boardBySlug("club-promo").id,
    tab: "content",
  });
  assert.deepEqual(adminBoardDestinationForSlug("gsa-executives", allFixtureBoards, "settings"), {
    scope: "council",
    boardId: boardBySlug("gsa-executives").id,
    tab: "settings",
  });
  assert.deepEqual(adminBoardDestinationForSlug("missing", allFixtureBoards, "settings"), {
    scope: "all",
    boardId: null,
    tab: "content",
  });
});

test("FAQ와 일정 쿼리는 대시보드 집계와 해당 통합 콘텐츠에서만 활성화된다", () => {
  assert.equal(adminFaqQueryEnabled("dashboard", false, "aggregate-posts"), true);
  assert.equal(adminFaqQueryEnabled("accounts", false, "faq"), false);
  assert.equal(adminFaqQueryEnabled("boardManagement", true, "faq"), true);
  assert.equal(adminFaqQueryEnabled("boardManagement", true, "calendar"), false);

  assert.equal(adminCalendarQueryEnabled("dashboard", false, false, "aggregate-posts"), true);
  assert.equal(adminCalendarQueryEnabled("accounts", false, false, "calendar"), false);
  assert.equal(adminCalendarQueryEnabled("boardManagement", false, true, "calendar"), true);
  assert.equal(adminCalendarQueryEnabled("boardManagement", false, true, "faq"), false);
  assert.equal(adminCalendarQueryEnabled("accounts", true, false, "posts"), true);
});

test("참여활동 탭은 참여·동아리·스터디·동문 게시글 게시판만 정렬해 보여준다", () => {
  assert.deepEqual(
    adminContentBoards(boards, "participation").map((item) => item.slug),
    ["club-activity", "club-promo", "study-recruit", "networking-programs"],
  );
});

test("표준 게시글이 아닌 관리자 콘텐츠는 게시글 탭에서 제외한다", () => {
  assert.deepEqual(
    adminContentBoards(boards, "council").map((item) => item.slug),
    ["council-activity", "suggestions", "mutual-aid", "gsa-feedback"],
  );
  assert.equal(adminContentBoards(boards, "all").some((item) => item.slug === "gsa-executives"), false);
  assert.equal(adminContentBoards(boards, "all").some((item) => item.slug === "gsa-faq"), false);
  assert.equal(adminContentBoards(boards, "all").some((item) => item.slug === "academic-calendar"), false);
});

test("게시판 종류에 맞는 관리자 전용 제어를 선택한다", () => {
  assert.deepEqual(adminBoardContentControl(boards.find((item) => item.slug === "academic-notices")), {
    kind: "notice",
    description: "공지 분류, 이미지, 상단 고정과 원우회 활동 연동을 공지사항 관리에서 설정합니다.",
    createLabel: null,
    canReplaceRepresentativeImage: false,
  });
  assert.deepEqual(adminBoardContentControl(boards.find((item) => item.slug === "club-promo")), {
    kind: "participation-guide",
    description: "대표 이미지, 동아리 소개와 가입 신청 링크를 관리합니다.",
    createLabel: "동아리 안내 등록",
    canReplaceRepresentativeImage: true,
  });
  assert.deepEqual(adminBoardContentControl(boards.find((item) => item.slug === "networking-programs")), {
    kind: "participation-guide",
    description: "대표 이미지, 네트워킹 소개와 참가 신청 링크를 관리합니다.",
    createLabel: "네트워킹 안내 등록",
    canReplaceRepresentativeImage: true,
  });
  assert.equal(adminBoardContentControl(boards.find((item) => item.slug === "suggestions")).kind, "suggestion");
  assert.equal(adminBoardContentControl(boards.find((item) => item.slug === "mutual-aid")).kind, "mutual-aid");
  for (const item of boards) {
    const control = adminBoardContentControl(item);
    assert.equal("dedicatedSection" in control, false);
    assert.equal("dedicatedLabel" in control, false);
  }
  assert.equal(adminBoardContentControl(boards.find((item) => item.slug === "exam-archive")).kind, "resource");
  assert.equal(adminBoardContentControl(boards.find((item) => item.slug === "event-album")).kind, "album");
});

test("관리자는 사용자 쓰기 권한의 행사 사진첩에도 새 게시물을 등록할 수 있다", () => {
  assert.equal(
    adminBoardContentControl(boards.find((item) => item.slug === "event-album")).createLabel,
    "행사 사진첩 등록",
  );
});

test("관리자 활동인증 목록은 비어 있지 않은 계좌번호를 표시한다", () => {
  assert.equal(
    adminActivityCertificationBankAccount({
      allowDisplay: true,
      boardType: "activity_certification",
      metadata: { bank_account: "  서강은행 123-456  " },
    }),
    "서강은행 123-456",
  );
});

test("계좌번호는 활동인증 관리 목록 외에는 표시하지 않는다", () => {
  assert.equal(adminActivityCertificationBankAccount({
    allowDisplay: false,
    boardType: "activity_certification",
    metadata: { bank_account: "서강은행 123-456" },
  }), null);
  assert.equal(adminActivityCertificationBankAccount({
    allowDisplay: true,
    boardType: "post",
    metadata: { bank_account: "서강은행 123-456" },
  }), null);
  assert.equal(adminActivityCertificationBankAccount({
    allowDisplay: true,
    boardType: "activity_certification",
    metadata: { bank_account: "   " },
  }), null);
});

test("그룹 전환은 유효한 현재 게시판을 유지하고 아니면 첫 게시판을 선택한다", () => {
  assert.equal(nextAdminContentSelection(boards, 6, "participation"), 6);
  assert.equal(nextAdminContentSelection(boards, 1, "participation"), 5);
  assert.equal(nextAdminContentSelection(boards, 6, "all"), null);
  assert.equal(nextAdminContentSelection([], 6, "participation"), null);
});
