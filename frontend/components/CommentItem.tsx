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
        marginLeft: depth * 14,
        marginTop: depth > 0 ? 8 : 0,
        // Figma 대댓글: padding 10/12, radius 10, 배경 #F7F7F5.
        paddingTop: depth > 0 ? 10 : 12,
        paddingBottom: depth === 0 ? 16 : 10,
        paddingHorizontal: depth > 0 ? 12 : 0,
        // 스레드 사이 구분선은 상세 화면이 그린다 — 마지막 댓글 밑에 줄이 남지 않도록 자체 밑줄은 없앤다.
        borderRadius: depth > 0 ? 10 : 0,
        backgroundColor: depth > 0 ? "#F7F7F5" : undefined,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: depth > 0 ? 16 : 27 }}>
        <Text style={{ color: "#15171C", fontSize: depth > 0 ? 13 : 14, fontWeight: "500", lineHeight: depth > 0 ? 16 : 17 }}>
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
                fontSize: depth > 0 ? 11 : 12,
                lineHeight: depth > 0 ? 13 : 15,
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
              fontSize: 14,
              lineHeight: 20,
              paddingHorizontal: depth > 0 ? 10 : 12,
              paddingVertical: depth > 0 ? 8 : 10,
              textAlignVertical: "top",
            },
            { outlineStyle: "none" } as never,
          ]}
          value={draft}
        />
      ) : (
        <Text style={{ marginTop: 4, color: "#6B7280", fontSize: depth > 0 ? 13 : 14, lineHeight: depth > 0 ? 16 : 22 }}>
          {comment.content}
        </Text>
      )}

      <Text
        style={{
          marginTop: 4,
          color: "#A6ACB7",
          fontSize: depth > 0 ? 11 : 12,
          lineHeight: depth > 0 ? 13 : 14,
          alignSelf: "flex-start",
        }}
      >
        {formatCommentDate(comment.created_at)}
      </Text>

      {hasActionRow ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: depth > 0 ? 16 : 10, marginTop: 4, paddingVertical: depth > 0 ? 8 : 0 }}>
          {actionState.showReply && onReply ? (
            <Pressable onPress={() => onReply(comment)}>
              <Text style={{ color: "#2761FF", fontSize: depth > 0 ? 13 : 12, fontWeight: "500", lineHeight: depth > 0 ? 16 : 15 }}>답글</Text>
            </Pressable>
          ) : null}

          {actionState.showSave ? (
            <Pressable disabled={isSaving} onPress={saveEdit}>
              <Text style={{ color: "#2761FF", fontSize: depth > 0 ? 13 : 12, fontWeight: "500", lineHeight: depth > 0 ? 16 : 15 }}>
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
              <Text style={{ color: "#A6ACB7", fontSize: depth > 0 ? 13 : 12, fontWeight: "500", lineHeight: depth > 0 ? 16 : 15 }}>취소</Text>
            </Pressable>
          ) : null}

          {actionState.showEdit ? (
            <Pressable
              onPress={() => {
                setDraft(comment.content);
                setIsEditing(true);
              }}
            >
              <Text style={{ color: "#A6ACB7", fontSize: depth > 0 ? 13 : 12, fontWeight: "500", lineHeight: depth > 0 ? 16 : 15 }}>수정</Text>
            </Pressable>
          ) : null}

          {actionState.showDelete ? (
            <Pressable onPress={() => onDelete?.(comment.id)}>
              <Text style={{ color: "#D64545", fontSize: depth > 0 ? 13 : 12, fontWeight: "500", lineHeight: depth > 0 ? 16 : 15 }}>삭제</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {comment.children.map((child) => (
        <CommentItem
          key={child.id}
          comment={child}
          currentUserId={currentUserId}
          depth={depth + 1}
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
