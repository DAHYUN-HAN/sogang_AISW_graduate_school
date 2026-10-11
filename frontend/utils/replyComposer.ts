import type { CommentNode } from "../types";
import { formatCohortName } from "./userLabel";

export type ReplyTarget = {
  commentId: number;
  authorLabel: string;
};

type ReplyComment = Pick<CommentNode, "id" | "author_cohort" | "author_nickname">;

export function createReplyTarget(comment: ReplyComment): ReplyTarget {
  return {
    commentId: comment.id,
    authorLabel: formatCohortName(comment.author_cohort, comment.author_nickname),
  };
}

export function getReplyComposerState(target: ReplyTarget | null) {
  if (!target) {
    return { parentId: null, noticeText: null, placeholder: "댓글을 남겨보세요" };
  }

  const politeLabel = target.authorLabel.endsWith("님")
    ? target.authorLabel
    : `${target.authorLabel}님`;

  return {
    parentId: target.commentId,
    noticeText: `${politeLabel}에게 댓글 작성 중`,
    placeholder: "댓글을 남겨보세요",
  };
}
