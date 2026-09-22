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

export type EventDayBackDecision =
  | { action: "back" }
  | { action: "navigate"; route: typeof HOME_TAB_ROUTE }
  | { action: "replace"; route: typeof HOME_TAB_ROUTE };

export type EventDetailBackDecision =
  | { action: "back" }
  | { action: "navigate"; route: "/(tabs)/notifications" }
  | { action: "replace"; route: typeof HOME_TAB_ROUTE };

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

function isPostDetailEditOrigin(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === ACTIVITY_POST_DETAIL_EDIT_ORIGIN || candidate === POST_DETAIL_EDIT_ORIGIN;
}

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

function eventDayReturnRoute(value: unknown): typeof HOME_TAB_ROUTE | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === HOME_TAB_ROUTE ? HOME_TAB_ROUTE : null;
}

export function eventDayRoute(dateKey: string, returnTo?: unknown) {
  const path = `/events/day/${dateKey}`;
  const safeReturnTo = eventDayReturnRoute(returnTo);
  return safeReturnTo ? `${path}?returnTo=${encodeURIComponent(safeReturnTo)}` : path;
}

export function eventDayBackDecision(returnTo: unknown, canGoBack: boolean): EventDayBackDecision {
  if (eventDayReturnRoute(returnTo)) return { action: "navigate", route: HOME_TAB_ROUTE };
  if (canGoBack) return { action: "back" };
  return { action: "replace", route: HOME_TAB_ROUTE };
}

export function eventRootRoute() {
  return HOME_TAB_ROUTE;
}

function eventDetailReturnRoute(value: unknown): "/(tabs)/notifications" | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "/(tabs)/notifications" ? candidate : null;
}

export function eventDetailRoute(eventId: number, returnTo?: unknown) {
  const path = `/events/${eventId}`;
  const safeReturnTo = eventDetailReturnRoute(returnTo);
  return safeReturnTo ? `${path}?returnTo=${encodeURIComponent(safeReturnTo)}` : path;
}

export function eventDetailBackDecision(returnTo: unknown, canGoBack: boolean): EventDetailBackDecision {
  const safeReturnTo = eventDetailReturnRoute(returnTo);
  if (safeReturnTo) return { action: "navigate", route: safeReturnTo };
  if (canGoBack) return { action: "back" };
  return { action: "replace", route: HOME_TAB_ROUTE };
}

export function notificationContentRoute(notification: {
  post_id?: number | null;
  event_id?: number | null;
}) {
  if (notification.post_id) {
    return postDetailRoute(notification.post_id, undefined, "/(tabs)/notifications");
  }
  if (notification.event_id) {
    return eventDetailRoute(notification.event_id, "/(tabs)/notifications");
  }
  return "/(tabs)/notifications" as const;
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

export function activityPostEditRouteFromDetail(
  boardId: number,
  postId: number,
  fromBoardId?: unknown,
  returnTo?: unknown,
) {
  const params = [`boardId=${boardId}`, `postId=${postId}`, `editOrigin=${ACTIVITY_POST_DETAIL_EDIT_ORIGIN}`];
  const sourceBoardId = routeBoardId(fromBoardId);
  if (sourceBoardId) params.push(`fromBoardId=${sourceBoardId}`);
  const safeReturnTo = postDetailReturnRoute(returnTo);
  if (safeReturnTo) params.push(`returnTo=${encodeURIComponent(safeReturnTo)}`);
  return `/board/post/create?${params.join("&")}` as const;
}

export function postEditRouteFromDetail(
  postId: number,
  fromBoardId?: unknown,
  returnTo?: unknown,
) {
  const params = [`editOrigin=${POST_DETAIL_EDIT_ORIGIN}`];
  const sourceBoardId = routeBoardId(fromBoardId);
  if (sourceBoardId) params.push(`fromBoardId=${sourceBoardId}`);
  const safeReturnTo = postDetailReturnRoute(returnTo);
  if (safeReturnTo) params.push(`returnTo=${encodeURIComponent(safeReturnTo)}`);
  return `/board/post/edit/${postId}?${params.join("&")}` as const;
}

export function mutualAidPostEditRouteFromDetail(
  boardId: number,
  postId: number,
  fromBoardId?: unknown,
  returnTo?: unknown,
) {
  const params = [`boardId=${boardId}`, `postId=${postId}`, `editOrigin=${POST_DETAIL_EDIT_ORIGIN}`];
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
  if (!board) return `/board/post/edit/${postId}` as const;
  const usesMemberNavigation = board.write_permission !== "admin" && board.board_type !== "album";
  if (!usesMemberNavigation) return `/board/post/edit/${postId}` as const;
  if (board.board_type === "activity_certification") {
    return activityPostEditRouteFromDetail(boardId, postId, fromBoardId, returnTo);
  }
  if (board.board_type === "mutual_aid") {
    return mutualAidPostEditRouteFromDetail(boardId, postId, fromBoardId, returnTo);
  }
  return postEditRouteFromDetail(postId, fromBoardId, returnTo);
}

export function postEditCompletionDecision(
  _boardType: string | undefined,
  editOrigin: unknown,
  canGoBack: boolean,
  postId: number,
  fromBoardId?: unknown,
  returnTo?: unknown,
): PostEditCompletionDecision {
  if (isPostDetailEditOrigin(editOrigin) && canGoBack) {
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
  const safeReturnTo = postDetailReturnRoute(returnTo);
  if (safeReturnTo) return { action: "navigate", route: safeReturnTo };
  if (canGoBack) return { action: "back" };
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
  if (postId && isPostDetailEditOrigin(params.editOrigin)) {
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

export function postCreateCompletionRoute(
  boardType: string | undefined,
  createdPostId: number,
  boardId: number,
  returnTo?: unknown,
) {
  if (boardType === "activity_certification") {
    return postDetailRoute(createdPostId, boardId, PARTICIPATION_TAB_ROUTE);
  }
  if (boardType === "mutual_aid" || boardType === "suggestion") {
    return boardRoute(boardId);
  }
  return postDetailRoute(createdPostId, boardId, returnTo);
}

export function postDetailBackDecision(
  board: BoardRouteInfo | null | undefined,
  canGoBack: boolean,
  fromBoardId?: unknown,
  returnTo?: unknown,
): PostDetailBackDecision {
  const safeReturnTo = postDetailReturnRoute(returnTo);
  if (safeReturnTo) return { action: "navigate", route: safeReturnTo };
  if (canGoBack) return { action: "back" };
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
