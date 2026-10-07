import assert from "node:assert/strict";
import test from "node:test";

import * as appRoutes from "../utils/appRoutes";
import {
  COMMUNITY_TAB_ROUTE,
  COUNCIL_TAB_ROUTE,
  HOME_TAB_ROUTE,
  NOTICES_TAB_ROUTE,
  PARTICIPATION_TAB_ROUTE,
  boardParentRoute,
  navigateFromPostDetail,
  postCreateBackDecision,
  postDetailBackDecision,
  postCreateCompletionRoute,
  postCreateRoute,
  postCreateRouteFromBoardList,
  postDetailRoute,
  postDetailReturnRoute,
  routeBoardId,
} from "../utils/appRoutes";

type PostCreateFormInstanceKey = (params: {
  boardId?: unknown;
  postId?: unknown;
  category?: unknown;
}) => string;

type PostEditCompletionDecision =
  | { action: "back" }
  | { action: "replace"; route: string };

type ParticipationGroupKey = "club" | "study" | "networking";

function getPostCreateFormInstanceKey() {
  const helper = Reflect.get(appRoutes, "postCreateFormInstanceKey");
  assert.equal(typeof helper, "function", "글쓰기 라우트별 폼 인스턴스 키 생성기가 필요합니다");
  return helper as PostCreateFormInstanceKey;
}

function getActivityPostEditRouteFromDetail() {
  const helper = Reflect.get(appRoutes, "activityPostEditRouteFromDetail");
  assert.equal(typeof helper, "function", "활동인증 상세 전용 수정 경로 생성기가 필요합니다");
  return helper as (boardId: number, postId: number, fromBoardId?: unknown, returnTo?: unknown) => string;
}

function getPostEditRouteFromDetail() {
  const helper = Reflect.get(appRoutes, "postEditRouteFromDetail");
  assert.equal(typeof helper, "function", "일반 상세 전용 수정 경로 생성기가 필요합니다");
  return helper as (postId: number, fromBoardId?: unknown, returnTo?: unknown) => string;
}

function getMutualAidPostEditRouteFromDetail() {
  const helper = Reflect.get(appRoutes, "mutualAidPostEditRouteFromDetail");
  assert.equal(typeof helper, "function", "상조회 상세 전용 수정 경로 생성기가 필요합니다");
  return helper as (boardId: number, postId: number, fromBoardId?: unknown, returnTo?: unknown) => string;
}

function getPostEditRouteForPostDetail() {
  const helper = Reflect.get(appRoutes, "postEditRouteForPostDetail");
  assert.equal(typeof helper, "function", "상세 게시글의 회원·관리자 수정 경로 판정기가 필요합니다");
  return helper as (
    board: { board_type: string; write_permission: string },
    boardId: number,
    postId: number,
    fromBoardId?: unknown,
    returnTo?: unknown,
  ) => string;
}

function getPostEditCompletionDecision() {
  const helper = Reflect.get(appRoutes, "postEditCompletionDecision");
  assert.equal(typeof helper, "function", "게시글 수정 완료 복귀 판정기가 필요합니다");
  return helper as (
    boardType: string | undefined,
    editOrigin: unknown,
    canGoBack: boolean,
    postId: number,
    fromBoardId?: unknown,
    returnTo?: unknown,
  ) => PostEditCompletionDecision;
}

function getNavigateAfterPostEdit() {
  const helper = Reflect.get(appRoutes, "navigateAfterPostEdit");
  assert.equal(typeof helper, "function", "수정 완료 복귀 실행기가 필요합니다");
  return helper as (
    decision: PostEditCompletionDecision,
    navigator: {
      back: () => void;
      replace: (route: string) => void;
    },
  ) => void;
}

function getPostCreateFormBackDecision() {
  const helper = Reflect.get(appRoutes, "postCreateFormBackDecision");
  assert.equal(typeof helper, "function", "작성·수정 화면 전용 뒤로가기 판정기가 필요합니다");
  return helper as (params: {
    boardType?: string;
    editOrigin?: unknown;
    postId?: unknown;
    returnTo?: unknown;
    canGoBack: boolean;
    boardId: number;
    fromBoardId?: unknown;
  }) =>
    | { action: "back" }
    | { action: "navigate"; route: string }
    | { action: "replace"; route: string };
}

function getParticipationGroupDefaultSlug() {
  const helper = Reflect.get(appRoutes, "participationGroupDefaultSlug");
  assert.equal(typeof helper, "function", "참여활동 그룹별 첫 화면 경로 생성기가 필요합니다");
  return helper as (group: ParticipationGroupKey) => string;
}

function getHandleNestedBoardHardwareBack() {
  const helper = Reflect.get(appRoutes, "handleNestedBoardHardwareBack");
  assert.equal(typeof helper, "function", "중첩 게시판의 Android 뒤로가기 실행기가 필요합니다");
  return helper as (childBack: (() => void) | null, exitBoard: () => void) => boolean;
}

test("전공 커뮤니티 게시판의 상위 경로는 숨겨진 전체 보드가 아니라 홈이다", () => {
  const route = boardParentRoute({ slug: "community-major", category: "community", board_type: "post" });
  assert.equal(route, HOME_TAB_ROUTE);
  assert.notEqual(route, "/(tabs)/boards");
});

test("행사 사진첩과 자료 게시판은 커뮤니티 탭으로 복귀한다", () => {
  assert.equal(boardParentRoute({ slug: "event-album", category: "community", board_type: "album" }), COMMUNITY_TAB_ROUTE);
  assert.equal(boardParentRoute({ slug: "lecture-reviews", category: "resources", board_type: "resource" }), COMMUNITY_TAB_ROUTE);
});

test("알 수 없는 게시판도 전체 보드 대신 홈으로 안전하게 복귀한다", () => {
  assert.equal(boardParentRoute({ slug: "custom-board", category: "custom", board_type: "post" }), HOME_TAB_ROUTE);
});

test("게시판 목록에서 연 상세 글에는 원래 게시판 ID를 기록한다", () => {
  assert.equal(postDetailRoute(91, 16), "/board/post/91?fromBoardId=16");
  assert.equal(
    postDetailRoute(91, 16, PARTICIPATION_TAB_ROUTE),
    "/board/post/91?fromBoardId=16&returnTo=%2F(tabs)%2Fparticipation",
  );
});

test("활동 인증 작성 완료 상세는 참여활동 복귀 정보를 보존한다", () => {
  assert.equal(
    postCreateCompletionRoute("activity_certification", 170, 12),
    "/board/post/170?fromBoardId=12&returnTo=%2F(tabs)%2Fparticipation",
  );
});

test("자료공유 작성 완료 상세는 출발 게시판과 커뮤니티 복귀 정보를 보존한다", () => {
  const completionRoute = postCreateCompletionRoute as unknown as (
    boardType: string | undefined,
    createdPostId: number,
    boardId: number,
    returnTo?: unknown,
  ) => string;

  assert.equal(
    completionRoute("resource", 844, 8, COMMUNITY_TAB_ROUTE),
    "/board/post/844?fromBoardId=8&returnTo=%2F(tabs)%2Fcommunity",
  );
});

test("상조회와 건의 작성 완료는 기존 게시판 복귀 경로를 유지한다", () => {
  assert.equal(postCreateCompletionRoute("mutual_aid", 170, 12), "/board/12");
  assert.equal(postCreateCompletionRoute("suggestion", 170, 12), "/board/12");
});

// 탭마다 스택이 따로라 아래 화면이 곧 들어온 화면이다. 그래서 pop을 먼저 하고,
// 출발지(returnTo)는 아래 화면이 없을 때(웹 새로고침, 직접 링크)만 쓴다.
test("자료공유 글쓰기는 출발지를 기록하고, 아래 화면이 없을 때만 커뮤니티로 복귀한다", () => {
  assert.equal(
    postCreateRouteFromBoardList(7, "시험족보", true, false, COMMUNITY_TAB_ROUTE),
    "/board/post/create?boardId=7&category=%EC%8B%9C%ED%97%98%EC%A1%B1%EB%B3%B4&returnTo=%2F(tabs)%2Fcommunity",
  );
  assert.deepEqual(postCreateBackDecision(COMMUNITY_TAB_ROUTE, true, 7), { action: "back" });
  assert.deepEqual(
    postCreateBackDecision(COMMUNITY_TAB_ROUTE, false, 7),
    { action: "navigate", route: COMMUNITY_TAB_ROUTE },
  );
});

test("스터디 모집 글쓰기는 출발지를 기록하고, 아래 화면이 없을 때만 참여활동으로 복귀한다", () => {
  assert.equal(
    postCreateRouteFromBoardList(25, "모집", true, false, PARTICIPATION_TAB_ROUTE),
    "/board/post/create?boardId=25&category=%EB%AA%A8%EC%A7%91&returnTo=%2F(tabs)%2Fparticipation",
  );
  assert.deepEqual(postCreateBackDecision(PARTICIPATION_TAB_ROUTE, true, 25), { action: "back" });
  assert.deepEqual(
    postCreateBackDecision(PARTICIPATION_TAB_ROUTE, false, 25),
    { action: "navigate", route: PARTICIPATION_TAB_ROUTE },
  );
});

test("자료공유에서 스터디로 이동하면 각 게시판의 글쓰기 폼을 새로 사용한다", () => {
  const formInstanceKey = getPostCreateFormInstanceKey();
  const resourceForm = formInstanceKey({ boardId: "7", category: "시험족보" });
  const studyForm = formInstanceKey({ boardId: "25", category: "모집" });

  assert.notEqual(resourceForm, studyForm);
  assert.equal(resourceForm, '[7,null,"시험족보"]');
  assert.equal(studyForm, '[25,null,"모집"]');
});

test("스터디에서 자료공유로 돌아가도 이전 글쓰기 상태를 재사용하지 않는다", () => {
  const formInstanceKey = getPostCreateFormInstanceKey();
  const studyForm = formInstanceKey({ boardId: ["25"], category: ["모집"] });
  const resourceForm = formInstanceKey({ boardId: ["7"], category: ["시험족보"] });

  assert.notEqual(studyForm, resourceForm);
  assert.equal(studyForm, '[25,null,"모집"]');
  assert.equal(resourceForm, '[7,null,"시험족보"]');
});

test("같은 게시판에서도 작성·수정·카테고리별 폼 인스턴스를 구분한다", () => {
  const formInstanceKey = getPostCreateFormInstanceKey();
  const createRecruit = formInstanceKey({ boardId: "25", category: "모집" });
  const editRecruit = formInstanceKey({ boardId: "25", postId: "204", category: "모집" });
  const createReview = formInstanceKey({ boardId: "25", category: "후기" });

  assert.equal(new Set([createRecruit, editRecruit, createReview]).size, 3);
  assert.equal(formInstanceKey({ boardId: "25", category: "모집" }), createRecruit);
});

test("스터디와 동아리 활동인증 상세의 수정 경로는 상세 출발 조건을 기록한다", () => {
  const editRoute = getActivityPostEditRouteFromDetail();
  assert.equal(
    editRoute(10, 204),
    "/board/post/create?boardId=10&postId=204&editOrigin=activity-post-detail",
  );
  assert.equal(
    editRoute(11, 205),
    "/board/post/create?boardId=11&postId=205&editOrigin=activity-post-detail",
  );
});

test("활동인증에서 참여활동 그룹을 바꾸면 각 그룹의 첫 화면으로 이동한다", () => {
  const defaultSlug = getParticipationGroupDefaultSlug();

  assert.equal(defaultSlug("club"), "club-promo");
  assert.equal(defaultSlug("study"), "study-recruit");
  assert.equal(defaultSlug("networking"), "networking-programs");
});

test("활동인증 상세 수정 경로는 원래 목록 복귀 정보를 안전하게 전달한다", () => {
  const editRoute = getActivityPostEditRouteFromDetail();

  assert.equal(
    editRoute(13, 205, "13", PARTICIPATION_TAB_ROUTE),
    "/board/post/create?boardId=13&postId=205&editOrigin=activity-post-detail&fromBoardId=13&returnTo=%2F(tabs)%2Fparticipation",
  );
  assert.equal(
    editRoute(13, 205, "13", "https://example.com"),
    "/board/post/create?boardId=13&postId=205&editOrigin=activity-post-detail&fromBoardId=13",
  );
});

test("자료글과 상조회 상세 수정 경로는 상세 출발 조건과 목록 복귀 정보를 전달한다", () => {
  const postEditRoute = getPostEditRouteFromDetail();
  const mutualAidEditRoute = getMutualAidPostEditRouteFromDetail();

  assert.equal(
    postEditRoute(302, "8", COMMUNITY_TAB_ROUTE),
    "/board/post/edit/302?editOrigin=post-detail&fromBoardId=8&returnTo=%2F(tabs)%2Fcommunity",
  );
  assert.equal(
    mutualAidEditRoute(18, 301, "18", "/(tabs)/council"),
    "/board/post/create?boardId=18&postId=301&editOrigin=post-detail&fromBoardId=18&returnTo=%2F(tabs)%2Fcouncil",
  );
  assert.equal(postEditRoute(302, "bad", "https://example.com"), "/board/post/edit/302?editOrigin=post-detail");
});

test("회원 작성 게시글은 종류에 맞는 수정 화면으로 이동하면서 원래 목록을 보존한다", () => {
  const editRoute = getPostEditRouteForPostDetail();

  assert.equal(
    editRoute({ board_type: "activity_certification", write_permission: "user" }, 10, 204, "10", PARTICIPATION_TAB_ROUTE),
    "/board/post/create?boardId=10&postId=204&editOrigin=activity-post-detail&fromBoardId=10&returnTo=%2F(tabs)%2Fparticipation",
  );
  assert.equal(
    editRoute({ board_type: "mutual_aid", write_permission: "user" }, 18, 301, "18", COUNCIL_TAB_ROUTE),
    "/board/post/create?boardId=18&postId=301&editOrigin=post-detail&fromBoardId=18&returnTo=%2F(tabs)%2Fcouncil",
  );
  assert.equal(
    editRoute({ board_type: "post", write_permission: "user" }, 25, 205, "25", PARTICIPATION_TAB_ROUTE),
    "/board/post/edit/205?editOrigin=post-detail&fromBoardId=25&returnTo=%2F(tabs)%2Fparticipation",
  );
  assert.equal(
    editRoute({ board_type: "suggestion", write_permission: "user" }, 17, 302, "17", COUNCIL_TAB_ROUTE),
    "/board/post/edit/302?editOrigin=post-detail&fromBoardId=17&returnTo=%2F(tabs)%2Fcouncil",
  );
});

test("관리자 작성 게시판과 사진첩은 회원 목록 복귀 규칙을 적용하지 않는다", () => {
  const editRoute = getPostEditRouteForPostDetail();

  assert.equal(
    editRoute({ board_type: "post", write_permission: "admin" }, 22, 401, "22", PARTICIPATION_TAB_ROUTE),
    "/board/post/edit/401",
  );
  assert.equal(
    editRoute({ board_type: "album", write_permission: "user" }, 6, 402, "6", COMMUNITY_TAB_ROUTE),
    "/board/post/edit/402",
  );
});

test("상세에서 수정한 활동인증은 저장 후 기존 상세 한 장만 남긴다", () => {
  const completionDecision = getPostEditCompletionDecision();
  assert.deepEqual(
    completionDecision("activity_certification", "activity-post-detail", true, 204, "10", PARTICIPATION_TAB_ROUTE),
    { action: "back" },
  );
  assert.deepEqual(
    completionDecision("activity_certification", ["activity-post-detail"], true, 205, "11", PARTICIPATION_TAB_ROUTE),
    { action: "back" },
  );
});

test("활동인증 게시판 조회가 늦어도 상세에서 시작한 수정은 기존 상세로 돌아간다", () => {
  const completionDecision = getPostEditCompletionDecision();

  assert.deepEqual(
    completionDecision(undefined, "activity-post-detail", true, 205, "13", PARTICIPATION_TAB_ROUTE),
    { action: "back" },
  );
});

test("활동인증 수정 화면을 새로 열어도 원래 목록 정보가 있는 상세로 교체한다", () => {
  const completionDecision = getPostEditCompletionDecision();

  assert.deepEqual(
    completionDecision(undefined, "activity-post-detail", false, 205, "13", PARTICIPATION_TAB_ROUTE),
    {
      action: "replace",
      route: "/board/post/205?fromBoardId=13&returnTo=%2F(tabs)%2Fparticipation",
    },
  );
});

test("활동인증 상세에서 연 수정 화면의 뒤로가기는 returnTo보다 기존 상세를 우선한다", () => {
  const backDecision = getPostCreateFormBackDecision();

  assert.deepEqual(
    backDecision({
      boardType: undefined,
      editOrigin: "activity-post-detail",
      postId: "205",
      returnTo: PARTICIPATION_TAB_ROUTE,
      canGoBack: true,
      boardId: 13,
      fromBoardId: "13",
    }),
    { action: "back" },
  );
});

test("일반 글쓰기와 일반 수정 화면은 기존 공통 뒤로가기를 유지한다", () => {
  const backDecision = getPostCreateFormBackDecision();

  assert.deepEqual(
    backDecision({
      returnTo: COMMUNITY_TAB_ROUTE,
      canGoBack: true,
      boardId: 7,
    }),
    { action: "back" },
  );
  assert.deepEqual(
    backDecision({
      returnTo: COMMUNITY_TAB_ROUTE,
      canGoBack: false,
      boardId: 7,
    }),
    { action: "navigate", route: COMMUNITY_TAB_ROUTE },
  );
  assert.deepEqual(
    backDecision({
      boardType: "mutual_aid",
      postId: "301",
      canGoBack: true,
      boardId: 18,
    }),
    { action: "back" },
  );
});

test("직접 진입한 활동인증 수정은 관계없는 탐색 기록으로 돌아가지 않는다", () => {
  const completionDecision = getPostEditCompletionDecision();
  assert.deepEqual(
    completionDecision("activity_certification", undefined, true, 204),
    { action: "replace", route: "/board/post/204" },
  );
  assert.deepEqual(
    completionDecision("activity_certification", "activity-post-detail", false, 204),
    { action: "replace", route: "/board/post/204" },
  );
});

test("상세에서 시작한 모든 회원 작성 글은 저장 후 기존 상세로 돌아간다", () => {
  const completionDecision = getPostEditCompletionDecision();
  assert.deepEqual(
    completionDecision("mutual_aid", "post-detail", true, 301, "18", COUNCIL_TAB_ROUTE),
    { action: "back" },
  );
  assert.deepEqual(
    completionDecision("resource", "post-detail", true, 302, "9", COMMUNITY_TAB_ROUTE),
    { action: "back" },
  );
  assert.deepEqual(
    completionDecision("post", "post-detail", true, 303, "25", PARTICIPATION_TAB_ROUTE),
    { action: "back" },
  );
});

test("상세 수정 완료는 진입 목록 종류와 무관하게 편집 화면만 제거한다", () => {
  const completionDecision = getPostEditCompletionDecision();
  const listRoutes = [
    HOME_TAB_ROUTE,
    NOTICES_TAB_ROUTE,
    COMMUNITY_TAB_ROUTE,
    PARTICIPATION_TAB_ROUTE,
    COUNCIL_TAB_ROUTE,
    "/(tabs)/search",
    "/(tabs)/search?scope=resources",
    "/(tabs)/notifications",
    "/(tabs)/settings/activity",
  ];

  for (const route of listRoutes) {
    assert.deepEqual(
      completionDecision("post", "post-detail", true, 303, "25", route),
      { action: "back" },
    );
  }
});

test("같은 보드 스택에서 수정해도 저장 후 목록까지 자르지 않고 상세를 남긴다", () => {
  const completionDecision = getPostEditCompletionDecision();

  assert.deepEqual(
    completionDecision("post", "post-detail", true, 303, "25", "/board/25"),
    { action: "back" },
  );
});

test("수정 완료 복귀 실행기는 기존 상세 복원과 직접 진입 상세 대체를 구분한다", () => {
  const navigateAfterPostEdit = getNavigateAfterPostEdit();
  const calls: string[] = [];
  const navigator = {
    back: () => calls.push("back"),
    replace: (route: string) => calls.push(`replace:${route}`),
  };

  navigateAfterPostEdit({ action: "back" }, navigator);
  assert.deepEqual(calls, ["back"]);

  calls.length = 0;
  navigateAfterPostEdit({ action: "replace", route: "/board/post/204" }, navigator);
  assert.deepEqual(calls, ["replace:/board/post/204"]);
});

test("직접 진입한 상조회와 자료글 수정은 관계없는 탐색 기록 대신 상세로 교체한다", () => {
  const completionDecision = getPostEditCompletionDecision();
  assert.deepEqual(
    completionDecision("mutual_aid", undefined, true, 301, "18", "/(tabs)/council"),
    { action: "replace", route: "/board/post/301?fromBoardId=18&returnTo=%2F(tabs)%2Fcouncil" },
  );
  assert.deepEqual(
    completionDecision("resource", "post-detail", false, 302, "9", COMMUNITY_TAB_ROUTE),
    { action: "replace", route: "/board/post/302?fromBoardId=9&returnTo=%2F(tabs)%2Fcommunity" },
  );
});

test("상조회 상세에서 연 수정 화면의 닫기도 기존 상세를 우선한다", () => {
  const backDecision = getPostCreateFormBackDecision();

  assert.deepEqual(
    backDecision({
      boardType: "mutual_aid",
      editOrigin: "post-detail",
      postId: "301",
      returnTo: "/(tabs)/council",
      canGoBack: true,
      boardId: 18,
      fromBoardId: "18",
    }),
    { action: "back" },
  );
  assert.deepEqual(
    backDecision({
      boardType: "mutual_aid",
      editOrigin: "post-detail",
      postId: "301",
      returnTo: "/(tabs)/council",
      canGoBack: false,
      boardId: 18,
      fromBoardId: "18",
    }),
    { action: "replace", route: "/board/post/301?fromBoardId=18&returnTo=%2F(tabs)%2Fcouncil" },
  );
});

test("일반 자료글 상세 수정의 닫기는 상세를 우선하고 직접 진입은 문맥이 보존된 상세로 교체한다", () => {
  const backDecision = getPostCreateFormBackDecision();

  assert.deepEqual(
    backDecision({
      boardType: "resource",
      editOrigin: "post-detail",
      postId: "848",
      returnTo: COMMUNITY_TAB_ROUTE,
      canGoBack: true,
      boardId: 11,
      fromBoardId: "11",
    }),
    { action: "back" },
  );
  assert.deepEqual(
    backDecision({
      boardType: "resource",
      editOrigin: "post-detail",
      postId: "848",
      returnTo: COMMUNITY_TAB_ROUTE,
      canGoBack: false,
      boardId: 11,
      fromBoardId: "11",
    }),
    { action: "replace", route: "/board/post/848?fromBoardId=11&returnTo=%2F(tabs)%2Fcommunity" },
  );
  assert.deepEqual(
    backDecision({
      boardType: "notice",
      postId: "848",
      canGoBack: true,
      boardId: 1,
    }),
    { action: "back" },
  );
});

test("상조회 등 독립 게시판 글쓰기는 기존 뒤로가기와 직접 진입 대체 경로를 유지한다", () => {
  assert.equal(
    postCreateRouteFromBoardList(18, "", false, false, "/board/18"),
    "/board/post/create?boardId=18&category=",
  );
  assert.deepEqual(postCreateBackDecision(undefined, true, 18), { action: "back" });
  assert.deepEqual(postCreateBackDecision(undefined, false, 18), { action: "replace", route: "/board/18" });
});

test("활동 인증 글쓰기도 다른 회원 작성 글처럼 원래 참여활동 목록을 보존한다", () => {
  assert.equal(
    postCreateRouteFromBoardList(12, "활동 인증", true, true, PARTICIPATION_TAB_ROUTE),
    postCreateRoute(12, "활동 인증", PARTICIPATION_TAB_ROUTE),
  );
});

test("글쓰기 복귀 경로로 외부 주소나 상세 화면을 허용하지 않는다", () => {
  assert.deepEqual(postCreateBackDecision("https://example.com", false, 18), { action: "replace", route: "/board/18" });
  assert.deepEqual(postCreateBackDecision("/board/post/645", true, 18), { action: "back" });
});

test("상세 복귀 경로는 앱 내부 목록 화면만 허용한다", () => {
  assert.equal(postDetailReturnRoute(PARTICIPATION_TAB_ROUTE), PARTICIPATION_TAB_ROUTE);
  assert.equal(postDetailReturnRoute("/board/28"), "/board/28");
  assert.equal(postDetailReturnRoute("https://example.com"), null);
  assert.equal(postDetailReturnRoute("/board/post/645"), null);
});

test("명시된 목록 화면은 아래 화면이 없을 때 그 탭으로 복귀하는 대비책이다", () => {
  const board = { slug: "study-activity", category: "study", board_type: "activity_certification" };
  assert.deepEqual(postDetailBackDecision(board, true, "28", PARTICIPATION_TAB_ROUTE), { action: "back" });
  assert.deepEqual(
    postDetailBackDecision(board, false, "28", PARTICIPATION_TAB_ROUTE),
    { action: "navigate", route: PARTICIPATION_TAB_ROUTE },
  );
});

test("탐색 기록이 있으면 게시판 종류와 무관하게 실제 이전 목록으로 복귀한다", () => {
  for (const board of [
    { slug: "academic-notices", category: "notice", board_type: "notice" },
    { slug: "exam-archive", category: "resources", board_type: "resource" },
    { slug: "study-activity", category: "study", board_type: "activity_certification" },
  ]) {
    assert.deepEqual(postDetailBackDecision(board, true, "13"), { action: "back" });
  }
});

test("탐색 기록이 없으면 출발 게시판 목록으로 복귀한다", () => {
  assert.deepEqual(
    postDetailBackDecision(
      { slug: "study-activity", category: "study", board_type: "activity_certification" },
      false,
      "13",
    ),
    { action: "replace", route: "/board/13" },
  );
});

test("잘못된 출발 게시판은 제품 상위 경로로 대체한다", () => {
  assert.deepEqual(
    postDetailBackDecision(
      { slug: "academic-notices", category: "notice", board_type: "notice" },
      false,
      "invalid",
    ),
    { action: "replace", route: NOTICES_TAB_ROUTE },
  );
});

test("일반 상세 글은 탐색 기록이 있으면 기존 화면으로 복귀한다", () => {
  assert.deepEqual(
    postDetailBackDecision({ slug: "academic-notices", category: "notice", board_type: "notice" }, true),
    { action: "back" }
  );
});

test("직접 링크로 연 일반 상세 글은 제품 상위 경로로 복귀한다", () => {
  assert.deepEqual(
    postDetailBackDecision({ slug: "academic-notices", category: "notice", board_type: "notice" }, false),
    { action: "replace", route: NOTICES_TAB_ROUTE }
  );
});

test("공통 뒤로가기 실행기는 탐색 기록이 있으면 pop, 없으면 기존 목록으로 간다", () => {
  for (const [canGoBack, expected] of [[true, "back"], [false, `navigate:${COMMUNITY_TAB_ROUTE}`]] as const) {
    const calls: string[] = [];
    navigateFromPostDetail(
      { slug: "exam-archive", category: "resources", board_type: "resource" },
      "16",
      COMMUNITY_TAB_ROUTE,
      {
        canGoBack: () => canGoBack,
        back: () => calls.push("back"),
        navigate: (route) => calls.push(`navigate:${route}`),
        replace: (route) => calls.push(`replace:${route}`),
      }
    );
    assert.deepEqual(calls, [expected]);
  }
});

test("게시판 경로 파라미터는 양의 정수만 허용한다", () => {
  assert.equal(routeBoardId("16"), 16);
  assert.equal(routeBoardId(["17", "18"]), 17);
  assert.equal(routeBoardId("0"), null);
  assert.equal(routeBoardId("1.5"), null);
});

test("내 활동 상세에서 돌아올 때 작성·댓글·스크랩 필터를 보존한다", () => {
  for (const type of ["posts", "comments", "bookmarks"]) {
    const route = `/(tabs)/settings/activity?type=${type}`;
    assert.equal(postDetailReturnRoute(route), route);
    assert.equal(postDetailRoute(123, undefined, route), `/board/post/123?returnTo=${encodeURIComponent(route)}`);
    assert.deepEqual(postDetailBackDecision(null, true, undefined, route), { action: "back" });
    assert.deepEqual(postDetailBackDecision(null, false, undefined, route), { action: "navigate", route });
  }
});

test("내 활동 복귀 필터는 정해진 세 종류와 단일 쿼리만 허용한다", () => {
  for (const query of ["type=unknown", "type=", "type=posts&type=bookmarks", "type=posts&next=https://example.com"]) {
    assert.equal(postDetailReturnRoute(`/(tabs)/settings/activity?${query}`), null);
  }
});

test("수정 후 복원된 상세의 뒤로가기는 모든 진입 목록 스택을 정확히 복원한다", () => {
  const board = { slug: "exam-archive", category: "resources", board_type: "resource" };
  const listRoutes = [
    HOME_TAB_ROUTE,
    NOTICES_TAB_ROUTE,
    COMMUNITY_TAB_ROUTE,
    PARTICIPATION_TAB_ROUTE,
    COUNCIL_TAB_ROUTE,
    "/(tabs)/search",
    "/(tabs)/search?scope=resources",
    "/(tabs)/notifications",
    "/(tabs)/settings/activity",
    "/board/25",
  ];

  for (const route of listRoutes) {
    assert.deepEqual(postDetailBackDecision(board, true, "25", route), { action: "back" });
    assert.deepEqual(
      postDetailBackDecision(board, false, "25", route),
      { action: "navigate", route },
    );
  }
});

test("중첩 게시판 Android 뒤로가기는 열린 자식 상세를 먼저 닫는다", () => {
  const handleHardwareBack = getHandleNestedBoardHardwareBack();
  const calls: string[] = [];

  assert.equal(
    handleHardwareBack(() => calls.push("child"), () => calls.push("board")),
    true,
  );
  assert.deepEqual(calls, ["child"]);

  calls.length = 0;
  assert.equal(handleHardwareBack(null, () => calls.push("board")), true);
  assert.deepEqual(calls, ["board"]);
});
