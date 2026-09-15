import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Alert, BackHandler, Image, Keyboard, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputKeyPressEvent, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CommentItem from "../../../../components/CommentItem";
import ActivityCertificationMediaImage from "../../../../components/ActivityCertificationMediaImage";
import LoadingState from "../../../../components/LoadingState";
import MediaImage from "../../../../components/MediaImage";
import NaturalAspectMediaImage from "../../../../components/NaturalAspectMediaImage";
import { AttachDocIcon, AttachLinkIcon, BookmarkIcon, CalendarSmallIcon, DownloadIcon, ExternalLinkIcon, FlagIcon, ImagePlaceholderIcon, MoreIcon, PencilIcon, SendIcon, SliderNextIcon, SliderPrevIcon, TrashIcon } from "../../../../components/icons";
import { useBoardsQuery } from "../../../../hooks/useApi";
import { resolveMediaAccessUrl, useMediaAccessUrl } from "../../../../hooks/useMediaAccessUrl";
import type { MediaReference } from "../../../../utils/mediaAccess";
import {
  useCreateComment,
  useDeleteComment,
  useDeletePost,
  usePostComments,
  usePostDetail,
  useToggleBookmark,
  useToggleLike,
  useUpdateComment,
  useUpdateMutualAid,
  useUpdateSuggestion,
} from "../../../../hooks/usePosts";
import { reportApi } from "../../../../services/api";
import { tabNameFromRoute, useTabHighlightStore } from "../../../../stores/tabHighlightStore";
import { useUserStore } from "../../../../stores/userStore";
import type { MutualAidStatus } from "../../../../types";
import {
  boardParentRoute,
  navigateFromPostDetail,
  postEditRouteForPostDetail,
} from "../../../../utils/appRoutes";
import { commentKeyAction, commentSubmissionValue } from "../../../../utils/commentKeyboard";
import { formatBoardDate } from "../../../../utils/dateFormat";
import { openMediaUrl } from "../../../../utils/mediaOpener";
import { canDeleteMutualAidRequest, canEditMutualAidRequest } from "../../../../utils/mutualAid";
import { isAdminUser } from "../../../../utils/permissions";
import { formatCohortName } from "../../../../utils/userLabel";
import { activityCertificationBadgeLabel } from "../../../../utils/activityCertification";
import { activityCertificationDetailHeading } from "../../../../utils/activityDetailPresentation";
import { activityImageLayoutFromMetadata } from "../../../../utils/activityImageLayout";
import { COMMENT_DELETE_COPY } from "../../../../utils/commentPresentation";
import {
  noticeAttachmentFrameAspectRatio,
  postDetailImagePresentation,
  shouldOpenPostAttachment,
} from "../../../../utils/postDetailImagePresentation";
import { imageDimensionsFromLoadEvent } from "../../../../utils/imageDimensions";
import { postDetailFocusDecision } from "../../../../utils/postDetailCache";
import { participationApplicationUrl } from "../../../../utils/participationGuide";
import { shouldShowPostAuthorBlock } from "../../../../utils/postMenu";
import { REPORT_REASONS, getReportEntryState, getReportSubmission, type ReportReason } from "../../../../utils/reportForm";
import { createReplyTarget, getReplyComposerState, type ReplyTarget } from "../../../../utils/replyComposer";
import { resourceCategoryLabel, resourceDetailMeta } from "../../../../utils/resourceBoards";

const COLORS = {
  primary: "#2761FF",
  primary50: "#EDF2FE",
  text: "#15171C",
  muted: "#6B7280",
  subtle: "#8A919C",
  divider: "#EEF0F3",
  surface: "#FFFFFF",
  page: "#FFFFFF",
  danger: "#B91C1C",
  danger50: "#FFF1F2",
  cyan50: "#E6F9FB",
  cyan700: "#14788A",
  green50: "#EAF8EF",
  green700: "#1F7A46",
  pink50: "#FFEAF1",
  pink700: "#B91C4C",
  yellow50: "#FFF6DC",
  yellow700: "#9A6B00",
};

const ALBUM_FALLBACK_GRADIENTS: readonly (readonly [string, string])[] = [
  ["#2761FF", "#86C8FF"],
  ["#5B49C8", "#B7A4F8"],
  ["#0E7B60", "#55C69A"],
  ["#B94A2F", "#F39A7D"],
];

const NO_COMMENT_RESOURCE_SLUGS = new Set(["lecture-reviews"]);

type ReportTarget = {
  type: "post" | "comment";
  id: number;
  label: string;
};

type WebTextInputKeyPressEvent = TextInputKeyPressEvent & {
  key?: string;
  shiftKey?: boolean;
  nativeEvent: TextInputKeyPressEvent["nativeEvent"] & {
    isComposing?: boolean;
    keyCode?: number;
  };
};

type IconName = keyof typeof Ionicons.glyphMap;

const SUGGESTION_STATUSES = [
  { value: "received", label: "대기중" },
  { value: "answered", label: "답변완료" },
];

const MUTUAL_AID_STATUSES: { value: MutualAidStatus; label: string }[] = [
  { value: "processing", label: "처리중" },
  { value: "completed", label: "완료" },
  { value: "rejected", label: "반려" },
];

function categoryLabel(value?: string | null, fallback = "게시글") {
  const raw = value?.trim();
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  if (lower.includes("event") || lower.includes("webinar") || raw.includes("행사") || raw.includes("특강")) return "행사공지";
  if (lower.includes("academic") || raw.includes("학사")) return "학사공지";
  if (raw.includes("전체")) return "공지";
  if (lower === "all" || lower.includes("other") || lower.includes("general") || raw.includes("기타")) return "기타공지";
  return raw.length <= 8 ? raw : fallback;
}

function categoryTone(label: string) {
  if (label.includes("반려")) return { bg: "#FBEAF0", fg: "#993556" };
  if (label.includes("종합")) return { bg: COLORS.yellow50, fg: COLORS.yellow700 };
  if (label.includes("행사") || label.includes("시험") || label.includes("족보")) return { bg: "#FBEAF0", fg: "#993556" };
  if (label.includes("진행중")) return { bg: "#EAF3DE", fg: "#3B6D11" };
  if (label === "마감") return { bg: "#F1F3F5", fg: COLORS.muted };
  if (label.includes("졸업") || label.includes("논문")) return { bg: "#EAF3DE", fg: "#3B6D11" };
  if (label.includes("인증") || label.includes("완료")) return { bg: COLORS.green50, fg: COLORS.green700 };
  if (label.includes("대기")) return { bg: COLORS.yellow50, fg: COLORS.yellow700 };
  if (label.includes("건의") || label.includes("답변")) return { bg: COLORS.cyan50, fg: COLORS.cyan700 };
  if (label.includes("후기")) return { bg: "#EEEDFE", fg: "#3C3489" };
  if (label.includes("기타")) return { bg: "#F0EEF9", fg: "#5A4C8B" };
  return { bg: "#E6F1FB", fg: "#0C447C" };
}

function isAdminParticipationGuideBoard(board?: { slug?: string } | null) {
  return board?.slug === "club-promo" || board?.slug === "networking-programs";
}

function firstUrlFromText(value: string) {
  return value.match(/https?:\/\/[^\s)]+/)?.[0];
}

function IconButton({ icon, onPress, label, size = 24, color = COLORS.text }: { icon: IconName; onPress: () => void; label: string; size?: number; color?: string }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={styles.iconButton}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

// Figma Detail-Image(Horizontal|Vertical)-Reordered: 참여활동 대표 이미지는
// 가로형이면 320x240(4:3), 세로형이면 320x400(4:5) 고정 박스에 cover로 채운다.
function ParticipationHeroImage({ media }: { media: MediaReference }) {
  const [aspect, setAspect] = useState<number | null>(null);
  const { uri } = useMediaAccessUrl(media);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled && width > 0 && height > 0) setAspect(width / height);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return (
    <View style={[styles.participationHeroBox, { aspectRatio: aspect !== null && aspect < 1 ? 4 / 5 : 4 / 3 }]}>
      <MediaImage media={media} resizeMode="cover" style={styles.participationHeroImage} />
    </View>
  );
}

function NoticeAttachmentImage({ media }: { media: MediaReference }) {
  const [sourceAspectRatio, setSourceAspectRatio] = useState<number | null>(null);
  const { uri } = useMediaAccessUrl(media);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled && width > 0 && height > 0) setSourceAspectRatio(width / height);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return (
    <View
      style={[
        styles.imageAttachment,
        styles.noticeImageAttachment,
        styles.noticeImageRadius,
        { aspectRatio: noticeAttachmentFrameAspectRatio(sourceAspectRatio) },
      ]}
    >
      <MediaImage
        media={media}
        onLoad={(event) => {
          const dimensions = imageDimensionsFromLoadEvent(event);
          if (dimensions) setSourceAspectRatio(dimensions.width / dimensions.height);
        }}
        resizeMode="contain"
        style={styles.noticeAttachmentImage}
      />
    </View>
  );
}

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ postId: string; fromBoardId?: string; returnTo?: string }>();
  const insets = useSafeAreaInsets();
  const postId = Number(params.postId);
  const lastFocusedPostIdRef = useRef<number | null>(null);
  const userId = useUserStore((state) => state.userId);
  const currentUser = useUserStore((state) => state.user);

  const { data: postRes, isError, isLoading, refetch } = usePostDetail(postId);
  const { data: boardsRes } = useBoardsQuery();

  const post = postRes?.data;
  const boards = boardsRes?.data.flatMap((group) => group.boards) ?? [];
  const board = boards.find((item) => item.id === post?.board_id);
  const setHighlightTab = useTabHighlightStore((state) => state.setTab);
  useEffect(() => {
    if (board) setHighlightTab(tabNameFromRoute(boardParentRoute(board)));
  }, [board, setHighlightTab]);
  const isMutualAidRequest = board?.board_type === "mutual_aid";
  const isSuggestionRequest = board?.board_type === "suggestion";
  const isNotice = board?.board_type === "notice" || post?.is_notice === true;
  const isResource = board?.board_type === "resource";
  const commentsDisabled = isMutualAidRequest || isSuggestionRequest || isNotice || board?.board_type === "activity_certification" || board?.board_type === "activity_history" || Boolean(board?.slug && NO_COMMENT_RESOURCE_SLUGS.has(board.slug));
  const { data: commentRes } = usePostComments(postId, Boolean(board) && !commentsDisabled);
  const comments = commentRes?.data ?? [];

  const [commentText, setCommentText] = useState("");
  const [commentInputHeight, setCommentInputHeight] = useState(36); // Figma: 입력창 36h
  const commentSubmitLockRef = useRef(false);
  const commentInputRef = useRef<TextInput>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const replyComposer = getReplyComposerState(replyTarget);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>(REPORT_REASONS[0].value);
  const [reportDetail, setReportDetail] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [reportedTargets, setReportedTargets] = useState<Record<string, boolean>>({});
  const [suggestionStatus, setSuggestionStatus] = useState("received");
  const [suggestionReply, setSuggestionReply] = useState("");
  const [mutualAidStatus, setMutualAidStatus] = useState<MutualAidStatus>("processing");
  const [mutualAidRejectionReason, setMutualAidRejectionReason] = useState("");
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<number | null>(null);
  const [commentDeleteError, setCommentDeleteError] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const likeMutation = useToggleLike(postId, post?.board_id ?? 0, board);
  const bookmarkMutation = useToggleBookmark(postId);
  const createCommentMutation = useCreateComment(postId);
  const updateCommentMutation = useUpdateComment(postId);
  const deleteCommentMutation = useDeleteComment(postId);
  const deletePostMutation = useDeletePost(postId, post?.board_id ?? 0, board);
  const updateSuggestionMutation = useUpdateSuggestion(postId);
  const updateMutualAidMutation = useUpdateMutualAid(postId);

  useEffect(() => {
    if (!post) return;
    setIsLiked(post.is_liked);
    setIsBookmarked(post.is_bookmarked);
    setLikeCount(post.like_count);
    setSuggestionStatus(post.suggestion?.status ?? post.status ?? "received");
    setSuggestionReply(post.suggestion?.admin_reply ?? "");
    setMutualAidStatus(post.mutual_aid?.status ?? "processing");
    setMutualAidRejectionReason(post.mutual_aid?.rejection_reason ?? "");
  }, [post]);

  useEffect(() => {
    setGalleryIndex(0);
  }, [postId]);

  useFocusEffect(
    useCallback(() => {
      const decision = postDetailFocusDecision(lastFocusedPostIdRef.current, postId);
      lastFocusedPostIdRef.current = decision.nextFocusedPostId;
      if (decision.shouldRefetch) {
        void refetch();
      }
    }, [postId, refetch])
  );

  const handlePostBack = useCallback(() => {
    // These overlays are in-screen views, so consume Back before navigating.
    if (pendingDeleteCommentId !== null) {
      if (!deleteCommentMutation.isPending) {
        setPendingDeleteCommentId(null);
        setCommentDeleteError(null);
      }
      return;
    }
    if (showDeleteConfirm) {
      if (!deletePostMutation.isPending) setShowDeleteConfirm(false);
      return;
    }
    if (reportTarget) {
      setReportTarget(null);
      return;
    }
    if (showPostMenu) {
      setShowPostMenu(false);
      return;
    }
    navigateFromPostDetail(board, params.fromBoardId, params.returnTo, {
      canGoBack: () => router.canGoBack(),
      back: () => router.back(),
      navigate: (route) => router.navigate(route as never),
      replace: (route) => router.replace(route as never),
    });
  }, [board, deleteCommentMutation.isPending, deletePostMutation.isPending, params.fromBoardId, params.returnTo, pendingDeleteCommentId, reportTarget, showDeleteConfirm, showPostMenu]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return undefined;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        handlePostBack();
        return true;
      });
      return () => subscription.remove();
    }, [handlePostBack])
  );

  const navigationHeader = (
    <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
      <IconButton icon="chevron-back" label="뒤로" onPress={handlePostBack} />
      <Text numberOfLines={1} style={styles.appBarTitle}>{board?.name ?? "게시글"}</Text>
      <View style={styles.iconButton} />
    </View>
  );

  if (isLoading) {
    return <View style={styles.screen}>{navigationHeader}<LoadingState /></View>;
  }

  if (isError || !post) {
    return (
      <View style={styles.screen}>
        {navigationHeader}
        <View style={styles.center}>
          <Text style={styles.loadErrorText}>게시글을 불러오지 못했습니다.</Text>
          <Pressable accessibilityRole="button" onPress={() => void refetch()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const isMine = post.author_id === userId;
  const isAdmin = isAdminUser(currentUser);
  const hasLockedSuggestion = Boolean(post.suggestion?.admin_reply);
  const metadata = post.metadata ?? {};
  const isCouncilActivityEntry = metadata.show_in_council_activity === true;
  const isAdminParticipationGuide = isAdminParticipationGuideBoard(board);
  const applicationButtonLabel = board?.slug === "networking-programs" ? "참가 신청" : "가입 신청";
  const resourceLabel = isResource ? resourceCategoryLabel(board, post.category) : null;
  const label = isMutualAidRequest
    ? MUTUAL_AID_STATUSES.find((status) => status.value === post.mutual_aid?.status)?.label ?? "처리중"
    : isSuggestionRequest
      ? SUGGESTION_STATUSES.find((status) => status.value === post.suggestion?.status)?.label ?? "대기중"
      : board?.board_type === "activity_certification"
        ? activityCertificationBadgeLabel(post, board?.slug)
      : resourceLabel
        ? resourceLabel
      : board?.slug === "study-recruit"
        ? String(metadata.recruitment_status ?? post.category ?? "").toLowerCase().includes("closed") || post.category?.includes("마감")
          ? "마감"
          : "진행중"
      : categoryLabel(post.category, isAdminParticipationGuide ? "모집중" : board?.board_type === "notice" ? "공지" : board?.name ?? "게시글");
  const tone = categoryTone(label);
  const applicationUrl = participationApplicationUrl(metadata);
  const isRecruitmentClosed =
    String(metadata.recruitment_status ?? post.category ?? "").toLowerCase().includes("closed") ||
    Boolean(post.category?.includes("마감"));
  const contentUrl = firstUrlFromText(post.content);
  const canManagePost = (isMine || isAdmin) && !hasLockedSuggestion;
  const canEditOwn =
    isMine &&
    !hasLockedSuggestion &&
    !isNotice &&
    (!isMutualAidRequest || canEditMutualAidRequest(post.mutual_aid?.status));
  const canDeleteOwn =
    isMine &&
    !hasLockedSuggestion &&
    !isNotice &&
    (!isMutualAidRequest || canDeleteMutualAidRequest(post.mutual_aid?.status));
  // 관리자만 작성하는 게시판(공지사항, 동아리 홍보, 네트워킹, 원우회 활동내역 등)은 신고 대상이 아니다.
  const isAdminOnlyBoard = board?.write_permission === "admin";
  const postReportEntry = getReportEntryState({
    isMine,
    isReported: Boolean(reportedTargets[`post:${post.id}`]),
    isAllowedTarget: !isAdminOnlyBoard,
  });
  const showReportItem = postReportEntry.visible;
  const showBlockItem = shouldShowPostAuthorBlock({
    authorId: post.author_id,
    isMine,
    canManagePost,
    isSuggestionRequest,
    isAdminOnlyBoard,
    boardSlug: board?.slug,
  });
  // 더보기 시트의 마지막 항목에는 구분선을 그리지 않는다 (Figma Report/MoreMenu)
  const lastMenuItem = [canEditOwn && "edit", canDeleteOwn && "delete", showReportItem && "report"]
    .filter(Boolean)
    .pop();
  const hasPostMenu = canEditOwn || canDeleteOwn || showReportItem || showBlockItem;
  const currentSuggestionLabel =
    SUGGESTION_STATUSES.find((status) => status.value === (post.suggestion?.status ?? suggestionStatus))?.label ??
    post.suggestion?.status ??
    suggestionStatus;
  const currentMutualAidLabel =
    MUTUAL_AID_STATUSES.find((status) => status.value === post.mutual_aid?.status)?.label ?? "처리중";
  const detailRows: [string, unknown][] =
    board?.board_type === "activity_certification"
      ? [
          ["활동일", metadata.activity_date],
          ["참가자", metadata.participants],
          ...(isAdmin ? ([["계좌번호", metadata.bank_account]] as [string, unknown][]) : []),
        ]
      : board?.board_type === "mutual_aid"
        ? [
            ["경조사 종류", post.mutual_aid?.event_type ?? post.category],
            [
              "날짜",
              formatBoardDate(
                post.mutual_aid?.event_date ??
                  (typeof metadata.event_date === "string" ? metadata.event_date : undefined),
              ),
            ],
            ["관계", post.mutual_aid?.relation ?? metadata.relation],
          ]
        : board?.slug === "study-recruit"
          ? [["스터디장 연락수단", metadata.contact]]
        : [];
  const visibleDetailRows = detailRows.filter(
    (row): row is [string, string] => typeof row[1] === "string" && row[1].trim().length > 0,
  );
  const hasMutualAidNote = isMutualAidRequest && post.content.trim().length > 0;
  const imageAttachments = post.attachments.filter((attachment) => attachment.content_type.startsWith("image/"));
  const normalizedGalleryIndex = Math.min(galleryIndex, Math.max(imageAttachments.length - 1, 0));
  const isActivityCertification = board?.board_type === "activity_certification";
  const activityImageLayout = activityImageLayoutFromMetadata(board?.metadata?.activity_image_layout);
  const isStudyRecruit = board?.slug === "study-recruit";
  const activityDetailHeading = isActivityCertification
    ? activityCertificationDetailHeading(board?.slug, post.title, label)
    : null;
  const isCouncilActivity = board?.board_type === "activity_history";
  const heroAttachment =
    board?.board_type === "album" || isActivityCertification || isCouncilActivityEntry
      ? imageAttachments[normalizedGalleryIndex]
      : imageAttachments[0];
  const galleryTotal = Math.max(imageAttachments.length, 1);
  const isPhotoAlbum = board?.board_type === "album";
  const hasVisualHero = board?.board_type === "album" || isActivityCertification || isCouncilActivityEntry;
  const heroImagePresentation = postDetailImagePresentation({
    placement: "hero",
    boardType: board?.board_type,
    boardSlug: board?.slug,
    isCouncilActivityEntry,
  });
  const hasNaturalHero = heroImagePresentation === "natural";
  const visibleAttachments = isPhotoAlbum
    ? []
    : isAdminParticipationGuide
      ? post.attachments.filter((attachment) => !attachment.content_type.startsWith("image/"))
    : hasVisualHero
      ? post.attachments.filter((attachment) => !attachment.content_type.startsWith("image/"))
      : post.attachments;
  const appBarTitle =
    board?.board_type === "album"
      ? post.title
      : isAdminParticipationGuide
        ? board?.slug === "networking-programs" ? "네트워킹" : "동아리"
        : isCouncilActivityEntry
          ? "원우회 활동내역"
        : isMutualAidRequest
          ? "상조회 신청 상세"
        : board?.board_type === "activity_certification"
          ? "활동 인증"
          : board?.slug === "lecture-reviews"
            ? "강의후기"
            : board?.slug === "exam-archive"
              ? "시험족보"
          : board?.board_type === "notice"
            ? "공지사항"
            : board?.name ?? "게시글";

  const requireLogin = () => {
    if (!userId) {
      router.push("/auth/login");
      return false;
    }
    return true;
  };

  const showPreviousImage = () => {
    if (imageAttachments.length < 2) return;
    setGalleryIndex((current) => (current - 1 + imageAttachments.length) % imageAttachments.length);
  };

  const showNextImage = () => {
    if (imageAttachments.length < 2) return;
    setGalleryIndex((current) => (current + 1) % imageAttachments.length);
  };

  const startReport = (target: ReportTarget) => {
    if (!requireLogin()) return;
    setReportTarget(target);
    setReportReason(REPORT_REASONS[0].value);
    setReportDetail("");
  };

  const reportSubmission = getReportSubmission(reportReason, reportDetail);
  const canSubmitReport = reportSubmission !== null;

  const submitReport = async () => {
    if (!reportTarget || !reportSubmission || !requireLogin()) return;
    try {
      setIsReporting(true);
      const response =
        reportTarget.type === "post"
          ? await reportApi.reportPost(reportTarget.id, reportSubmission)
          : await reportApi.reportComment(reportTarget.id, reportSubmission);
      setReportedTargets((current) => ({ ...current, [`${reportTarget.type}:${reportTarget.id}`]: true }));
      setReportTarget(null);
      setReportDetail("");
      Alert.alert(response.data.duplicate ? "이미 신고됨" : "신고 접수 완료", "검토 후 조치하겠습니다.");
    } catch {
      Alert.alert("신고 실패", "신고 내용을 확인하거나 잠시 후 다시 시도하세요.");
    } finally {
      setIsReporting(false);
    }
  };

  const handleLike = async () => {
    if (!requireLogin() || likeMutation.isPending) return;
    try {
      const response = await likeMutation.mutateAsync();
      setIsLiked(response.data.is_liked);
      setLikeCount(response.data.like_count);
    } catch {
      Alert.alert("좋아요 실패", "좋아요 상태를 변경할 수 없습니다.");
    }
  };

  const handleBookmark = async () => {
    if (!requireLogin() || bookmarkMutation.isPending) return;
    try {
      const response = await bookmarkMutation.mutateAsync();
      setIsBookmarked(response.data.is_bookmarked);
    } catch {
      Alert.alert("북마크 실패", "북마크 상태를 변경할 수 없습니다.");
    }
  };

  const handleParticipationApply = () => {
    if (applicationUrl) {
      Linking.openURL(applicationUrl);
      return;
    }
    Alert.alert(applicationButtonLabel, "관리자가 참여 링크를 준비 중입니다.");
  };

  const handleDeletePost = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeletePost = () => {
    deletePostMutation.mutate(undefined, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
        setShowPostMenu(false);
        navigateFromPostDetail(board, params.fromBoardId, params.returnTo, {
          canGoBack: () => router.canGoBack(),
          back: () => router.back(),
          navigate: (route) => {
            if (route.startsWith("/board/")) router.dismissTo(route as never);
            else router.navigate(route as never);
          },
          replace: (route) => router.replace(route as never),
        });
      },
      onError: () => Alert.alert("삭제 실패", "게시글을 삭제할 수 없습니다."),
    });
  };

  const handleDeleteComment = (commentId: number) => {
    if (deleteCommentMutation.isPending) return;
    setCommentDeleteError(null);
    setPendingDeleteCommentId(commentId);
  };

  const closeCommentDeleteConfirm = () => {
    if (deleteCommentMutation.isPending) return;
    setPendingDeleteCommentId(null);
    setCommentDeleteError(null);
  };

  const confirmDeleteComment = () => {
    if (pendingDeleteCommentId === null || deleteCommentMutation.isPending) return;
    deleteCommentMutation.mutate(pendingDeleteCommentId, {
      onSuccess: () => {
        setPendingDeleteCommentId(null);
        setCommentDeleteError(null);
        setReplyTarget(null);
      },
      onError: () => setCommentDeleteError("댓글을 삭제할 수 없습니다. 잠시 후 다시 시도해주세요."),
    });
  };

  const handleCreateComment = () => {
    if (!requireLogin()) return;
    const trimmed = commentSubmissionValue({
      text: commentText,
      isPending: createCommentMutation.isPending,
      isLocked: commentSubmitLockRef.current,
    });
    if (!trimmed) return;
    commentSubmitLockRef.current = true;
    createCommentMutation.mutate(
      { content: trimmed, parent_id: replyComposer.parentId },
      {
        onSuccess: () => {
          setCommentText("");
          setCommentInputHeight(38);
          setReplyTarget(null);
          Keyboard.dismiss();
        },
        onError: () => Alert.alert("댓글 등록 실패", "댓글을 저장할 수 없습니다."),
        onSettled: () => {
          commentSubmitLockRef.current = false;
        },
      }
    );
  };

  const handleCommentKeyPress = (event: TextInputKeyPressEvent) => {
    if (Platform.OS !== "web") return;
    const webEvent = event as WebTextInputKeyPressEvent;
    const action = commentKeyAction({
      key: webEvent.key ?? webEvent.nativeEvent.key,
      shiftKey: webEvent.shiftKey,
      isComposing: webEvent.nativeEvent.isComposing,
      keyCode: webEvent.nativeEvent.keyCode,
    });
    if (action !== "submit") return;
    event.preventDefault();
    handleCreateComment();
  };

  // 동아리/네트워킹 안내: 관리자가 등록한 사진을 제목과 본문 사이에 세로로 모두 나열한다.
  const participationImagesSection =
    isAdminParticipationGuide && imageAttachments.length > 0 ? (
      <View style={styles.participationImagesBlock}>
        {imageAttachments.map((image) => (
          <ParticipationHeroImage key={image.id} media={image} />
        ))}
      </View>
    ) : null;

  const visualHeroSection = hasVisualHero ? (
    <View style={[
      styles.visualHeroBlock,
      isAdminParticipationGuide ? styles.visualHeroBlockInset : null,
    ]}>
      <View style={[
        hasNaturalHero ? styles.visualHeroNatural : styles.visualHero,
        isPhotoAlbum ? styles.visualHeroAlbum : null,
      ]}>
        {heroAttachment ? (
          isAdminParticipationGuide ? (
            <ParticipationHeroImage key={heroAttachment.id} media={heroAttachment} />
          ) : isActivityCertification ? (
            <ActivityCertificationMediaImage
              key={heroAttachment.id}
              layout={activityImageLayout}
              media={heroAttachment}
            />
          ) : hasNaturalHero ? (
            <NaturalAspectMediaImage key={heroAttachment.id} media={heroAttachment}
              style={styles.visualHeroNaturalImage}
            />
          ) : (
            <MediaImage
              media={heroAttachment}
              resizeMode={heroImagePresentation === "fixed-contain" ? "contain" : "cover"}
              style={styles.visualHeroImage}
            />
          )
        ) : isAdminParticipationGuide ? (
          <View style={styles.participationHeroPlaceholder}>
            <ImagePlaceholderIcon size={36} />
          </View>
        ) : (
          <LinearGradient
            colors={
              board?.board_type === "album"
                ? ALBUM_FALLBACK_GRADIENTS[
                    normalizedGalleryIndex % ALBUM_FALLBACK_GRADIENTS.length
                  ]
                : ["#2761FF", "#86C8FF"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.visualHeroFallback,
              hasNaturalHero ? styles.visualHeroFallbackNatural : null,
            ]}
          />
        )}
        {board?.board_type === "album" || isActivityCertification || isCouncilActivityEntry ? (
          <>
            {imageAttachments.length > 1 ? (
              <>
                <Pressable accessibilityLabel="이전 사진" onPress={showPreviousImage} style={[styles.galleryArrow, styles.galleryArrowLeft]}>
                  <SliderPrevIcon size={28} />
                </Pressable>
                <Pressable accessibilityLabel="다음 사진" onPress={showNextImage} style={[styles.galleryArrow, styles.galleryArrowRight]}>
                  <SliderNextIcon size={28} />
                </Pressable>
              </>
            ) : null}
            {/* Figma: 사진첩 상세에는 n/N 카운터가 없다 */}
            {!isPhotoAlbum ? (
              <View style={styles.galleryCount}>
                <Text style={styles.galleryCountText}>{normalizedGalleryIndex + 1} / {galleryTotal}</Text>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
      {board?.board_type === "album" && imageAttachments.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryThumbs}>
          {(imageAttachments.length > 0 ? imageAttachments : [null, null, null, null]).map((attachment, index) => {
            return (
              <Pressable
                key={attachment?.id ?? `fallback-${index}`}
                accessibilityLabel={`${index + 1}번째 사진`}
                disabled={!attachment}
                onPress={() => setGalleryIndex(index)}
                style={[styles.galleryThumb, index === normalizedGalleryIndex ? styles.galleryThumbActive : null]}
              >
                {attachment ? (
                  <MediaImage media={attachment} style={styles.galleryThumbImage} />
                ) : (
                  <LinearGradient
                    colors={ALBUM_FALLBACK_GRADIENTS[index % ALBUM_FALLBACK_GRADIENTS.length]}
                    style={styles.galleryThumbFallback}
                  />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  ) : null;

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <IconButton
          icon="chevron-back"
          label="뒤로"
          onPress={handlePostBack}
        />
        <Text numberOfLines={1} style={styles.appBarTitle}>
          {appBarTitle}
        </Text>
        {isPhotoAlbum ? (
          <View style={styles.iconButton} />
        ) : (
          <View style={styles.appBarActions}>
            {!isAdminParticipationGuide && !isActivityCertification && !isStudyRecruit && !isCouncilActivity && !isMutualAidRequest ? (
              <Pressable accessibilityLabel="북마크" onPress={handleBookmark} style={[styles.iconButton, styles.appBarActionButton]}>
                <BookmarkIcon filled={isBookmarked} color={isBookmarked ? COLORS.primary : COLORS.text} size={20} />
              </Pressable>
            ) : null}
            {hasPostMenu && !isCouncilActivity ? (
              <Pressable accessibilityLabel="더보기" onPress={() => setShowPostMenu(true)} style={[styles.iconButton, styles.appBarActionButton]}>
                <MoreIcon color={COLORS.text} />
              </Pressable>
            ) : null}
          </View>
        )}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroller} contentContainerStyle={[styles.content, isAdminParticipationGuide || isCouncilActivityEntry || isPhotoAlbum || commentsDisabled ? styles.contentWithoutCommentBar : null]}>
        {!isAdminParticipationGuide ? visualHeroSection : null}

        {board?.board_type !== "album" ? (
          <>
            {activityDetailHeading?.titleText ? (
              <Text style={styles.activityStudyTitle}>{activityDetailHeading.titleText}</Text>
            ) : activityDetailHeading?.tagText ? (
              <View style={[styles.categoryPill, { backgroundColor: tone.bg }]}>
                <Text style={[styles.categoryText, { color: tone.fg }]}>{activityDetailHeading.tagText}</Text>
              </View>
            ) : isCouncilActivity ? null : (
              <View style={[styles.categoryPill, isMutualAidRequest ? styles.mutualAidPill : null, { backgroundColor: tone.bg }]}>
                <Text style={[styles.categoryText, isMutualAidRequest ? styles.mutualAidPillText : null, { color: tone.fg }]}>{label}</Text>
              </View>
            )}

            {!isActivityCertification ? (
              <Text style={[styles.title, board?.board_type === "notice" ? styles.titleNotice : isMutualAidRequest ? styles.titleMutualAid : (isAdminParticipationGuide || isStudyRecruit || isCouncilActivity) ? styles.titleGuide : null]}>{post.title}</Text>
            ) : null}
            {isAdminParticipationGuide ? participationImagesSection : null}
            {!isAdminParticipationGuide && !isActivityCertification && !isCouncilActivity && !isCouncilActivityEntry ? (
              <Text style={[styles.meta, board?.board_type === "notice" ? styles.metaNotice : isMutualAidRequest ? styles.metaMutualAid : null]}>
                {board?.board_type === "notice"
                  ? `${formatBoardDate(post.created_at)} · 조회 ${post.view_count}`
                  : isMutualAidRequest
                    ? `${formatCohortName(post.author_cohort, post.author_nickname)} · ${formatBoardDate(post.created_at)}`
                  : isResource
                    ? resourceDetailMeta({
                        boardSlug: board?.slug,
                        authorCohort: post.author_cohort,
                        authorNickname: post.author_nickname,
                        createdAt: post.created_at,
                      })
                  : commentsDisabled
                    ? formatBoardDate(post.created_at)
                  : isStudyRecruit
                    ? `${formatCohortName(post.author_cohort, post.author_nickname)} · ${formatBoardDate(post.created_at)}`
                  : `${post.author_nickname} · ${formatBoardDate(post.created_at)}`}
              </Text>
            ) : null}

            {!isAdminParticipationGuide && !isActivityCertification ? (
              <View style={[styles.bodyDivider, isMutualAidRequest ? styles.mutualAidBodyDivider : null]} />
            ) : null}
          </>
        ) : null}
        {!isPhotoAlbum && !isMutualAidRequest && post.content.trim() ? <Text style={[styles.body, isActivityCertification ? styles.bodyTopGapCert : isAdminParticipationGuide ? styles.bodyTopGap : null]}>{post.content}</Text> : null}


        {isActivityCertification ? (
          <>
            {typeof metadata.activity_date === "string" && metadata.activity_date.trim() ? (
              <View style={styles.certDateRow}>
                <CalendarSmallIcon size={16} color={COLORS.muted} />
                <Text style={styles.certDateText}>{formatBoardDate(metadata.activity_date)}</Text>
              </View>
            ) : null}
            {typeof metadata.participants === "string" && metadata.participants.trim() ? (
              <>
                <Text style={styles.certParticipantLabel}>참가자</Text>
                <View style={styles.certParticipantList}>
                  {metadata.participants
                    .split(",")
                    .map((name) => name.trim())
                    .filter(Boolean)
                    .map((name, index) => (
                      <View key={`${name}-${index}`} style={styles.certParticipantChip}>
                        <Text style={styles.certParticipantChipText}>{name}</Text>
                      </View>
                    ))}
                </View>
              </>
            ) : null}
          </>
        ) : isStudyRecruit ? (
          typeof metadata.contact === "string" && metadata.contact.trim() ? (
            <View style={[styles.certDateRow, styles.studyContactRow]}>
              <Ionicons name="mail-outline" size={15} color={COLORS.muted} />
              <Text style={styles.certDateText}>스터디장 연락수단 {metadata.contact}</Text>
            </View>
          ) : null
        ) : detailRows.length > 0 ? (
          <View style={[styles.infoBox, isMutualAidRequest ? styles.mutualAidInfoBox : null]}>
            {visibleDetailRows
              .map(([rowLabel, value], index) => (
                <View
                  key={rowLabel}
                  style={[
                    styles.infoRow,
                    isMutualAidRequest ? styles.mutualAidInfoRow : null,
                    isMutualAidRequest && !hasMutualAidNote && index === visibleDetailRows.length - 1
                      ? styles.mutualAidInfoRowLast
                      : null,
                  ]}
                >
                  <Text style={[styles.infoLabel, isMutualAidRequest ? styles.mutualAidInfoLabel : null]}>{rowLabel}</Text>
                  <Text style={[styles.infoValue, isMutualAidRequest ? styles.mutualAidInfoValue : null]}>
                    {isMutualAidRequest && rowLabel === "날짜" ? formatBoardDate(value) : value}
                  </Text>
                </View>
              ))}
          </View>
        ) : null}

        {isMutualAidRequest && post.content.trim() ? (
          <View style={[styles.infoRow, styles.mutualAidInfoRow, styles.mutualAidInfoRowLast]}>
            <Text style={[styles.infoLabel, styles.mutualAidInfoLabel]}>비고</Text>
            <Text style={[styles.infoValue, styles.mutualAidInfoValue]}>{post.content}</Text>
          </View>
        ) : null}

        {visibleAttachments.length > 0 ? (
          <View style={[styles.attachmentsList, isMutualAidRequest ? styles.mutualAidAttachments : null]}>
            {isMutualAidRequest ? <Text style={styles.mutualAidSectionLabel}>증빙서류</Text> : null}
            {visibleAttachments.map((attachment) => {
              const isImage = attachment.content_type.startsWith("image/");
              const canOpenAttachment = shouldOpenPostAttachment({
                isNotice,
                contentType: attachment.content_type,
              });
              return !canOpenAttachment ? (
                <NoticeAttachmentImage key={attachment.id} media={attachment} />
              ) : (
                <Pressable
                  key={attachment.id}
                  onPress={async () => {
                    try {
                      const accessUrl = await resolveMediaAccessUrl(attachment);
                      if (accessUrl) {
                        await openMediaUrl(accessUrl, {
                          platform: Platform.OS,
                          assignWebLocation: (url) => window.location.assign(url),
                          openExternalUrl: (url) => Linking.openURL(url),
                        });
                      }
                    } catch {
                      Alert.alert("파일 열기 실패", "첨부 파일에 접근할 수 없습니다.");
                    }
                  }}
                  style={isImage ? styles.imageAttachment : styles.fileAttachment}
                >
                  {isImage ? (
                    <NaturalAspectMediaImage
                      media={attachment}
                      style={styles.attachmentImage}
                    />
                  ) : null}
                  {!isImage ? (
                    <>
                      <AttachDocIcon size={18} />
                      <Text numberOfLines={1} style={styles.fileName}>
                        {attachment.original_filename}
                      </Text>
                      <DownloadIcon size={18} />
                    </>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {board?.board_type === "notice" && contentUrl ? (
          <View style={[styles.attachmentsList, visibleAttachments.length > 0 ? styles.attachmentsFollowup : null]}>
            <Pressable onPress={() => Linking.openURL(contentUrl)} style={styles.fileAttachment}>
              <AttachLinkIcon size={16} />
              <Text numberOfLines={1} style={styles.fileName}>{contentUrl}</Text>
              <ExternalLinkIcon size={18} />
            </Pressable>
          </View>
        ) : null}

        {isAdminParticipationGuide ? (
          isRecruitmentClosed ? (
            <View style={[styles.joinButton, styles.joinButtonClosed]}>
              <Text style={[styles.joinButtonText, styles.joinButtonClosedText]}>모집 마감</Text>
            </View>
          ) : (
            <Pressable onPress={handleParticipationApply} style={styles.joinButton}>
              <Text style={styles.joinButtonText}>{applicationButtonLabel}</Text>
            </Pressable>
          )
        ) : null}

        {post.suggestion?.admin_reply ? (
          <View style={styles.officialReplyBox}>
            <View style={styles.officialReplyTitleRow}>
              <Image source={require("../../../../assets/images/council-reply.png")} style={styles.officialReplyIcon} />
              <Text style={styles.officialReplyTitle}>원우회 답변</Text>
            </View>
            <Text style={styles.officialReplyBody}>{post.suggestion.admin_reply}</Text>
            {post.suggestion.replied_at ? <Text style={styles.officialReplyDate}>{formatBoardDate(post.suggestion.replied_at)}</Text> : null}
          </View>
        ) : null}

        {post.suggestion && isAdmin ? (
          <View style={styles.suggestionBox}>
            <Text style={styles.suggestionTitle}>관리자 답변 관리</Text>
            <Text style={styles.suggestionStatus}>{currentSuggestionLabel}</Text>
            <View style={styles.adminReplyBox}>
                <View style={styles.statusRow}>
                  {SUGGESTION_STATUSES.map((status) => (
                    <Pressable
                      key={status.value}
                      onPress={() => setSuggestionStatus(status.value)}
                      style={[styles.statusChip, suggestionStatus === status.value ? styles.statusChipActive : null]}
                    >
                      <Text style={[styles.statusChipText, suggestionStatus === status.value ? styles.statusChipTextActive : null]}>{status.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  multiline
                  value={suggestionReply}
                  onChangeText={setSuggestionReply}
                  placeholder="공식 답변"
                  placeholderTextColor={COLORS.subtle}
                  style={styles.replyTextarea}
                />
                <Pressable
                  disabled={updateSuggestionMutation.isPending}
                  onPress={() => {
                    if (suggestionStatus === "answered" && !suggestionReply.trim()) {
                      Alert.alert("답변 내용 필요", "답변완료 처리하려면 공식 답변을 입력해주세요.");
                      return;
                    }
                    updateSuggestionMutation.mutate({
                      status: suggestionStatus,
                      admin_reply: suggestionReply.trim() || undefined,
                    });
                  }}
                  style={styles.replySaveButton}
                >
                  <Text style={styles.replySaveText}>{updateSuggestionMutation.isPending ? "저장 중" : "답변 저장"}</Text>
                </Pressable>
            </View>
          </View>
        ) : null}

        {post.mutual_aid?.rejection_reason && !isAdmin ? (
          <View style={styles.mutualAidRejectionBox}>
            <Text style={styles.mutualAidRejectionTitle}>반려 사유</Text>
            <Text style={styles.mutualAidRejectionBody}>{post.mutual_aid.rejection_reason}</Text>
          </View>
        ) : null}

        {post.mutual_aid && isAdmin ? (
          <View style={styles.suggestionBox}>
            <Text style={styles.suggestionTitle}>상조회 처리 상태</Text>
            <Text style={styles.suggestionStatus}>{currentMutualAidLabel}</Text>
            {post.mutual_aid.rejection_reason ? (
              <Text style={styles.suggestionBody}>반려 사유: {post.mutual_aid.rejection_reason}</Text>
            ) : null}
            {typeof metadata.proof_url === "string" && metadata.proof_url.trim() ? (
              <Pressable onPress={() => Linking.openURL(metadata.proof_url as string)} style={styles.externalLinkButton}>
                <Ionicons name="link-outline" size={18} color={COLORS.primary} />
                <Text numberOfLines={1} style={styles.externalLinkText}>{metadata.proof_url}</Text>
                <Ionicons name="open-outline" size={17} color={COLORS.primary} />
              </Pressable>
            ) : null}
            {isAdmin ? (
              <View style={styles.adminReplyBox}>
                <View style={styles.statusRow}>
                  {MUTUAL_AID_STATUSES.map((status) => (
                    <Pressable
                      key={status.value}
                      onPress={() => setMutualAidStatus(status.value)}
                      style={[styles.statusChip, mutualAidStatus === status.value ? styles.statusChipActive : null]}
                    >
                      <Text style={[styles.statusChipText, mutualAidStatus === status.value ? styles.statusChipTextActive : null]}>
                        {status.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {mutualAidStatus === "rejected" ? (
                  <TextInput
                    multiline
                    value={mutualAidRejectionReason}
                    onChangeText={setMutualAidRejectionReason}
                    placeholder="반려 사유를 입력하세요"
                    placeholderTextColor={COLORS.subtle}
                    style={styles.replyTextarea}
                  />
                ) : null}
                <Pressable
                  disabled={updateMutualAidMutation.isPending}
                  onPress={() => {
                    if (mutualAidStatus === "rejected" && !mutualAidRejectionReason.trim()) {
                      Alert.alert("반려 사유 필요", "반려 사유를 입력해주세요.");
                      return;
                    }
                    updateMutualAidMutation.mutate(
                      {
                        status: mutualAidStatus,
                        rejection_reason: mutualAidStatus === "rejected" ? mutualAidRejectionReason.trim() : undefined,
                      },
                      { onSuccess: () => Alert.alert("상태 저장", "상조회 처리 상태가 저장되었습니다.") }
                    );
                  }}
                  style={styles.replySaveButton}
                >
                  <Text style={styles.replySaveText}>{updateMutualAidMutation.isPending ? "저장 중" : "상태 저장"}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {!isAdminParticipationGuide && !isCouncilActivityEntry && !isPhotoAlbum && !isMutualAidRequest && !isSuggestionRequest && !isNotice && !isActivityCertification && !isStudyRecruit && !isCouncilActivity ? (
          <View style={styles.actionRow}>
            <Pressable disabled={likeMutation.isPending} onPress={handleLike} style={styles.iconAction}>
              <Ionicons name={isLiked ? "heart" : "heart-outline"} size={16} color={isLiked ? COLORS.primary : COLORS.muted} />
              <Text style={styles.actionText}>추천 {likeCount}</Text>
            </Pressable>
            {!commentsDisabled ? (
              <View style={styles.iconAction}>
                <Ionicons name="chatbubble-outline" size={16} color={COLORS.muted} />
                <Text style={styles.actionText}>댓글 {post.comment_count}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {!isAdminParticipationGuide && !isCouncilActivityEntry && !isPhotoAlbum && !commentsDisabled ? (
          <View style={styles.commentSection}>
            <Text style={styles.commentTitle}>댓글 {post.comment_count}</Text>
            {comments.length === 0 ? <Text style={styles.emptyComment}>아직 댓글이 없어요. 첫 댓글을 남겨보세요!</Text> : null}
            {comments.map((comment, index) => (
              <Fragment key={comment.id}>
                {index > 0 ? <View style={styles.commentThreadDivider} /> : null}
              <CommentItem
                comment={comment}
                currentUserId={userId}
                onDelete={handleDeleteComment}
                onEdit={async (commentId, content) => {
                  try {
                    await updateCommentMutation.mutateAsync({ commentId, content });
                  } catch (error) {
                    Alert.alert("댓글 수정 실패", "댓글을 수정할 수 없습니다.");
                    throw error;
                  }
                }}
                onReport={startReport}
                reportedTargets={reportedTargets}
                // 스터디 모집 댓글에는 답글(대댓글)을 제공하지 않는다.
                onReply={
                  isStudyRecruit
                    ? undefined
                    : (comment) => {
                        setReplyTarget(createReplyTarget(comment));
                        // 답글을 누르면 바로 입력창에 커서를 준다.
                        commentInputRef.current?.focus();
                      }
                }
              />
              </Fragment>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {!isAdminParticipationGuide && !isCouncilActivityEntry && !isPhotoAlbum && !commentsDisabled ? (
        <View style={[styles.commentBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {replyComposer.noticeText ? (
            <View style={styles.replyNotice}>
              <Text style={styles.replyNoticeText}>{replyComposer.noticeText}</Text>
              <Pressable accessibilityLabel="답글 대상 취소" onPress={() => setReplyTarget(null)}>
                <Text style={styles.replyCancelText}>취소</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.commentInputRow}>
            <TextInput
              ref={commentInputRef}
              blurOnSubmit={Platform.OS === "web" ? false : undefined}
              multiline
              value={commentText}
              onChangeText={setCommentText}
              onContentSizeChange={(event) => {
                setCommentInputHeight(Math.min(88, Math.max(36, event.nativeEvent.contentSize.height)));
              }}
              onKeyPress={handleCommentKeyPress}
              onSubmitEditing={Platform.OS === "web" ? undefined : handleCreateComment}
              placeholder={replyComposer.placeholder}
              placeholderTextColor="#A6ACB7"
              returnKeyType="send"
              scrollEnabled={commentInputHeight >= 88}
              style={[styles.commentInput, { height: commentInputHeight }, { outlineStyle: "none" } as never]}
              submitBehavior={Platform.OS === "web" ? "newline" : "submit"}
            />
            <Pressable accessibilityLabel="댓글 등록" disabled={createCommentMutation.isPending} onPress={handleCreateComment}>
              <SendIcon size={36} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {showPostMenu ? (
        <Pressable accessibilityLabel="더보기 메뉴 닫기" onPress={() => setShowPostMenu(false)} style={styles.modalBackdrop}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.menuSheet}>
            <View style={styles.sheetHandle} />
            {canEditOwn ? (
              <Pressable
                onPress={() => {
                  setShowPostMenu(false);
                  router.push(
                    postEditRouteForPostDetail(
                      board,
                      post.board_id,
                      post.id,
                      params.fromBoardId,
                      params.returnTo,
                    ) as never,
                  );
                }}
                style={[styles.sheetMenuItem, lastMenuItem === "edit" ? styles.sheetMenuItemLast : null]}
              >
                <PencilIcon size={20} color={COLORS.text} />
                <Text style={styles.sheetMenuText}>수정</Text>
              </Pressable>
            ) : null}
            {canDeleteOwn ? (
              <Pressable
                onPress={() => {
                  setShowPostMenu(false);
                  handleDeletePost();
                }}
                style={[styles.sheetMenuItem, lastMenuItem === "delete" ? styles.sheetMenuItemLast : null]}
              >
                <TrashIcon size={20} color="#D64545" />
                <Text style={[styles.sheetMenuText, styles.sheetMenuDangerText]}>삭제</Text>
              </Pressable>
            ) : null}
            {showReportItem ? (
              <Pressable
                disabled={postReportEntry.action === "none"}
                onPress={() => {
                  setShowPostMenu(false);
                  startReport({ type: "post", id: post.id, label: "게시글" });
                }}
                style={[styles.sheetMenuItem, lastMenuItem === "report" ? styles.sheetMenuItemLast : null]}
              >
                <FlagIcon size={20} color={COLORS.text} />
                <Text style={styles.sheetMenuText}>{postReportEntry.label}</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      ) : null}

      {reportTarget ? (
        <Pressable accessibilityLabel="신고하기 닫기" onPress={() => setReportTarget(null)} style={styles.modalBackdrop}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.reportSheet}>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.reportScroller} contentContainerStyle={styles.reportContent}>
              <View style={styles.sheetHandle} />
              <Text style={styles.reportSheetTitle}>신고하기</Text>
              <Text style={styles.reportSheetSubtitle}>신고 사유를 선택해주세요</Text>
              <View style={styles.reportReasonList}>
                {REPORT_REASONS.map((reason, index) => {
                  const selected = reportReason === reason.value;
                  const isLast = index === REPORT_REASONS.length - 1;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      key={reason.value}
                      onPress={() => setReportReason(reason.value)}
                      style={[styles.reportReasonItem, isLast ? styles.reportReasonItemLast : null, { outlineStyle: "none" } as never]}
                    >
                      <View style={[styles.radioOuter, selected ? styles.radioOuterSelected : null]}>
                        {selected ? <View style={styles.radioInner} /> : null}
                      </View>
                      <Text style={[styles.reportReasonText, selected ? styles.reportReasonTextSelected : null]}>{reason.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {reportReason === "other" ? (
                <TextInput
                  maxLength={1000}
                  multiline
                  value={reportDetail}
                  onChangeText={setReportDetail}
                  placeholder="구체적인 사유를 입력해주세요"
                  placeholderTextColor={COLORS.subtle}
                  style={[styles.reportDetailInput, { outlineStyle: "none" } as never]}
                  textAlignVertical="top"
                />
              ) : null}
              <Pressable
                disabled={isReporting || !canSubmitReport}
                onPress={submitReport}
                style={[styles.reportPrimaryButton, isReporting || !canSubmitReport ? styles.buttonDisabled : null]}
              >
                <Text style={styles.reportPrimaryButtonText}>{isReporting ? "제출 중" : "제출"}</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      ) : null}

      {showDeleteConfirm ? (
        <Pressable
          accessibilityLabel="게시물 삭제 닫기"
          onPress={() => {
            if (!deletePostMutation.isPending) setShowDeleteConfirm(false);
          }}
          style={styles.confirmBackdrop}
        >
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>게시물 삭제</Text>
            <Text style={styles.confirmBody}>삭제한 게시물은 복구할 수 없어요.{"\n"}작성한 댓글도 함께 삭제돼요.</Text>
            <View style={styles.confirmActions}>
              <Pressable
                disabled={deletePostMutation.isPending}
                onPress={() => {
                  if (!deletePostMutation.isPending) setShowDeleteConfirm(false);
                }}
                style={styles.confirmCancelButton}
              >
                <Text style={styles.confirmCancelText}>취소</Text>
              </Pressable>
              <Pressable disabled={deletePostMutation.isPending} onPress={confirmDeletePost} style={[styles.confirmDeleteButton, deletePostMutation.isPending ? styles.buttonDisabled : null]}>
                <Text style={styles.confirmDeleteText}>{deletePostMutation.isPending ? "삭제 중" : "삭제"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      ) : null}

      {pendingDeleteCommentId !== null ? (
        <Pressable accessibilityLabel="댓글 삭제 닫기" onPress={closeCommentDeleteConfirm} style={styles.confirmBackdrop}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{COMMENT_DELETE_COPY.title}</Text>
            <Text style={styles.confirmBody}>{COMMENT_DELETE_COPY.body}</Text>
            {commentDeleteError ? (
              <Text accessibilityRole="alert" style={styles.confirmErrorText}>
                {commentDeleteError}
              </Text>
            ) : null}
            <View style={styles.confirmActions}>
              <Pressable disabled={deleteCommentMutation.isPending} onPress={closeCommentDeleteConfirm} style={styles.confirmCancelButton}>
                <Text style={styles.confirmCancelText}>취소</Text>
              </Pressable>
              <Pressable
                disabled={deleteCommentMutation.isPending}
                onPress={confirmDeleteComment}
                style={[styles.confirmDeleteButton, deleteCommentMutation.isPending ? styles.buttonDisabled : null]}
              >
                <Text style={styles.confirmDeleteText}>{deleteCommentMutation.isPending ? "삭제 중" : "삭제"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.page,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: COLORS.page,
  },
  loadErrorText: {
    color: COLORS.muted,
    fontSize: 14,
  },
  retryButton: {
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  appBar: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
  },
  appBarTitle: {
    position: "absolute",
    left: 88,
    right: 88,
    textAlign: "center",
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "500",
  },
  appBarActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  appBarActionButton: {
    width: 32,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 24, 39, 0.38)",
    zIndex: 50,
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-end",
    backgroundColor: "rgba(17, 24, 39, 0.15)",
    zIndex: 50,
  },
  menuCard: {
    minWidth: 190,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    paddingVertical: 4,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  menuItem: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "500",
  },
  menuItemDanger: {
    color: "#D64545",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#EAECEF",
  },
  menuSheet: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: "#C7CCD4",
    marginBottom: 16,
  },
  sheetMenuItem: {
    minHeight: 50,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EAECEF",
  },
  sheetMenuText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 18,
  },
  sheetMenuDangerText: {
    color: "#D64545",
  },
  reportSheet: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "100%",
    alignSelf: "center",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
  },
  reportScroller: { flexGrow: 0 },
  reportContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  reportSheetTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "600",
    marginTop: 6,
  },
  reportSheetSubtitle: {
    color: "#6B727D",
    fontSize: 13,
    fontWeight: "400",
    marginTop: 4,
    marginBottom: 12,
  },
  reportReasonList: {
    marginTop: 4,
  },
  reportReasonItem: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EAECEF",
  },
  reportReasonItemLast: {
    borderBottomWidth: 0,
  },
  radioOuter: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#CBD1DA",
  },
  radioOuterSelected: {
    borderColor: COLORS.primary,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  reportReasonText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
  },
  reportReasonTextSelected: {
    fontWeight: "500",
  },
  reportDetailInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 8,
    color: COLORS.text,
    fontSize: 13,
    padding: 12,
    marginTop: 12,
  },
  reportPrimaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    marginTop: 16,
  },
  reportPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)", // Figma 딤드배경
    paddingHorizontal: 28,
    zIndex: 60,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 280, // Figma 댓글삭제확인모달 280w
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  confirmTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 26,
    textAlign: "center",
  },
  confirmBody: {
    color: "#4B5160",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 22,
    textAlign: "center",
    marginTop: 16,
  },
  sheetMenuItemLast: {
    borderBottomWidth: 0,
  },
  confirmErrorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19,
    marginTop: 12,
    textAlign: "center",
  },
  confirmActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  confirmCancelButton: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E1E4E9",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
  },
  confirmCancelText: {
    color: "#4B5160",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
  },
  confirmDeleteButton: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#D64545",
    paddingHorizontal: 14,
  },
  confirmDeleteText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
  },
  postMenu: {
    position: "absolute",
    right: 18,
    zIndex: 20,
    minWidth: 152,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.surface,
    paddingVertical: 5,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 8,
  },
  postMenuItem: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 14,
  },
  postMenuText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  scroller: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 116,
  },
  contentWithoutCommentBar: {
    paddingBottom: 44,
  },
  categoryPill: {
    alignSelf: "flex-start",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 13,
  },
  visualHeroBlock: {
    marginHorizontal: -20,
    marginTop: -8,
    marginBottom: 18,
  },
  visualHeroBlockInset: {
    marginHorizontal: 0,
    marginTop: 14,
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  visualHero: {
    position: "relative",
    height: 230,
    overflow: "hidden",
    backgroundColor: "#EEF2F7",
  },
  visualHeroAlbum: {
    height: 240, // Figma: 사진첩 큰사진 슬라이더 240h
  },
  visualHeroNatural: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#EEF2F7",
  },
  visualHeroImage: {
    width: "100%",
    height: "100%",
  },
  visualHeroNaturalImage: {
    width: "100%",
  },
  visualHeroFallback: {
    flex: 1,
  },
  visualHeroFallbackNatural: {
    flex: 0,
    width: "100%",
    aspectRatio: 360 / 230,
  },
  participationHeroPlaceholder: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 12,
    backgroundColor: "#F1F0E8",
    alignItems: "center",
    justifyContent: "center",
  },
  participationImagesBlock: {
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 16,
    gap: 12,
  },
  participationHeroBox: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F1F0E8",
  },
  participationHeroImage: {
    width: "100%",
    height: "100%",
  },
  galleryArrow: {
    // Reuse the existing gray-circle slider icons; keep the current hit areas.
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  galleryArrowLeft: {
    left: 0,
    paddingLeft: 8,
    alignItems: "flex-start",
  },
  galleryArrowRight: {
    right: 0,
    paddingRight: 8,
    alignItems: "flex-end",
  },
  galleryCount: {
    // Figma: 페이지 인디케이터 우16/하16, 검정 40%, radius 999, padding 4/10
    position: "absolute",
    right: 16,
    bottom: 16,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  galleryCountText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 15,
  },
  galleryThumbs: {
    // Figma: 썸네일 스트립 52px, gap 8, padding 12/16/16
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  galleryThumb: {
    width: 52,
    height: 52,
    borderRadius: 6,
    // Keep the width set when deselecting; Android can otherwise clip the image.
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  galleryThumbActive: {
    borderColor: COLORS.primary,
  },
  galleryThumbImage: {
    width: "100%",
    height: "100%",
  },
  galleryThumbFallback: {
    flex: 1,
  },
  title: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "400",
    lineHeight: 27,
    marginTop: 12,
  },
  titleNotice: {
    fontSize: 20,
    fontWeight: "400",
    lineHeight: 28,
  },
  titleMutualAid: {
    fontSize: 19, // Figma: Medium 19/23
    fontWeight: "500",
    lineHeight: 23,
  },
  titleGuide: {
    fontWeight: "500",
  },
  meta: {
    color: "#A6ACB7",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 15,
    marginTop: 8,
  },
  metaNotice: {
    color: COLORS.muted,
    fontSize: 13,
  },
  metaMutualAid: {
    color: "#A6ACB7", // Figma: Regular 12/15
    fontSize: 12,
    lineHeight: 15,
    marginTop: 8,
  },
  mutualAidInfoLabel: {
    color: "#A6ACB7", // Figma: Regular 12/15
    fontSize: 12,
    lineHeight: 15,
  },
  mutualAidInfoValue: {
    fontSize: 14, // Figma: Regular 14/17, label과 gap 6
    lineHeight: 17,
    marginTop: 6,
  },
  bodyDivider: {
    height: 1,
    backgroundColor: "#E1E4E9",
    marginTop: 16,
    marginBottom: 16,
  },
  mutualAidBodyDivider: {
    height: 0.5, // Figma: 메타래퍼 border-bottom 0.5, 곧바로 정보목록 시작
    marginBottom: 0,
  },
  body: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 23,
  },
  bodyTopGap: {
    marginTop: 16,
  },
  bodyTopGapCert: {
    marginTop: 12, // Figma: 활동 인증 태그→내용 12
  },
  activityStudyTitle: {
    width: "100%",
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "500",
    lineHeight: 21, // Figma: 17/21
  },
  studyContactRow: {
    gap: 6, // Figma: 스터디 연락처행 gap 6
  },
  certDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E1E4E9",
    paddingBottom: 16,
    marginTop: 16,
  },
  certDateText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
  },
  certParticipantLabel: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 16,
    marginTop: 16,
    marginBottom: 10,
  },
  certParticipantList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  certParticipantChip: {
    borderWidth: 0.5,
    borderColor: "#E1E4E9",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  certParticipantChipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
  },
  externalLinkButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 13,
    marginTop: 14,
  },
  externalLinkText: {
    flex: 1,
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  galleryCaption: {
    marginTop: 4,
  },
  joinButton: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    marginTop: 20,
  },
  joinButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  joinButtonClosed: {
    backgroundColor: "#E4E6EA", // Figma: 마감 버튼 배경
  },
  joinButtonClosedText: {
    color: "#999EA8", // Figma: 마감 버튼 텍스트
  },
  infoBox: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.divider,
    marginTop: 22,
  },
  infoRow: {
    paddingVertical: 12,
  },
  infoLabel: {
    color: COLORS.subtle,
    fontSize: 12,
    fontWeight: "400",
  },
  infoValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    marginTop: 5,
  },
  mutualAidInfoBox: {
    borderTopWidth: 0,
    borderBottomWidth: 0,
    marginTop: 0,
  },
  mutualAidInfoRow: {
    borderBottomWidth: 0.5, // Figma: 0.5 #E1E4E9
    borderBottomColor: "#E1E4E9",
    paddingVertical: 14,
  },
  mutualAidInfoRowLast: {
    borderBottomWidth: 0,
  },
  mutualAidPill: {
    borderRadius: 999, // Figma: 25h, padding 5/10
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mutualAidPillText: {
    fontSize: 12, // Figma: Medium 12/15
    fontWeight: "500",
    lineHeight: 15,
  },
  mutualAidSectionLabel: {
    color: COLORS.subtle,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
  mutualAidAttachments: {
    marginTop: 26,
  },
  attachmentsList: {
    gap: 12,
    marginTop: 24,
  },
  fileAttachment: {
    minHeight: 42, // Figma 첨부파일/첨부링크 42h
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 0.5,
    borderColor: "#E1E4E9",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  imageAttachment: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  noticeImageAttachment: {
    width: "100%",
    backgroundColor: "#F1F0E8",
  },
  noticeImageRadius: {
    borderRadius: 12,
  },
  noticeAttachmentImage: {
    width: "100%",
    height: "100%",
  },
  attachmentsFollowup: {
    marginTop: 12, // 첨부목록과의 간격 (Figma gap 12)
  },
  attachmentImage: {
    width: "100%",
  },
  fileName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16, // Figma: 첨부 파일명 13/16
  },
  suggestionBox: {
    borderRadius: 8,
    backgroundColor: COLORS.cyan50,
    padding: 14,
    marginTop: 24,
  },
  suggestionTitle: {
    color: COLORS.cyan700,
    fontSize: 15,
    fontWeight: "900",
  },
  officialReplyBox: {
    borderRadius: 12,
    backgroundColor: "#F7F8FA", // Figma 236:39
    padding: 16,
    marginTop: 24,
    gap: 8,
  },
  officialReplyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  officialReplyIcon: {
    width: 16,
    height: 16,
  },
  officialReplyTitle: {
    color: "#2761FF",
    fontSize: 13,
    fontWeight: "500", // Figma: Medium
    lineHeight: 16,
  },
  officialReplyBody: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400", // Figma: Regular
    lineHeight: 17,
  },
  officialReplyDate: {
    color: "#A6ACB7",
    fontSize: 12,
    fontWeight: "400",
  },
  suggestionStatus: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 7,
  },
  suggestionBody: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 9,
  },
  mutualAidRejectionBox: {
    borderRadius: 12,
    backgroundColor: COLORS.pink50,
    padding: 16,
    marginTop: 24,
    gap: 8,
  },
  mutualAidRejectionTitle: {
    color: COLORS.pink700,
    fontSize: 14,
    fontWeight: "500",
  },
  mutualAidRejectionBody: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 22,
  },
  adminReplyBox: {
    gap: 10,
    marginTop: 12,
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
  },
  statusChip: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusChipActive: {
    backgroundColor: COLORS.cyan700,
  },
  statusChipText: {
    color: COLORS.cyan700,
    fontWeight: "900",
  },
  statusChipTextActive: {
    color: "#FFFFFF",
  },
  replyTextarea: {
    minHeight: 86,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    color: COLORS.text,
    padding: 12,
    textAlignVertical: "top",
  },
  replySaveButton: {
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: COLORS.cyan700,
    paddingVertical: 11,
  },
  replySaveText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    borderBottomWidth: 0.5,
    borderColor: "#E1E4E9",
    paddingBottom: 16,
    marginTop: 20,
  },
  iconAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "400",
  },
  ownerActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  ownerButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
    paddingVertical: 11,
  },
  ownerButtonText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  deleteButton: {
    borderColor: "#FECACA",
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontWeight: "900",
  },
  reportBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: COLORS.danger50,
    padding: 14,
    marginTop: 18,
  },
  reportTitle: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: "900",
  },
  reasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  reasonChip: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  reasonChipActive: {
    backgroundColor: COLORS.danger,
  },
  reasonText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: "900",
  },
  reasonTextActive: {
    color: "#FFFFFF",
  },
  reportInput: {
    minHeight: 76,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    color: COLORS.text,
    padding: 12,
    marginTop: 10,
    textAlignVertical: "top",
  },
  reportActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  reportSubmit: {
    flex: 1,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: COLORS.danger,
    paddingVertical: 11,
  },
  reportSubmitText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  reportCancel: {
    flex: 1,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingVertical: 11,
  },
  reportCancelText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  commentSection: {
    marginTop: 16,
  },
  commentTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 17,
  },
  commentThreadDivider: {
    height: 1,
    backgroundColor: "#E1E4E9",
  },
  emptyComment: {
    color: "#A6ACB7",
    fontSize: 13,
    fontWeight: "400",
    textAlign: "center",
    paddingVertical: 24,
  },
  commentBar: {
    borderTopWidth: 0.5,
    borderTopColor: "#E1E4E9",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  replyNotice: {
    // Figma 답글대상표시: 풀폭 #F7F7F5 바, padding 10/16, 상단 0.5 구분선
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginHorizontal: -16,
    marginTop: -10,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F7F7F5",
    // 상단 선은 commentBar의 borderTop이 그려주므로 여기서는 입력창과의 경계선만 긋는다
    borderBottomWidth: 0.5,
    borderBottomColor: "#E1E4E9",
  },
  replyNoticeText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 15,
  },
  replyCancelText: {
    color: "#A6ACB7",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 15,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  commentInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 88,
    borderWidth: 0.5,
    borderColor: "#E1E4E9",
    borderRadius: 999,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    textAlignVertical: "top",
  },
  sendButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: COLORS.primary,
  },
});
