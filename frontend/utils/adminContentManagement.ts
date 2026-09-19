import type { Board } from "../types";

export type AdminContentScope = "all" | "notices" | "participation" | "community" | "council";

export type AdminBoardManagementTab = "content" | "settings";

export type AdminBoardDestination = {
  scope: AdminContentScope;
  boardId: number | null;
  tab: AdminBoardManagementTab;
};

export type AdminBoardLegacySectionTransition = {
  handledSection: string;
  destination: AdminBoardDestination | null;
};

export type AdminBoardNavigationEvent =
  | {
    type: "legacy";
    rawSection: string | undefined;
    boards: Board[];
    boardsReady: boolean;
    rawLinkKey?: string;
  }
  | {
    type: "explicit";
    rawLinkKey: string;
  };

export type AdminDeferredEventGateState = {
  rawLinkKey: string;
  occurrence: number;
  cancelledOccurrence: number | null;
};

export type AdminDeferredEventGateEvent = {
  type: "sync" | "cancel" | "apply";
  rawLinkKey: string;
};

export type AdminDeferredEventGateTransition = {
  state: AdminDeferredEventGateState;
  shouldApply: boolean;
};

export type AdminBoardSettingKey = "allow_anonymous" | "write_permission" | "read_permission";

export type AdminBoardLockedPolicy = {
  key: string;
  label: string;
  reason: string;
  settingKey: AdminBoardSettingKey | null;
};

export type AdminBoardContentKind =
  | "aggregate-posts"
  | "posts"
  | "notice"
  | "album"
  | "activity-certification"
  | "activity-history"
  | "resource"
  | "suggestion"
  | "mutual-aid"
  | "calendar"
  | "external-link"
  | "organization-intro"
  | "faq"
  | "guide";

type AdminBoardLegacyContentKind = AdminBoardContentKind | "participation-guide" | "standard";

export type AdminBoardCapability = {
  kind: AdminBoardContentKind;
  contentAvailable: boolean;
  canReplaceRepresentativeImage: boolean;
  lockedPolicies: AdminBoardLockedPolicy[];
};

export type AdminBoardContentControl = {
  kind: AdminBoardLegacyContentKind;
  description: string;
  createLabel: string | null;
  canReplaceRepresentativeImage: boolean;
};

export type AdminPostMode = "all" | "notice" | "pinned";

export type AdminPostPaginationState = {
  contextKey: string;
  page: number;
};

export function adminPostPageForContext(
  state: AdminPostPaginationState,
  contextKey: string,
): number {
  return state.contextKey === contextKey ? state.page : 1;
}

export function adminPostPageAfterDelete({
  currentPage,
  currentItemCount,
}: {
  currentPage: number;
  currentItemCount: number;
}): number {
  return currentPage > 1 && currentItemCount === 1 ? currentPage - 1 : currentPage;
}

export async function runAdminPostDelete({
  postId,
  currentPage,
  currentItemCount,
  deletePost,
  afterDelete,
}: {
  postId: number;
  currentPage: number;
  currentItemCount: number;
  deletePost: (postId: number) => Promise<void>;
  afterDelete: () => Promise<void>;
}): Promise<number> {
  await deletePost(postId);
  await afterDelete();
  return adminPostPageAfterDelete({ currentPage, currentItemCount });
}

export function adminPostListQueryParams({
  isDashboard,
  page,
  search,
  boardId,
  mode,
}: {
  isDashboard: boolean;
  page: number;
  search: string;
  boardId?: number;
  mode: AdminPostMode;
}) {
  return {
    page: isDashboard ? 1 : page,
    size: 10,
    q: isDashboard ? undefined : search.trim() || undefined,
    board_id: isDashboard ? undefined : boardId,
    is_notice: isDashboard ? undefined : mode === "notice" ? true : undefined,
    is_pinned: isDashboard ? undefined : mode === "pinned" ? true : undefined,
  };
}

export function adminActivityCertificationBankAccount({
  allowDisplay,
  boardType,
  metadata,
}: {
  allowDisplay: boolean;
  boardType?: string;
  metadata?: Record<string, unknown>;
}): string | null {
  if (!allowDisplay || boardType !== "activity_certification") return null;
  const bankAccount = metadata?.bank_account;
  if (typeof bankAccount !== "string") return null;
  return bankAccount.trim() || null;
}

const ADMIN_CONTENT_BOARD_TYPES = new Set([
  "notice",
  "album",
  "resource",
  "activity_certification",
  "activity_history",
  "suggestion",
  "mutual_aid",
  "post",
]);

const SCOPE_CATEGORIES: Record<Exclude<AdminContentScope, "all">, readonly string[]> = {
  notices: ["notices"],
  participation: ["participation", "club", "study", "alumni"],
  community: ["community", "resources"],
  council: ["council", "gsa"],
};

const LEGACY_SECTION_SLUGS = {
  notices: "all-notices",
  executives: "gsa-executives",
  cohortLeaders: "gsa-cohort-leaders",
  pastCouncils: "gsa-past-councils",
  suggestions: "suggestions",
  mutualAid: "mutual-aid",
  faqs: "gsa-faq",
  events: "academic-calendar",
} as const;

const fallbackAdminBoardDestination = (): AdminBoardDestination => ({
  scope: "all",
  boardId: null,
  tab: "content",
});

export function adminBoardsForScope(boards: Board[], scope: AdminContentScope): Board[] {
  const categories = scope === "all" ? null : SCOPE_CATEGORIES[scope];
  return boards
    .filter((board) => categories === null || categories.includes(board.category))
    .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
}

export function adminScopeForBoard(board: Board): AdminContentScope {
  for (const [scope, categories] of Object.entries(SCOPE_CATEGORIES) as [Exclude<AdminContentScope, "all">, readonly string[]][]) {
    if (categories.includes(board.category)) return scope;
  }
  return "all";
}

export function adminBoardDestinationForSlug(
  slug: string,
  boards: Board[],
  tab: AdminBoardManagementTab = "content",
): AdminBoardDestination {
  const board = boards.find((item) => item.slug === slug);
  if (!board) return fallbackAdminBoardDestination();
  return {
    scope: adminScopeForBoard(board),
    boardId: board.id,
    tab,
  };
}

export function adminBoardDestinationForLegacySection(
  section: string,
  boards: Board[],
): AdminBoardDestination | null {
  if (section === "posts") return fallbackAdminBoardDestination();
  if (section === "boards") {
    const firstBoard = adminBoardsForScope(boards, "all")[0];
    return firstBoard
      ? { scope: "all", boardId: firstBoard.id, tab: "settings" }
      : fallbackAdminBoardDestination();
  }
  const slug = LEGACY_SECTION_SLUGS[section as keyof typeof LEGACY_SECTION_SLUGS];
  return slug ? adminBoardDestinationForSlug(slug, boards) : null;
}

export function adminBoardNavigationTransition(
  handledSection: string | null,
  event: AdminBoardNavigationEvent,
): AdminBoardLegacySectionTransition | null {
  if (event.type === "explicit") {
    return { handledSection: event.rawLinkKey, destination: null };
  }
  const rawLinkKey = event.rawLinkKey ?? event.rawSection ?? "";
  if (!event.rawSection || !event.boardsReady || rawLinkKey === handledSection) return null;
  return {
    handledSection: rawLinkKey,
    destination: adminBoardDestinationForLegacySection(event.rawSection, event.boards),
  };
}

export function adminDeferredEventGateInitialState(rawLinkKey: string): AdminDeferredEventGateState {
  return { rawLinkKey, occurrence: 0, cancelledOccurrence: null };
}

export function adminDeferredEventGateTransition(
  state: AdminDeferredEventGateState,
  event: AdminDeferredEventGateEvent,
): AdminDeferredEventGateTransition {
  const current = event.rawLinkKey === state.rawLinkKey
    ? state
    : {
      rawLinkKey: event.rawLinkKey,
      occurrence: state.occurrence + 1,
      cancelledOccurrence: null,
    };
  if (event.type === "cancel") {
    return {
      state: { ...current, cancelledOccurrence: current.occurrence },
      shouldApply: false,
    };
  }
  return {
    state: current,
    shouldApply: event.type === "apply" && current.cancelledOccurrence !== current.occurrence,
  };
}

export function adminFaqQueryEnabled(
  section: string,
  isManagedContentActive: boolean,
  kind: AdminBoardContentKind,
): boolean {
  return section === "dashboard" || (isManagedContentActive && kind === "faq");
}

export function adminCalendarQueryEnabled(
  section: string,
  hasEditEventId: boolean,
  isManagedContentActive: boolean,
  kind: AdminBoardContentKind,
): boolean {
  return section === "dashboard"
    || hasEditEventId
    || (isManagedContentActive && kind === "calendar");
}

const lockedPolicy = (key: string, label: string, reason: string, settingKey: AdminBoardSettingKey | null): AdminBoardLockedPolicy => ({ key, label, reason, settingKey });

export function adminBoardCapability(board?: Board): AdminBoardCapability {
  if (!board) return { kind: "aggregate-posts", contentAvailable: true, canReplaceRepresentativeImage: false, lockedPolicies: [] };

  const kindByType: Record<string, AdminBoardContentKind> = {
    post: "posts",
    notice: "notice",
    album: "album",
    resource: "resource",
    activity_certification: "activity-certification",
    activity_history: "activity-history",
    suggestion: "suggestion",
    mutual_aid: "mutual-aid",
    calendar: "calendar",
    external_link: "external-link",
    organization_intro: "organization-intro",
    faq: "faq",
    guide: "guide",
  };
  const kind = kindByType[board.board_type] ?? "posts";
  const lockedPolicies: AdminBoardLockedPolicy[] = [];
  if (board.slug === "lecture-reviews") {
    lockedPolicies.push(
      lockedPolicy("forced-anonymous", "강제 익명", "강의 후기는 작성자 익명으로 운영합니다.", "allow_anonymous"),
      lockedPolicy("comments-enabled", "댓글 활성화", "강의 후기에는 댓글을 허용합니다.", null),
    );
  } else if (board.slug === "exam-archive") {
    lockedPolicies.push(
      lockedPolicy("author-visible", "작성자 표시", "시험 족보는 작성자를 표시합니다.", "allow_anonymous"),
      lockedPolicy("comments-enabled", "댓글 활성화", "시험 족보에는 댓글을 허용합니다.", null),
    );
  } else if (board.slug === "suggestions") {
    lockedPolicies.push(lockedPolicy("allow-anonymous", "익명 허용", "건의사항은 익명 작성 정책을 사용합니다.", "allow_anonymous"));
  } else if (board.slug === "club-promo" || board.slug === "networking-programs") {
    lockedPolicies.push(lockedPolicy("admin-only-write", "관리자 작성", "이 안내 게시판은 관리자만 작성합니다.", "write_permission"));
  }

  return {
    kind,
    contentAvailable: kind !== "guide",
    canReplaceRepresentativeImage: board.slug === "club-promo" || board.slug === "networking-programs",
    lockedPolicies,
  };
}

export function adminContentBoards(boards: Board[], scope: AdminContentScope): Board[] {
  const categories = scope === "all" ? null : SCOPE_CATEGORIES[scope];
  return boards
    .filter((board) => ADMIN_CONTENT_BOARD_TYPES.has(board.board_type))
    .filter((board) => categories === null || categories.includes(board.category))
    .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
}

export function adminBoardContentControl(board?: Board): AdminBoardContentControl {
  if (!board) {
    return {
      kind: "standard",
      description: "게시글을 검색하고 열기, 수정, 고정과 삭제를 관리합니다.",
      createLabel: null,
      canReplaceRepresentativeImage: false,
    };
  }

  if (board.board_type === "notice") {
    return {
      kind: "notice",
      description: "공지 분류, 이미지, 상단 고정과 원우회 활동 연동을 공지사항 관리에서 설정합니다.",
      createLabel: null,
      canReplaceRepresentativeImage: false,
    };
  }

  if (board.slug === "club-promo") {
    return {
      kind: "participation-guide",
      description: "대표 이미지, 동아리 소개와 가입 신청 링크를 관리합니다.",
      createLabel: "동아리 안내 등록",
      canReplaceRepresentativeImage: true,
    };
  }

  if (board.slug === "networking-programs") {
    return {
      kind: "participation-guide",
      description: "대표 이미지, 네트워킹 소개와 참가 신청 링크를 관리합니다.",
      createLabel: "네트워킹 안내 등록",
      canReplaceRepresentativeImage: true,
    };
  }

  if (board.board_type === "suggestion") {
    return {
      kind: "suggestion",
      description: "접수 상태와 공식 답변은 건의사항 답변 관리에서 처리합니다.",
      createLabel: null,
      canReplaceRepresentativeImage: false,
    };
  }

  if (board.board_type === "mutual_aid") {
    return {
      kind: "mutual-aid",
      description: "비공개 증빙 확인, 처리 완료와 반려는 상조회 신청 관리에서 처리합니다.",
      createLabel: null,
      canReplaceRepresentativeImage: false,
    };
  }

  if (board.board_type === "album") {
    return {
      kind: "album",
      description: "행사 사진을 이미지 중심 게시글로 관리합니다.",
      createLabel: `${board.name} 등록`,
      canReplaceRepresentativeImage: false,
    };
  }

  if (board.board_type === "activity_certification") {
    return {
      kind: "activity-certification",
      description: "활동일, 참여자와 활동 사진을 확인하고 게시글 상태를 관리합니다.",
      createLabel: null,
      canReplaceRepresentativeImage: false,
    };
  }

  if (board.board_type === "activity_history") {
    return {
      kind: "activity-history",
      description: "원우회 활동내역은 공지사항의 활동내역 연동 옵션으로 관리합니다.",
      createLabel: null,
      canReplaceRepresentativeImage: false,
    };
  }

  if (board.board_type === "resource") {
    return {
      kind: "resource",
      description: "자료 파일, 게시판 분류와 작성자 표시 정책을 유지하며 게시글을 관리합니다.",
      createLabel: board.write_permission === "admin" ? `${board.name} 등록` : null,
      canReplaceRepresentativeImage: false,
    };
  }

  return {
    kind: "standard",
    description: "게시글을 검색하고 열기, 수정, 고정과 삭제를 관리합니다.",
    createLabel: board.write_permission === "admin" ? `${board.name} 등록` : null,
    canReplaceRepresentativeImage: false,
  };
}

export function nextAdminContentSelection(
  boards: Board[],
  currentBoardId: number | null,
  nextScope: AdminContentScope,
): number | null {
  if (nextScope === "all") return null;
  const visibleBoards = adminContentBoards(boards, nextScope);
  if (visibleBoards.some((board) => board.id === currentBoardId)) return currentBoardId;
  return visibleBoards[0]?.id ?? null;
}
export function nextAdminBoardSelection(
  boards: Board[],
  currentBoardId: number | null,
  nextScope: AdminContentScope,
): number | null {
  if (nextScope === "all") return null;
  const visibleBoards = adminBoardsForScope(boards, nextScope);
  if (visibleBoards.some((board) => board.id === currentBoardId)) return currentBoardId;
  return visibleBoards[0]?.id ?? null;
}
