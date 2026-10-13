export const COMMENT_DELETE_COPY = {
  title: "댓글 삭제",
  body: "댓글을 삭제하시겠어요?\n삭제한 댓글은 복구할 수 없어요.",
} as const;

export type CommentReportAction = "open" | "none";

export type CommentActionState = {
  showReply: boolean;
  showEdit: boolean;
  showDelete: boolean;
  showSave: boolean;
  showCancel: boolean;
  showReport: boolean;
  reportAction: CommentReportAction;
};

export function getCommentActionState({
  depth,
  isMine,
  isEditing,
}: {
  depth: number;
  isMine: boolean;
  isEditing: boolean;
}): CommentActionState {
  return {
    showReply: depth === 0 && !isEditing,
    showEdit: isMine && !isEditing,
    showDelete: isMine && !isEditing,
    showSave: isMine && isEditing,
    showCancel: isMine && isEditing,
    showReport: !isMine,
    // 이미 신고한 댓글도 "신고"로 두고, 다시 누르면 화면이 "이미 신고한 댓글이에요." 토스트를 띄운다.
    reportAction: isMine ? "none" : "open",
  };
}

export function commentEditSubmissionValue(draft: string, isSaving: boolean): string | null {
  if (isSaving) return null;
  const trimmed = draft.trim();
  return trimmed || null;
}
