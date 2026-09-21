import { Feather, Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { isAxiosError } from "axios";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { BackHandler, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { AttachFileIcon, AttachImageIcon, AttachLinkIcon, BackIcon, CalendarSmallIcon, CameraAddIcon, CloseIcon } from "../../../../components/icons";
import { useBoardsQuery } from "../../../../hooks/useApi";
import { useCreatePost, usePostDetail, useUpdatePost } from "../../../../hooks/usePosts";
import CompletionState from "../../../../components/CompletionState";
import ClubOperationStatusField from "../../../../components/ClubOperationStatusField";
import { clubOperationStatus } from "../../../../utils/participationGuide";
import LoadingState from "../../../../components/LoadingState";
import PostAttachmentEditor from "../../../../components/PostAttachmentEditor";
import { MediaImageBackground } from "../../../../components/MediaImage";
import { duesPayerApi, postApi } from "../../../../services/api";
import type { MediaAsset } from "../../../../types";
import {
  ACTIVITY_PARTICIPANT_GUIDANCE,
  activityBankAccountFieldState,
  activityParticipantSelectionError,
  activityParticipantsFromMetadata,
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
  isMutualAidEventDateAllowed,
  maximumActivityCertificationDate,
  minimumMutualAidEventDate,
} from "../../../../utils/dateSelection";
import { createFormNotice, requiredFieldNotice, type FormNotice } from "../../../../utils/formNotice";
import { pickAndUploadDocuments, pickAndUploadImages } from "../../../../utils/mediaPicker";
import {
  canEditMutualAidRequest,
  isUnchangedMutualAidEventDate,
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
          {optional ? <Text style={styles.optionalMark}> (선택)</Text> : null}
        </View>
      ) : null}
      {children}
      {helper ? <Text style={styles.helperText}>{helper}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// Figma: 입력 중(포커스) 상태는 1.5px #21262E 테두리
function FormTextInput({ style, onBlur, onFocus, ...props }: ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  const inputStyle: TextStyle = StyleSheet.flatten([style, focused ? styles.inputFocused : null]);
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

const EVIDENCE_MODES = [
  { key: "file" as const, label: "이미지 첨부" },
  { key: "link" as const, label: "링크 첨부" },
];

function mutualAidDateGuidance(minimumDate: string) {
  return `오늘 기준 2일 후인 ${formatBoardDate(minimumDate)}부터 신청할 수 있어요.`;
}

function isMutualAidDateTooSoonError(error: unknown) {
  return (
    isAxiosError<{ code?: string }>(error) &&
    error.response?.data?.code === "MUTUAL_AID_DATE_TOO_SOON"
  );
}

function activitySelectPlaceholder(slug?: string) {
  if (slug?.includes("study")) return "모집글을 선택하세요";
  if (slug?.includes("networking")) return "네트워킹을 선택하세요";
  return "동아리명을 선택하세요";
}

type SelectionOption = { key: string; label: string };

function SelectionSheet({
  visible,
  title,
  options,
  emptyText,
  selectedKey,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: SelectionOption[];
  emptyText: string;
  selectedKey?: string;
  onClose: () => void;
  onSelect: (option: SelectionOption) => void;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.sheetBackdrop}>
        <Pressable onPress={() => undefined} style={styles.sheetCard}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {options.length === 0 ? <Text style={styles.sheetEmpty}>{emptyText}</Text> : null}
            {options.map((option) => {
              const active = option.key === selectedKey;
              return (
                <Pressable key={option.key} onPress={() => onSelect(option)} style={styles.sheetOption}>
                  <Text style={[styles.sheetOptionText, active ? styles.sheetOptionTextActive : null]}>{option.label}</Text>
                  {active ? <Ionicons name="checkmark" size={16} color={COLORS.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FormNoticeModal({ notice, onClose }: { notice: FormNotice | null; onClose: () => void }) {
  return (
    <Modal animationType="fade" transparent visible={Boolean(notice)} onRequestClose={onClose}>
      <Pressable accessibilityViewIsModal onPress={onClose} style={styles.noticeBackdrop}>
        <Pressable onPress={() => undefined} style={styles.noticeCard}>
          <View style={styles.noticeIcon}>
            <Ionicons name="alert-circle-outline" size={24} color={COLORS.primary} />
          </View>
          <Text accessibilityRole="header" style={styles.noticeTitle}>{notice?.title}</Text>
          <Text style={styles.noticeMessage}>{notice?.message}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.noticeButton}>
            <Text style={styles.noticeButtonText}>확인</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
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
  const [selectedParticipants, setSelectedParticipants] = useState<ActivityParticipant[]>([]);
  const [selectionSheet, setSelectionSheet] = useState<"activity" | "mutualType" | "mutualRelation" | "board" | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  // 증빙서류는 파일 업로드와 링크 입력 중 하나만 사용한다.
  const [evidenceMode, setEvidenceMode] = useState<"file" | "link" | null>(null);
  const [evidenceLink, setEvidenceLink] = useState("");
  const [activitySourcePostId, setActivitySourcePostId] = useState<number | null>(null);
  const [createdPostId, setCreatedPostId] = useState<number | null>(null);
  const [formNotice, setFormNotice] = useState<FormNotice | null>(null);
  const hydratedPostId = useRef<number | null>(null);
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
  const isAdminParticipationPost = board?.slug === "club-promo" || isNetworkingProgram;
  const bankAccountField = activityBankAccountFieldState(postId);
  const compactCreate = !isActivity && !isMutualAid;
  const requiresAttachment = isActivity || isMutualAid || isAlbum || isAdminParticipationPost;
  const canPickBoard =
    !postId && compactCreate && !isAlbum && !isSuggestion && !isStudyRecruit && !isNetworkingProgram && !isAdminParticipationPost;
  const selectableBoards = useMemo(() => {
    const group = boardsRes?.data.find((entry) => entry.boards.some((item) => item.id === boardId));
    return group?.boards ?? [];
  }, [boardsRes?.data, boardId]);
  const trimmedParticipantQuery = participantQuery.trim();
  const participantSearch = useQuery({
    queryKey: ["dues-payer-search", trimmedParticipantQuery],
    queryFn: () => duesPayerApi.search(trimmedParticipantQuery, 8),
    enabled: isActivity && trimmedParticipantQuery.length > 0,
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

  const { clearErrors, control, handleSubmit, reset, setError, setValue } = useForm<FormValues>({
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
      clubOperationStatus: "active",
    },
  });

  useEffect(() => {
    if (!postId || !existingPost || hydratedPostId.current === postId) return;

    const metadata = existingPost.metadata ?? {};
    const storedParticipants = activityParticipantsFromMetadata(metadata);
    reset({
      title: existingPost.title,
      category: mutualAidEventTypeLabel(existingPost.mutual_aid?.event_type ?? existingPost.category),
      content: existingPost.content,
      activityDate: typeof metadata.activity_date === "string" ? metadata.activity_date : "",
      participants: typeof metadata.participants === "string" ? metadata.participants : "",
      bankAccount: "",
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
    hydratedPostId.current = postId;
  }, [existingPost, postId, reset]);

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
    ? "변경사항 저장"
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
    return Object.keys(metadata).length > 0 ? metadata : undefined;
  };

  const requireValue = (value: string | undefined, label: string) => {
    if (clean(value)) {
      return false;
    }
    setFormNotice(requiredFieldNotice(label));
    return true;
  };

  const handleMutationError = (error: unknown) => {
    if (isMutualAid && isMutualAidDateTooSoonError(error)) {
      const message = mutualAidDateGuidance(minimumMutualAidEventDate());
      setError("eventDate", { message });
      setFormNotice(createFormNotice("신청 가능한 날짜", message));
      return;
    }
    setFormNotice(createFormNotice(
      postId ? "수정 실패" : isMutualAid ? "신청 실패" : "등록 실패",
      "입력 내용과 첨부파일을 확인한 뒤 다시 시도하세요."
    ));
  };

  const onSubmit = (values: FormValues) => {
    if (isAlbum && attachmentIds.length > PHOTO_ALBUM_IMAGE_SELECTION_LIMIT) {
      setFormNotice(createFormNotice("사진 첨부", "사진첩은 게시글당 최대 20장까지 등록할 수 있어요. 사진을 20장 이하로 줄여주세요."));
      return;
    }
    if (!isActivity && !isMutualAid && requireValue(values.title, labels.title)) {
      return;
    }
    if (!isMutualAid && !isAlbum && requireValue(values.content, labels.content)) {
      return;
    }
    if (isActivity) {
      if (
        requireValue(values.category, "활동 대상") ||
        requireValue(values.activityDate, "활동일") ||
        requireValue(values.participants, "참가자") ||
        (bankAccountField.required && requireValue(values.bankAccount, "입금 계좌"))
      ) {
        return;
      }
      if (!isActivityCertificationDateAllowed(values.activityDate)) {
        const message = "오늘 이후 날짜는 선택할 수 없어요.";
        setError("activityDate", { message });
        setFormNotice(createFormNotice("활동일", message));
        return;
      }
      const participantError = activityParticipantSelectionError(selectedParticipants, existingPost?.metadata);
      if (participantError) {
        setFormNotice(createFormNotice("참가자 재선택", participantError));
        return;
      }
    }
    if (isMutualAid) {
      if (requireValue(values.category, "경조사 종류") || requireValue(values.eventDate, "경조사 일자") || requireValue(values.relation, "관계")) {
        return;
      }
      const storedEventDate = existingPost?.mutual_aid?.event_date ??
        (typeof existingPost?.metadata?.event_date === "string" ? existingPost.metadata.event_date : undefined);
      if (
        !isUnchangedMutualAidEventDate(values.eventDate, storedEventDate) &&
        !isMutualAidEventDateAllowed(values.eventDate)
      ) {
        const message = mutualAidDateGuidance(minimumMutualAidEventDate());
        setError("eventDate", { message });
        setFormNotice(createFormNotice("신청 가능한 날짜", message));
        return;
      }
    }
    if (isStudyRecruit && requireValue(values.contact, "스터디장 연락수단")) {
      return;
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
        setFormNotice(createFormNotice("참여 버튼 링크", "http:// 또는 https://로 시작하는 올바른 주소를 입력하세요."));
        return;
      }
    }
    if (isMutualAid && evidenceMode === "link") {
      const link = evidenceLink.trim();
      if (!link) {
        setFormNotice(createFormNotice("증빙서류 첨부", "청첩장·부고장 링크를 입력하세요."));
        return;
      }
      try {
        const parsed = new URL(link);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("INVALID_PROTOCOL");
      } catch {
        setFormNotice(createFormNotice("증빙서류 첨부", "http:// 또는 https://로 시작하는 올바른 주소를 입력하세요."));
        return;
      }
    } else if (
      requiresAttachment &&
      (isAdminParticipationPost ? !participationRepresentativeImage : attachmentIds.length === 0)
    ) {
      setFormNotice(createFormNotice(labels.attachment, `${labels.attachmentHelp}을 첨부하세요.`));
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
          navigateAfterPostEdit(decision, {
            back: () => router.back(),
            replace: (route) => router.replace(route as never),
          });
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
        router.replace(
          postCreateCompletionRoute(boardType, res.data.id, boardId, params.returnTo) as never,
        );
      },
      onError: handleMutationError,
    });
  };

  const uploadAttachments = async (pickAttachments: () => Promise<MediaAsset[]>) => {
    try {
      setIsUploading(true);
      const uploaded = await pickAttachments();
      if (uploaded.length > 0) {
        setAttachments((current) => {
          const next = [...current, ...uploaded];
          return isAlbum ? next.slice(0, PHOTO_ALBUM_IMAGE_SELECTION_LIMIT) : next;
        });
      }
    } catch {
      setFormNotice(createFormNotice("업로드 실패", "파일 업로드를 다시 시도하세요."));
    } finally {
      setIsUploading(false);
    }
  };

  const pickPostImages = () => {
    if (isAlbumImageLimitReached) {
      setFormNotice(createFormNotice("사진 첨부", "사진첩은 게시글당 최대 20장까지 등록할 수 있어요."));
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
              setFormNotice(createFormNotice("사진 업로드 안내", messages.join(" ")));
            },
          }
        : undefined,
    );
  };

  const selectParticipationRepresentativeImage = async () => {
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
            setFormNotice(createFormNotice("대표 이미지", messages.join(" ")));
          }
        },
      });
      if (uploaded[0]) {
        setAttachments((current) =>
          replaceParticipationGuideRepresentative(current, uploaded[0]),
        );
      }
    } catch {
      setFormNotice(createFormNotice("업로드 실패", "대표 이미지 업로드를 다시 시도하세요."));
    } finally {
      setIsUploading(false);
    }
  };

  const selectParticipationDetailImages = () => uploadAttachments(
    () => pickAndUploadImages(undefined, {
      retainSuccessfulUploads: true,
      onBatchIssue: ({ uploadedCount, failedCount }) => {
        if (failedCount > 0) {
          setFormNotice(createFormNotice(
            "상세 글 이미지",
            `${uploadedCount}장은 추가했고 ${failedCount}장은 업로드하지 못했어요.`,
          ));
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
  const activitySourcePosts = activitySourceQuery.data ?? [];
  const activityOptions: SelectionOption[] = activitySourcePosts.map((post) => ({ key: String(post.id), label: post.title }));
  const mutualAidTypeOptions: SelectionOption[] = [
    { key: "marriage", label: "결혼" },
    { key: "bereavement", label: "상(喪)" },
  ];
  const mutualAidRelationOptions: SelectionOption[] = ["본인", "배우자", "부모", "자녀", "형제/자매"].map((label) => ({ key: label, label }));
  const imageAttachments = attachments.filter((attachment) => attachment.content_type.startsWith("image/"));
  const nonImageAttachments = attachments.filter((attachment) => !attachment.content_type.startsWith("image/"));

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
  }, [boardId, boardType, createdPostId, datePickerOpen, params.editOrigin, params.fromBoardId, params.postId, params.returnTo, selectionSheet]);

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
      <View style={[styles.appBar, isActivity ? styles.appBarNoDivider : null, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable
          accessibilityLabel="닫기"
          onPress={handleCreateBack}
          style={styles.iconButton}
        >
          <Ionicons name={isActivity ? "chevron-back" : "close"} size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.appBarTitle}>{labels.screenTitle}</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        style={styles.formScroller}
        contentContainerStyle={[styles.content, isActivity ? styles.activityContent : null]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {isActivity ? (
          <>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Pressable onPress={() => setSelectionSheet("activity")} style={styles.activitySelect}>
                  <Text style={[styles.activitySelectValue, !field.value ? styles.activitySelectPlaceholder : null]}>
                    {field.value || activitySelectPlaceholder(board?.slug)}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#A6ACB7" />
                </Pressable>
              )}
            />

            <View style={styles.activityFieldGroup}>
              <Pressable disabled={isUploading} onPress={selectFile} style={[styles.activityPhotoBox, isUploading ? styles.attachButtonDisabled : null]}>
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
                    onChangeText={field.onChange}
                    placeholder="활동에 대한 소감을 남겨주세요"
                    placeholderTextColor="#A6ACB7"
                    style={[styles.input, styles.activityFeedbackInput, fieldState.error ? styles.inputError : null]}
                    textAlignVertical="top"
                    value={field.value}
                  />
                )}
              />
            </View>

            <Controller
              control={control}
              name="activityDate"
              render={({ field, fieldState }) => (
                <>
                  <Pressable
                    accessibilityHint="달력에서 실제 활동 날짜를 선택합니다"
                    accessibilityLabel="활동일 선택"
                    accessibilityRole="button"
                    onPress={() => setDatePickerOpen((open) => !open)}
                    style={styles.activityInputWithIcon}
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

            <View style={styles.activityFieldGroup}>
              <Text style={styles.activityFieldTitle}>활동비 받을 계좌번호</Text>
              <Controller
                control={control}
                name="bankAccount"
                render={({ field }) => (
                  <FormTextInput
                    onChangeText={field.onChange}
                    placeholder={bankAccountField.placeholder}
                    placeholderTextColor="#A6ACB7"
                    style={styles.input}
                    value={field.value ?? ""}
                  />
                )}
              />
              <View style={styles.activityWarning}>
                <Ionicons name="alert-circle-outline" size={14} color="#854F0B" style={styles.activityWarningIcon} />
                <Text style={styles.activityWarningText}>{bankAccountField.guidance}</Text>
              </View>
            </View>

            <View style={[styles.activityFieldGroup, styles.activityParticipantGroup]}>
              <Text style={styles.activityFieldTitle}>참가자</Text>
              <Controller
                control={control}
                name="participants"
                render={() => {
                  return (
                    <>
                      <View style={[styles.activityInputWithIcon, participantSearchFocused ? styles.activityInputWithIconFocused : null]}>
                        <Ionicons name="search-outline" size={16} color="#A6ACB7" />
                        <TextInput
                          onBlur={() => setParticipantSearchFocused(false)}
                          onChangeText={setParticipantQuery}
                          onFocus={() => setParticipantSearchFocused(true)}
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
                                  <Text style={styles.participantName}>{participant.name}</Text>
                                  {participant.major || participant.student_number ? (
                                    <Text style={styles.participantMeta}>{[participant.major, participant.student_number].filter(Boolean).join(" ")}</Text>
                                  ) : null}
                                </View>
                                {selected ? (
                                  <Ionicons name="checkmark-circle" size={28} color={COLORS.primary} />
                                ) : (
                                  <View style={styles.participantAddButton}>
                                    <Ionicons name="add" size={16} color={COLORS.primary} />
                                  </View>
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
                              <Text style={styles.activityMemberChipText}>{formatActivityParticipant(participant)}</Text>
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
                <Ionicons name="alert-circle-outline" size={14} color="#854F0B" style={styles.activityWarningIcon} />
                <Text style={styles.activityWarningText}>{ACTIVITY_PARTICIPANT_GUIDANCE}</Text>
              </View>
            </View>
          </>
        ) : (
          <>
        {canPickBoard ? (
          <View style={styles.boardSelectWrap}>
            <Pressable
              onPress={() => setSelectionSheet(selectionSheet === "board" ? null : "board")}
              style={styles.selectLike}
            >
              <Text style={[styles.selectText, !board ? styles.selectPlaceholder : null]} numberOfLines={1}>
                {board?.name ?? "게시판을 선택하세요"}
              </Text>
              <Ionicons name={selectionSheet === "board" ? "chevron-up" : "chevron-down"} size={16} color="#A6ACB7" />
            </Pressable>
            {selectionSheet === "board" ? (
              <View style={styles.boardDropdown}>
                <Text style={styles.boardDropdownTitle}>게시판을 선택하세요</Text>
                {selectableBoards.length === 0 ? (
                  <Text style={styles.boardDropdownEmpty}>선택할 수 있는 게시판이 없습니다.</Text>
                ) : (
                  selectableBoards.map((item, index) => {
                    const active = item.id === boardId;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => {
                          setBoardId(item.id);
                          setSelectionSheet(null);
                        }}
                        style={[styles.boardDropdownItem, index > 0 ? styles.boardDropdownDivider : null]}
                      >
                        <Text style={[styles.boardDropdownText, active ? styles.boardDropdownTextActive : null]}>{item.name}</Text>
                        {active ? <Ionicons name="checkmark" size={16} color={COLORS.primary} /> : null}
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}
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
                onChangeText={field.onChange}
                placeholder={labels.titlePlaceholder}
                placeholderTextColor="#A6ACB7"
                style={[styles.input, fieldState.error ? styles.inputError : null]}
                value={field.value}
              />
            </FormField>
          )}
        />
      ) : null}

      {!isAlbum && (isMutualAid || board?.slug === "club-promo") ? (
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <FormField label={compactCreate ? "" : labels.category} requiredStar={isMutualAid} helper={isSuggestion ? "운영, 행사, 시설 등 필요한 경우만 입력하세요." : undefined}>
              {isMutualAid ? (
                <Pressable onPress={() => setSelectionSheet("mutualType")} style={styles.selectionField}>
                  <Text style={[styles.selectionValue, !field.value ? styles.selectionPlaceholder : null]}>{field.value || labels.categoryPlaceholder}</Text>
                  <Ionicons name="chevron-down" size={17} color={COLORS.subtle} />
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
                  onChangeText={field.onChange}
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
                <Pressable onPress={() => setDatePickerOpen((open) => !open)} style={styles.selectionField}>
                  <Text style={[styles.selectionValue, !field.value ? styles.selectionPlaceholder : null]}>
                    {field.value ? formatBoardDate(field.value) : "경조사 날짜를 선택하세요"}
                  </Text>
                  <Feather name="calendar" size={14} color={COLORS.subtle} />
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
            render={({ field }) => (
              <FormField label="관계" requiredStar>
                <Pressable onPress={() => setSelectionSheet("mutualRelation")} style={styles.selectionField}>
                  <Text style={[styles.selectionValue, !field.value ? styles.selectionPlaceholder : null]}>
                    {field.value || "본인 / 배우자 / 부모 등 선택"}
                  </Text>
                  <Ionicons name="chevron-down" size={17} color={COLORS.subtle} />
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
                    <View style={[styles.evidenceModeTabVisual, active ? styles.evidenceModeTabActive : null]}>
                      <Text style={[styles.evidenceModeText, active ? styles.evidenceModeTextActive : null]}>{mode.label}</Text>
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
                  onChangeText={setEvidenceLink}
                  onFocus={() => setEvidenceLinkFocused(true)}
                  placeholder="청첩장·부고장 링크를 입력해주세요"
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
                onChangeText={field.onChange}
                placeholder={labels.contentPlaceholder}
                placeholderTextColor="#A6ACB7"
                style={[styles.input, styles.textArea, isSuggestion ? styles.suggestionContentInput : isStudyRecruit ? styles.studyContentInput : styles.generalContentInput, fieldState.error ? styles.inputError : null]}
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
                onChangeText={field.onChange}
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
        <PostAttachmentEditor attachments={attachments} onChange={setAttachments} onUploadingChange={setIsUploading} disabled={createMutation.isPending || updateMutation.isPending} />
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
        onPress={handleSubmit(onSubmit)}
        style={[styles.submitButton, isActivity ? styles.activitySubmitButton : null, isSubmitting ? styles.submitButtonDisabled : null]}
      >
        <Text style={[styles.submitText, isActivity ? styles.activitySubmitText : null]}>{createMutation.isPending || updateMutation.isPending ? "저장 중" : submitLabel}</Text>
      </Pressable>
      </ScrollView>

      <SelectionSheet
        visible={selectionSheet === "activity"}
        title={activitySelectPlaceholder(board?.slug)}
        options={activityOptions}
        emptyText={activitySourceQuery.isLoading ? "활동 대상을 불러오는 중입니다." : "선택할 수 있는 활동이 없습니다."}
        selectedKey={activitySourcePostId ? String(activitySourcePostId) : undefined}
        onClose={() => setSelectionSheet(null)}
        onSelect={(option) => {
          setValue("category", option.label, { shouldValidate: true });
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
          setSelectionSheet(null);
        }}
      />
      <FormNoticeModal notice={formNotice} onClose={() => setFormNotice(null)} />
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
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "rgba(17, 24, 39, 0.42)",
  },
  sheetCard: {
    width: "100%",
    maxWidth: 405,
    maxHeight: "70%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: "#C7CCD4",
    marginBottom: 16,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "500",
    marginBottom: 8,
  },
  sheetEmpty: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: 24,
  },
  sheetOption: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EAECEF",
  },
  sheetOptionText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "400",
  },
  sheetOptionTextActive: {
    color: COLORS.primary,
    fontWeight: "500",
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
    borderWidth: 1.5, // Figma 참가자검색 focus: 1.5px #21262E
    borderColor: "#21262E",
    paddingHorizontal: 13, // 굵어진 테두리만큼 보정해 내용 흔들림 방지
  },
  activityInlineInput: {
    flex: 1,
    minHeight: 41,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    paddingVertical: 0,
  },
  noticeBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17, 24, 39, 0.42)",
    paddingHorizontal: 24,
  },
  noticeCard: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
  },
  noticeIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: COLORS.primary50,
  },
  noticeTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center",
  },
  noticeMessage: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: "center",
  },
  noticeButton: {
    width: "100%",
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    marginTop: 20,
  },
  noticeButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "400",
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
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 17,
  },
  participantAddButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    // Android(Fabric)에서는 크기를 크게 넘는 radius가 원으로 잘리지 않으므로 정확히 절반 값을 쓴다.
    borderRadius: 14,
    borderWidth: 1.3,
    borderColor: COLORS.primary,
  },
  participantMeta: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "400",
    marginTop: 2,
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
  activityWarningIcon: {
    marginTop: 1,
  },
  activityWarningText: {
    color: "#854F0B",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 17,
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
    color: COLORS.text,
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
  boardDropdown: {
    marginTop: 6,
    borderWidth: 0.5,
    borderColor: "#E1E4E9",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  boardDropdownTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "500",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  boardDropdownItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  boardDropdownDivider: {
    borderTopWidth: 1,
    borderTopColor: "#EAECEF",
  },
  boardDropdownText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "400",
  },
  boardDropdownTextActive: {
    color: COLORS.primary,
    fontWeight: "500",
  },
  boardDropdownEmpty: {
    color: COLORS.subtle,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
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
    marginLeft: -4, // 라벨 글씨에 붙이기 (labelRow gap 상쇄)
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
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 15,
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
    // 파일·링크 증빙 입력 박스는 동일한 40px 규격을 사용한다.
    width: "100%",
    height: 40,
    paddingHorizontal: 14,
    paddingVertical: 0,
  },
  evidenceFileButtonText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    flexWrap: "wrap",
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 15,
  },
  evidenceLinkField: {
    // Figma: 링크입력필드 40h, padding 12/14, gap 8
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 14,
  },
  evidenceLinkInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 15,
  },
  evidenceLinkFieldFocused: {
    borderWidth: 1.5, // Figma focus: 1.5px #21262E
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
  calCell: { width: `${100 / 7}%`, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
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
    borderWidth: 1.5, // Figma 참가자검색 focus와 동일: 1.5px #21262E
    borderColor: "#21262E",
    paddingHorizontal: 13, // 굵어진 테두리만큼 보정
    paddingVertical: 11,
  },
  inputError: {
    borderColor: COLORS.danger,
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
