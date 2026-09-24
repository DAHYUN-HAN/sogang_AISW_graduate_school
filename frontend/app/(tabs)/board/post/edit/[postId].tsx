import { useNavigation, usePreventRemove, type NavigationAction } from "@react-navigation/native";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Alert, BackHandler, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { setWriteLeaveGuard } from "../../../../../stores/writeLeaveGuard";
import { useBoardsQuery } from "../../../../../hooks/useApi";
import { usePostDetail, useUpdatePost } from "../../../../../hooks/usePosts";
import LoadingState from "../../../../../components/LoadingState";
import ClubOperationStatusField from "../../../../../components/ClubOperationStatusField";
import { clubOperationStatus } from "../../../../../utils/participationGuide";
import DiscardWriteModal from "../../../../../components/DiscardWriteModal";
import NoticeModal, { type NoticeModalContent } from "../../../../../components/NoticeModal";
import SelectionSheet from "../../../../../components/SelectionSheet";
import PostAttachmentEditor from "../../../../../components/PostAttachmentEditor";
import Toast from "../../../../../components/Toast";
import {
  RESOURCE_RATING_FIELDS,
  RESOURCE_RATING_LEVELS,
  resourcePostFieldValues,
  resourcePostFields,
  withResourcePostMetadata,
} from "../../../../../utils/resourcePostFields";
import { TOAST_MESSAGES, nextToastState, type ToastState } from "../../../../../utils/toast";
import { uploadFailureFeedback } from "../../../../../utils/uploadFeedback";
import type { MediaAsset } from "../../../../../types";
import { pickAndUploadImages } from "../../../../../utils/mediaPicker";
import {
  PHOTO_ALBUM_IMAGE_SELECTION_LIMIT,
  participationGuideImageSections,
  postImageSelectionLimit,
  replaceParticipationGuideRepresentative,
} from "../../../../../utils/postAttachments";
import { resourceCategoryLabel, resourcePostEditBoards } from "../../../../../utils/resourceBoards";
import {
  navigateAfterPostEdit,
  postCreateFormBackDecision,
  postDetailRoute,
  postEditCompletionDecision,
} from "../../../../../utils/appRoutes";

import { CloseIcon } from "../../../../../components/icons";
const COLORS = {
  primary: "#2761FF",
  text: "#15171C",
  muted: "#6B7280",
  subtle: "#9CA3AF",
  border: "#E1E4E9",
  surface: "#FFFFFF",
  danger: "#EF4444",
  danger50: "#FFF5F5",
};

// 작성 화면과 같은 방식이다. 필수 검사는 제출할 때 한 번에 모아서 하고,
// 문구 없이 테두리만 빨갛게 한 뒤 토스트로 알린다.
const schema = z.object({
  title: z.string().optional(),
  category: z.string().optional(),
  content: z.string().optional(),
  contact: z.string().optional(),
  applicationUrl: z.string().optional(),
  professor: z.string().optional(),
  difficulty: z.string().optional(),
  satisfaction: z.string().optional(),
  clubOperationStatus: z.enum(["active", "ended"]),
});

type FormValues = z.infer<typeof schema>;

// reset()에 값을 넘기면 그 값이 새 기본값이 된다. 저장된 글을 채운 뒤에는
// 인자 없는 reset()이 빈 폼이 아니라 그 글로 되돌아가므로, 비울 때는 이
// 값을 직접 넘긴다.
const EMPTY_FORM: FormValues = {
  title: "",
  category: "",
  content: "",
  contact: "",
  applicationUrl: "",
  professor: "",
  difficulty: "",
  satisfaction: "",
  clubOperationStatus: "active",
};

export default function PostEditScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    postId: string;
    editOrigin?: string;
    fromBoardId?: string;
    returnTo?: string;
  }>();
  const postId = Number(params.postId);
  const { data, isError, isLoading, refetch } = usePostDetail(postId, true, true);
  const post = data?.data;
  const { data: boardsRes } = useBoardsQuery();
  const boards = boardsRes?.data.flatMap((group) => group.boards) ?? [];
  const board = boards.find((item) => item.id === post?.board_id);
  const resourceBoardOptions = resourcePostEditBoards(boards, board);
  const [selectedBoardId, setSelectedBoardId] = useState(0);
  const [isBoardMenuOpen, setIsBoardMenuOpen] = useState(false);
  const selectedBoard = resourceBoardOptions.find((item) => item.id === selectedBoardId) ?? board;
  const isResourceEdit = resourceBoardOptions.length > 0;
  // 게시판을 옮기면 받을 과목정보도 바뀐다. 원래 게시판이 아니라 고른 게시판을 본다.
  const resourceFields = resourcePostFields(selectedBoard?.slug);
  const isStudyRecruit = board?.slug === "study-recruit";
  const isAdminParticipationPost = board?.slug === "club-promo" || board?.slug === "networking-programs";
  const isAlbum = board?.board_type === "album";
  const isMutualAid = board?.board_type === "mutual_aid";
  const isActivityCertification = board?.board_type === "activity_certification";
  const updateMutation = useUpdatePost(postId, post?.board_id ?? 0, board);
  const [attachments, setAttachments] = useState<MediaAsset[]>([]);
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);
  // 저장에 성공해 떠나는 이동은 막으면 안 된다. 저장해도 폼은 여전히 기준선과
  // 달라 hasUnsavedChanges가 참으로 남으므로, 이 표시로 잠금을 먼저 푼다.
  // 작성 화면과 같은 방식이다.
  const [submitted, setSubmitted] = useState(false);
  const pendingSubmitNavigation = useRef<(() => void) | null>(null);
  // 확인창을 띄우는 동안 고른 게시판을 들고 있는다. 확인 전에는 옮기지 않는다.
  const [pendingBoardId, setPendingBoardId] = useState<number | null>(null);
  // 첨부와 게시판 이동은 react-hook-form 밖이라 기준선을 따로 들고 있는다.
  const unsavedBaseline = useRef({ attachmentIds: "", boardId: 0 });
  const hydratedPostId = useRef<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const {
    representativeImage: participationRepresentativeImage,
    detailImages: participationDetailImages,
  } = participationGuideImageSections(attachments);
  const albumImageSelectionLimit = postImageSelectionLimit(board?.board_type, attachments.length);
  const isAlbumImageLimitReached = isAlbum && albumImageSelectionLimit === 0;

  const [toast, setToast] = useState<ToastState>(null);
  const [notice, setNotice] = useState<NoticeModalContent | null>(null);
  // 작성 화면과 같은 규칙으로 업로드 실패를 나눠 보여준다.
  const showUploadFailure = useCallback((error: unknown) => {
    const feedback = uploadFailureFeedback(error);
    if (feedback.kind === "modal") setNotice(feedback.notice);
    else setToast((current) => nextToastState(current, feedback.message));
  }, []);
  const hideToast = useCallback(() => setToast(null), []);

  const { control, clearErrors, formState, handleSubmit, reset, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_FORM,
  });

  // 인증 화면처럼 값을 고치는 즉시 빨간 테두리를 푼다. 스키마가 모두 optional이라
  // 재검증만으로는 풀리지 않아 직접 지운다.
  const clearOnChange = (name: keyof FormValues, onChange: (value: string) => void) => (value: string) => {
    onChange(value);
    clearErrors(name);
  };

  // 저장된 글로 폼을 되돌린다. 첫 진입과 게시판 변경 후 초기화가 같은 값을 쓴다.
  const hydrateFromPost = useCallback(() => {
    if (!post) return;
    reset({
      title: post.title,
      category: post.category ?? "",
      content: post.content,
      contact: typeof post.metadata?.contact === "string" ? post.metadata.contact : "",
      applicationUrl: typeof post.metadata?.application_url === "string" ? post.metadata.application_url : "",
      ...resourcePostFieldValues(resourcePostFields(board?.slug), post.metadata),
      clubOperationStatus: clubOperationStatus(post.metadata),
    });
    setAttachments(post.attachments);
    unsavedBaseline.current = {
      attachmentIds: post.attachments.map((attachment) => attachment.id).join(","),
      boardId: post.board_id,
    };
  }, [board?.slug, post, reset]);

  useEffect(() => {
    if (!post || hydratedPostId.current === post.id) return;
    setSelectedBoardId((current) => current || post.board_id);
    hydrateFromPost();
    hydratedPostId.current = post.id;
  }, [hydrateFromPost, post]);

  useEffect(() => {
    if (!post || !isActivityCertification) return;
    router.replace(`/board/post/create?boardId=${post.board_id}&postId=${post.id}` as never);
  }, [isActivityCertification, post]);

  // 저장 후처럼 물어보지 않고 바로 나가는 경로. 사용자가 닫을 때는 requestClose를 쓴다.
  const leaveScreen = useCallback(() => {
    if (params.editOrigin) {
      const decision = postCreateFormBackDecision({
        boardType: board?.board_type,
        editOrigin: params.editOrigin,
        postId,
        returnTo: params.returnTo,
        canGoBack: router.canGoBack(),
        boardId: post?.board_id ?? 0,
        fromBoardId: params.fromBoardId,
      });
      if (decision.action === "back") router.back();
      else if (decision.action === "navigate") router.navigate(decision.route as never);
      else router.replace(decision.route as never);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace(postDetailRoute(postId));
  }, [board?.board_type, params.editOrigin, params.fromBoardId, params.returnTo, post?.board_id, postId]);

  // 나갈 때 확인창을 띄울지. 내용·첨부뿐 아니라 게시판을 옮긴 것도 변경으로 센다.
  const hasUnsavedChanges =
    formState.isDirty
    || attachments.map((attachment) => attachment.id).join(",") !== unsavedBaseline.current.attachmentIds
    || (selectedBoardId !== 0 && selectedBoardId !== unsavedBaseline.current.boardId);

  // 게시판마다 받는 항목이 달라서 고치던 값을 그대로 옮기면 엉뚱한 칸에 남는다.
  // 작성 화면과 달리 빈 폼이 아니라 저장된 글로 되돌린다. 비우면 그대로 저장할 때
  // 글 내용이 사라진다.
  // 게시판을 바꾸면 쓰던 내용을 비운다. 작성 화면과 같은 규칙이다.
  const clearForBoardChange = useCallback((nextBoardId: number) => {
    setSelectedBoardId(nextBoardId);
    reset(EMPTY_FORM);
    setAttachments([]);
    clearErrors();
  }, [clearErrors, reset]);

  const selectBoard = useCallback((nextBoardId: number) => {
    setIsBoardMenuOpen(false);
    if (nextBoardId === selectedBoardId) return;
    // 작성 화면과 달리 늘 물어본다. 수정 화면은 저장된 글이 이미 채워져 있어
    // 비울 내용이 없는 경우가 없다.
    setPendingBoardId(nextBoardId);
  }, [selectedBoardId]);

  const requestClose = useCallback(() => {
    if (isBoardMenuOpen) {
      setIsBoardMenuOpen(false);
      return;
    }
    if (hasUnsavedChanges) {
      setDiscardPromptOpen(true);
      return;
    }
    leaveScreen();
  }, [hasUnsavedChanges, isBoardMenuOpen, leaveScreen]);

  useFocusEffect(useCallback(() => {
    if (Platform.OS !== "android") return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      requestClose();
      return true;
    });
    return () => subscription.remove();
  }, [requestClose]));

  // iOS 가장자리 스와이프는 UIKit이 직접 pop 해서 위 핸들러를 타지 않는다.
  // usePreventRemove가 native-stack의 preventNativeDismiss를 켜 그것까지 막는다.
  const navigation = useNavigation();
  const [removeConfirmed, setRemoveConfirmed] = useState(false);
  const pendingRemoveAction = useRef<NavigationAction | null>(null);
  // 하단 탭을 눌러 떠나려는 경우. 확인 후에 이 함수를 불러 그 탭으로 옮긴다.
  const pendingTabLeave = useRef<(() => void) | null>(null);

  usePreventRemove(hasUnsavedChanges && !submitted && !removeConfirmed, ({ data }) => {
    pendingRemoveAction.current = data.action;
    setDiscardPromptOpen(true);
  });

  useEffect(() => {
    if (!submitted) return;
    // 잠금이 풀린 렌더 뒤에 옮긴다. 같은 틱에 옮기면 usePreventRemove가 아직
    // 이전 값을 들고 있어 저장에도 수정 취소 확인창이 뜬다.
    const go = pendingSubmitNavigation.current;
    pendingSubmitNavigation.current = null;
    go?.();
  }, [submitted]);

  // 탭바는 이 화면의 부모라 requestClose를 타지 않는다. 가로채기를 걸어
  // 헤더·안드로이드 뒤로가기와 같은 확인창을 거치게 한다.
  const blocksLeaving = hasUnsavedChanges && !submitted && !removeConfirmed;
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
    // 잠금이 풀린 뒤에 원래 하려던 이동을 진행한다. 헤더·안드로이드에서 왔으면
    // 남겨둔 동작이 없어 기존 경로를 탄다.
    const tabLeave = pendingTabLeave.current;
    pendingTabLeave.current = null;
    const action = pendingRemoveAction.current;
    pendingRemoveAction.current = null;
    if (tabLeave) tabLeave();
    else if (action) navigation.dispatch(action);
    else leaveScreen();
  }, [leaveScreen, navigation, removeConfirmed]);

  const navigationHeader = (
    <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 18) }]}>
      <Pressable accessibilityLabel="닫기" onPress={requestClose} style={styles.iconButton}>
        <CloseIcon size={20} color={COLORS.text} />
      </Pressable>
      <Text style={styles.appBarTitle}>{isStudyRecruit ? "스터디 모집" : "글 수정"}</Text>
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

  if (isActivityCertification) {
    return <View style={styles.screen}>{navigationHeader}<LoadingState message="활동인증 수정 화면으로 이동하고 있어요" /></View>;
  }

  const onSubmit = (values: FormValues) => {
    // 필수 검사를 통과한 뒤에는 비어 있지 않다.
    const title = values.title?.trim() ?? "";
    const content = values.content?.trim() ?? "";
    if (isAlbum && attachments.length > PHOTO_ALBUM_IMAGE_SELECTION_LIMIT) {
      setUploadNotice("사진첩은 게시글당 최대 20장까지 등록할 수 있어요. 사진을 20장 이하로 줄여주세요.");
      return;
    }

    // 작성 화면과 같다. 첫 항목에서 멈추지 않고 비어 있는 칸을 모두 모아
    // 한 번에 빨갛게 칠하고, 문구에는 항목명을 넣지 않는다.
    const missing: (keyof FormValues)[] = [];
    const requireField = (name: keyof FormValues, value?: string) => {
      if (!value?.trim()) missing.push(name);
    };
    requireField("title", values.title);
    if (!isAlbum && !isMutualAid) requireField("content", values.content);
    if (isStudyRecruit) requireField("contact", values.contact);
    if (isAdminParticipationPost) requireField("applicationUrl", values.applicationUrl);
    if (resourceFields?.professor) requireField("professor", values.professor);
    if (resourceFields?.difficulty) requireField("difficulty", values.difficulty);
    if (resourceFields?.satisfaction) requireField("satisfaction", values.satisfaction);

    clearErrors(missing);
    if (missing.length > 0) {
      // message를 비워 칸 아래 문구 없이 테두리만 빨갛게 만든다.
      for (const name of missing) setError(name, { message: "" });
      setToast((current) => nextToastState(current, TOAST_MESSAGES.requiredFieldError));
      return;
    }

    if (isAdminParticipationPost) {
      const applicationUrl = values.applicationUrl?.trim() ?? "";
      try {
        const parsed = new URL(applicationUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("INVALID_PROTOCOL");
      } catch {
        setNotice({
          title: "참여 버튼 링크",
          body: "http:// 또는 https://로 시작하는 올바른 주소를 입력하세요.",
        });
        return;
      }
      if (!participationRepresentativeImage) {
        Alert.alert("대표 사진", "동아리 게시글에는 사진을 1장 이상 첨부해야 합니다.");
        return;
      }
    }

    updateMutation.mutate(
      {
        board_id: isResourceEdit ? selectedBoardId || post.board_id : undefined,
        title,
        content: isAlbum ? title : content,
        category: isResourceEdit
          ? resourceCategoryLabel(selectedBoard) ?? undefined
          : values.category?.trim() || undefined,
        metadata: isStudyRecruit
          ? {
              ...(post.metadata ?? {}),
              recruitment_status: values.category === "마감" ? "closed" : "open",
              contact: values.contact?.trim() ?? "",
            }
          : isAdminParticipationPost
            ? {
                ...(post.metadata ?? {}),
                application_url: values.applicationUrl?.trim() ?? "",
                ...(board?.slug === "club-promo" ? { club_operation_status: values.clubOperationStatus } : {}),
              }
            : isResourceEdit
              ? withResourcePostMetadata(post.metadata, resourceFields, values)
              : post.metadata,
        attachment_ids: attachments.map((attachment) => attachment.id),
        is_anonymous: post.is_anonymous,
      },
      {
        onSuccess: () => {
          if (params.editOrigin) {
            const detailBoardId = isResourceEdit && selectedBoardId !== post.board_id
              ? selectedBoardId
              : params.fromBoardId;
            const decision = postEditCompletionDecision(
              board?.board_type,
              params.editOrigin,
              router.canGoBack(),
              postId,
              detailBoardId,
              params.returnTo,
            );
            pendingSubmitNavigation.current = () => navigateAfterPostEdit(decision, {
              back: () => router.back(),
              replace: (route) => router.replace(route as never),
            });
          } else {
            pendingSubmitNavigation.current = leaveScreen;
          }
          setSubmitted(true);
        },
        onError: () => Alert.alert("저장 실패", "작성자 또는 관리자만 이 게시글을 수정할 수 있습니다."),
      }
    );
  };

  const selectImages = async () => {
    Keyboard.dismiss();
    if (isAlbumImageLimitReached) {
      setUploadNotice("사진첩은 게시글당 최대 20장까지 등록할 수 있어요.");
      return;
    }
    try {
      setIsUploading(true);
      setUploadNotice(null);
      const uploaded = await pickAndUploadImages(
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
                setUploadNotice(messages.join(" "));
              },
            }
          : undefined,
      );
      if (uploaded.length > 0) {
        setAttachments((current) => {
          const next = [...current, ...uploaded];
          return isAlbum ? next.slice(0, PHOTO_ALBUM_IMAGE_SELECTION_LIMIT) : next;
        });
      }
    } catch {
      setUploadNotice("사진 업로드를 다시 시도하세요.");
    } finally {
      setIsUploading(false);
    }
  };

  const selectParticipationImages = async (kind: "representative" | "detail") => {
    Keyboard.dismiss();
    if (kind === "detail" && !participationRepresentativeImage) {
      setUploadNotice("대표 이미지를 먼저 등록해주세요.");
      return;
    }
    try {
      setIsUploading(true);
      setUploadNotice(null);
      const uploaded = await pickAndUploadImages(undefined, {
        maxSelection: kind === "representative" ? 1 : undefined,
        retainSuccessfulUploads: true,
        onBatchIssue: ({ uploadedCount, failedCount, skippedCount }) => {
          const messages = [
            kind === "representative" && skippedCount > 0
              ? "대표 이미지는 1장만 등록할 수 있어 첫 번째 사진만 사용했어요."
              : null,
            failedCount > 0
              ? `${uploadedCount}장은 추가했고 ${failedCount}장은 업로드하지 못했어요.`
              : null,
          ].filter((message): message is string => Boolean(message));
          setUploadNotice(messages.join(" "));
        },
      });
      if (uploaded.length > 0) {
        setAttachments((current) =>
          kind === "representative"
            ? replaceParticipationGuideRepresentative(current, uploaded[0])
            : [...current, ...uploaded],
        );
      }
    } catch {
      setUploadNotice(`${kind === "representative" ? "대표" : "상세 글"} 이미지 업로드를 다시 시도하세요.`);
    } finally {
      setIsUploading(false);
    }
  };

  const boardLabel = post.category?.trim() || board?.name || "게시판";

  return (
    <View style={styles.screen}>
      {navigationHeader}

      <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroller} contentContainerStyle={styles.content}>
        {isResourceEdit ? (
          <View>
            <Pressable
              accessibilityLabel="게시판 선택"
              accessibilityRole="button"
              accessibilityState={{ expanded: isBoardMenuOpen }}
              onPress={() => { Keyboard.dismiss(); setIsBoardMenuOpen(true); }}
              style={styles.boardSelect}
            >
              <Text numberOfLines={1} style={styles.readOnlyText}>{selectedBoard?.name ?? "게시판 선택"}</Text>
              <Ionicons name="chevron-down" size={18} color={COLORS.muted} />
            </Pressable>
          </View>
        ) : isStudyRecruit ? null : (
          <View style={styles.readOnlyField}>
            <Text numberOfLines={1} style={styles.readOnlyText}>{boardLabel}</Text>
          </View>
        )}

        {isStudyRecruit ? (
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <View style={styles.labeledField}>
                <Text style={[styles.fieldLabel, styles.fieldLabelMuted]}>모집 상태</Text>
                <View style={styles.statusRow}>
                  {["진행중", "마감"].map((status) => {
                    const selected = field.value === status;
                    return (
                      <Pressable key={status} onPress={() => field.onChange(status)} style={[styles.statusButton, selected ? styles.statusButtonSelected : null]}>
                        <Text style={[styles.statusText, selected ? styles.statusTextSelected : null]}>{status}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          />
        ) : null}

        <Controller
          control={control}
          name="title"
          render={({ field, fieldState }) => (
            <View>
              <TextInput
                accessibilityLabel="제목"
                multiline={!isStudyRecruit}
                onBlur={field.onBlur}
                onChangeText={clearOnChange("title", field.onChange)}
                placeholder={resourceFields?.titlePlaceholder ?? "제목을 입력하세요"}
                placeholderTextColor={COLORS.subtle}
                style={[styles.input, isStudyRecruit ? null : styles.titleInput, fieldState.error ? styles.inputError : null]}
                textAlignVertical="top"
                value={field.value}
              />
            </View>
          )}
        />

        {resourceFields?.professor ? (
          <Controller
            control={control}
            name="professor"
            render={({ field, fieldState }) => (
              <View style={styles.labeledField}>
                <Text style={styles.fieldLabel}>교수명</Text>
                <View style={[styles.suffixInputRow, fieldState.error ? styles.inputError : null]}>
                  <TextInput
                    onChangeText={clearOnChange("professor", field.onChange)}
                    placeholder="교수명을 입력하세요"
                    placeholderTextColor={COLORS.subtle}
                    style={[styles.suffixInput, { outlineStyle: "none" } as never]}
                    value={field.value ?? ""}
                  />
                  <Text style={styles.suffixInputLabel}>교수</Text>
                </View>
              </View>
            )}
          />
        ) : null}

        {RESOURCE_RATING_FIELDS.filter((rating) => resourceFields?.[rating.name]).map((rating) => (
          <Controller
            control={control}
            key={rating.name}
            name={rating.name}
            render={({ field, fieldState }) => (
              <View style={styles.labeledField}>
                <Text style={styles.fieldLabel}>{rating.label}</Text>
                <View style={styles.ratingRow}>
                  {RESOURCE_RATING_LEVELS.map((level) => {
                    const selected = field.value === level;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        key={level}
                        // 필수 입력이라 해제는 없다. 다른 등급을 눌러 바꾼다.
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
              </View>
            )}
          />
        ))}

        {board?.slug === "club-promo" ? (
          <Controller
            control={control}
            name="clubOperationStatus"
            render={({ field }) => <ClubOperationStatusField value={field.value} onChange={field.onChange} />}
          />
        ) : null}

        {!isAlbum ? (
          <Controller
            control={control}
            name="content"
            render={({ field, fieldState }) => (
              <View>
                <TextInput
                  accessibilityLabel="내용"
                  multiline
                  onBlur={field.onBlur}
                  onChangeText={clearOnChange("content", field.onChange)}
                  placeholder="내용을 입력하세요"
                  placeholderTextColor={COLORS.subtle}
                  style={[styles.input, isStudyRecruit ? styles.studyContentInput : styles.contentInput, fieldState.error ? styles.inputError : null]}
                  textAlignVertical="top"
                  value={field.value}
                />
              </View>
            )}
          />
        ) : null}

        {isStudyRecruit ? (
          <Controller
            control={control}
            name="contact"
            render={({ field, fieldState }) => (
              <View style={styles.labeledField}>
                <Text style={styles.fieldLabel}>스터디장 연락수단</Text>
                <TextInput
                  accessibilityLabel="연락 수단"
                  onBlur={field.onBlur}
                  onChangeText={clearOnChange("contact", field.onChange)}
                  placeholder="스터디장 연락 수단"
                  placeholderTextColor={COLORS.subtle}
                  style={[styles.input, fieldState.error ? styles.inputError : null]}
                  value={field.value}
                />
              </View>
            )}
          />
        ) : null}

        {isAdminParticipationPost || isAlbum ? (
          <>
            {isAdminParticipationPost ? (
              <Controller
                control={control}
                name="applicationUrl"
                render={({ field, fieldState }) => (
                  <View>
                    <Text style={styles.fieldLabel}>참여 버튼 링크</Text>
                    <TextInput
                      accessibilityLabel="참여 버튼 링크"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      onBlur={field.onBlur}
                      onChangeText={clearOnChange("applicationUrl", field.onChange)}
                      placeholder="https://forms.gle/..."
                      placeholderTextColor={COLORS.subtle}
                      style={[styles.input, fieldState.error ? styles.inputError : null]}
                      value={field.value}
                    />
                  </View>
                )}
              />
            ) : null}

            {isAlbum ? (
              <View style={styles.photoBox}>
                <View style={styles.photoHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>사진</Text>
                    <Text style={styles.helperText}>{`행사 사진 ${attachments.length}/20 · 게시글당 최대 20장 · 장당 10MB 이하`}</Text>
                  </View>
                  <Pressable
                    disabled={isUploading || isAlbumImageLimitReached}
                    onPress={selectImages}
                    style={[styles.photoAddButton, isUploading || isAlbumImageLimitReached ? styles.photoAddButtonDisabled : null]}
                  >
                    <Ionicons name="image-outline" size={17} color={COLORS.primary} />
                    <Text style={styles.photoAddText}>{isUploading ? "업로드 중" : isAlbumImageLimitReached ? "20장 완료" : "사진 추가"}</Text>
                  </Pressable>
                </View>
                {attachments.map((attachment) => (
                  <View key={attachment.id} style={styles.photoRow}>
                    <Text numberOfLines={1} style={styles.photoName}>{attachment.original_filename}</Text>
                    <Pressable hitSlop={8} onPress={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}>
                      <Ionicons name="close-circle" size={19} color={COLORS.subtle} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <>
                <View style={styles.photoBox}>
                  <View style={styles.photoHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>대표 이미지</Text>
                      <Text style={styles.helperText}>목록 썸네일에만 사용합니다. 이미지 1장 · 10MB 이하</Text>
                    </View>
                    <Pressable
                      disabled={isUploading}
                      onPress={() => void selectParticipationImages("representative")}
                      style={[styles.photoAddButton, isUploading ? styles.photoAddButtonDisabled : null]}
                    >
                      <Ionicons name="image-outline" size={17} color={COLORS.primary} />
                      <Text style={styles.photoAddText}>{isUploading ? "업로드 중" : participationRepresentativeImage ? "이미지 변경" : "이미지 등록"}</Text>
                    </Pressable>
                  </View>
                  {participationRepresentativeImage ? (
                    <View style={styles.photoRow}>
                      <Text numberOfLines={1} style={styles.photoName}>{participationRepresentativeImage.original_filename}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.photoBox}>
                  <View style={styles.photoHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>상세 글 이미지</Text>
                      <Text style={styles.helperText}>
                        {participationRepresentativeImage
                          ? "상세 본문 아래에 등록 순서대로 표시합니다. 각 이미지 10MB 이하"
                          : "대표 이미지를 먼저 등록하면 상세 이미지를 추가할 수 있습니다."}
                      </Text>
                    </View>
                    <Pressable
                      disabled={isUploading || !participationRepresentativeImage}
                      onPress={() => void selectParticipationImages("detail")}
                      style={[styles.photoAddButton, isUploading || !participationRepresentativeImage ? styles.photoAddButtonDisabled : null]}
                    >
                      <Ionicons name="images-outline" size={17} color={COLORS.primary} />
                      <Text style={styles.photoAddText}>{isUploading ? "업로드 중" : "이미지 추가"}</Text>
                    </Pressable>
                  </View>
                  {participationDetailImages.map((attachment) => (
                    <View key={attachment.id} style={styles.photoRow}>
                      <Text numberOfLines={1} style={styles.photoName}>{attachment.original_filename}</Text>
                      <Pressable hitSlop={8} onPress={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}>
                        <Ionicons name="close-circle" size={19} color={COLORS.subtle} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </>
            )}
            {uploadNotice ? <Text style={styles.errorText}>{uploadNotice}</Text> : null}
          </>
        ) : isResourceEdit || board?.category === "community" ? (
          <PostAttachmentEditor attachments={attachments} onChange={setAttachments} onUploadingChange={setIsUploading} onError={showUploadFailure} disabled={updateMutation.isPending} />
        ) : null}

        <Pressable
          disabled={updateMutation.isPending || isUploading}
          // 제출할 때도 포커스를 놓아 검은 테두리와 키보드를 함께 걷는다.
          onPress={() => { Keyboard.dismiss(); handleSubmit(onSubmit)(); }}
          style={[styles.submitButton, updateMutation.isPending || isUploading ? styles.submitButtonDisabled : null]}
        >
          <Text style={styles.submitText}>{updateMutation.isPending || isUploading ? "저장 중" : "완료"}</Text>
        </Pressable>
      </ScrollView>
      <SelectionSheet
        visible={isBoardMenuOpen}
        title="게시판을 선택하세요"
        options={resourceBoardOptions.map((option) => ({ key: String(option.id), label: option.name }))}
        emptyText="옮길 수 있는 게시판이 없습니다."
        selectedKey={String(selectedBoardId)}
        onClose={() => setIsBoardMenuOpen(false)}
        onSelect={(option) => selectBoard(Number(option.key))}
      />
      <DiscardWriteModal
        visible={discardPromptOpen}
        mode="edit"
        onKeep={() => setDiscardPromptOpen(false)}
        onDiscard={() => { setDiscardPromptOpen(false); setRemoveConfirmed(true); }}
      />
      <DiscardWriteModal
        visible={pendingBoardId !== null}
        mode="boardChange"
        onKeep={() => setPendingBoardId(null)}
        onDiscard={() => {
          if (pendingBoardId !== null) clearForBoardChange(pendingBoardId);
          setPendingBoardId(null);
        }}
      />
      <NoticeModal notice={notice} onClose={() => setNotice(null)} />
      <Toast toast={toast} onHide={hideToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
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
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E1E4E9",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  appBarTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "500",
  },
  scroller: {
    flex: 1,
  },
  content: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  readOnlyField: {
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  readOnlyText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
  },
  boardSelect: {
    minHeight: 41,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  // Figma: 작성 화면과 동일한 세그먼트 컨트롤 (46h 트랙 + 38h 옵션)
  statusRow: {
    flexDirection: "row",
    gap: 4,
    width: "100%",
    backgroundColor: "#F0F0EE",
    padding: 4,
    borderRadius: 10,
  },
  statusButton: {
    flex: 1,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  statusButtonSelected: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  statusText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 17,
  },
  statusTextSelected: {
    color: COLORS.primary,
  },
  labeledField: {
    gap: 6, // Figma: 라벨-입력 간격 6
  },
  input: {
    minHeight: 41, // Figma: 41h, padding 12/14
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  titleInput: {
    height: 100,
  },
  contentInput: {
    height: 116,
  },
  studyContentInput: {
    height: 111, // Figma: 스터디 내용입력 111h
  },
  // 작성 화면과 같은 규칙. Figma 오류 상태는 1px이고 여백은 기본과 같다.
  inputError: {
    borderWidth: 1,
    borderColor: "#D64545",
  },
  // 등급 버튼은 좌우 여백이 없어 두께만 바꾼다.
  borderOnlyError: {
    borderWidth: 1,
    borderColor: "#D64545",
  },
  suffixInputRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
  },
  suffixInput: {
    flex: 1,
    minHeight: 41,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 17,
    paddingVertical: 12,
    // Android TextInput의 기본 가로 여백을 없앤다. 두면 바깥 래퍼의 14에 더해진다.
    paddingHorizontal: 0,
  },
  suffixInputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.muted,
  },
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
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 5,
  },
  fieldLabel: {
    color: COLORS.text,
    fontSize: 13, // Figma: 라벨 13/16 Medium
    fontWeight: "500",
    lineHeight: 16,
    marginBottom: 0,
  },
  fieldLabelMuted: {
    color: COLORS.muted, // Figma: 모집 상태 라벨 #6B7280
  },
  helperText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  photoBox: {
    gap: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 13,
  },
  photoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  photoAddButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 7,
    paddingHorizontal: 11,
  },
  photoAddButtonDisabled: {
    opacity: 0.5,
  },
  photoAddText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  photoRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 7,
    backgroundColor: "#F7F8FA",
    paddingHorizontal: 10,
  },
  photoName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
  },
  submitButton: {
    minHeight: 48, // Figma: 완료 버튼 48h
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 18, // Figma: 15/18 Medium
  },
});
