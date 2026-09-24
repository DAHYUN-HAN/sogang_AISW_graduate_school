import type {
  ActivityCertificationParticipantDetail,
  ApiSuccess,
  PostListItem,
} from "../types";
import { clubOperationStatus } from "./participationGuide";

export type ActivityParticipant = {
  id: number;
  name: string;
  major?: string;
  student_number?: string;
  legacy?: boolean;
  persisted?: boolean;
  // 검색 결과에서 고른 사람은 원우회비 납부 여부를 함께 들고 온다. 고른 뒤 아래에
  // 붙는 칩도 검색 목록과 같은 색으로 보여 주기 위해 남긴다. 저장된 글을 다시 열
  // 때는 글 상세의 activity_participants에서 채운다.
  is_paid_for_board?: boolean | null;
};

type ActivityBadgePost = {
  activity_source_title?: string | null;
  category?: string | null;
  metadata?: Record<string, unknown> | null;
};

const GENERIC_CLUB_ACTIVITY_LABELS = new Set(["동아리 활동 인증", "활동 인증", "안내"]);

type ActivitySourcePost = Pick<PostListItem, "id" | "title" | "created_at" | "metadata">;
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
    const posts = await loadAllPublishedActivitySourcePosts(boardId, loadPage, pageSize);
    return posts.filter((post) => clubOperationStatus(post.metadata) === "active");
  }
  const response = await loadPage(boardId, 1, pageSize, activitySourcePostFilters());
  return response.data;
}

export const ACTIVITY_PARTICIPANT_PAID_COLOR = "#212429";
export const ACTIVITY_PARTICIPANT_UNPAID_COLOR = "#8A919C";

export function activityParticipantTextColor(
  // 납부 여부를 모르는 경우(저장된 글의 메타데이터 등)는 undefined로 들어온다.
  // 명시적으로 false일 때만 미납자 색이므로 그대로 납부자 색이 된다.
  participant: { is_paid_for_board?: boolean | null },
) {
  return participant.is_paid_for_board === false
    ? ACTIVITY_PARTICIPANT_UNPAID_COLOR
    : ACTIVITY_PARTICIPANT_PAID_COLOR;
}

export function activityParticipantSearchKey(boardId: number, query: string) {
  return ["dues-payer-search", boardId, query] as const;
}

// Figma Screen/Activity/Verify(60:70)의 참가자안내(110:39) 문구를 그대로 쓴다.
export const ACTIVITY_PARTICIPANT_GUIDANCE =
  "참가자 이름 색상으로 지원금 지급 여부를 알 수 있어요. 검정은 지급 가능, 회색은 지급 불가. 본인도 검색해서 추가해주세요.";

export function activityBankAccountFieldState(postId: number | null) {
  if (postId) {
    return {
      required: false,
      placeholder: "은행 / 계좌번호를 입력하세요",
      guidance: "계좌는 본인 명의로만 등록 가능해요",
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
  // 학번은 개인정보라 화면에 노출하지 않는다. 기수를 못 읽으면 이름과 전공만 표시한다.
  return [participant.name, participant.major].filter(Boolean).join(" ");
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

export function activityDetailParticipants(
  participants: ActivityCertificationParticipantDetail[] | null | undefined,
  metadata?: Record<string, unknown> | null,
): ActivityCertificationParticipantDetail[] {
  if (Array.isArray(participants) && participants.length > 0) return participants;
  return participantLabels(metadata).map((label) => ({
    id: null,
    label,
    is_paid_for_board: null,
  }));
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

/**
 * 저장된 참가자 목록에 글 상세가 준 납부 여부를 채워 넣는다. 메타데이터에는 이름과
 * dues_payer_id만 있어 색을 알 수 없으므로, 수정 화면에서도 검색 목록과 같은 색이
 * 나오도록 id로 맞춘다. 상세에 없는 사람은 그대로 둔다(= 납부자 색).
 */
export function withParticipantDuesState(
  participants: ActivityParticipant[],
  details?: { id: number | null; is_paid_for_board: boolean | null }[] | null,
): ActivityParticipant[] {
  if (!Array.isArray(details) || details.length === 0) return participants;
  const paidById = new Map<number, boolean | null>();
  for (const detail of details) {
    if (typeof detail.id === "number") paidById.set(detail.id, detail.is_paid_for_board);
  }
  if (paidById.size === 0) return participants;
  return participants.map((participant) => (
    paidById.has(participant.id)
      ? { ...participant, is_paid_for_board: paidById.get(participant.id) ?? null }
      : participant
  ));
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
