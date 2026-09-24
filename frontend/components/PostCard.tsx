import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BookmarkIcon } from "./icons";
import type { PostListItem } from "../types";
import { formatBoardDate } from "../utils/dateFormat";
import { resourceCategoryLabel } from "../utils/resourceBoards";
import { resourceSubjectSummary } from "../utils/resourcePostFields";
import { formatCohortName } from "../utils/userLabel";

type Props = {
  post: PostListItem;
  onPress: (postId: number) => void;
  boardType?: string;
  boardSlug?: string;
  isLast?: boolean;
};

const COLORS = {
  primary: "#2761FF",
  primary50: "#EDF2FE",
  text: "#15171C",
  muted: "#6B7280",
  subtle: "#8A919C",
  divider: "#EEF0F3",
  pink50: "#FFEAF1",
  pink700: "#B91C4C",
  yellow50: "#FFF6DC",
  yellow700: "#9A6B00",
  green50: "#EAF8EF",
  green700: "#1F7A46",
  purple50: "#F1EEFB",
  purple700: "#5B49C8",
};

const TYPE_LABELS: Record<string, string> = {
  album: "사진첩",
  external_link: "외부 링크",
  faq: "FAQ",
  organization_intro: "소개",
  suggestion: "건의",
  notice: "공지",
  calendar: "일정",
  guide: "가이드",
  resource: "자료",
  activity_certification: "활동 인증",
  activity_history: "활동 내역",
  mutual_aid: "상조회",
};

function normalizeCategory(post: PostListItem, boardType?: string, boardSlug?: string) {
  if (boardType === "suggestion" && post.suggestion) {
    return post.suggestion.status === "answered" ? "답변완료" : "대기중";
  }
  if (boardType === "mutual_aid" && post.mutual_aid) {
    return {
      processing: "처리중",
      completed: "완료",
      rejected: "반려",
    }[post.mutual_aid.status];
  }
  if (boardType === "resource") {
    const resourceLabel = resourceCategoryLabel(
      { slug: boardSlug, board_type: boardType, category: "resources" },
      post.category,
    );
    if (resourceLabel) return resourceLabel;
  }
  const raw = post.category?.trim();
  if (boardSlug === "study-recruit") {
    const recruitmentStatus = String(post.metadata?.recruitment_status ?? raw ?? "").toLowerCase();
    return recruitmentStatus.includes("closed") || recruitmentStatus.includes("마감") ? "마감" : "진행중";
  }
  if (raw) {
    const lower = raw.toLowerCase();
    if (lower.includes("event") || lower.includes("webinar") || raw.includes("행사") || raw.includes("특강")) return "행사공지";
    if (lower.includes("academic") || raw.includes("학사")) return "학사공지";
    if (lower.includes("other") || lower.includes("general") || raw.includes("기타")) return "기타공지";
    if (raw.includes("전체")) return "공지";
    return raw.length <= 8 ? raw : "공지";
  }
  return boardType ? (TYPE_LABELS[boardType] ?? boardType) : "게시글";
}

function categoryTone(label: string) {
  if (label.includes("반려")) return { bg: "#FBEAF0", fg: "#993556" };
  if (label.includes("완료")) return { bg: "#EAF3DE", fg: "#3B6D11" }; // Figma: 답변완료 칩
  if (label.includes("대기")) return { bg: "#FAEEDA", fg: "#854F0B" }; // Figma: 대기중 칩
  if (label.includes("진행")) return { bg: "#EAF3DE", fg: "#3B6D11" };
  if (label.includes("마감")) return { bg: "#F0F0EE", fg: "#5B5B57" };
  if (label.includes("종합")) return { bg: "#FAEEDA", fg: "#854F0B" };
  if (label.includes("행사") || label.includes("시험")) return { bg: "#FBEAF0", fg: "#993556" };
  if (label.includes("졸업") || label.includes("인증")) return { bg: "#EAF3DE", fg: "#3B6D11" };
  if (label.includes("강의") || label.includes("후기") || label.includes("스터디") || label.includes("모집")) return { bg: "#EEEDFE", fg: "#3C3489" };
  if (label.includes("기타")) return { bg: "#F0EEF9", fg: "#5A4C8B" };
  return { bg: "#E6F1FB", fg: "#0C447C" };
}

function compactPreview(post: PostListItem) {
  const title = post.title.trim();
  const preview = post.content_preview.trim();
  const withoutDuplicateTitle = preview.startsWith(title) ? preview.slice(title.length).trim() : preview;
  const firstMeaningfulLine = withoutDuplicateTitle
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && line !== title);
  return firstMeaningfulLine ?? "";
}

export default function PostCard({ post, onPress, boardType, boardSlug, isLast }: Props) {
  const label = normalizeCategory(post, boardType, boardSlug);
  const tone = categoryTone(label);
  const preview = compactPreview(post);
  // 강의후기 카드는 본문 미리보기 자리에 과목정보를 보여준다. 과목정보가 없는
  // 예전 글은 빈 문자열이 와서 기존 미리보기로 돌아간다.
  const subjectSummary = resourceSubjectSummary(boardSlug, post.metadata);
  const isLectureReview = boardSlug === "lecture-reviews";
  const isStudyRecruit = boardSlug === "study-recruit";
  const isMutualAid = boardType === "mutual_aid";
  const isSuggestion = boardType === "suggestion";
  const isWorkflowRequest = isMutualAid || isSuggestion;
  const showAuthor = !isLectureReview && !isSuggestion;
  // Figma 스터디카드 메타: "72기 김민석 · 26.06.23(금) · 댓글 3" — 댓글 수는 노출하고 추천 수만 감춘다.
  // 강의후기도 댓글을 쓸 수 있으므로 댓글 수를 보여 준다. 작성자만 익명이라
  // showAuthor에서만 빠진다.
  const showCommentCount = !isWorkflowRequest;
  const showLikeCount = !isWorkflowRequest && !isStudyRecruit;

  return (
    <Pressable onPress={() => onPress(post.id)} style={[styles.row, isWorkflowRequest ? styles.rowWorkflow : null, isLast ? styles.rowLast : null]}>
      <View style={styles.metaRow}>
        <View style={[styles.pill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.pillText, { color: tone.fg }]}>{label}</Text>
        </View>
        {post.is_pinned || post.is_notice ? (
          <View style={styles.pinPill}>
            <BookmarkIcon filled size={11} color={COLORS.primary} />
            <Text style={styles.pinText}>고정</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.title, isWorkflowRequest ? styles.titleWorkflow : null]} numberOfLines={2}>
        {post.title}
      </Text>
      {subjectSummary ? (
        <Text style={styles.preview} numberOfLines={1}>
          {subjectSummary}
        </Text>
      ) : preview && !isWorkflowRequest ? (
        <Text style={styles.preview} numberOfLines={2}>
          {preview}
        </Text>
      ) : null}
      <Text style={styles.footerText} numberOfLines={1}>
        {[
          showAuthor ? formatCohortName(post.author_cohort, post.author_nickname) : null,
          formatBoardDate(post.created_at),
          showCommentCount ? `댓글 ${post.comment_count}` : null,
          showLikeCount ? `추천 ${post.like_count}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#E1E4E9",
    backgroundColor: "#FFFFFF",
    // Figma: 구분선이 좌우 16px 안쪽에만 그려지도록 padding 대신 margin.
    marginHorizontal: 16,
    paddingVertical: 14,
  },
  rowWorkflow: {
    paddingVertical: 13, // Figma: 건의/상조회 항목 padding 13/0
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pill: {
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 13,
  },
  pinPill: {
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 6,
    backgroundColor: COLORS.primary50,
    paddingHorizontal: 7,
  },
  pinText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  title: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 17, // Figma: 14/17
    marginTop: 6,
  },
  titleWorkflow: {
    fontWeight: "400", // Figma: 건의/상조회 제목 Regular 14/17
    lineHeight: 17,
  },
  preview: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 20, // Figma: 13/150%
    marginTop: 6,
  },
  footerText: {
    color: "#A6ACB7",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 15,
    marginTop: 6,
  },
});
