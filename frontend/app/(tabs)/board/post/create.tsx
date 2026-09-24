import { Feather, Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused, useNavigation, usePreventRemove, type NavigationAction } from "@react-navigation/native";
import { isAxiosError } from "axios";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { BackHandler, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { AttachFileIcon, AttachImageIcon, AttachLinkIcon, BackIcon, CalendarSmallIcon, CameraAddIcon, CloseIcon, ImagePlaceholderIcon, NoticeAlertIcon, ParticipantAddIcon } from "../../../../components/icons";
import { useBoardsQuery } from "../../../../hooks/useApi";
import { useCreatePost, usePostDetail, useUpdatePost } from "../../../../hooks/usePosts";
import CompletionState from "../../../../components/CompletionState";
import DiscardWriteModal from "../../../../components/DiscardWriteModal";
import ClubOperationStatusField from "../../../../components/ClubOperationStatusField";
import { clubOperationStatus } from "../../../../utils/participationGuide";
import LoadingState from "../../../../components/LoadingState";
import PostAttachmentEditor from "../../../../components/PostAttachmentEditor";
import SelectionSheet, { type SelectionOption } from "../../../../components/SelectionSheet";
import NoticeModal, { type NoticeModalContent } from "../../../../components/NoticeModal";
import Toast from "../../../../components/Toast";
import { MediaImageBackground } from "../../../../components/MediaImage";
import { setWriteLeaveGuard } from "../../../../stores/writeLeaveGuard";
import { duesPayerApi, postApi } from "../../../../services/api";
import type { MediaAsset } from "../../../../types";
import {
  ACTIVITY_PARTICIPANT_GUIDANCE,
  activityBankAccountFieldState,
  activityParticipantSearchKey,
  activityParticipantSelectionError,
  activityParticipantTextColor,
  activityParticipantsFromMetadata,
  withParticipantDuesState,
  activitySourcePostIdFromMetadata,
  buildActivityCertificationMetadata,
  formatActivityParticipant,
  loadPublishedActivitySourcePosts,
  type ActivityParticipant,
} from "../../../../utils/activityCertification";
import {
  navigateAfterPostEdit,
  postCreateFormBackDecision,
  postCreateCompletionRoute,
  postCreateFormInstanceKey,
  postEditCompletionDecision,
} from "../../../../utils/appRoutes";
import { formatBoardDate } from "../../../../utils/dateFormat";
import {
  calendarMonthFromDotDate,
  formatDotDate,
  isActivityCertificationDateAllowed,
  isCalendarDateWithinBounds,
  isCalendarMonthAfterMaximum,
  maximumActivityCertificationDate,
  minimumMutualAidEventDate,
} from "../../../../utils/dateSelection";
import { TOAST_MESSAGES, nextToastState, type ToastState } from "../../../../utils/toast";
import { uploadFailureFeedback } from "../../../../utils/uploadFeedback";
import { pickAndUploadDocuments, pickAndUploadImages } from "../../../../utils/mediaPicker";
import {
  canEditMutualAidRequest,
  isValidEvidenceLink,
  mutualAidEventTypeLabel,
  mutualAidRelationLabel,
  normalizeMutualAidEventDate,
} from "../../../../utils/mutualAid";
import {
  PHOTO_ALBUM_IMAGE_SELECTION_LIMIT,
  participationGuideImageSections,
  postImageSelectionLimit,
  replaceParticipationGuideRepresentative,
  writeAttachmentActions,
} from "../../../../utils/postAttachments";
import {
  RESOURCE_RATING_FIELDS,
  RESOURCE_RATING_LEVELS,
  resourcePostFieldValues,
  resourcePostFields,
  resourcePostMetadata,
} from "../../../../utils/resourcePostFields";

const COLORS = {
  primary: "#2761FF",
  primary50: "#EDF2FE",
  primary100: "#D5E0FE",
  text: "#15171C",
  navy: "#0B1F56",
  muted: "#6B7280",
  subtle: "#8A919C",
  border: "#E1E4E9",
  danger: "#B91C1C",
  bg: "#FFFFFF",
  page: "#F7F8FA",
};

const schema = z.object({
  title: z.string().optional(),
  category: z.string().optional(),
  content: z.string().optional(),
  activityDate: z.string().optional(),
  participants: z.string().optional(),
  bankAccount: z.string().optional(),
  eventDate: z.string().optional(),
  relation: z.string().optional(),
  contact: z.string().optional(),
  applicationUrl: z.string().optional(),
  professor: z.string().optional(),
  difficulty: z.string().optional(),
  satisfaction: z.string().optional(),
  clubOperationStatus: z.enum(["active", "ended"]),
});

type FormValues = z.infer<typeof schema>;

type FormFieldProps = {
  label: string;
  required?: boolean;
  requiredStar?: boolean;
  optional?: boolean;
  helper?: string;
  error?: string;
  children: ReactNode;
};

function FormField({ label, required, requiredStar, optional, helper, error, children }: FormFieldProps) {
  return (
    <View style={styles.field}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {requiredStar ? (
            <Text style={styles.requiredStar}>*</Text>
          ) : required ? (
            <View style={styles.requiredPill}>
              <Text style={styles.requiredText}>필수</Text>
            </View>
          ) : null}
          {optional ? <Text style={styles.optionalMark}>(선택)</Text> : null}
        </View>
      ) : null}
      {children}
      {helper ? <Text style={styles.helperText}>{helper}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// Figma: 기본 0.5px #E1E4E9, 입력 중(포커스)과 오류는 1px 테두리
function FormTextInput({ style, hasError, onBlur, onFocus, ...props }: ComponentProps<typeof TextInput> & { hasError?: boolean }) {
  const [focused, setFocused] = useState(false);
  // 오류 테두리가 포커스 테두리를 이긴다. 값을 채우기 전까지는 눌러도 빨간색을
  // 유지해야 인증 화면과 감각이 같다.
  const inputStyle: TextStyle = StyleSheet.flatten([
    style,
    focused ? styles.inputFocused : null,
    hasError ? styles.inputError : null,
  ]);
  const scrollableBody = props.multiline && Platform.OS === "android";
  const iosBody = props.multiline && Platform.OS === "ios";
  const maximumBodyHeight = 240;
  const borderWidth = inputStyle?.borderWidth ?? 0;
  const input = (
    <TextInput
      {...props}
      // Android uses a nested ScrollView for boundary handoff. iOS keeps its
      // native scrolling UITextView so text selection and caret reveal stay native.
      scrollEnabled={scrollableBody ? false : iosBody ? true : props.scrollEnabled}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      style={[
        inputStyle,
        scrollableBody ? {
          borderWidth: 0,
          borderRadius: 0,
          minHeight: typeof inputStyle?.minHeight === "number" ? Math.max(0, inputStyle.minHeight - borderWidth * 2) : inputStyle?.minHeight,
        } : null,
        iosBody ? { maxHeight: maximumBodyHeight } : null,
        { outlineStyle: "none" } as never,
      ]}
    />
  );
  if (!scrollableBody) return input;

  return (
    <ScrollView
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      bounces={false}
      style={{
        flexGrow: 0,
        width: inputStyle?.width,
        minHeight: inputStyle?.minHeight,
        maxHeight: maximumBodyHeight,
        borderWidth,
        borderColor: inputStyle?.borderColor,
        borderRadius: inputStyle?.borderRadius,
        backgroundColor: inputStyle?.backgroundColor,
      }}
    >
      {input}
    </ScrollView>
  );
}

function clean(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

const BOARD_SELECT_PLACEHOLDER = "게시판을 선택하세요";

const EVIDENCE_MODES = [
  { key: "file" as const, label: "이미지 첨부" },
  { key: "link" as const, label: "링크 첨부" },
];

function activitySelectPlaceholder(slug?: string) {
  if (slug?.includes("study")) return "모집글을 선택하세요";
  if (slug?.includes("networking")) return "네트워킹을 선택하세요";
  return "동아리명을 선택하세요";
}

const CAL_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function InlineCalendar({
  value,
  minimumDate,
  maximumDate,
  onSelect,
}: {
  value?: string;
  minimumDate?: string;
  maximumDate?: string;
  onSelect: (dateStr: string) => void;
}) {
  const [view, setView] = useState(() => {
    const month = calendarMonthFromDotDate(value ?? minimumDate ?? maximumDate);
    if (isCalendarMonthAfterMaximum(month.year, month.monthIndex, maximumDate)) {
      const maximumMonth = calendarMonthFromDotDate(maximumDate);
      return { y: maximumMonth.year, m: maximumMonth.monthIndex };
    }
    return { y: month.year, m: month.monthIndex };
  });

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const selected = value ?? "";
  const goPrev = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const goNext = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));
  const nextView = view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 };
  const isNextDisabled = isCalendarMonthAfterMaximum(nextView.y, nextView.m, maximumDate);

  return (
    <View style={styles.calCard}>
      <View style={styles.calHeader}>
        <Pressable hitSlop={10} onPress={goPrev} style={styles.calNav}>
          <BackIcon size={20} color={COLORS.text} />
        </Pressable>
        <Text style={styles.calTitle}>{`${view.y}년 ${view.m + 1}월`}</Text>
        <Pressable
          accessibilityState={{ disabled: isNextDisabled }}
          disabled={isNextDisabled}
          hitSlop={10}
          onPress={goNext}
          style={[styles.calNav, isNextDisabled ? styles.calNavDisabled : null]}
        >
          <Ionicons name="chevron-forward" size={20} color={isNextDisabled ? COLORS.subtle : COLORS.text} />
        </Pressable>
      </View>
      <View style={styles.calWeekRow}>
        {CAL_WEEKDAYS.map((w) => (
          <Text key={w} style={styles.calWeekday}>{w}</Text>
        ))}
      </View>
      <View style={styles.calGrid}>
        {cells.map((day, index) => {
          if (day === null) return <View key={`e-${index}`} style={styles.calCell} />;
          const dateStr = formatDotDate(new Date(view.y, view.m, day));
          const isSelected = dateStr === selected;
          const isDisabled = !isCalendarDateWithinBounds(dateStr, { minimumDate, maximumDate });
          return (
            <Pressable
              accessibilityState={{ disabled: isDisabled, selected: isSelected }}
              disabled={isDisabled}
              key={dateStr}
              onPress={() => onSelect(dateStr)}
              style={styles.calCell}
            >
              <View style={[styles.calDay, isSelected ? styles.calDaySelected : null, isDisabled ? styles.calDayDisabled : null]}>
                <Text style={[styles.calDayText, isSelected ? styles.calDayTextSelected : null, isDisabled ? styles.calDayTextDisabled : null]}>{day}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type PostCreateRouteParams = {
  boardId?: string;
  boardGroup?: string;
  postId?: string;
  title?: string;
  category?: string;
  content?: string;
  returnTo?: string;
  editOrigin?: string;
  fromBoardId?: string;
};

export default function PostCreateScreen() {
  const params = useLocalSearchParams<PostCreateRouteParams>();
  const isFocused = useIsFocused();
  const postId = Number(params.postId);
  const isEditing = Number.isFinite(postId) && postId > 0;
  // Tab navigation retains this route. Discard abandoned new-post state,
  // including pending attachment state, before the next writing session.
  if (!isFocused && !isEditing) return null;
  return <PostCreateForm key={postCreateFormInstanceKey(params)} params={params} />;
}

function PostCreateForm({ params }: { params: PostCreateRouteParams }) {
  const insets = useSafeAreaInsets();

  const parsedInitialBoardId = Number(params.boardId);
  const [selectedBoardId, setBoardId] = useState(() =>
    Number.isFinite(parsedInitialBoardId) && parsedInitialBoardId > 0 ? parsedInitialBoardId : 0,
  );
  const parsedPostId = Number(params.postId);
  const postId = Number.isFinite(parsedPostId) && parsedPostId > 0 ? parsedPostId : null;
  const editPostQuery = usePostDetail(postId ?? 0, postId !== null, true);
  const existingPost = editPostQuery.data?.data;
  const boardId = existingPost?.board_id ?? selectedBoardId;

  const { data: boardsRes, isError: isBoardsError, isLoading: isBoardsLoading, refetch: refetchBoards } = useBoardsQuery();
  const [attachments, setAttachments] = useState<MediaAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [participantQuery, setParticipantQuery] = useState("");
  const [participantSearchFocused, setParticipantSearchFocused] = useState(false);
  const [evidenceLinkFocused, setEvidenceLinkFocused] = useState(false);
  const [professorFocused, setProfessorFocused] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<ActivityParticipant[]>([]);
  const [selectionSheet, setSelectionSheet] = useState<"activity" | "mutualType" | "mutualRelation" | "board" | null>(null);
  const [missingBoard, setMissingBoard] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  // 증빙서류는 파일 업로드와 링크 입력 중 하나만 사용한다.
  const [evidenceMode, setEvidenceMode] = useState<"file" | "link" | null>(null);
  const [evidenceLink, setEvidenceLink] = useState("");
  const [activitySourcePostId, setActivitySourcePostId] = useState<number | null>(null);
  const [createdPostId, setCreatedPostId] = useState<number | null>(null);
  // 등록·저장에 성공해 떠나는 이동은 막으면 안 된다. 완료 화면을 쓰는
  // 활동인증·상조회·건의만 createdPostId가 채워지므로, 나머지 게시판과 수정
  // 저장은 이 표시로 usePreventRemove 잠금을 먼저 푼다.
  const [submitted, setSubmitted] = useState(false);
  const pendingSubmitNavigation = useRef<(() => void) | null>(null);
  const [notice, setNotice] = useState<NoticeModalContent | null>(null);
  // 업로드 실패 원인에 따라 토스트와 모달을 나눠 보여준다.
  const showUploadFailure = useCallback((error: unknown, imagesOnly = false) => {
    const feedback = uploadFailureFeedback(error, imagesOnly);
    if (feedback.kind === "modal") setNotice(feedback.notice);
    else setToast((current) => nextToastState(current, feedback.message));
  }, []);
  const [toast, setToast] = useState<ToastState>(null);
  // 첨부·증빙은 react-hook-form 밖에 있어서 테두리 표시를 따로 들고 있는다.
  const [missingRequiredAttachment, setMissingRequiredAttachment] = useState(false);
  const showToast = useCallback((message: string) => setToast((current) => nextToastState(current, message)), []);
  const hideToast = useCallback(() => setToast(null), []);
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);
  // 확인창을 띄우는 동안 고른 게시판을 들고 있는다. 확인 전에는 바꾸지 않는다.
  const [pendingBoardId, setPendingBoardId] = useState<number | null>(null);
  // 수정 모드는 기존 글 값이 기준선이 된다. 작성 모드는 빈 문자열로 시작한다.
  const unsavedBaseline = useRef({ attachmentIds: "", participantIds: "", evidenceLink: "" });
  const hydratedPostId = useRef<number | null>(null);
  // 키보드가 뜨면 입력칸 바로 아래에 붙은 안내문구나 버튼이 가려진다. 드러내야 할
  // 블록을 기억해 두었다가, 포커스 시점과 키보드 때문에 높이가 줄어드는 시점
  // (ScrollView onLayout) 양쪽에서 그만큼 스크롤한다.
  const formScrollRef = useRef<ScrollView>(null);
  const formScrollHeight = useRef(0);
  const bankGroupBottom = useRef(0);
  const attachSectionTop = useRef(0);
  const attachActionsBottom = useRef(0);
  const revealTarget = useRef<"end" | "bank" | "attach" | null>(null);
  const revealFocusedBlock = () => {
    const target = revealTarget.current;
    if (!target) return;
    const bottom = target === "bank"
      ? bankGroupBottom.current
      : target === "attach"
        ? attachSectionTop.current + attachActionsBottom.current
        : 0;
    // 드러낼 블록을 모르거나(첨부가 없는 게시판) 아직 재본 적이 없으면 맨 아래까지 내린다.
    if (bottom <= 0 || formScrollHeight.current <= 0) {
      formScrollRef.current?.scrollToEnd({ animated: true });
      return;
    }
    formScrollRef.current?.scrollTo({ y: Math.max(0, bottom - formScrollHeight.current + 16), animated: true });
  };
  const boards = useMemo(() => boardsRes?.data.flatMap((group) => group.boards) ?? [], [boardsRes?.data]);
  const board = useMemo(
    () => boards.find((item) => item.id === boardId),
    [boardId, boards]
  );
  const createMutation = useCreatePost(boardId, board);
  const updateMutation = useUpdatePost(postId ?? 0, boardId, board);
  const fallbackBoardType = [10, 11, 12].includes(boardId)
    ? "activity_certification"
    : boardId === 15
      ? "suggestion"
      : boardId === 16
        ? "mutual_aid"
        : undefined;
  const boardType = board?.board_type ?? fallbackBoardType;
  const isSuggestion = boardType === "suggestion";
  const isActivity = boardType === "activity_certification";
  const isMutualAid = boardType === "mutual_aid";
  const mutualAidMinimumDate = minimumMutualAidEventDate();
  const isAlbum = boardType === "album";
  const isStudyRecruit = board?.slug === "study-recruit";
  // 처음 올릴 때부터 마감 상태인 모집글을 막는다. 마감 전환은 등록 후 수정에서만.
  const canCloseRecruitment = Boolean(postId);
  const isNetworkingProgram = board?.slug === "networking-programs";
  // 자료공유 게시판별 추가 입력(교수명·난이도·만족도)은 resourcePostFields 표가 정한다.
  const resourceFields = resourcePostFields(board?.slug);
  const isAdminParticipationPost = board?.slug === "club-promo" || isNetworkingProgram;
  const bankAccountField = activityBankAccountFieldState(postId);
  const compactCreate = !isActivity && !isMutualAid;
  const requiresAttachment = isActivity || isMutualAid || isAlbum || isAdminParticipationPost;
  const canPickBoard =
    !postId && compactCreate && !isAlbum && !isSuggestion && !isStudyRecruit && !isNetworkingProgram && !isAdminParticipationPost;
  const selectableBoards = useMemo(() => {
    const groups = boardsRes?.data ?? [];
    const owning = groups.find((entry) => entry.boards.some((item) => item.id === boardId));
    if (owning) return owning.boards;
    // 게시판을 아직 안 골랐으면 어느 묶음에서 왔는지로 후보를 좁힌다.
    return groups.find((entry) => entry.category === params.boardGroup)?.boards ?? [];
  }, [boardsRes?.data, boardId, params.boardGroup]);
  const trimmedParticipantQuery = participantQuery.trim();
  const participantSearch = useQuery({
    queryKey: activityParticipantSearchKey(boardId, trimmedParticipantQuery),
    queryFn: () => duesPayerApi.search(trimmedParticipantQuery, boardId, 8),
    enabled: isActivity && boardId > 0 && trimmedParticipantQuery.length > 0,
    retry: false,
  });
  const activitySourceBoard = useMemo(() => {
    if (!isActivity) return undefined;
    if (board?.slug.includes("study")) return boards.find((item) => item.slug === "study-recruit");
    if (board?.slug.includes("networking")) {
      return boards.find((item) => item.slug === "networking-programs") ?? boards.find((item) => item.slug === "alumni-directory");
    }
    return boards.find((item) => item.slug === "club-promo");
  }, [board?.slug, boards, isActivity]);
  const activitySourceQuery = useQuery({
    queryKey: ["posts", activitySourceBoard?.id, "activity-source-options", activitySourceBoard?.slug],
    queryFn: () => loadPublishedActivitySourcePosts(
      activitySourceBoard?.id ?? 0,
      activitySourceBoard?.slug,
      postApi.getPosts,
    ),
    enabled: isActivity && Boolean(activitySourceBoard?.id),
    retry: false,
  });

  const { clearErrors, control, formState, handleSubmit, reset, setError, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: params.title ?? "",
      category: params.category ?? "",
      content: params.content ?? "",
      activityDate: maximumActivityCertificationDate(),
      participants: "",
      bankAccount: "",
      eventDate: "",
      relation: "",
      contact: "",
      applicationUrl: "",
      professor: "",
      difficulty: "",
      satisfaction: "",
      clubOperationStatus: "active",
    },
  });

  // 인증 화면(register/login)처럼 값을 고치는 즉시 빨간 테두리를 푼다.
  // 스키마가 모두 optional이라 재검증만으로는 풀리지 않아 직접 지운다.
  const clearOnChange = (name: keyof FormValues, onChange: (value: string) => void) => (value: string) => {
    onChange(value);
    clearErrors(name);
  };

  useEffect(() => {
    // 게시판이 확정되기 전에 프리필하면 게시판별 추가 입력이 빈 값으로 덮인다.
    if (!postId || !existingPost || !board || hydratedPostId.current === postId) return;

    const metadata = existingPost.metadata ?? {};
    // 메타데이터에는 납부 여부가 없다. 글 상세가 준 값으로 채워 수정 화면의 칩도
    // 검색 목록과 같은 색이 되게 한다.
    const storedParticipants = withParticipantDuesState(
      activityParticipantsFromMetadata(metadata),
      existingPost.activity_participants,
    );
    reset({
      title: existingPost.title,
      category: mutualAidEventTypeLabel(existingPost.mutual_aid?.event_type ?? existingPost.category),
      content: existingPost.content,
      activityDate: typeof metadata.activity_date === "string" ? metadata.activity_date : "",
      participants: typeof metadata.participants === "string" ? metadata.participants : "",
      bankAccount: typeof metadata.bank_account === "string" ? metadata.bank_account : "",
      eventDate: normalizeMutualAidEventDate(
        existingPost.mutual_aid?.event_date ??
          (typeof metadata.event_date === "string" ? metadata.event_date : undefined),
      ),
      relation: mutualAidRelationLabel(
        existingPost.mutual_aid?.relation ??
          (typeof metadata.relation === "string" ? metadata.relation : undefined),
      ),
      contact: typeof metadata.contact === "string" ? metadata.contact : "",
      applicationUrl: typeof metadata.application_url === "string" ? metadata.application_url : "",
      ...resourcePostFieldValues(resourceFields, metadata),
      clubOperationStatus: clubOperationStatus(metadata),
    });
    setAttachments(existingPost.attachments);
    // 링크로 신청했던 글이면 링크 탭으로 열린다.
    const storedProofUrl = typeof metadata.proof_url === "string" ? metadata.proof_url : "";
    setEvidenceLink(storedProofUrl);
    setEvidenceMode(storedProofUrl ? "link" : "file");
    setSelectedParticipants(storedParticipants);
    setParticipantQuery("");
    setActivitySourcePostId(activitySourcePostIdFromMetadata(metadata));
    // 불러온 값이 "변경 없음"의 기준이 된다. 이후 이 값과 달라지면 이탈 시 확인창을 띄운다.
    unsavedBaseline.current = {
      attachmentIds: existingPost.attachments.map((attachment) => attachment.id).join(","),
      participantIds: storedParticipants.map((participant) => participant.id).join(","),
      evidenceLink: storedProofUrl,
    };
    hydratedPostId.current = postId;
  }, [board, existingPost, postId, reset, resourceFields]);

  useEffect(() => {
    if (isStudyRecruit && (!params.category || params.category === "모집")) {
      setValue("category", "진행중");
    }
    if (board?.slug === "club-promo" && !params.category) {
      setValue("category", "모집중");
    }
    if (isActivity && (params.category === "활동 인증" || params.category === "안내")) {
      setValue("category", "");
    }
  }, [isStudyRecruit, isActivity, board?.slug, params.category, setValue]);

  useEffect(() => {
    if (isAdminParticipationPost && !params.category) {
      setValue("category", "모집중");
    }
  }, [isAdminParticipationPost, params.category, setValue]);

  const attachmentIds = attachments.map((attachment) => attachment.id);
  const {
    representativeImage: participationRepresentativeImage,
    detailImages: participationDetailImages,
  } = participationGuideImageSections(attachments);
  const albumImageSelectionLimit = postImageSelectionLimit(boardType, attachmentIds.length);
  const isAlbumImageLimitReached = isAlbum && albumImageSelectionLimit === 0;
  const syncParticipants = (items: ActivityParticipant[]) => {
    setSelectedParticipants(items);
    setValue("participants", items.map(formatActivityParticipant).join(", "), { shouldValidate: true });
    clearErrors("participants");
  };
  const addParticipant = (participant: ActivityParticipant) => {
    if (selectedParticipants.some((item) => item.id === participant.id)) {
      setParticipantQuery("");
      return;
    }
    syncParticipants([...selectedParticipants, participant]);
    setParticipantQuery("");
  };
  const removeParticipant = (participantId: number) => {
    syncParticipants(selectedParticipants.filter((item) => item.id !== participantId));
  };
  const labels = {
    screenTitle: postId ? (isMutualAid ? "상조회 신청 수정" : isActivity ? "활동 인증 수정" : isAlbum ? "사진 수정" : "게시글 수정") : isAlbum ? "사진 등록" : isMutualAid ? "상조회 신청" : isActivity ? "활동 인증" : isSuggestion ? "건의사항 작성" : isStudyRecruit ? "스터디 모집" : isNetworkingProgram ? "네트워킹 등록" : isAdminParticipationPost ? "동아리 등록" : "글쓰기",
    title: isAlbum ? "행사명" : isMutualAid ? "신청 제목" : isActivity ? "인증 제목" : isSuggestion ? "건의 제목" : "제목",
    titlePlaceholder: isMutualAid
      ? "신청 내용을 한 줄로 입력하세요"
      : isAlbum
        ? "행사 사진 제목을 입력하세요"
      : isActivity
        ? "활동명을 입력하세요"
        : isSuggestion
          ? "제목을 입력하세요"
        : isStudyRecruit
          ? "스터디 제목을 입력하세요"
        : resourceFields
          ? resourceFields.titlePlaceholder
          : "제목을 입력하세요",
    category: isMutualAid ? "경조사 종류" : isActivity ? "소속 그룹" : isStudyRecruit ? "모집 상태" : "분류",
    categoryPlaceholder: isMutualAid ? "결혼 / 상(喪) 중 선택" : isActivity ? "활동 대상을 선택하세요" : isStudyRecruit ? "진행중 / 마감" : "선택 입력",
    content: isMutualAid ? "비고" : isActivity ? "활동 소감" : isSuggestion ? "건의 내용" : "내용",
    contentPlaceholder: isMutualAid
      ? "전달하고 싶은 내용이 있다면 적어주세요"
      : isActivity
        ? "활동 내용과 소감을 적어주세요"
        : isSuggestion
          ? "원우회에 건의하고 싶은 내용을 자유롭게 작성해 주세요"
        : isStudyRecruit
          ? "스터디 내용, 진행 요일/시간 등을 입력하세요"
          : "내용을 입력하세요",
    attachment: isAlbum ? "사진" : isMutualAid ? "증빙서류" : isActivity ? "활동 사진" : isAdminParticipationPost ? "대표 사진" : "첨부파일",
    attachmentHelp: isAlbum ? `행사 사진 ${attachmentIds.length}/20 · 게시글당 최대 20장 · 장당 10MB 이하` : isMutualAid ? "청첩장, 부고장 등 증빙 파일" : isActivity ? "활동 사진 1장 이상" : isAdminParticipationPost ? "목록 썸네일에 사용할 대표 이미지를 1장 첨부하세요." : "이미지, PDF, 문서 파일",
  };
  const guide = isSuggestion
    ? {
        icon: "shield-checkmark-outline" as const,
        title: "익명으로 접수됩니다",
        body: "해당 건의사항은 익명으로 등록되며, 작성자는 노출되지 않아요",
      }
    : isAlbum
      ? {
          icon: "images-outline" as const,
          title: "사진만 등록할 수 있어요",
          body: "행사명과 사진을 등록해주세요. 본문 없이 이미지 파일만 등록할 수 있어요.",
        }
    : isAdminParticipationPost
      ? {
          icon: "people-outline" as const,
          title: `관리자 전용 ${isNetworkingProgram ? "네트워킹" : "동아리"} 게시글`,
          body: `목록 대표 이미지와 상세 글 이미지를 구분해 등록하고 ${isNetworkingProgram ? "참가 신청" : "가입 신청"} 링크를 연결할 수 있습니다.`,
        }
    : isActivity
      ? {
          icon: "camera-outline" as const,
          title: "활동 인증 기준",
          body: "활동일, 참가자, 계좌 정보를 입력하고 활동 사진을 1장 이상 첨부하세요.",
        }
      : isMutualAid
        ? {
            icon: "flower-outline" as const,
            title: "상조회 신청 기준",
            body: "경조사 일자와 관계를 입력하고 증빙서류를 첨부하세요.",
          }
        : null;
  const submitLabel = postId
    ? (isMutualAid || isActivity ? "수정 완료" : "변경사항 저장")
    : isAlbum
      ? "사진 등록"
    : isSuggestion
      ? "등록"
      : isActivity
        ? "인증 등록"
        : isMutualAid
          ? "신청"
          : isStudyRecruit
            ? "등록"
          : "등록";
  const isSubmitting = isUploading || createMutation.isPending || updateMutation.isPending;

  const buildMetadata = (values: FormValues) => {
    if (isActivity) {
      return buildActivityCertificationMetadata({
        existingMetadata: existingPost?.metadata,
        activityDate: values.activityDate,
        participants: values.participants,
        bankAccount: values.bankAccount,
        selectedParticipants,
        activitySourcePostId,
      });
    }
    const metadata: Record<string, string> = {};
    if (isMutualAid) {
      if (clean(values.eventDate)) metadata.event_date = clean(values.eventDate) as string;
      if (clean(values.relation)) metadata.relation = clean(values.relation) as string;
      metadata.proof_url = evidenceMode === "link" ? evidenceLink.trim() : "";
    }
    if (isStudyRecruit) {
      metadata.recruitment_status = values.category === "마감" ? "closed" : "open";
      if (clean(values.contact)) metadata.contact = clean(values.contact) as string;
    }
    if (isAdminParticipationPost && clean(values.applicationUrl)) {
      metadata.application_url = clean(values.applicationUrl) as string;
      if (board?.slug === "club-promo") metadata.club_operation_status = values.clubOperationStatus;
    }
    Object.assign(metadata, resourcePostMetadata(resourceFields, values));
    return Object.keys(metadata).length > 0 ? metadata : undefined;
  };

  // 참여 버튼 링크(관리자 전용)만 쓰는 검사. 토스트 전환 대상이 아니라서
  // 기존과 같은 확인창 문구를 그대로 유지한다.
  const requireValue = (value: string | undefined, label: string) => {
    if (clean(value)) {
      return false;
    }
    setNotice({ title: "필수 항목", body: `${label} 항목을 입력하세요.` });
    return true;
  };

  const handleMutationError = () => {
    showToast(TOAST_MESSAGES.error);
  };

  const onSubmit = (values: FormValues) => {
    if (isAlbum && attachmentIds.length > PHOTO_ALBUM_IMAGE_SELECTION_LIMIT) {
      showToast(TOAST_MESSAGES.error);
      return;
    }
    // 디자인은 비어 있는 필수 칸을 한 번에 빨갛게 표시한다. 첫 항목에서 멈추지 않고
    // 전부 모은 뒤 토스트 하나로 알린다. 어느 칸인지는 테두리가 알려주므로
    // 문구에는 항목명을 넣지 않는다.
    const missing: (keyof FormValues)[] = [];
    const requireField = (name: keyof FormValues, value?: string) => {
      if (!clean(value)) missing.push(name);
    };
    if (!isActivity && !isMutualAid) requireField("title", values.title);
    if (!isMutualAid && !isAlbum) requireField("content", values.content);
    if (isActivity) {
      requireField("category", values.category);
      requireField("activityDate", values.activityDate);
      requireField("participants", values.participants);
      if (bankAccountField.required) requireField("bankAccount", values.bankAccount);
    }
    if (isMutualAid) {
      requireField("category", values.category);
      requireField("eventDate", values.eventDate);
      requireField("relation", values.relation);
    }
    if (isStudyRecruit) requireField("contact", values.contact);
    if (resourceFields?.professor) requireField("professor", values.professor);
    if (resourceFields?.difficulty) requireField("difficulty", values.difficulty);
    if (resourceFields?.satisfaction) requireField("satisfaction", values.satisfaction);
    const missingEvidenceLink = isMutualAid && evidenceMode === "link" && !evidenceLink.trim();
    const missingAttachment = !missingEvidenceLink
      && !(isMutualAid && evidenceMode === "link")
      && requiresAttachment
      && (isAdminParticipationPost ? !participationRepresentativeImage : attachmentIds.length === 0);

    // 게시판을 고르지 않으면 어디로 보낼지 정해지지 않는다. 다른 필수 칸과
    // 같은 시점에 같은 방식으로 알린다.
    const boardUnselected = canPickBoard && !board;
    clearErrors(missing);
    setMissingBoard(boardUnselected);
    setMissingRequiredAttachment(missingAttachment || missingEvidenceLink);
    if (boardUnselected || missing.length > 0 || missingAttachment || missingEvidenceLink) {
      // message를 비워 칸 아래 문구 없이 테두리만 빨갛게 만든다.
      for (const name of missing) setError(name, { message: "" });
      showToast(TOAST_MESSAGES.requiredFieldError);
      return;
    }
    if (isActivity) {
      if (!isActivityCertificationDateAllowed(values.activityDate)) {
        const message = "오늘 이후 날짜는 선택할 수 없어요.";
        setError("activityDate", { message: "" });
        showToast(message);
        return;
      }
      const participantError = activityParticipantSelectionError(selectedParticipants, existingPost?.metadata);
      if (participantError) {
        showToast(participantError);
        return;
      }
    }
    if (isAdminParticipationPost) {
      const applicationUrl = clean(values.applicationUrl);
      if (requireValue(applicationUrl, "참여 버튼 링크")) {
        return;
      }
      try {
        const parsed = new URL(applicationUrl as string);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("INVALID_PROTOCOL");
      } catch {
        setNotice({
          title: "참여 버튼 링크",
          body: "http:// 또는 https://로 시작하는 올바른 주소를 입력하세요.",
        });
        return;
      }
    }
    if (isMutualAid && evidenceMode === "link" && !isValidEvidenceLink(evidenceLink)) {
      showToast(TOAST_MESSAGES.linkFormatError);
      return;
    }

    const generatedActivityTitle = `${board?.name ?? "활동 인증"}${clean(values.activityDate) ? ` ${clean(values.activityDate)}` : ""}`;
    const generatedMutualAidTitle = `${clean(values.category) ?? "경조사"} 상조회 신청`;
    const payload = {
      title: isActivity ? clean(values.title) ?? clean(values.category) ?? generatedActivityTitle : isMutualAid ? generatedMutualAidTitle : clean(values.title) as string,
      content: isAlbum ? (clean(values.title) as string) : values.content ?? "",
      category: isAlbum ? undefined : clean(values.category),
      metadata: buildMetadata(values),
      attachment_ids: attachmentIds,
      replace_evidence: Boolean(postId && isMutualAid),
      is_anonymous: isSuggestion,
    };
    if (postId) {
      updateMutation.mutate(payload, {
        onSuccess: () => {
          const decision = postEditCompletionDecision(
            boardType,
            params.editOrigin,
            router.canGoBack(),
            postId,
            params.fromBoardId,
            params.returnTo,
          );
          pendingSubmitNavigation.current = () => navigateAfterPostEdit(decision, {
            back: () => router.back(),
            replace: (route) => router.replace(route as never),
          });
          setSubmitted(true);
        },
        onError: handleMutationError,
      });
      return;
    }

    createMutation.mutate(payload, {
      onSuccess: (res) => {
        if (isActivity || isMutualAid || isSuggestion) {
          setCreatedPostId(res.data.id);
          return;
        }
        const route = postCreateCompletionRoute(boardType, res.data.id, boardId, params.returnTo);
        pendingSubmitNavigation.current = () => router.replace(route as never);
        setSubmitted(true);
      },
      onError: handleMutationError,
    });
  };

  const uploadAttachments = async (pickAttachments: () => Promise<MediaAsset[]>) => {
    // 갤러리·파일 선택창이 키보드 위로 뜨면 뒤에 키보드가 남는다. 먼저 내린다.
    Keyboard.dismiss();
    try {
      setIsUploading(true);
      const uploaded = await pickAttachments();
      if (uploaded.length > 0) {
        setMissingRequiredAttachment(false);
        setAttachments((current) => {
          const next = [...current, ...uploaded];
          return isAlbum ? next.slice(0, PHOTO_ALBUM_IMAGE_SELECTION_LIMIT) : next;
        });
      }
    } catch (error) {
      showUploadFailure(error, isAlbum || isActivity || isAdminParticipationPost);
    } finally {
      setIsUploading(false);
    }
  };

  const pickPostImages = () => {
    if (isAlbumImageLimitReached) {
      showToast("게시글당 최대 20장까지 등록할 수 있어요");
      return Promise.resolve([]);
    }
    return pickAndUploadImages(
      undefined,
      isAlbum
        ? {
            maxSelection: albumImageSelectionLimit,
            retainSuccessfulUploads: true,
            onBatchIssue: ({ uploadedCount, failedCount, skippedCount }) => {
              const messages = [
                skippedCount > 0 ? `게시글당 최대 20장까지 등록할 수 있어 ${skippedCount}장은 제외했어요.` : null,
                failedCount > 0 ? `${uploadedCount}장은 추가했고 ${failedCount}장은 업로드하지 못했어요.` : null,
              ].filter((message): message is string => Boolean(message));
              setNotice({ title: "사진 업로드 안내", body: messages.join("\n") });
            },
          }
        : undefined,
    );
  };

  const selectParticipationRepresentativeImage = async () => {
    Keyboard.dismiss();
    try {
      setIsUploading(true);
      const uploaded = await pickAndUploadImages(undefined, {
        maxSelection: 1,
        retainSuccessfulUploads: true,
        onBatchIssue: ({ failedCount, skippedCount }) => {
          const messages = [
            skippedCount > 0 ? "대표 이미지는 1장만 등록할 수 있어 첫 번째 사진만 사용했어요." : null,
            failedCount > 0 ? "대표 이미지를 업로드하지 못했어요." : null,
          ].filter((message): message is string => Boolean(message));
          if (messages.length > 0) {
            setNotice({ title: "대표 이미지", body: messages.join("\n") });
          }
        },
      });
      if (uploaded[0]) {
        setAttachments((current) =>
          replaceParticipationGuideRepresentative(current, uploaded[0]),
        );
      }
    } catch (error) {
      showUploadFailure(error, true);
    } finally {
      setIsUploading(false);
    }
  };

  const selectParticipationDetailImages = () => uploadAttachments(
    () => pickAndUploadImages(undefined, {
      retainSuccessfulUploads: true,
      onBatchIssue: ({ uploadedCount, failedCount }) => {
        if (failedCount > 0) {
          setNotice({
            title: "상세 글 이미지",
            body: `${uploadedCount}장은 추가했고 ${failedCount}장은 업로드하지 못했어요.`,
          });
        }
      },
    }),
  );

  const selectMutualAidEvidenceImages = () => uploadAttachments(
    () => pickAndUploadDocuments(undefined, true, {
      multiple: true,
      accept: ".jpg,.jpeg,.png,image/jpeg,image/png",
      types: ["image/jpeg", "image/png"],
    }),
  );

  const handleEvidenceModeSelect = (mode: "file" | "link") => {
    setEvidenceMode(mode);
    if (mode === "file") {
      setEvidenceLink("");
      void selectMutualAidEvidenceImages();
      return;
    }
    setAttachments([]);
  };

  const selectFile = () => uploadAttachments(
    (isAlbum || isActivity || isAdminParticipationPost)
      ? pickPostImages
      : () => pickAndUploadDocuments(undefined, isMutualAid)
  );

  const compactAttachmentActions = writeAttachmentActions({
    images: () => void uploadAttachments(pickPostImages),
    documents: () => void uploadAttachments(() => pickAndUploadDocuments()),
  });

  const participantResults = participantSearch.data?.data ?? [];
  // 동아리 활동인증은 운영 중인 동아리만 고를 수 있다. 운영이 끝난 동아리의
  // 안내 글은 지우지 않고 남겨둔다 — 과거 활동인증이 그 글을 참조해 배지에
  // 마지막 공식명을 띄우기 때문이다.
  const activitySourcePosts = useMemo(() => {
    const posts = activitySourceQuery.data ?? [];
    if (activitySourceBoard?.slug !== "club-promo") return posts;
    return posts.filter((post) => clubOperationStatus(post.metadata) === "active");
  }, [activitySourceBoard?.slug, activitySourceQuery.data]);
  const activityOptions: SelectionOption[] = activitySourcePosts.map((post) => ({ key: String(post.id), label: post.title }));
  const mutualAidTypeOptions: SelectionOption[] = [
    { key: "marriage", label: "결혼" },
    { key: "bereavement", label: "상(喪)" },
  ];
  const mutualAidRelationOptions: SelectionOption[] = ["본인", "배우자", "부모", "자녀", "형제/자매"].map((label) => ({ key: label, label }));
  const imageAttachments = attachments.filter((attachment) => attachment.content_type.startsWith("image/"));
  const nonImageAttachments = attachments.filter((attachment) => !attachment.content_type.startsWith("image/"));

  // 제목·본문 등 폼 필드의 변경은 react-hook-form이 기준선 대비로 이미 추적한다.
  // 첨부·참가자·증빙 링크는 폼 밖 상태라 기준선과 직접 비교한다.
  const hasUnsavedChanges =
    formState.isDirty ||
    attachments.map((attachment) => attachment.id).join(",") !== unsavedBaseline.current.attachmentIds ||
    selectedParticipants.map((participant) => participant.id).join(",") !== unsavedBaseline.current.participantIds ||
    evidenceLink !== unsavedBaseline.current.evidenceLink;

  // 게시판마다 받는 항목이 달라서 쓰던 값을 그대로 옮기면 엉뚱한 칸에 남는다.
  // 디자인(BoardChangeConfirmModal)대로 확인을 받은 뒤 처음 상태로 되돌린다.
  const applyBoardChange = useCallback((nextBoardId: number) => {
    setBoardId(nextBoardId);
    reset();
    setAttachments([]);
    setSelectedParticipants([]);
    setParticipantQuery("");
    setActivitySourcePostId(null);
    setEvidenceLink("");
    setEvidenceMode(null);
    setMissingRequiredAttachment(false);
    setMissingBoard(false);
    unsavedBaseline.current = { attachmentIds: "", participantIds: "", evidenceLink: "" };
  }, [reset]);

  const selectBoard = useCallback((nextBoardId: number) => {
    setSelectionSheet(null);
    if (nextBoardId === boardId) return;
    // 아직 아무것도 안 썼으면 물어볼 것이 없다.
    if (!hasUnsavedChanges) {
      applyBoardChange(nextBoardId);
      return;
    }
    setPendingBoardId(nextBoardId);
  }, [applyBoardChange, boardId, hasUnsavedChanges]);

  const leaveCreateScreen = useCallback(() => {
    const decision = postCreateFormBackDecision({
      boardType,
      editOrigin: params.editOrigin,
      postId: params.postId,
      returnTo: params.returnTo,
      canGoBack: router.canGoBack(),
      boardId,
      fromBoardId: params.fromBoardId,
    });
    if (decision.action === "back") router.back();
    else if (decision.action === "navigate") router.navigate(decision.route as never);
    else router.replace(decision.route as never);
  }, [boardId, boardType, params.editOrigin, params.fromBoardId, params.postId, params.returnTo]);

  const handleCreateBack = useCallback(() => {
    if (createdPostId) {
      router.replace(postCreateCompletionRoute(boardType, createdPostId, boardId, params.returnTo) as never);
      return;
    }
    if (selectionSheet) {
      setSelectionSheet(null);
      return;
    }
    if (datePickerOpen) {
      setDatePickerOpen(false);
      return;
    }
    // 작성·수정 중인 내용이 있으면 바로 나가지 않고 확인부터 받는다.
    if (hasUnsavedChanges) {
      setDiscardPromptOpen(true);
      return;
    }
    leaveCreateScreen();
  }, [boardId, boardType, createdPostId, datePickerOpen, hasUnsavedChanges, leaveCreateScreen, params.returnTo, selectionSheet]);

  // iOS 가장자리 스와이프는 UIKit이 직접 pop 해서 위 핸들러들을 타지 않는다.
  // usePreventRemove가 native-stack의 preventNativeDismiss를 켜 그 제스처까지
  // 막아주므로, 확인창을 헤더·안드로이드 뒤로가기와 같은 지점으로 모은다.
  const navigation = useNavigation();
  const [removeConfirmed, setRemoveConfirmed] = useState(false);
  const pendingRemoveAction = useRef<NavigationAction | null>(null);
  // 하단 탭을 눌러 떠나려는 경우. 확인 후에 이 함수를 불러 그 탭으로 옮긴다.
  const pendingTabLeave = useRef<(() => void) | null>(null);

  usePreventRemove(hasUnsavedChanges && !createdPostId && !submitted && !removeConfirmed, ({ data }) => {
    pendingRemoveAction.current = data.action;
    setDiscardPromptOpen(true);
  });

  useEffect(() => {
    if (!submitted) return;
    // 잠금이 풀린 렌더 뒤에 옮긴다. 같은 틱에 옮기면 usePreventRemove가 아직
    // 이전 값을 들고 있어 등록에도 작성 취소 확인창이 뜬다.
    const go = pendingSubmitNavigation.current;
    pendingSubmitNavigation.current = null;
    go?.();
  }, [submitted]);

  // 탭바는 이 화면의 부모라 handleCreateBack을 타지 않는다. 가로채기를 걸어
  // 헤더·안드로이드 뒤로가기와 같은 확인창을 거치게 한다.
  const blocksLeaving = hasUnsavedChanges && !createdPostId && !removeConfirmed;
  useEffect(() => {
    if (!blocksLeaving) return undefined;
    setWriteLeaveGuard((proceed) => {
      pendingTabLeave.current = proceed;
      setDiscardPromptOpen(true);
    });
    return () => setWriteLeaveGuard(null);
  }, [blocksLeaving]);

  useEffect(() => {
    if (!removeConfirmed) return;
    // 잠금이 풀린 뒤에 원래 하려던 이동을 그대로 진행한다. 제스처가 아니라
    // 헤더·안드로이드에서 왔으면 남겨둔 동작이 없어 기존 경로를 탄다.
    const tabLeave = pendingTabLeave.current;
    pendingTabLeave.current = null;
    const action = pendingRemoveAction.current;
    pendingRemoveAction.current = null;
    if (tabLeave) tabLeave();
    else if (action) navigation.dispatch(action);
    else leaveCreateScreen();
  }, [leaveCreateScreen, navigation, removeConfirmed]);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardPromptOpen(false);
    // 작성 모드는 returnTo 경로에서 화면이 스택에 남을 수 있어 직접 비운다.
    // 수정 모드는 뒤로가기가 스택을 pop 하므로 언마운트되며 사라진다.
    if (!postId) {
      reset();
      setAttachments([]);
      setSelectedParticipants([]);
      setParticipantQuery("");
      setEvidenceLink("");
      setEvidenceMode("file");
      setActivitySourcePostId(null);
    }
    // 잠금을 먼저 풀어야 이동이 다시 막히지 않는다. 실제 이동은 위 effect가 한다.
    setRemoveConfirmed(true);
  }, [postId, reset]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return undefined;
      // The hidden board tab can have no list beneath this form. Use its origin
      // just like the header, instead of letting the parent tab return to Home.
      // Native Modal sheets retain their own onRequestClose handling.
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        handleCreateBack();
        return true;
      });
      return () => subscription.remove();
    }, [handleCreateBack]),
  );

  if (postId && (editPostQuery.isLoading || isBoardsLoading)) {
    return <LoadingState message="활동인증 정보를 불러오는 중이에요" />;
  }

  if (postId && (editPostQuery.isError || isBoardsError || !existingPost || !board)) {
    return (
      <View style={styles.editStateScreen}>
        <Text style={styles.editStateText}>수정할 활동인증을 불러오지 못했습니다.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void Promise.all([editPostQuery.refetch(), refetchBoards()])}
          style={styles.editRetryButton}
        >
          <Text style={styles.editRetryButtonText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  if (postId && isMutualAid && !canEditMutualAidRequest(existingPost?.mutual_aid?.status)) {
    return (
      <View style={styles.editStateScreen}>
        <Text style={styles.editStateText}>처리 완료되었거나 반려된 상조회 신청은 수정할 수 없습니다.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace(`/board/post/${postId}` as never)}
          style={styles.editRetryButton}
        >
          <Text style={styles.editRetryButtonText}>신청 상세로 돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  if ((isActivity || isMutualAid || isSuggestion) && createdPostId) {
    return (
      <CompletionState
        title={isSuggestion ? "건의사항이 등록되었어요!" : isMutualAid ? "신청이 완료되었어요!" : "활동 인증이 등록됐어요!"}
        onConfirm={handleCreateBack}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {/* Figma Verify-PhotoPreview: 활동 인증 상단바에는 구분선이 없다 */}
      {/* Figma 상조회 신청 TopBar: padding 18/16/14, 구분선 없음, 닫기 20×20(stroke 1.8), 제목 18/21, 우측 spacer 20. */}
      <View style={[styles.appBar, isActivity ? styles.appBarNoDivider : null, isMutualAid ? styles.appBarMutualAid : null, { paddingTop: Math.max(insets.top, 10) + (isMutualAid ? 18 : 0) }]}>
        <Pressable
          accessibilityLabel="닫기"
          hitSlop={isMutualAid ? 11 : undefined}
          onPress={handleCreateBack}
          style={isMutualAid ? styles.appBarIconMutualAid : styles.iconButton}
        >
          {isMutualAid ? (
            <CloseIcon size={20} color={COLORS.text} />
          ) : isActivity ? (
            <BackIcon size={24} color={COLORS.text} />
          ) : (
            <Ionicons name="close" size={24} color={COLORS.text} />
          )}
        </Pressable>
        <Text style={[styles.appBarTitle, isMutualAid ? styles.appBarTitleMutualAid : null]}>{labels.screenTitle}</Text>
        <View style={isMutualAid ? styles.appBarIconMutualAid : styles.iconButton} />
      </View>

      <ScrollView
        ref={formScrollRef}
        style={styles.formScroller}
        contentContainerStyle={[styles.content, isActivity ? styles.activityContent : null, isMutualAid ? styles.contentMutualAid : null]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        onLayout={(event) => {
          formScrollHeight.current = event.nativeEvent.layout.height;
          revealFocusedBlock();
        }}
      >
        {isActivity ? (
          <>
            <Controller
              control={control}
              name="category"
              render={({ field, fieldState }) => (
                <Pressable onPress={() => { Keyboard.dismiss(); setSelectionSheet("activity"); }} style={[styles.activitySelect, fieldState.error ? styles.inputError : null]}>
                  <Text style={[styles.activitySelectValue, !field.value ? styles.activitySelectPlaceholder : null]}>
                    {field.value || activitySelectPlaceholder(board?.slug)}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#A6ACB7" />
                </Pressable>
              )}
            />

            <View style={styles.activityFieldGroup}>
              <Pressable disabled={isUploading} onPress={selectFile} style={[styles.activityPhotoBox, isUploading ? styles.attachButtonDisabled : null, missingRequiredAttachment ? styles.borderOnlyError : null]}>
                {imageAttachments.length > 0 ? (
                  <View style={styles.activityPhotoGrid}>
                    {imageAttachments.map((attachment) => {
                      return (
                        <MediaImageBackground key={attachment.id} media={attachment} imageStyle={styles.activityPhotoTileImage} style={styles.activityPhotoTile}>
                          <Pressable
                            accessibilityLabel={`${attachment.original_filename} 삭제`}
                            hitSlop={6}
                            onPress={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                            style={styles.activityPhotoRemove}
                          >
                            <CloseIcon size={12} color="#FFFFFF" />
                          </Pressable>
                        </MediaImageBackground>
                      );
                    })}
                    <View style={styles.activityPhotoAddTile}>
                      <Ionicons name="add" size={20} color={COLORS.subtle} />
                    </View>
                  </View>
                ) : (
                  <>
                    <CameraAddIcon size={26} />
                    <Text style={styles.activityPhotoText}>
                      {isUploading ? "업로드 중" : "활동 사진을 추가해주세요"}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            <View style={styles.activityFieldGroup}>
              <Controller
                control={control}
                name="content"
                render={({ field, fieldState }) => (
                  <FormTextInput
                    multiline
                    onChangeText={clearOnChange("content", field.onChange)}
                    placeholder="활동에 대한 소감을 남겨주세요"
                    placeholderTextColor="#A6ACB7"
                    hasError={Boolean(fieldState.error)}
                    style={[styles.input, styles.activityFeedbackInput]}
                    textAlignVertical="top"
                    value={field.value}
                  />
                )}
              />
            </View>

            <Text style={styles.activityFieldTitle}>활동한 날짜</Text>
            <Controller
              control={control}
              name="activityDate"
              render={({ field, fieldState }) => (
                <>
                  <Pressable
                    accessibilityHint="달력에서 실제 활동 날짜를 선택합니다"
                    accessibilityLabel="활동일 선택"
                    accessibilityRole="button"
                    onPress={() => { Keyboard.dismiss(); setDatePickerOpen((open) => !open); }}
                    style={[styles.activityInputWithIcon, fieldState.error ? styles.inputError : null]}
                  >
                    <Text style={styles.activityDateValue}>{field.value ? formatBoardDate(field.value) : "활동일을 선택하세요"}</Text>
                    <CalendarSmallIcon size={15} color="#A6ACB7" />
                  </Pressable>
                  {datePickerOpen ? (
                    <InlineCalendar
                      maximumDate={maximumActivityCertificationDate()}
                      value={field.value}
                      onSelect={(dateStr) => {
                        field.onChange(dateStr);
                        clearErrors("activityDate");
                        setDatePickerOpen(false);
                      }}
                    />
                  ) : null}
                  {fieldState.error?.message ? <Text style={styles.errorText}>{fieldState.error.message}</Text> : null}
                </>
              )}
            />

            <View
              style={styles.activityFieldGroup}
              onLayout={(event) => { bankGroupBottom.current = event.nativeEvent.layout.y + event.nativeEvent.layout.height; }}
            >
              <Text style={styles.activityFieldTitle}>활동비 받을 계좌번호</Text>
              <Controller
                control={control}
                name="bankAccount"
                render={({ field, fieldState }) => (
                  <FormTextInput
                    onBlur={() => { revealTarget.current = null; }}
                    onFocus={() => { revealTarget.current = "bank"; revealFocusedBlock(); }}
                    onChangeText={clearOnChange("bankAccount", field.onChange)}
                    placeholder={bankAccountField.placeholder}
                    placeholderTextColor="#A6ACB7"
                    hasError={Boolean(fieldState.error)}
                    style={styles.input}
                    value={field.value ?? ""}
                  />
                )}
              />
              <View style={styles.activityWarning}>
                <View style={styles.activityWarningIcon}>
                  <NoticeAlertIcon size={14} color="#854F0B" />
                </View>
                <View style={styles.activityWarningBody}>
                  <Text style={styles.activityWarningText}>{bankAccountField.guidance}</Text>
                </View>
              </View>
            </View>

            <View style={[styles.activityFieldGroup, styles.activityParticipantGroup]}>
              <Text style={styles.activityFieldTitle}>참가자</Text>
              <Controller
                control={control}
                name="participants"
                render={({ fieldState }) => {
                  return (
                    <>
                      <View style={[styles.activityInputWithIcon, participantSearchFocused ? styles.activityInputWithIconFocused : null, fieldState.error ? styles.inputError : null]}>
                        <Ionicons name="search-outline" size={16} color="#A6ACB7" />
                        <TextInput
                          onBlur={() => { setParticipantSearchFocused(false); revealTarget.current = null; }}
                          onChangeText={setParticipantQuery}
                          onFocus={() => { setParticipantSearchFocused(true); revealTarget.current = "end"; revealFocusedBlock(); }}
                          placeholder="이름으로 검색"
                          placeholderTextColor="#A6ACB7"
                          style={[styles.activityInlineInput, { outlineStyle: "none" } as never]}
                          value={participantQuery}
                        />
                      </View>
                      {trimmedParticipantQuery.length > 0 && !participantSearch.isLoading && participantResults.length === 0 ? (
                        <Text style={styles.participantNoResultText}>검색 결과가 없어요</Text>
                      ) : null}
                      {trimmedParticipantQuery.length > 0 && participantResults.length > 0 ? (
                        <View style={styles.participantResultBox}>
                          {participantResults.map((participant) => {
                            const selected = selectedParticipants.some((item) => item.id === participant.id);
                            const participantColor = activityParticipantTextColor(participant);
                            return (
                              <Pressable
                                key={participant.id}
                                disabled={selected}
                                onPress={() => addParticipant(participant)}
                                style={[styles.participantResultRow, selected ? styles.participantResultRowDisabled : null]}
                              >
                                <View style={styles.participantAvatar}>
                                  <Ionicons name="person" size={22} color="#FFFFFF" />
                                </View>
                                <View style={styles.participantTextBlock}>
                                  {/* Figma 참가자검색행: 학번은 노출하지 않고 "72기 이름" + 전공만 표시한다. */}
                                  <Text style={[styles.participantName, { color: participantColor }]}>
                                    {formatActivityParticipant(participant)}
                                  </Text>
                                  {participant.major ? (
                                    <Text style={[styles.participantMeta, { color: participantColor }]}>{participant.major}</Text>
                                  ) : null}
                                </View>
                                {selected ? (
                                  <Ionicons name="checkmark-circle" size={28} color={COLORS.primary} />
                                ) : (
                                  <ParticipantAddIcon size={28} color={COLORS.primary} />
                                )}
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                      {selectedParticipants.length > 0 ? (
                        <View style={styles.activityChipRow}>
                          {selectedParticipants.map((participant) => (
                            <Pressable key={participant.id} onPress={() => removeParticipant(participant.id)} style={styles.activityMemberChip}>
                              {/* 검색 목록과 같은 기준으로 미납자는 회색으로 보여 준다. */}
                              <Text style={[styles.activityMemberChipText, { color: activityParticipantTextColor(participant) }]}>
                                {formatActivityParticipant(participant)}
                              </Text>
                              <CloseIcon size={12} color={COLORS.muted} />
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </>
                  );
                }}
              />
              <View style={styles.activityWarning}>
                <View style={styles.activityWarningIcon}><NoticeAlertIcon size={14} color="#854F0B" /></View>
                {/* Android(Fabric)에서는 행 안의 Text가 flex:1로도 줄어들지 않아 View로 감싸 폭을 제한한다. */}
                <View style={styles.activityWarningBody}>
                  <Text style={styles.activityWarningText}>{ACTIVITY_PARTICIPANT_GUIDANCE}</Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <>
        {canPickBoard ? (
          <View style={styles.boardSelectWrap}>
            <Pressable
              onPress={() => { Keyboard.dismiss(); setSelectionSheet("board"); }}
              style={[styles.selectLike, missingBoard ? styles.inputError : null]}
            >
              <Text style={[styles.selectText, !board ? styles.selectPlaceholder : null]} numberOfLines={1}>
                {board?.name ?? BOARD_SELECT_PLACEHOLDER}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#A6ACB7" />
            </Pressable>
          </View>
        ) : null}

        {guide && !isMutualAid ? (
          <View style={[styles.guideBox, isSuggestion ? styles.guideBoxSuggestion : null]}>
            <Ionicons name={isSuggestion ? "information-circle-outline" : guide.icon} size={17} color={isSuggestion ? "#0C447C" : COLORS.primary} />
            <Text style={[styles.guideBody, isSuggestion ? styles.guideBodySuggestion : null]}>{guide.body}</Text>
          </View>
        ) : null}

      {isStudyRecruit ? (
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <View style={styles.studyStatusWrap}>
              <Text style={[styles.label, styles.studyStatusLabel]}>모집 상태</Text>
              <View style={styles.recruitmentStatusRow}>
                {["진행중", "마감"].map((status) => {
                  const disabled = status === "마감" && !canCloseRecruitment;
                  return (
                    <Pressable
                      key={status}
                      disabled={disabled}
                      onPress={() => field.onChange(status)}
                      style={[
                        styles.recruitmentStatusButton,
                        field.value === status ? styles.recruitmentStatusButtonActive : null,
                        disabled ? styles.recruitmentStatusButtonDisabled : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.recruitmentStatusText,
                          field.value === status ? styles.recruitmentStatusTextActive : null,
                          disabled ? styles.recruitmentStatusTextDisabled : null,
                        ]}
                      >
                        {status}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        />
      ) : null}

      {!isMutualAid ? (
        <Controller
          control={control}
          name="title"
          render={({ field, fieldState }) => (
            <FormField label={compactCreate || isStudyRecruit ? "" : labels.title} required error={fieldState.error?.message}>
              <FormTextInput
                onChangeText={clearOnChange("title", field.onChange)}
                placeholder={labels.titlePlaceholder}
                placeholderTextColor="#A6ACB7"
                hasError={Boolean(fieldState.error)}
                style={styles.input}
                value={field.value}
              />
            </FormField>
          )}
        />
      ) : null}

      {resourceFields?.professor ? (
        <Controller
          control={control}
          name="professor"
          render={({ field, fieldState }) => (
            <FormField label={compactCreate ? "" : "교수명"}>
              {/* 포커스 테두리는 바깥 래퍼가 갖는다. 안쪽 입력에 붙이면 둥근 모서리를
                  따르지 않고 각진 사각형으로 그려지고, 글자 시작 위치도 밀린다. */}
              <View
                style={[
                  styles.suffixInputRow,
                  professorFocused ? styles.suffixInputRowFocused : null,
                  fieldState.error ? styles.inputError : null,
                ]}
              >
                <TextInput
                  onBlur={() => setProfessorFocused(false)}
                  onChangeText={clearOnChange("professor", field.onChange)}
                  onFocus={() => setProfessorFocused(true)}
                  placeholder="교수명을 입력하세요"
                  placeholderTextColor="#A6ACB7"
                  style={[styles.suffixInput, { outlineStyle: "none" } as never]}
                  value={field.value}
                />
                <Text style={styles.suffixInputLabel}>교수</Text>
              </View>
            </FormField>
          )}
        />
      ) : null}

      {RESOURCE_RATING_FIELDS.filter((rating) => resourceFields?.[rating.name]).map((rating) => (
        <Controller
          control={control}
          key={rating.name}
          name={rating.name}
          render={({ field, fieldState }) => (
            <FormField label={rating.label}>
              <View style={styles.ratingRow}>
                {RESOURCE_RATING_LEVELS.map((level) => {
                  const selected = field.value === level;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={level}
                      // 필수 입력이라 해제는 없다. 다른 등급을 눌러 바꾼다.
                      // 위 입력칸에 포커스가 남아 있으면 검은 테두리와 키보드가 그대로라
                      // 등급을 고르는 순간 포커스를 놓아준다.
                      onPress={() => { Keyboard.dismiss(); field.onChange(level); clearErrors(rating.name); }}
                      style={[
                        styles.ratingButton,
                        selected ? styles.ratingButtonActive : null,
                        fieldState.error ? styles.borderOnlyError : null,
                      ]}
                    >
                      <Text style={[styles.ratingText, selected ? styles.ratingTextActive : null]}>{level}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </FormField>
          )}
        />
      ))}

      {!isAlbum && (isMutualAid || board?.slug === "club-promo") ? (
        <Controller
          control={control}
          name="category"
          render={({ field, fieldState }) => (
            <FormField label={compactCreate ? "" : labels.category} requiredStar={isMutualAid} helper={isSuggestion ? "운영, 행사, 시설 등 필요한 경우만 입력하세요." : undefined}>
              {isMutualAid ? (
                <Pressable onPress={() => { Keyboard.dismiss(); setSelectionSheet("mutualType"); }} style={[styles.selectionField, fieldState.error ? styles.inputError : null]}>
                  <Text style={[styles.selectionValue, !field.value ? styles.selectionPlaceholder : null]}>{field.value || labels.categoryPlaceholder}</Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.subtle} />
                </Pressable>
              ) : isStudyRecruit ? (
                <View style={styles.recruitmentStatusRow}>
                  {["진행중", "마감"].map((status) => {
                    const disabled = status === "마감" && !canCloseRecruitment;
                    return (
                      <Pressable
                        key={status}
                        disabled={disabled}
                        onPress={() => field.onChange(status)}
                        style={[
                          styles.recruitmentStatusButton,
                          field.value === status ? styles.recruitmentStatusButtonActive : null,
                          disabled ? styles.recruitmentStatusButtonDisabled : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.recruitmentStatusText,
                            field.value === status ? styles.recruitmentStatusTextActive : null,
                            disabled ? styles.recruitmentStatusTextDisabled : null,
                          ]}
                        >
                          {status}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : board?.slug === "club-promo" ? (
                <View style={styles.recruitmentStatusRow}>
                  {["모집중", "상시", "마감"].map((status) => (
                    <Pressable
                      key={status}
                      onPress={() => field.onChange(status)}
                      style={[styles.recruitmentStatusButton, field.value === status ? styles.recruitmentStatusButtonActive : null]}
                    >
                      <Text style={[styles.recruitmentStatusText, field.value === status ? styles.recruitmentStatusTextActive : null]}>{status}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <FormTextInput
                  onChangeText={clearOnChange("category", field.onChange)}
                  placeholder={labels.categoryPlaceholder}
                  placeholderTextColor="#A6ACB7"
                  style={styles.input}
                  value={field.value}
                />
              )}
            </FormField>
          )}
        />
      ) : null}

      {board?.slug === "club-promo" ? (
        <Controller
          control={control}
          name="clubOperationStatus"
          render={({ field }) => <ClubOperationStatusField value={field.value} onChange={field.onChange} />}
        />
      ) : null}

      {isActivity ? (
        <>
          <Controller
            control={control}
            name="activityDate"
            render={({ field }) => (
              <FormField label="활동일" required>
                <FormTextInput
                  onChangeText={field.onChange}
                  placeholder="YYYY.MM.DD"
                  placeholderTextColor="#A6ACB7"
                  style={styles.input}
                  value={field.value}
                />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="participants"
            render={({ field }) => (
              <FormField label="참가자" required helper="여러 명이면 쉼표로 구분해 입력하세요.">
                <FormTextInput
                  onChangeText={field.onChange}
                  placeholder="예: 홍길동, 김서강"
                  placeholderTextColor="#A6ACB7"
                  style={styles.input}
                  value={field.value}
                />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="bankAccount"
            render={({ field }) => (
              <FormField label="입금 계좌" required helper="은행명, 계좌번호, 예금주를 함께 입력하세요.">
                <FormTextInput
                  onChangeText={field.onChange}
                  placeholder="예: 신한 110-000-000000 홍길동"
                  placeholderTextColor="#A6ACB7"
                  style={styles.input}
                  value={field.value}
                />
              </FormField>
            )}
          />
        </>
      ) : null}

      {isMutualAid ? (
        <>
          <Controller
            control={control}
            name="eventDate"
            render={({ field, fieldState }) => (
              <FormField error={fieldState.error?.message} label="날짜" requiredStar>
                <Pressable onPress={() => { Keyboard.dismiss(); setDatePickerOpen((open) => !open); }} style={[styles.selectionField, fieldState.error ? styles.inputError : null]}>
                  <Text style={[styles.selectionValue, !field.value ? styles.selectionPlaceholder : null]}>
                    {field.value ? formatBoardDate(field.value) : "경조사 날짜를 선택하세요"}
                  </Text>
                  <Feather name="calendar" size={15} color={COLORS.subtle} />
                </Pressable>
                {datePickerOpen ? (
                  <InlineCalendar
                    minimumDate={mutualAidMinimumDate}
                    value={field.value}
                    onSelect={(dateStr) => {
                      field.onChange(dateStr);
                      clearErrors("eventDate");
                      setDatePickerOpen(false);
                    }}
                  />
                ) : null}
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="relation"
            render={({ field, fieldState }) => (
              <FormField label="관계" requiredStar>
                <Pressable onPress={() => { Keyboard.dismiss(); setSelectionSheet("mutualRelation"); }} style={[styles.selectionField, fieldState.error ? styles.inputError : null]}>
                  <Text style={[styles.selectionValue, !field.value ? styles.selectionPlaceholder : null]}>
                    {field.value || "본인 / 배우자 / 부모 등 선택"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.subtle} />
                </Pressable>
              </FormField>
            )}
          />
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>증빙서류 첨부</Text>
              <Text style={styles.requiredStar}>*</Text>
            </View>
            <View style={styles.evidenceModeRow}>
              {EVIDENCE_MODES.map((mode) => {
                const active = evidenceMode === mode.key;
                // 증빙이 비었다는 표시는 고른 쪽 탭에 띄운다. 아직 아무 쪽도
                // 고르지 않았으면 어디를 채워야 하는지 알 수 없으므로 양쪽에 띄운다.
                const showsError = missingRequiredAttachment && (active || evidenceMode === null);
                return (
                  <Pressable
                    key={mode.key}
                    accessibilityHint={mode.key === "file" ? "JPG 또는 PNG 이미지를 선택합니다." : "청첩장 또는 부고장 링크 입력란을 표시합니다."}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    disabled={isSubmitting}
                    onPress={() => handleEvidenceModeSelect(mode.key)}
                    style={styles.evidenceModeTab}
                  >
                    <View style={[styles.evidenceModeTabVisual, active ? styles.evidenceModeTabActive : null, showsError ? styles.evidenceModeTabError : null]}>
                      <Text style={[styles.evidenceModeText, active && !showsError ? styles.evidenceModeTextActive : null]}>{mode.label}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {evidenceMode === "file" ? (
              <View style={styles.evidenceImageSection}>
                <Text style={styles.evidenceImageHint}>※ 청첩장, 부고장 이미지를 첨부할 수 있어요 (JPG, PNG)</Text>
                {imageAttachments.length > 0 ? (
                  <View style={styles.evidenceImageGrid}>
                    {imageAttachments.map((attachment) => (
                      <MediaImageBackground
                        key={attachment.id}
                        media={attachment}
                        imageStyle={styles.evidenceImageTileImage}
                        style={styles.evidenceImageTile}
                      >
                        <Pressable
                          accessibilityLabel={`${attachment.original_filename} 삭제`}
                          accessibilityRole="button"
                          disabled={isSubmitting}
                          onPress={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                          style={styles.evidenceImageRemove}
                        >
                          <View style={styles.evidenceImageRemoveVisual}>
                            <CloseIcon size={10} color="#FFFFFF" />
                          </View>
                        </Pressable>
                      </MediaImageBackground>
                    ))}
                  </View>
                ) : null}
                {nonImageAttachments.length > 0 ? (
                  <View style={styles.evidenceLegacyFiles}>
                    {nonImageAttachments.map((attachment) => (
                      <View key={attachment.id} style={styles.evidenceLegacyFile}>
                        <Ionicons name="document-outline" size={16} color={COLORS.primary} />
                        <Text numberOfLines={1} style={styles.evidenceLegacyFileName}>{attachment.original_filename}</Text>
                        <Pressable
                          accessibilityLabel={`${attachment.original_filename} 삭제`}
                          accessibilityRole="button"
                          disabled={isSubmitting}
                          onPress={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                          style={styles.evidenceLegacyFileRemove}
                        >
                          <CloseIcon size={16} color={COLORS.muted} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : evidenceMode === "link" ? (
              <View style={[styles.evidenceLinkField, evidenceLinkFocused ? styles.evidenceLinkFieldFocused : null]}>
                <AttachLinkIcon size={16} color={COLORS.muted} />
                <TextInput
                  autoCapitalize="none"
                  keyboardType="url"
                  onBlur={() => setEvidenceLinkFocused(false)}
                  onChangeText={(value) => {
                    setEvidenceLink(value);
                    setMissingRequiredAttachment(false);
                  }}
                  onFocus={() => setEvidenceLinkFocused(true)}
                  placeholder="청첩장, 부고장 링크(URL)를 입력해주세요"
                  placeholderTextColor={COLORS.muted}
                  style={[styles.evidenceLinkInput, { outlineStyle: "none" } as never]}
                  value={evidenceLink}
                />
              </View>
            ) : null}
          </View>
          <Controller
            control={control}
            name="content"
            render={({ field }) => (
              <FormField label="비고" optional>
                <FormTextInput
                  multiline
                  onBlur={() => { revealTarget.current = null; }}
                  onFocus={() => { revealTarget.current = "end"; revealFocusedBlock(); }}
                  onChangeText={field.onChange}
                  placeholder="전달하고 싶은 내용이 있다면 적어주세요"
                  placeholderTextColor="#A6ACB7"
                  style={[styles.input, styles.textArea]}
                  textAlignVertical="top"
                  value={field.value ?? ""}
                />
              </FormField>
            )}
          />
        </>
      ) : null}

      {!isAlbum && !isMutualAid ? (
        <Controller
          control={control}
          name="content"
          render={({ field, fieldState }) => (
            <FormField label={compactCreate || isStudyRecruit ? "" : labels.content} required={!isMutualAid} error={fieldState.error?.message}>
              <FormTextInput
                multiline
                onBlur={() => { revealTarget.current = null; }}
                onFocus={() => { revealTarget.current = "attach"; revealFocusedBlock(); }}
                onChangeText={clearOnChange("content", field.onChange)}
                placeholder={labels.contentPlaceholder}
                placeholderTextColor="#A6ACB7"
                hasError={Boolean(fieldState.error)}
                style={[styles.input, styles.textArea, isSuggestion ? styles.suggestionContentInput : isStudyRecruit ? styles.studyContentInput : styles.generalContentInput]}
                textAlignVertical="top"
                value={field.value ?? ""}
              />
            </FormField>
          )}
        />
      ) : null}

      {isStudyRecruit ? (
        <Controller
          control={control}
          name="contact"
          render={({ field }) => (
            <FormField label="스터디장 연락수단">
              <FormTextInput
                multiline
                onChangeText={clearOnChange("contact", field.onChange)}
                placeholder={"스터디원들과 연락할 수단을 입력해주세요.\n(이메일, 카카오톡 ID, 휴대폰번호 등)"}
                placeholderTextColor="#A6ACB7"
                style={[styles.input, styles.contactInput]}
                textAlignVertical="top"
                value={field.value}
              />
            </FormField>
          )}
        />
      ) : null}

      {isAdminParticipationPost ? (
        <Controller
          control={control}
          name="applicationUrl"
          render={({ field }) => (
            <FormField label="참여 버튼 링크" required helper={`상세 화면의 ${isNetworkingProgram ? "참가 신청" : "가입 신청"} 버튼이 이 주소를 엽니다.`}>
              <FormTextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                onChangeText={field.onChange}
                placeholder="https://forms.gle/..."
                placeholderTextColor="#A6ACB7"
                style={styles.input}
                value={field.value}
              />
            </FormField>
          )}
        />
      ) : null}

      {isStudyRecruit || isSuggestion || isMutualAid ? null : compactCreate && !isAlbum && !isAdminParticipationPost ? (
        <PostAttachmentEditor
          attachments={attachments}
          onChange={setAttachments}
          onUploadingChange={setIsUploading}
          onError={showUploadFailure}
          disabled={createMutation.isPending || updateMutation.isPending}
          onLayout={(event) => { attachSectionTop.current = event.nativeEvent.layout.y; }}
          onActionsLayout={(event) => { attachActionsBottom.current = event.nativeEvent.layout.y + event.nativeEvent.layout.height; }}
        />
      ) : compactCreate ? (
        <View style={styles.compactAttachWrap}>
          {!isAdminParticipationPost ? (
            <>
              <View style={styles.compactAttachActions}>
                {compactAttachmentActions.map((action) => (
                  <Pressable
                    disabled={isUploading || (isAlbum && action.picker === "images" && isAlbumImageLimitReached)}
                    key={action.picker}
                    onPress={action.onPress}
                    style={[styles.compactAttachButton, isUploading || (isAlbum && action.picker === "images" && isAlbumImageLimitReached) ? styles.attachButtonDisabled : null]}
                  >
                    {action.picker === "images" ? (
                      <AttachImageIcon size={16} color={COLORS.muted} />
                    ) : (
                      <AttachFileIcon size={16} color={COLORS.muted} />
                    )}
                    <Text style={styles.compactAttachText}>
                      {isUploading ? "업로드 중" : isAlbum && action.picker === "images" && isAlbumImageLimitReached ? "20장 완료" : action.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.attachExtensionHint}>이미지: JPG, PNG | 파일: PDF, DOCX</Text>
              {isAlbum ? <Text style={styles.helperText}>{labels.attachmentHelp}</Text> : null}
              {imageAttachments.length > 0 ? (
                <View style={styles.writeImageGrid}>
                  {imageAttachments.map((attachment) => (
                    <MediaImageBackground
                      key={attachment.id}
                      media={attachment}
                      imageStyle={styles.writeImageThumbImage}
                      style={styles.writeImageThumb}
                    >
                      <Pressable
                        hitSlop={6}
                        onPress={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                        style={styles.writeImageRemove}
                      >
                        <CloseIcon size={12} color="#FFFFFF" />
                      </Pressable>
                    </MediaImageBackground>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.participationImageSection}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>대표 이미지</Text>
                  <View style={styles.requiredPill}>
                    <Text style={styles.requiredText}>필수</Text>
                  </View>
                </View>
                <Text style={styles.helperText}>목록 썸네일에만 사용합니다. 이미지 1장 · 10MB 이하</Text>
                <Pressable
                  disabled={isUploading}
                  onPress={selectParticipationRepresentativeImage}
                  style={[styles.compactAttachButton, isUploading ? styles.attachButtonDisabled : null]}
                >
                  <Ionicons name="image-outline" size={16} color={COLORS.muted} />
                  <Text style={styles.compactAttachText}>
                    {isUploading ? "업로드 중" : participationRepresentativeImage ? "대표 이미지 변경" : "대표 이미지 등록"}
                  </Text>
                </Pressable>
                {participationRepresentativeImage ? (
                  <View style={styles.writeImageGrid}>
                    <MediaImageBackground
                      media={participationRepresentativeImage}
                      imageStyle={styles.writeImageThumbImage}
                      style={styles.writeImageThumb}
                    />
                  </View>
                ) : null}
              </View>

              <View style={styles.participationImageSection}>
                <Text style={styles.label}>상세 글 이미지</Text>
                <Text style={styles.helperText}>
                  {participationRepresentativeImage
                    ? "상세 본문 아래에 등록 순서대로 표시합니다. 각 이미지 10MB 이하"
                    : "대표 이미지를 먼저 등록하면 상세 이미지를 추가할 수 있습니다."}
                </Text>
                <Pressable
                  disabled={isUploading || !participationRepresentativeImage}
                  onPress={selectParticipationDetailImages}
                  style={[styles.compactAttachButton, isUploading || !participationRepresentativeImage ? styles.attachButtonDisabled : null]}
                >
                  <Ionicons name="images-outline" size={16} color={COLORS.muted} />
                  <Text style={styles.compactAttachText}>{isUploading ? "업로드 중" : "상세 이미지 추가"}</Text>
                </Pressable>
                {participationDetailImages.length > 0 ? (
                  <View style={styles.writeImageGrid}>
                    {participationDetailImages.map((attachment) => (
                      <MediaImageBackground
                        key={attachment.id}
                        media={attachment}
                        imageStyle={styles.writeImageThumbImage}
                        style={styles.writeImageThumb}
                      >
                        <Pressable
                          hitSlop={6}
                          onPress={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                          style={styles.writeImageRemove}
                        >
                          <CloseIcon size={12} color="#FFFFFF" />
                        </Pressable>
                      </MediaImageBackground>
                    ))}
                  </View>
                ) : null}
              </View>
            </>
          )}
          {attachments.some((item) => !item.content_type.startsWith("image/")) ? (
            <View style={styles.compactAttachmentList}>
              {attachments
                .filter((item) => !item.content_type.startsWith("image/"))
                .map((attachment) => (
                  <View key={attachment.id} style={styles.compactAttachmentItem}>
                    <Ionicons name="document-outline" size={18} color={COLORS.muted} />
                    <Text numberOfLines={1} style={styles.compactAttachmentName}>
                      {attachment.original_filename}
                    </Text>
                    <Pressable hitSlop={8} onPress={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}>
                      <CloseIcon size={18} color={COLORS.muted} />
                    </Pressable>
                  </View>
                ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.attachmentBox}>
          <View style={styles.attachmentHeader}>
            <View style={styles.attachmentText}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{labels.attachment}</Text>
                {requiresAttachment ? (
                  <View style={styles.requiredPill}>
                    <Text style={styles.requiredText}>필수</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.helperText}>{labels.attachmentHelp}</Text>
            </View>
            <Pressable disabled={isUploading} onPress={selectFile} style={[styles.attachButton, isUploading ? styles.attachButtonDisabled : null]}>
              <Ionicons name="attach" size={18} color={COLORS.primary} />
              <Text style={styles.attachButtonText}>{isUploading ? "업로드 중" : "첨부"}</Text>
            </Pressable>
          </View>
          {attachments.length > 0 ? (
            <View style={styles.attachmentList}>
              {attachments.map((attachment) => (
                <View key={attachment.id} style={styles.attachmentItem}>
                  <View style={styles.attachmentFile}>
                    <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
                    <View style={styles.attachmentNameWrap}>
                      <Text style={styles.attachmentName} numberOfLines={1}>
                        {attachment.original_filename}
                      </Text>
                      <Text style={styles.attachmentSize}>{Math.ceil(attachment.file_size / 1024)} KB</Text>
                    </View>
                  </View>
                  <Pressable hitSlop={8} onPress={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}>
                    <Ionicons name="close-circle" size={22} color={COLORS.danger} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.attachmentEmpty}>
              <Text style={styles.attachmentEmptyText}>아직 첨부된 파일이 없습니다.</Text>
            </View>
          )}
        </View>
      )}
          </>
        )}

      <Pressable
        disabled={isSubmitting}
        // 제출할 때도 포커스를 놓아 검은 테두리와 키보드를 함께 걷는다.
        onPress={() => { Keyboard.dismiss(); handleSubmit(onSubmit)(); }}
        style={[styles.submitButton, isActivity ? styles.activitySubmitButton : null, isMutualAid ? styles.submitButtonMutualAid : null, isSubmitting ? styles.submitButtonDisabled : null]}
      >
        <Text style={[styles.submitText, isActivity ? styles.activitySubmitText : null]}>{createMutation.isPending || updateMutation.isPending ? "저장 중" : submitLabel}</Text>
      </Pressable>
      </ScrollView>

      <SelectionSheet
        visible={selectionSheet === "board"}
        title={BOARD_SELECT_PLACEHOLDER}
        options={selectableBoards.map((item) => ({ key: String(item.id), label: item.name }))}
        emptyText={isBoardsLoading ? "게시판을 불러오는 중입니다." : "선택할 수 있는 게시판이 없습니다."}
        selectedKey={board ? String(board.id) : undefined}
        onClose={() => setSelectionSheet(null)}
        onSelect={(option) => selectBoard(Number(option.key))}
      />
      <SelectionSheet
        visible={selectionSheet === "activity"}
        title={activitySelectPlaceholder(board?.slug)}
        options={activityOptions}
        emptyText={activitySourceQuery.isLoading ? "활동 대상을 불러오는 중입니다." : "선택할 수 있는 활동이 없습니다."}
        selectedKey={activitySourcePostId ? String(activitySourcePostId) : undefined}
        onClose={() => setSelectionSheet(null)}
        onSelect={(option) => {
          setValue("category", option.label, { shouldValidate: true });
          clearErrors("category");
          setActivitySourcePostId(Number(option.key));
          setSelectionSheet(null);
        }}
      />
      <SelectionSheet
        visible={selectionSheet === "mutualType"}
        title="경조사 종류"
        options={mutualAidTypeOptions}
        emptyText="선택 가능한 경조사 종류가 없습니다."
        onClose={() => setSelectionSheet(null)}
        onSelect={(option) => {
          setValue("category", option.label, { shouldValidate: true });
          clearErrors("category");
          setSelectionSheet(null);
        }}
      />
      <SelectionSheet
        visible={selectionSheet === "mutualRelation"}
        title="관계"
        options={mutualAidRelationOptions}
        emptyText="선택 가능한 관계가 없습니다."
        onClose={() => setSelectionSheet(null)}
        onSelect={(option) => {
          setValue("relation", option.label, { shouldValidate: true });
          clearErrors("relation");
          setSelectionSheet(null);
        }}
      />
      <DiscardWriteModal
        visible={discardPromptOpen}
        mode={postId ? "edit" : "create"}
        onKeep={() => setDiscardPromptOpen(false)}
        onDiscard={handleDiscardConfirm}
      />
      <DiscardWriteModal
        visible={pendingBoardId !== null}
        mode="boardChange"
        onKeep={() => setPendingBoardId(null)}
        onDiscard={() => {
          if (pendingBoardId !== null) applyBoardChange(pendingBoardId);
          setPendingBoardId(null);
        }}
      />
      <NoticeModal notice={notice} onClose={() => setNotice(null)} />
      <Toast toast={toast} onHide={hideToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  successScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bg,
    paddingHorizontal: 28,
  },
  successContent: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 16,
  },
  successIcon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#22C55E",
    borderRadius: 32,
  },
  successTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "500",
    lineHeight: 32,
    textAlign: "center",
  },
  successButton: {
    width: 280,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  successButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "400",
  },
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  editStateScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 24,
  },
  editStateText: {
    color: COLORS.muted,
    fontSize: 14,
    textAlign: "center",
  },
  editRetryButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
  },
  editRetryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "400",
  },
  appBar: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  appBarNoDivider: {
    borderBottomWidth: 0,
  },
  appBarMutualAid: {
    minHeight: 0,
    borderBottomWidth: 0,
    paddingBottom: 14, // Figma TopBar padding 18/16/14
  },
  appBarIconMutualAid: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  appBarTitleMutualAid: {
    lineHeight: 21, // Figma 18/21
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
  },
  appBarTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 22, // Figma: 글쓰기 18/22 Medium
  },
  formScroller: {
    flex: 1,
  },
  content: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  contentMutualAid: {
    paddingTop: 14, // Figma 작성본문 padding 14/20/16 + 신청버튼래퍼 padding 12/20/24
    paddingBottom: 24,
  },
  activityContent: {
    gap: 16,
    paddingTop: 18,
  },
  activitySelect: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  activitySelectInput: {
    flex: 1,
    height: 40,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    paddingVertical: 0,
  },
  activitySelectValue: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 17,
  },
  activitySelectPlaceholder: {
    color: "#A6ACB7",
  },
  selectionField: {
    minHeight: 41, // Figma: 41h, border 0.5, padding 12/14
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectionValue: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14, // Figma: Regular 14/17
    fontWeight: "400",
    lineHeight: 17,
  },
  selectionPlaceholder: {
    color: COLORS.subtle,
  },
  recruitmentStatusRow: {
    flexDirection: "row",
    gap: 4,
    width: "100%",
    backgroundColor: "#F0F0EE",
    padding: 4,
    borderRadius: 10,
  },
  recruitmentStatusButton: {
    flex: 1,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  recruitmentStatusButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  recruitmentStatusText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 17,
  },
  recruitmentStatusTextActive: {
    color: COLORS.primary,
  },
  recruitmentStatusButtonDisabled: {
    opacity: 0.45,
  },
  recruitmentStatusTextDisabled: {
    color: COLORS.subtle,
  },
  activityPhotoBox: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#B4B2A9",
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    overflow: "hidden",
  },
  activityPhotoGrid: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 10,
    padding: 12,
  },
  activityPhotoText: {
    color: "#A6ACB7",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
  },
  activityPhotoTile: {
    width: 62,
    height: 62,
    overflow: "hidden",
    borderRadius: 7,
    backgroundColor: COLORS.primary100,
  },
  activityPhotoTileImage: {
    borderRadius: 7,
  },
  activityPhotoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "rgba(17,24,39,0.65)",
  },
  activityPhotoAddTile: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 7,
    backgroundColor: COLORS.page,
  },
  activityPhotoPreview: {
    width: "100%",
    height: "100%",
    justifyContent: "flex-end",
    padding: 10,
  },
  activityPhotoPreviewImage: {
    borderRadius: 8,
  },
  activityPhotoScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,24,39,0.08)",
  },
  activityPhotoStatus: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 13,
    backgroundColor: "rgba(17,24,39,0.62)",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  activityPhotoStatusText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  activityPhotoCount: {
    position: "absolute",
    right: 10,
    top: 10,
    borderRadius: 12,
    backgroundColor: "rgba(17,24,39,0.58)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activityPhotoCountText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  attachExtensionHint: {
    color: "#A6ACB7",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 15,
  },
  activityAttachmentList: {
    gap: 6,
  },
  activityAttachmentItem: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
  },
  activityAttachmentText: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  activityFeedbackInput: {
    minHeight: 80, // Figma: 후기입력 80h
  },
  activityInputWithIcon: {
    minHeight: 41, // Figma: 41h, padding 12/14
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 14,
  },
  activityInputWithIconFocused: {
    borderWidth: 1, // Figma 참가자검색 focus: 1px #21262E
    borderColor: "#21262E",
  },
  activityInlineInput: {
    flex: 1,
    minHeight: 41,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    paddingVertical: 0,
  },
  activityDateValue: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 17,
  },
  participantResultBox: {
    gap: 8,
    backgroundColor: COLORS.bg,
  },
  participantResultRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 0.5,
    borderColor: "#E1E4E9",
    borderRadius: 10,
    padding: 14,
  },
  participantResultRowDisabled: {
    opacity: 0.5,
  },
  participantAvatar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#E6F1FB",
  },
  participantTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  participantName: {
    color: "#212429", // Figma 참가자검색행: 납부자 이름색
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 17,
  },
  participantMeta: {
    color: "#6B7280", // Figma 참가자검색행: 전공 12/14
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "400",
  },
  participantNoResultText: {
    color: "#8A919C",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
    paddingTop: 4,
    paddingLeft: 2,
  },
  activityFieldGroup: {
    gap: 6,
  },
  activityParticipantGroup: {
    gap: 10,
  },
  activityFieldTitle: {
    color: COLORS.text, // Figma Verify 최신 스펙: 참가자/계좌 소제목 #15171C
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 16,
  },
  activityWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "#FAEEDA",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  // Figma 참가자안내: 14×15 프레임, padding-top 1.
  activityWarningIcon: {
    marginTop: 1,
    width: 14,
    height: 14,
  },
  // Figma 참가자안내: 상자 320 안에서 여백 12·아이콘 14·간격 8을 빼면 274가 남지만
  // 본문 폭은 254로 잡혀 있어 오른쪽에 20의 여유가 더 있다. 그 여유를 paddingRight로 재현한다.
  activityWarningBody: {
    flex: 1,
    minWidth: 0,
    paddingRight: 20,
  },
  activityWarningText: {
    // 가로 flex 안의 Text는 RN 기본 flexShrink가 0이라 남은 폭에 맞지 않고
    // 줄 끝 글자가 배경 밖으로 밀려난다. 다른 안내 박스와 같게 맞춘다.
    flex: 1,
    color: "#854F0B",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 17, // 12px × 145%
  },
  activityChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  activityMemberChip: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: "#E1E4E9",
    backgroundColor: "#FFFFFF",
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 6,
  },
  activityMemberChipText: {
    color: "#212429", // Figma 참가자칩: 납부자 이름색
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
  },
  selectLike: {
    height: 41, // Figma: 게시판 선택 41h
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 14,
  },
  selectText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 17,
  },
  selectPlaceholder: {
    color: "#A6ACB7",
  },
  boardSelectWrap: {
    width: "100%",
    position: "relative",
    zIndex: 10,
  },
  guideBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary50,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  guideBody: {
    flex: 1,
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  guideBoxSuggestion: {
    alignItems: "flex-start",
    gap: 8, // Figma: 익명안내 padding 12/14, gap 8
    backgroundColor: "#E6F1FB", // Figma 134:7 banner bg
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  guideBodySuggestion: {
    color: "#0C447C", // Figma 134:7 banner text
    fontWeight: "400",
  },
  field: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  label: {
    color: COLORS.text, // Figma: #15171C Medium 13/16
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 16,
  },
  requiredPill: {
    borderRadius: 4,
    backgroundColor: COLORS.primary50,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  requiredText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  requiredStar: {
    color: "#E24B4A", // Figma 64:13 required asterisk
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 16, // 라벨과 간격은 labelRow gap 7을 그대로 쓴다(디자인 화면 기준).
  },
  evidenceModeRow: {
    flexDirection: "row",
    gap: 8, // Figma: 토글 gap 8
  },
  evidenceModeTab: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
  },
  evidenceModeTabVisual: {
    width: "100%",
    height: 34, // Figma: 34h, padding 9/0
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
  },
  evidenceModeTabActive: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: "#E8EEFF", // Figma: 선택 탭 배경
  },
  // Figma MutualAidApply-ImageMode-Error / LinkMode-Error: 고른 탭이 파란 채움과
  // 파란 글자를 잃고 빨간 테두리만 남는다. 링크 입력칸은 빨개지지 않는다.
  // 두께는 선택 탭의 파란 테두리와 같은 1px이라야 오류가 켜질 때 탭 크기가
  // 흔들리지 않는다.
  evidenceModeTabError: {
    borderWidth: 1,
    borderColor: "#D64545",
    backgroundColor: COLORS.bg,
  },
  evidenceModeText: {
    color: COLORS.muted, // Figma: #6B7280 Medium 13/16
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 16,
  },
  evidenceModeTextActive: {
    color: COLORS.primary,
  },
  evidenceImageSection: {
    gap: 8,
  },
  evidenceImageHint: {
    // Figma MutualAidApply-ImageMode-Error: Regular 13/16 #999EA8
    color: "#999EA8",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
  },
  evidenceImageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  evidenceImageTile: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#E9ECF1",
  },
  evidenceImageTileImage: {
    borderRadius: 8,
  },
  evidenceImageRemove: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 44,
    height: 44,
    alignItems: "flex-end",
    paddingTop: 4,
    paddingRight: 4,
  },
  evidenceImageRemoveVisual: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "rgba(17,24,39,0.68)",
  },
  evidenceLegacyFiles: {
    gap: 8,
  },
  evidenceLegacyFile: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingLeft: 12,
  },
  evidenceLegacyFileName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 15,
  },
  evidenceLegacyFileRemove: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  evidenceFileButton: {
    // Figma 첨부버튼: 36h, padding 10/0, 테두리 없음, radius 8.
    width: "100%",
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    paddingVertical: 10,
  },
  evidenceFileButtonText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    flexWrap: "wrap",
    color: "#999EA8", // Figma 13/16 #999EA8
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
  },
  evidenceThumbArea: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 12, // Figma 첨부영역 padding 12/0/0
  },
  evidenceThumbWrap: {
    width: 80,
    height: 80,
  },
  evidenceThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EDF0F5",
  },
  evidenceThumbImageFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  evidenceThumbImage: {
    borderRadius: 8,
  },
  evidenceThumbRemove: {
    position: "absolute",
    top: -6,
    right: -2, // Figma: left 60 of 80 → 우측으로 2px 돌출
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "rgba(33, 36, 41, 0.8)",
  },
  evidenceLinkField: {
    // Figma: 링크입력필드 36h, padding 10/12, gap 8
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 36,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 12,
  },
  evidenceLinkInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 14, // Figma 12/14
    paddingVertical: 0,
  },
  evidenceLinkFieldFocused: {
    borderWidth: 1, // Figma focus: 1px #21262E
    borderColor: "#21262E",
  },
  calCard: {
    marginTop: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: COLORS.bg,
  },
  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  calNav: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  calNavDisabled: { opacity: 0.45 },
  calTitle: { color: COLORS.text, fontSize: 16, fontWeight: "600" },
  calWeekRow: { flexDirection: "row", marginBottom: 4 },
  calWeekday: { flex: 1, textAlign: "center", color: COLORS.subtle, fontSize: 12, fontWeight: "500" },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  // 100/7%(14.2857…)는 7칸 합이 100%를 넘어 마지막 칸이 줄바꿈된다. 홈 캘린더와 같이 14.285%를 쓴다.
  calCell: { width: "14.285%", alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  calDay: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  calDaySelected: { backgroundColor: COLORS.primary },
  calDayDisabled: { backgroundColor: "#F7F8FA" },
  calDayText: { color: COLORS.text, fontSize: 14, fontWeight: "400" },
  calDayTextSelected: { color: "#FFFFFF", fontWeight: "600" },
  calDayTextDisabled: { color: "#C7CBD2" },
  optionalMark: {
    color: "#A6ACB7",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 14, // Figma (선택) 12/14, 라벨과 간격은 labelRow gap 7
  },
  // Figma: 교수명 입력 — 우측에 "교수" 접미 라벨이 붙은 단일 입력 박스
  suffixInputRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 14,
  },
  // 제목 칸(input)과 글자 시작 위치를 맞추려면 굵어진 테두리만큼 패딩을 줄인다.
  suffixInputRowFocused: {
    borderWidth: 1, // Figma focus: 1px #21262E
    borderColor: "#21262E",
  },
  suffixInput: {
    flex: 1,
    minHeight: 41,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 17,
    paddingVertical: 12,
    // Android TextInput의 기본 가로 패딩을 없앤다. 두면 바깥 래퍼의 14에 더해져
    // 제목·내용 칸보다 글자가 안쪽에서 시작한다.
    paddingHorizontal: 0,
  },
  suffixInputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.muted,
  },
  // Figma: 난이도/만족도 — 테두리 버튼 3개, 선택 시 primary 테두리 + 연한 배경
  ratingRow: {
    width: "100%",
    flexDirection: "row",
    gap: 8,
  },
  ratingButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
  },
  ratingButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#E8EEFF",
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.muted,
  },
  ratingTextActive: {
    color: COLORS.primary,
  },
  input: {
    width: "100%",
    minHeight: 41, // Figma: 41h (textArea가 덮어씀)
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 17, // Figma: 입력 텍스트 14/17 Regular
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputFocused: {
    borderWidth: 1, // Figma 참가자검색 focus와 동일: 1px #21262E
    borderColor: "#21262E",
  },
  // Figma 오류 상태: 1px #D64545. 입력칸·등급 버튼 모두 같은 굵기다.
  // 기본 0.5 -> 1로 0.5px만 굵어져 여백 보정 없이도 글자가 밀리지 않는다.
  // 기본 테두리(0.5)보다 굵어지는 만큼 좌우 패딩을 줄여 글자 위치를 유지한다.
  inputError: {
    borderWidth: 1,
    borderColor: "#D64545",
  },
  // 등급 버튼은 좌우 패딩이 없어 두께만 바꾼다.
  borderOnlyError: {
    borderWidth: 1,
    borderColor: "#D64545",
  },
  textArea: {
    minHeight: 70, // Figma: 비고필드 70h
  },
  suggestionContentInput: {
    minHeight: 180, // Figma: 건의 내용입력 180h
  },
  generalContentInput: {
    minHeight: 100, // Figma: 일반 글쓰기 내용입력 100h
  },
  contactInput: {
    minHeight: 60,
  },
  studyStatusWrap: {
    width: "100%",
    gap: 6,
  },
  studyStatusLabel: {
    color: COLORS.muted, // Figma: 모집 상태 라벨 #6B7280
  },
  studyContentInput: {
    minHeight: 111, // Figma: 스터디 내용입력 111h
  },
  helperText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 17,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: "800",
  },
  attachmentBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    padding: 14,
  },
  attachmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  attachmentText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  attachButton: {
    minWidth: 82,
    height: 42,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: COLORS.primary50,
  },
  attachButtonDisabled: {
    opacity: 0.55,
  },
  attachButtonText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "400",
  },
  attachmentList: {
    gap: 8,
    marginTop: 12,
  },
  attachmentItem: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    padding: 10,
  },
  attachmentFile: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  attachmentNameWrap: {
    flex: 1,
    minWidth: 0,
  },
  attachmentName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },
  attachmentSize: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  attachmentEmpty: {
    minHeight: 92,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  attachmentEmptyText: {
    color: COLORS.subtle,
    fontSize: 12,
    fontWeight: "700",
  },
  compactAttachWrap: {
    alignItems: "flex-start",
    gap: 8,
  },
  participationImageSection: {
    width: "100%",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 4,
  },
  compactAttachButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  compactAttachActions: {
    width: "100%",
    flexDirection: "row",
    gap: 8, // Figma: 첨부 옵션 버튼 간격 8
  },
  compactAttachText: {
    color: COLORS.muted,
    fontSize: 13, // Figma: 이미지 첨부 13/16
    fontWeight: "400",
    lineHeight: 16,
  },
  writeImageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  writeImageThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#E1E4E9",
  },
  writeImageThumbImage: {
    borderRadius: 8,
  },
  writeImageRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(17,24,39,0.55)",
  },
  compactAttachmentList: {
    width: "100%",
    gap: 8,
  },
  compactAttachmentItem: {
    // Figma: 첨부파일 미리보기 42h, padding 12/14, border 0.5
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  compactAttachmentOpen: {
    minHeight: 34,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compactAttachmentName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
  },
  submitButton: {
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    marginTop: 10,
  },
  submitButtonMutualAid: {
    marginTop: 14, // gap 14 + 14 = 본문 하단 16 + 래퍼 상단 12
  },
  activitySubmitButton: {
    height: 45, // Figma: 인증버튼 45h
    borderRadius: 8,
    marginTop: 2,
  },
  submitButtonDisabled: {
    backgroundColor: "#AABDFD",
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 15, // Figma: Medium 15/18
    fontWeight: "500",
    lineHeight: 18,
  },
  activitySubmitText: {
    fontSize: 14,
    lineHeight: 17,
  },
});
