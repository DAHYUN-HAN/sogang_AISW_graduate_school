import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import type { Board, MediaAsset } from "../../types";
import type { AdminBoardCapability, AdminBoardContentKind } from "../../utils/adminContentManagement";
import type { AdminBoardContentTargetStatus } from "./AdminBoardManagementNavigator";

export type AdminBoardContentPanelProps = {
  board?: Board;
  capability: AdminBoardCapability;
  renderers: Partial<Record<AdminBoardContentKind, () => ReactNode>>;
};

export type AdminBoardContentQueryPolicy = {
  isManagedContentActive: boolean;
  showsStandardPosts: boolean;
  noticeSource: "admin" | "public" | null;
  noticeBoardId?: number;
  showsSuggestions: boolean;
  suggestionBoardId?: number;
  showsMutualAid: boolean;
  mutualAidBoardId?: number;
  showsActivityHistory: boolean;
};

export function adminBoardContentQueryPolicy({
  section,
  tab,
  kind,
  board,
  targetStatus,
}: {
  section: string;
  tab: "content" | "settings";
  kind: AdminBoardContentKind;
  board?: Board;
  targetStatus: AdminBoardContentTargetStatus;
}): AdminBoardContentQueryPolicy {
  const hasManagedTarget = targetStatus === "aggregate" || targetStatus === "board";
  const isManagedContentActive = section === "boardManagement" && tab === "content" && hasManagedTarget;
  const managedStandardKinds: AdminBoardContentKind[] = [
    "aggregate-posts",
    "posts",
    "resource",
    "album",
    "activity-certification",
  ];
  const showsManagedNotice = isManagedContentActive && targetStatus === "board" && kind === "notice" && Boolean(board);
  const showsSuggestions = isManagedContentActive && targetStatus === "board" && kind === "suggestion";
  const showsMutualAid = isManagedContentActive && targetStatus === "board" && kind === "mutual-aid";
  return {
    isManagedContentActive,
    showsStandardPosts: section === "posts" || (isManagedContentActive && managedStandardKinds.includes(kind)),
    noticeSource: showsManagedNotice ? "admin" : ["notices", "banners"].includes(section) ? "public" : null,
    noticeBoardId: showsManagedNotice ? board?.id : undefined,
    showsSuggestions: section === "suggestions" || showsSuggestions,
    suggestionBoardId: showsSuggestions ? board?.id : undefined,
    showsMutualAid: section === "mutualAid" || showsMutualAid,
    mutualAidBoardId: showsMutualAid ? board?.id : undefined,
    showsActivityHistory: isManagedContentActive && kind === "activity-history",
  };
}

export type NoticeEditorOperation = {
  id: number;
  kind: "upload" | "save";
  boardId: number;
  editingNoticeId: number | null;
  generation: number;
};

export type NoticeEditorTarget = Pick<NoticeEditorOperation, "boardId" | "editingNoticeId" | "generation">;

export function beginNoticeEditorOperation(active: NoticeEditorOperation | null, next: NoticeEditorOperation) {
  return active ? { accepted: false as const, operation: active } : { accepted: true as const, operation: next };
}

export function noticeEditorOperationResult(
  operation: NoticeEditorOperation,
  current: NoticeEditorTarget,
  outcome: "success" | "failure",
) {
  const apply = operation.boardId === current.boardId
    && operation.editingNoticeId === current.editingNoticeId
    && operation.generation === current.generation;
  return { apply, notification: apply ? outcome : null };
}

export function mergeNoticeAttachments(current: MediaAsset[], uploaded: MediaAsset[]) {
  const seenIds = new Set(current.map((attachment) => attachment.id));
  return [
    ...current,
    ...uploaded.filter((attachment) => {
      if (seenIds.has(attachment.id)) return false;
      seenIds.add(attachment.id);
      return true;
    }),
  ];
}

export function replaceNoticeAttachment(
  current: MediaAsset[],
  targetAttachmentId: number,
  replacement: MediaAsset,
) {
  return current.map((attachment) => (
    attachment.id === targetAttachmentId ? replacement : attachment
  ));
}

export function noticeImageUploadIssueMessage(issue: { uploadedCount: number; failedCount: number }) {
  return issue.failedCount > 0
    ? `${issue.uploadedCount}장은 추가했고 ${issue.failedCount}장은 업로드하지 못했습니다.`
    : null;
}

export function NoticeImageUploadFeedback({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text accessibilityRole="alert" style={{ color: "#D94343", fontSize: 12 }}>{message}</Text>;
}

export function noticeUploadButtonLabel(progress: number | null) {
  return progress === null ? "업로드 중" : `업로드 ${progress}%`;
}

export function noticeEditorBoardTransition(
  selectedBoardId: number | null,
  nextBoardId: number,
  editingBoardId: number | null,
) {
  return {
    selectedBoardId: nextBoardId,
    shouldResetEditor: selectedBoardId !== nextBoardId && editingBoardId !== nextBoardId,
  };
}

export function publicNoticeBoardSelection(boards: Board[], selectedBoardId: number | null) {
  const activeNoticeBoards = boards.filter(
    (board) => board.board_type === "notice" && board.is_active !== false,
  );
  if (activeNoticeBoards.some((board) => board.id === selectedBoardId)) return selectedBoardId;
  return activeNoticeBoards[0]?.id ?? null;
}

export function AdminBoardContentQueryState({
  isLoading,
  isError,
  isEmpty,
  emptyMessage,
  onRetry,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  emptyMessage: string;
  onRetry: () => void;
}) {
  const stateStyle = {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E1E4E9",
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 8,
  } as const;
  if (isLoading) return <View style={stateStyle}><ActivityIndicator /></View>;
  if (isError) {
    return (
      <View style={stateStyle}>
        <Text style={{ color: "#D94343", fontWeight: "800" }}>콘텐츠를 불러오지 못했습니다.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="콘텐츠 다시 시도"
          onPress={onRetry}
          style={{ alignSelf: "flex-start", borderRadius: 6, backgroundColor: "#EDF2FE", paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Text style={{ color: "#2761FF", fontWeight: "800" }}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }
  if (isEmpty) return <View style={stateStyle}><Text style={{ color: "#6B7280" }}>{emptyMessage}</Text></View>;
  return null;
}

export function AdminBoardTargetQueryState({
  status,
  missingReason,
  onRetry,
}: {
  status: AdminBoardContentTargetStatus;
  missingReason?: "selection" | "empty";
  onRetry: () => void;
}) {
  const stateStyle = {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E1E4E9",
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 8,
  } as const;
  if (status === "loading") {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel="게시판 목록을 불러오는 중" style={stateStyle}>
        <ActivityIndicator />
        <Text style={{ color: "#6B7280" }}>게시판 목록을 불러오는 중입니다.</Text>
      </View>
    );
  }
  if (status === "error") {
    return (
      <View style={stateStyle}>
        <Text style={{ color: "#D94343", fontWeight: "800" }}>게시판 목록을 불러오지 못했습니다.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="게시판 목록 다시 시도"
          onPress={onRetry}
          style={{ alignSelf: "flex-start", borderRadius: 6, backgroundColor: "#EDF2FE", paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Text style={{ color: "#2761FF", fontWeight: "800" }}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }
  if (status === "missing") {
    return (
      <View style={stateStyle}>
        <Text style={{ color: "#6B7280" }}>
          {missingReason === "empty"
            ? "이 그룹에 등록된 게시판이 없습니다."
            : "선택한 게시판을 찾을 수 없습니다. 다른 게시판을 선택하거나 목록을 다시 불러와주세요."}
        </Text>
      </View>
    );
  }
  return null;
}

export default function AdminBoardContentPanel({ board, capability, renderers }: AdminBoardContentPanelProps) {
  const render = renderers[capability.kind];
  if (render) return <>{render()}</>;
  return <Text>{board ? `${board.name} 콘텐츠를 관리할 수 없습니다.` : "표시할 콘텐츠가 없습니다."}</Text>;
}
