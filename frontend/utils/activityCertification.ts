import type { ApiSuccess, PostListItem } from "../types";

export type ActivityParticipant = {
  id: number;
  name: string;
  major?: string;
  student_number?: string;
  legacy?: boolean;
  persisted?: boolean;
};

type ActivityBadgePost = {
  activity_source_title?: string | null;
  category?: string | null;
  metadata?: Record<string, unknown> | null;
};

const GENERIC_CLUB_ACTIVITY_LABELS = new Set(["동아리 활동 인증", "활동 인증", "안내"]);

export const CURRENT_CLUB_NAMES = [
  "파인튜닝",
  "SG_LLM",
  "알바트로스냅",
  "서강의 봄",
  "서뽈링",
  "서강와인",
  "인간지능투자",
  "FC리턴윈",
] as const;

function normalizedClubSourceTitle(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function titleMatchesCurrentClub(title: string, clubName: string): boolean {
  const normalizedTitle = normalizedClubSourceTitle(title);
  const normalizedName = normalizedClubSourceTitle(clubName);
  if (!normalizedTitle.startsWith(normalizedName)) return false;
  const suffix = normalizedTitle.slice(normalizedName.length);
  return suffix === "" || suffix.startsWith(" ") || suffix.startsWith("(") || suffix.startsWith("（");
}

export function currentClubActivitySourcePosts<
  T extends Pick<PostListItem, "id" | "title"> & Partial<Pick<PostListItem, "created_at">>,
>(posts: readonly T[]): T[] {
  const selected = new Map<string, T>();
  for (const post of posts) {
    const clubName = CURRENT_CLUB_NAMES.find((name) => titleMatchesCurrentClub(post.title, name));
    if (!clubName) continue;
    const current = selected.get(clubName);
    const postCreatedAt = post.created_at ? Date.parse(post.created_at) : Number.NEGATIVE_INFINITY;
    const currentCreatedAt = current?.created_at ? Date.parse(current.created_at) : Number.NEGATIVE_INFINITY;
    const postTime = Number.isFinite(postCreatedAt) ? postCreatedAt : Number.NEGATIVE_INFINITY;
    const currentTime = Number.isFinite(currentCreatedAt) ? currentCreatedAt : Number.NEGATIVE_INFINITY;
    if (!current || postTime > currentTime || (postTime === currentTime && post.id > current.id)) {
      selected.set(clubName, post);
    }
  }
  return CURRENT_CLUB_NAMES.flatMap((name) => {
    const post = selected.get(name);
    return post ? [post] : [];
  });
}

type ActivitySourcePost = Pick<PostListItem, "id" | "title" | "created_at">;
type ActivitySourcePageLoader<T extends ActivitySourcePost> = (
  boardId: number,
  page: number,
  size: number,
  filters: ReturnType<typeof activitySourcePostFilters>,
) => Promise<ApiSuccess<T[]>>;

export async function loadAllPublishedActivitySourcePosts<T extends ActivitySourcePost>(
  boardId: number,
  loadPage: ActivitySourcePageLoader<T>,
  pageSize = 50,
): Promise<T[]> {
  const posts: T[] = [];
  let page = 1;

  while (true) {
    const response = await loadPage(boardId, page, pageSize, activitySourcePostFilters());
    posts.push(...response.data);
    if (response.data.length === 0) return posts;

    const pagination = response.pagination;
    if (
      !pagination
      || !Number.isInteger(pagination.page)
      || !Number.isInteger(pagination.total_pages)
      || pagination.page >= pagination.total_pages
    ) return posts;
    const nextPage = pagination.page + 1;
    if (nextPage <= page) return posts;
    page = nextPage;
  }
}

export async function loadPublishedActivitySourcePosts<T extends ActivitySourcePost>(
  boardId: number,
  boardSlug: string | undefined,
  loadPage: ActivitySourcePageLoader<T>,
  pageSize = 50,
): Promise<T[]> {
  if (boardSlug === "club-promo") {
    return loadAllPublishedActivitySourcePosts(boardId, loadPage, pageSize);
  }
  const response = await loadPage(boardId, 1, pageSize, activitySourcePostFilters());
  return response.data;
}

export const ACTIVITY_PARTICIPANT_GUIDANCE =
  "원우회비 미납자, 졸업자는 검색되지 않아요. 지원금은 참가자 목록 기준 지급되니 본인도 검색해서 추가해주세요.";

export function activityBankAccountFieldState(postId: number | null) {
  if (postId) {
    return {
      required: false,
      placeholder: "새 계좌번호를 입력하면 변경돼요",
      guidance: "기존 계좌는 표시되지 않아요. 변경할 경우 새 계좌를 입력해주세요.",
    } as const;
  }
  return {
    required: true,
    placeholder: "은행 / 계좌번호를 입력하세요",
    guidance: "계좌는 본인 명의로만 등록 가능해요",
  } as const;
}

export function formatActivityParticipant(participant: ActivityParticipant): string {
  // 학번 A73006의 A 다음 두 자리가 기수 → 디자인 표기 "73기 손예진"
  // ponytail: 기수 2자리는 학번 체계(A+5자리)의 한계 — 100기부터는 학번 형식이 바뀌므로
  // 규칙에 안 걸리면 아래 fallback(이름 전공 학번)으로 표시된다. 새 형식 확정 시 갱신.
  const cohortMatch = participant.student_number?.match(/^A(\d{2})\d{3}$/i);
  if (cohortMatch) return `${Number(cohortMatch[1])}기 ${participant.name}`;
  return [participant.name, participant.major, participant.student_number].filter(Boolean).join(" ");
}

function positiveInteger(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function specificText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function specificNonGenericText(value: unknown): string | undefined {
  const text = specificText(value);
  return text && !GENERIC_CLUB_ACTIVITY_LABELS.has(text) ? text : undefined;
}

export function activityCertificationBadgeLabel(post: ActivityBadgePost, boardSlug?: string): string {
  if (boardSlug !== "club-activity") return specificText(post.category) ?? "활동 인증";
  return specificText(post.activity_source_title)
    ?? specificNonGenericText(post.category)
    ?? specificNonGenericText(post.metadata?.legacy_activity_name)
    ?? "동아리 활동 인증";
}

export function shouldShowActivityCertificationBadge(boardSlug?: string): boolean {
  return boardSlug !== "study-activity";
}

export function activityCertificationCardTitle(
  post: Pick<PostListItem, "title">,
  boardSlug?: string,
): string | null {
  if (boardSlug !== "study-activity") return null;
  return post.title.trim() || null;
}

export function activityCertificationPreview(
  post: Pick<PostListItem, "title" | "content_preview">,
  boardSlug?: string,
): string {
  const title = post.title.trim();
  const contentPreview = post.content_preview.trim();
  if (boardSlug === "club-activity") {
    return contentPreview
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? title;
  }
  const withoutDuplicateTitle = contentPreview.startsWith(title)
    ? contentPreview.slice(title.length).trim()
    : contentPreview;
  const lines = withoutDuplicateTitle
    .split(/\r?\n/)
    .map((line) => line.trim());
  const preview = lines.find((line) => (
    line
    && line !== title
  ));

  if (preview) return preview;
  return contentPreview || title;
}

export function activitySourcePostFilters(): { sort: "latest"; status: "published" } {
  return { sort: "latest", status: "published" };
}

function participantLabels(metadata?: Record<string, unknown> | null) {
  return typeof metadata?.participants === "string"
    ? metadata.participants.split(",").map((label) => label.trim()).filter(Boolean)
    : [];
}

function isUnchangedPersistedSelection(
  selectedParticipants: ActivityParticipant[],
  existingMetadata?: Record<string, unknown> | null,
) {
  const existingParticipants = typeof existingMetadata?.participants === "string"
    ? existingMetadata.participants.trim()
    : "";
  return selectedParticipants.length > 0
    && selectedParticipants.every((participant) => participant.persisted)
    && selectedParticipants.map(formatActivityParticipant).join(", ") === existingParticipants;
}

export function activityParticipantsFromMetadata(
  metadata?: Record<string, unknown> | null,
): ActivityParticipant[] {
  const labels = participantLabels(metadata);
  const duesPayerIds = Array.isArray(metadata?.participant_dues_payer_ids)
    ? metadata.participant_dues_payer_ids.map(positiveInteger)
    : [];
  const hasCompleteDuesIds = labels.length > 0
    && duesPayerIds.length === labels.length
    && duesPayerIds.every((id): id is number => id !== undefined);

  if (hasCompleteDuesIds) {
    return labels.map((name, index) => ({
      id: duesPayerIds[index] as number,
      name,
      persisted: true,
    }));
  }

  return labels.map((name, index) => ({
    id: -(index + 1),
    name,
    legacy: true,
    persisted: true,
  }));
}

export function activityParticipantSelectionError(
  selectedParticipants: ActivityParticipant[],
  existingMetadata?: Record<string, unknown> | null,
): string | null {
  if (
    selectedParticipants.some((participant) => participant.legacy)
    && !isUnchangedPersistedSelection(selectedParticipants, existingMetadata)
  ) {
    return "기존 회원 기반 참가자를 변경하려면 원우회비 납부자 명부에서 참가자 전원을 다시 선택해주세요.";
  }
  return null;
}

export function activitySourcePostIdFromMetadata(
  metadata?: Record<string, unknown> | null,
): number | null {
  const value = typeof metadata?.activity_source_post_id === "string"
    ? metadata.activity_source_post_id
    : undefined;
  return positiveInteger(value) ?? null;
}

export function buildActivityCertificationMetadata({
  existingMetadata,
  activityDate,
  participants,
  bankAccount,
  selectedParticipants,
  activitySourcePostId,
}: {
  existingMetadata?: Record<string, unknown> | null;
  activityDate?: string;
  participants?: string;
  bankAccount?: string;
  selectedParticipants: ActivityParticipant[];
  activitySourcePostId: number | null;
}): Record<string, unknown> {
  const metadata: Record<string, unknown> = { ...(existingMetadata ?? {}) };
  const trimmedDate = activityDate?.trim();
  const trimmedParticipants = participants?.trim();
  const trimmedBankAccount = bankAccount?.trim();

  if (trimmedDate) metadata.activity_date = trimmedDate;
  if (trimmedParticipants) metadata.participants = trimmedParticipants;
  if (trimmedBankAccount) metadata.bank_account = trimmedBankAccount;

  if (isUnchangedPersistedSelection(selectedParticipants, existingMetadata)) {
    delete metadata.participant_dues_payer_ids;
  } else {
    delete metadata.participant_user_ids;
    metadata.participant_dues_payer_ids = selectedParticipants
      .filter((participant) => !participant.legacy)
      .map((participant) => participant.id);
  }

  if (activitySourcePostId) {
    metadata.activity_source_post_id = String(activitySourcePostId);
  }

  return metadata;
}
