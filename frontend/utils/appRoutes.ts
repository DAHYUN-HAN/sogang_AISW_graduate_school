export const HOME_TAB_ROUTE = "/(tabs)/home" as const;
export const NOTICES_TAB_ROUTE = "/(tabs)/notices" as const;
export const COMMUNITY_TAB_ROUTE = "/(tabs)/community" as const;
export const PARTICIPATION_TAB_ROUTE = "/(tabs)/participation" as const;
export const COUNCIL_TAB_ROUTE = "/(tabs)/council" as const;
export const MY_PAGE_ROUTE = "/(tabs)/settings" as const;

type BoardRouteInfo = {
  slug: string;
  category: string;
  board_type: string;
};

type PostDetailFallbackRoute =
  | ReturnType<typeof boardParentRoute>
  | ReturnType<typeof boardRoute>;

export type PostDetailReturnRoute =
  | PostDetailFallbackRoute
  | "/(tabs)/notifications"
  | "/(tabs)/search"
  | `/(tabs)/search?scope=${string}`
  | "/(tabs)/settings/activity"
  | `/(tabs)/settings/activity?type=${"posts" | "comments" | "bookmarks"}`;

export type PostDetailBackDecision =
  | { action: "back" }
  | { action: "navigate"; route: PostDetailReturnRoute }
  | { action: "replace"; route: PostDetailFallbackRoute };

export type PostCreateBackDecision =
  | { action: "back" }
  | { action: "navigate"; route: PostDetailReturnRoute }
  | { action: "replace"; route: ReturnType<typeof boardRoute> };

export type PostEditCompletionDecision =
  | { action: "back" }
  | { action: "replace"; route: ReturnType<typeof postDetailRoute> };

export type ParticipationGroupKey = "club" | "study" | "networking";

const ACTIVITY_POST_DETAIL_EDIT_ORIGIN = "activity-post-detail" as const;
const POST_DETAIL_EDIT_ORIGIN = "post-detail" as const;

type PostEditRouteBoardInfo = {
  board_type: string;
  write_permission: string;
};


type PostDetailNavigator = {
  canGoBack: () => boolean;
  back: () => void;
  navigate: (route: PostDetailReturnRoute) => void;
  replace: (route: PostDetailFallbackRoute) => void;
};

export function routeBoardId(value: unknown): number | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string" && typeof candidate !== "number") return null;
  const parsed = Number(candidate);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function boardRoute(boardId: number) {
  return `/board/${boardId}` as const;
}

// 기수별 기장단 소개·역대 원우회의 기수 상세. 카드 id에 한글 기수가 들어가 인코딩한다.
export function councilCardRoute(boardId: number, cardId: string) {
  return `/board/${boardId}/council/${encodeURIComponent(cardId)}`;
}

/**
 * 알림을 눌렀을 때 열 화면. 열 것이 없으면 null이라 부르는 쪽이 머물러 있는다.
 *
 * 일정 알림에는 더 이상 전용 화면이 없다. 서버가 그 일정에 연결된 공지를 누를 때
 * 기준으로 채워 주며, 연결이 없으면 읽음 처리만 하고 이동하지 않는다.
 */
export function notificationContentRoute(notification: {
  post_id?: number | null;
  event_notice_post_id?: number | null;
}) {
  if (notification.post_id) {
    return postDetailRoute(notification.post_id, undefined, "/(tabs)/notifications");
  }
  if (notification.event_notice_post_id) {
    return postDetailRoute(notification.event_notice_post_id, undefined, "/(tabs)/notifications");
  }
  return null;
}

export function postDetailReturnRoute(value: unknown): PostDetailReturnRoute | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string") return null;
  if (
    candidate === HOME_TAB_ROUTE ||
    candidate === NOTICES_TAB_ROUTE ||
    candidate === COMMUNITY_TAB_ROUTE ||
    candidate === PARTICIPATION_TAB_ROUTE ||
    candidate === COUNCIL_TAB_ROUTE ||
    candidate === "/(tabs)/notifications" ||
    candidate === "/(tabs)/search" ||
    candidate === "/(tabs)/settings/activity"
  ) {
    return candidate;
  }
  if (/^\/board\/[1-9]\d*$/.test(candidate)) return candidate as ReturnType<typeof boardRoute>;
  if (/^\/\(tabs\)\/search\?scope=[a-z-]+$/.test(candidate)) {
    return candidate as `/(tabs)/search?scope=${string}`;
  }
  if (/^\/\(tabs\)\/settings\/activity\?type=(posts|comments|bookmarks)$/.test(candidate)) {
    return candidate as PostDetailReturnRoute;
  }
  return null;
}

export function postDetailRoute(postId: number, fromBoardId?: number, returnTo?: unknown) {
  const path = `/board/post/${postId}`;
  const params: string[] = [];
  if (fromBoardId) params.push(`fromBoardId=${fromBoardId}`);
  const safeReturnTo = postDetailReturnRoute(returnTo);
  if (safeReturnTo) params.push(`returnTo=${encodeURIComponent(safeReturnTo)}`);
  return params.length > 0 ? `${path}?${params.join("&")}` : path;
}

// boardId가 없는 글쓰기도 있다. 자료공유 `전체`처럼 여러 게시판을 모아 보는
// 목록에서는 고를 게시판이 정해지지 않아서, 대신 boardGroup으로 어느 묶음에서
// 왔는지만 넘기고 글쓰기 화면이 직접 고르게 한다.
export function postCreateRoute(
  boardId: number | null,
  category = "",
  returnTo?: unknown,
  boardGroup?: string,
) {
  const params: string[] = [];
  if (boardId !== null && boardId > 0) params.push(`boardId=${boardId}`);
  params.push(`category=${encodeURIComponent(category)}`);
  if (boardGroup) params.push(`boardGroup=${encodeURIComponent(boardGroup)}`);
  const safeReturnTo = postDetailReturnRoute(returnTo);
  if (safeReturnTo) params.push(`returnTo=${encodeURIComponent(safeReturnTo)}`);
  return `/board/post/create?${params.join("&")}` as const;
}

export function postCreateFormInstanceKey(params: {
  boardId?: unknown;
  postId?: unknown;
  category?: unknown;
}) {
  const categoryCandidate = Array.isArray(params.category) ? params.category[0] : params.category;
  const category = typeof categoryCandidate === "string" ? categoryCandidate : "";
  return JSON.stringify([
    routeBoardId(params.boardId),
    routeBoardId(params.postId),
    category,
  ]);
}

export function participationGroupDefaultSlug(group: ParticipationGroupKey) {
  if (group === "club") return "club-promo" as const;
  if (group === "study") return "study-recruit" as const;
  return "networking-programs" as const;
}

// 모든 게시판의 글 수정은 글쓰기 화면(create.tsx)의 수정 모드에서 한다.
// boardId를 모르면 빼도 된다(글쓰기 화면이 불러온 글의 게시판을 쓴다).
export function postEditRoute(
  boardId: number | null,
  postId: number,
  fromBoardId?: unknown,
  returnTo?: unknown,
  editOrigin: string = POST_DETAIL_EDIT_ORIGIN,
) {
  const params = [`postId=${postId}`, `editOrigin=${editOrigin}`];
  if (boardId !== null && boardId > 0) params.unshift(`boardId=${boardId}`);
  const sourceBoardId = routeBoardId(fromBoardId);
  if (sourceBoardId) params.push(`fromBoardId=${sourceBoardId}`);
  const safeReturnTo = postDetailReturnRoute(returnTo);
  if (safeReturnTo) params.push(`returnTo=${encodeURIComponent(safeReturnTo)}`);
  return `/board/post/create?${params.join("&")}` as const;
}

export function postEditRouteForPostDetail(
  board: PostEditRouteBoardInfo | null | undefined,
  boardId: number,
  postId: number,
  fromBoardId?: unknown,
  returnTo?: unknown,
) {
  const origin = board?.board_type === "activity_certification" ? ACTIVITY_POST_DETAIL_EDIT_ORIGIN : POST_DETAIL_EDIT_ORIGIN;
  return postEditRoute(board ? boardId : null, postId, fromBoardId, returnTo, origin);
}

export function postEditCompletionDecision(
  _boardType: string | undefined,
  _editOrigin: unknown,
  canGoBack: boolean,
  postId: number,
  fromBoardId?: unknown,
  returnTo?: unknown,
): PostEditCompletionDecision {
  // 수정은 글 상세에서 들어온다. 아래 화면이 있으면 그 상세로 pop 한다.
  if (canGoBack) {
    return { action: "back" };
  }
  return {
    action: "replace",
    route: postDetailRoute(postId, routeBoardId(fromBoardId) ?? undefined, returnTo),
  };
}

export function postCreateRouteFromBoardList(
  boardId: number | null,
  category: string,
  isTabRoot: boolean,
  _isActivityCertification: boolean,
  returnTo: unknown,
  boardGroup?: string,
) {
  return postCreateRoute(boardId, category, isTabRoot ? returnTo : undefined, boardGroup);
}

export function postCreateBackDecision(
  returnTo: unknown,
  canGoBack: boolean,
  boardId: number,
): PostCreateBackDecision {
  // 탭마다 스택이 따로라 아래 화면이 곧 들어온 화면이다. returnTo는 스택이 비어
  // 돌아갈 곳이 없을 때(웹 새로고침, 직접 링크)만 쓴다.
  if (canGoBack) return { action: "back" };
  const safeReturnTo = postDetailReturnRoute(returnTo);
  if (safeReturnTo) return { action: "navigate", route: safeReturnTo };
  return { action: "replace", route: boardRoute(boardId) };
}

export function postCreateFormBackDecision(params: {
  boardType?: string;
  editOrigin?: unknown;
  postId?: unknown;
  returnTo?: unknown;
  canGoBack: boolean;
  boardId: number;
  fromBoardId?: unknown;
}): PostCreateBackDecision | PostEditCompletionDecision {
  const postId = routeBoardId(params.postId);
  // 수정 화면(postId 있음)은 늘 글 상세로 돌아간다. 관리자 웹처럼 editOrigin 없이 열려도 같다.
  if (postId) {
    if (params.canGoBack) return { action: "back" };
    return {
      action: "replace",
      route: postDetailRoute(postId, routeBoardId(params.fromBoardId) ?? undefined, params.returnTo),
    };
  }
  return postCreateBackDecision(params.returnTo, params.canGoBack, params.boardId);
}

export function navigateAfterPostEdit(
  decision: PostEditCompletionDecision,
  navigator: {
    back: () => void;
    replace: (route: ReturnType<typeof postDetailRoute>) => void;
  },
) {
  if (decision.action === "back") {
    navigator.back();
    return;
  }
  navigator.replace(decision.route);
}

export function handleNestedBoardHardwareBack(
  childBack: (() => void) | null,
  exitBoard: () => void,
) {
  (childBack ?? exitBoard)();
  return true;
}

// 완료 화면에서 "확인"을 누르면 갈 곳. 건의사항·상조회는 글 상세를 볼 일이 없어
// 게시판 목록으로, 나머지는 방금 쓴 글 상세로 간다.
function completionReturnsToList(boardType: string | undefined) {
  return boardType === "mutual_aid" || boardType === "suggestion";
}

// 글 상세에서 뒤로 갈 곳. 활동 인증은 참여활동 탭에서 쓰므로 그곳으로 돌아간다.
function completionDetailReturnTo(boardType: string | undefined, returnTo?: unknown) {
  return boardType === "activity_certification" ? PARTICIPATION_TAB_ROUTE : postDetailReturnRoute(returnTo);
}

export function postCreateCompletionRoute(
  boardType: string | undefined,
  createdPostId: number,
  boardId: number,
  returnTo?: unknown,
) {
  if (completionReturnsToList(boardType)) return boardRoute(boardId);
  return postDetailRoute(createdPostId, boardId, completionDetailReturnTo(boardType, returnTo));
}

type StackRouteInput = { name: string; params?: object };

// 등록 직후 글쓰기 화면 자리에 놓을 스택. 모든 게시판이 완료 화면을 거친다.
// 완료 화면 바로 아래에 "확인"의 도착지(postCreateCompletionRoute와 같은 곳)를 깔아
// 두어, 확인·안드로이드 뒤로가기·iOS 스와이프가 모두 완료 화면만 빼서 같은 화면으로
// 돌아가게 한다.
// - 건의사항·상조회: 그 게시판 목록. 아래에 있으면 거기까지 비워 같은 목록이 두 번
//   쌓이지 않게 하고, 없으면 목록을 깐다.
// - 그 밖의 게시판: 방금 쓴 글 상세. 그 아래는 글쓰기 전 화면이다.
export function postCompletionStack<R extends StackRouteInput>(
  routes: R[],
  boardType: string | undefined,
  createdPostId: number,
  boardId: number,
  returnTo?: unknown,
): (R | StackRouteInput)[] {
  const below: (R | StackRouteInput)[] = routes.slice(0, -1);
  const detailReturnTo = completionDetailReturnTo(boardType, returnTo);
  const complete = {
    name: "board/post/complete",
    params: {
      boardType: boardType ?? "",
      boardId: String(boardId),
      postId: String(createdPostId),
      // 웹 새로고침처럼 아래 화면이 없을 때 같은 도착지를 다시 만들 수 있게 넘긴다.
      ...(detailReturnTo && !completionReturnsToList(boardType) ? { returnTo: detailReturnTo } : {}),
    },
  };
  if (!completionReturnsToList(boardType)) {
    const detail = {
      name: "board/post/[postId]",
      params: { postId: String(createdPostId), fromBoardId: String(boardId), ...(detailReturnTo ? { returnTo: detailReturnTo } : {}) },
    };
    return [...below, detail, complete];
  }
  let listIndex = -1;
  below.forEach((route, index) => {
    const params = route.params as { boardId?: unknown } | undefined;
    if (route.name === "board/[boardId]" && Number(params?.boardId) === boardId) listIndex = index;
  });
  const list = listIndex >= 0
    ? below.slice(0, listIndex + 1)
    : [...below, { name: "board/[boardId]", params: { boardId: String(boardId) } }];
  return [...list, complete];
}

export function postDetailBackDecision(
  board: BoardRouteInfo | null | undefined,
  canGoBack: boolean,
  fromBoardId?: unknown,
  returnTo?: unknown,
): PostDetailBackDecision {
  // iOS 가장자리 스와이프는 스택 아래 화면을 꺼낸다. 헤더·안드로이드도 같은 곳으로
  // 가도록 pop을 먼저 하고, returnTo는 아래 화면이 없을 때만 쓴다.
  if (canGoBack) return { action: "back" };
  const safeReturnTo = postDetailReturnRoute(returnTo);
  if (safeReturnTo) return { action: "navigate", route: safeReturnTo };
  const sourceBoardId = routeBoardId(fromBoardId);
  if (sourceBoardId) return { action: "replace", route: boardRoute(sourceBoardId) };
  return { action: "replace", route: boardParentRoute(board) };
}

export function navigateFromPostDetail(
  board: BoardRouteInfo | null | undefined,
  fromBoardId: unknown,
  returnTo: unknown,
  navigator: PostDetailNavigator
) {
  const decision = postDetailBackDecision(board, navigator.canGoBack(), fromBoardId, returnTo);
  if (decision.action === "back") {
    navigator.back();
    return;
  }
  if (decision.action === "navigate") {
    navigator.navigate(decision.route);
    return;
  }
  navigator.replace(decision.route);
}

export function boardParentRoute(board?: BoardRouteInfo | null) {
  if (!board) return HOME_TAB_ROUTE;
  if (board.board_type === "notice" || board.slug.includes("notice")) return NOTICES_TAB_ROUTE;
  if (board.slug === "event-album" || board.board_type === "resource" || board.category === "resources") {
    return COMMUNITY_TAB_ROUTE;
  }
  if (
    board.slug.includes("club") ||
    board.slug.includes("study") ||
    board.slug.includes("networking") ||
    board.slug.includes("alumni") ||
    board.category === "club" ||
    board.category === "study" ||
    board.category === "alumni" ||
    board.category === "participation"
  ) {
    return PARTICIPATION_TAB_ROUTE;
  }
  if (
    board.slug === "suggestions" ||
    board.slug === "mutual-aid" ||
    board.category === "council" ||
    board.category === "gsa"
  ) {
    return COUNCIL_TAB_ROUTE;
  }

  // Legacy community boards (including community-major) are entered from Home.
  // The hidden all-boards tab is not a user-facing fallback destination.
  return HOME_TAB_ROUTE;
}
