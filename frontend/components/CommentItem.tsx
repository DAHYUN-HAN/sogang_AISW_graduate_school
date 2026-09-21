import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import type { CommentNode } from "../types";
import { commentEditSubmissionValue, getCommentActionState } from "../utils/commentPresentation";
import { formatBoardDate, formatRelativeTime } from "../utils/dateFormat";
import { formatCohortName } from "../utils/userLabel";

type CommentReportTarget = {
  type: "comment";
  id: number;
  label: string;
};

type Props = {
  comment: CommentNode;
  depth?: number;
  currentUserId?: number | null;
  onReply?: (comment: CommentNode) => void;
  onEdit?: (commentId: number, content: string) => Promise<void> | void;
  onDelete?: (commentId: number) => void;
  onReport?: (target: CommentReportTarget) => void;
  reportedTargets?: Record<string, boolean>;
  /** 첫 대댓글은 부모 댓글의 하단 여백(12)까지 더해 20px 아래에 놓인다. */
  isFirstReply?: boolean;
  /** 스터디 모집처럼 대댓글도 스레드 구분선도 없는 목록. 댓글 하나가 padding-bottom 12만 갖는다. */
  flat?: boolean;
};

function formatCommentDate(value: string) {
  return [formatBoardDate(value), formatRelativeTime(value)].filter(Boolean).join(" · ");
}

export default function CommentItem({
  comment,
  depth = 0,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onReport,
  reportedTargets = {},
  isFirstReply = false,
  flat = false,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [isSaving, setIsSaving] = useState(false);
  const isMine = currentUserId === comment.author_id;
  const isReported = reportedTargets[`comment:${comment.id}`];
  const actionState = getCommentActionState({
    depth,
    isMine,
    isEditing,
    isReported: Boolean(isReported),
  });
  const hasActionRow = (actionState.showReply && Boolean(onReply))
    || actionState.showEdit
    || actionState.showDelete
    || actionState.showSave
    || actionState.showCancel;
  const hasReplies = comment.children.length > 0;

  const saveEdit = async () => {
    const next = commentEditSubmissionValue(draft, isSaving);
    if (!next || !onEdit) return;
    try {
      setIsSaving(true);
      await onEdit(comment.id, next);
      setIsEditing(false);
    } catch {
      // The route owns user-facing error feedback; keep the draft open for retry.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View
      style={{
        // Figma 댓글스레드는 댓글·대댓글을 같은 320px 폭으로 stretch 한다 — 대댓글은 들여쓰지 않고 배경/라운드로 구분한다.
        marginTop: depth > 0 ? (isFirstReply ? 20 : 8) : 0,
        // Figma 대댓글: padding 10/12, radius 10, 배경 #F7F7F5.
        paddingTop: depth > 0 ? 10 : flat ? 0 : 16,
        // 스레드형은 댓글 여백 12 + 스레드 하단 16 = 28. 대댓글이 있으면 12는 첫 대댓글까지의 20에 이미 들어가 있다.
        // flat(스터디 모집)은 스레드 래퍼가 없어 댓글 여백 12만 남는다.
        paddingBottom: depth === 0 ? (flat ? 12 : hasReplies ? 16 : 28) : 10,
        paddingHorizontal: depth > 0 ? 12 : 0,
        // 스레드 사이 구분선은 상세 화면이 그린다 — 마지막 댓글 밑에 줄이 남지 않도록 자체 밑줄은 없앤다.
        borderRadius: depth > 0 ? 10 : 0,
        backgroundColor: depth > 0 ? "#F7F7F5" : undefined,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          // Figma 작성자 영역: 댓글은 center, 대댓글은 flex-start 정렬.
          alignItems: depth > 0 ? "flex-start" : "center",
          justifyContent: "space-between",
          minHeight: depth > 0 ? 16 : 27,
        }}
      >
        <Text style={{ color: "#15171C", fontSize: 13, fontWeight: "500", lineHeight: 16 }}>
          {formatCohortName(comment.author_cohort, comment.author_nickname)}
        </Text>
        {actionState.showReport ? (
          <Pressable
            accessibilityRole="button"
            disabled={actionState.reportAction === "none"}
            onPress={() => {
              if (actionState.reportAction === "open") {
                onReport?.({ type: "comment", id: comment.id, label: `댓글 #${comment.id}` });
              }
            }}
          >
            <Text
              style={{
                color: actionState.reportAction === "none" ? "#15803D" : "#A6ACB7",
                fontSize: 11,
                lineHeight: 13,
                fontWeight: "400",
              }}
            >
              {actionState.reportLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {isEditing ? (
        <TextInput
          autoFocus
          maxLength={500}
          multiline
          onChangeText={setDraft}
          style={[
            {
              marginTop: 4,
              minHeight: depth > 0 ? 44 : 60,
              borderWidth: 1.3,
              borderColor: "#2761FF",
              borderRadius: 8,
              backgroundColor: "#FFFFFF",
              color: "#15171C",
              fontSize: 13,
              lineHeight: 16,
              // Figma 답글수정입력: padding 8/10.
              paddingHorizontal: 10,
              paddingVertical: 8,
              textAlignVertical: "top",
            },
            { outlineStyle: "none" } as never,
          ]}
          value={draft}
        />
      ) : (
        <Text style={{ marginTop: 4, color: "#6B7280", fontSize: 13, lineHeight: depth > 0 ? 16 : 20 }}>
          {comment.content}
        </Text>
      )}

      <Text
        style={{
          marginTop: 4,
          color: "#A6ACB7",
          fontSize: 11,
          lineHeight: 13,
          alignSelf: "flex-start",
        }}
      >
        {formatCommentDate(comment.created_at)}
      </Text>

      {/* Figma 액션행: padding 8/0, gap 16, 라벨 13/16 500 — 댓글과 대댓글이 같은 크기다. */}
      {hasActionRow ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 4, paddingVertical: 8 }}>
          {actionState.showReply && onReply ? (
            <Pressable onPress={() => onReply(comment)}>
              <Text style={{ color: "#2761FF", fontSize: 13, fontWeight: "500", lineHeight: 16 }}>답글</Text>
            </Pressable>
          ) : null}

          {actionState.showSave ? (
            <Pressable disabled={isSaving} onPress={saveEdit}>
              <Text style={{ color: "#2761FF", fontSize: 13, fontWeight: "500", lineHeight: 16 }}>
                {isSaving ? "저장 중" : "저장"}
              </Text>
            </Pressable>
          ) : null}

          {actionState.showCancel ? (
            <Pressable
              disabled={isSaving}
              onPress={() => {
                setDraft(comment.content);
                setIsEditing(false);
              }}
            >
              <Text style={{ color: "#A6ACB7", fontSize: 13, fontWeight: "500", lineHeight: 16 }}>취소</Text>
            </Pressable>
          ) : null}

          {actionState.showEdit ? (
            <Pressable
              onPress={() => {
                setDraft(comment.content);
                setIsEditing(true);
              }}
            >
              <Text style={{ color: "#A6ACB7", fontSize: 13, fontWeight: "500", lineHeight: 16 }}>수정</Text>
            </Pressable>
          ) : null}

          {actionState.showDelete ? (
            <Pressable onPress={() => onDelete?.(comment.id)}>
              <Text style={{ color: "#D64545", fontSize: 13, fontWeight: "500", lineHeight: 16 }}>삭제</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {comment.children.map((child, childIndex) => (
        <CommentItem
          key={child.id}
          comment={child}
          currentUserId={currentUserId}
          depth={depth + 1}
          isFirstReply={childIndex === 0}
          onDelete={onDelete}
          onEdit={onEdit}
          onReply={onReply}
          onReport={onReport}
          reportedTargets={reportedTargets}
        />
      ))}
    </View>
  );
}
