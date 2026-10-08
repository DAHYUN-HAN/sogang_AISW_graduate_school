import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router as expoRouter, useGlobalSearchParams, usePathname } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Keyboard, Platform, Pressable, ScrollView, View } from "react-native";
import { AdminBoardContentQueryState, NoticeImageUploadFeedback, adminBoardContentQueryPolicy, beginNoticeEditorOperation, mergeNoticeAttachments, noticeEditorBoardTransition, noticeEditorOperationResult, noticeImageUploadIssueMessage, noticeUploadButtonLabel, publicNoticeBoardSelection, replaceNoticeAttachment, type NoticeEditorOperation } from "../../components/admin/AdminBoardContentPanel";
import { adminBoardContentTarget, adminBoardCreateCancelTransition, adminBoardCreateTransition, adminBoardCreationResult, adminBoardNavigationIntentResolution, adminBoardScopeTransition, adminBoardSelectionTransition, adminBoardsWithCreatedBoard, boardSettingsSaveResult, shouldClearOptimisticCreatedBoard, type AdminBoardNavigationIntent } from "../../components/admin/AdminBoardManagementNavigator";
import { adminBoardPermissionOptions } from "../../components/admin/AdminBoardSettingsPanel";
import { AppText as Text } from "../../components/AppTypography";
import MediaImage from "../../components/MediaImage";
import { invalidatePostMutationCaches, postMutationCacheTargets } from "../../hooks/usePosts";
import { adminApi, bannerApi, boardApi, commentApi, eventApi, faqApi, postApi, registrationApi, reportApi } from "../../services/api";
import { useUserStore } from "../../stores/userStore";
import type { AdminAuditLog, AdminReportItem, AdminUserItem, BannerItem, Board, EventItem, FAQItem, MajorOption, MediaAsset, MutualAidStatus, PostListItem, PrivacyPolicyVersion, ReportStatus } from "../../types";
import { adminBoardSettingsDraft, adminBoardSettingsPayload, externalLinkMetadata, validateExternalHttpUrl, type AdminBoardSettingsDraft } from "../../utils/adminBoardSettings";
import { adminBoardCapability, adminBoardContentControl, adminBoardDestinationForLegacySection, adminBoardDestinationForSlug, adminBoardNavigationTransition, adminCalendarQueryEnabled, adminDeferredEventGateInitialState, adminDeferredEventGateTransition, adminFaqQueryEnabled, adminPostListQueryParams, adminPostPageForContext, runAdminPostDelete, type AdminBoardContentKind, type AdminBoardDestination, type AdminBoardManagementTab, type AdminContentScope } from "../../utils/adminContentManagement";
import { adminEventFormRouteTransition } from "../../utils/adminEventForm";
import { runAdminMutation } from "../../utils/adminMutationCoordinator";
import { adminSectionPath, resolveAdminSection } from "../../utils/adminNavigation";
import { adminSaveFeedback, type AdminSaveFeedbackPresentation } from "../../utils/adminSaveFeedback";
import { canSaveCohortLeaderCards, canSaveCurrentCouncilCards, canSavePastCouncilCards, cohortLeaderFormsFromMetadata, councilGalleryFields, currentCouncilFormsFromMetadata, moveCouncilIntroductionItem, pastCouncilFormsFromMetadata, withCohortLeaderMetadata, withCurrentCouncilMetadata, withPastCouncilMetadata, type CurrentCouncilFormData } from "../../utils/councilIntroductions";
import { koreaDateTimeInputToUtcISOString, utcApiDateTimeToKoreaInput } from "../../utils/dateFormat";
import { EVENT_CATEGORY_OPTIONS, eventCategoryValueForSubmit, eventDisplayCategory } from "../../utils/eventCategoryPresentation";
import { pickAndUploadBannerImage, pickAndUploadContentImage, pickAndUploadImages } from "../../utils/mediaPicker";
import { formatPastCouncilActivitiesForEditing, parsePastCouncilActivitiesForStorage } from "../../utils/pastCouncil";
import { ADMIN_POST_MODE_FILTERS, ActionButton, AdminBoardsQueryData, AdminPostCard, AdminPostMode, AdminSection, BOARD_TYPE_LABELS, BannerForm, BannerImageSlot, BannerSaveMessage, BoardForm, COLORS, Chip, CohortLeaderForm, EventCard, EventDateTimePicker, EventForm, ExecutiveFormMember, ExternalLinkDraftState, FAQCard, FAQForm, Field, IntroImageTarget, IntroMemberEditor, IntroPhotoGalleryEditor, MutualAidAdminCard, NOTICE_CATEGORY_OPTIONS, NoticeCard, NoticeForm, OptimisticManagedBoard, Panel, PastCouncilForm, RADIUS, SuggestionAdminCard, SuggestionAdminFilter, USER_ROLE_LABELS, UnsupportedBoardContent, appendedIntroGalleryPatch, bannerFormFromItem, bannerPosition, cleanNullable, cleanOptional, emptyBanner, emptyBoard, emptyCohortLeader, emptyCurrentCouncil, emptyEvent, emptyExecutiveMember, emptyFAQ, emptyNotice, emptyPastCouncil, eventSchema, externalLinkBoardTransition, externalLinkNavigationTransition, externalLinkSaveTransition, firstParam, introGalleryPatch, mediaUrl, nextBannerOrder, normalizeNoticeCategoryValue, parseSort } from "./AdminControls";

import { useAdminAlert } from "../../utils/adminAlert";
import AdminNoticePollEditor from "./AdminNoticePollEditor";
import AdminNoticeBodyEditor from "./AdminNoticeBodyEditor";
import AdminBannerSchedule from "./AdminBannerSchedule";
import { insertNoticeBodyImage, noticeBodyBlocks, noticeBodyDraft, removeNoticeBodyImage, replaceNoticeBodyImage, type NoticeBodySelection } from "../../utils/noticeBody";
import { noticePollDraft, noticePollPayload } from "../../utils/noticePoll";
import { noticeSaveIssue } from "../../utils/noticePollUsability";
import AdminNoticePreview from "./AdminNoticePreview";

import { adminPostRouter } from "../../utils/adminPostRouter";
import { BoardFilterRow, BoardSectionTitle } from "./AdminBoardTheme";

export function useAdminController() {
  const Alert = useAdminAlert();

  const params = useGlobalSearchParams<{ editEventId?: string; section?: string; scope?: string }>();
  const pathname = usePathname();
  const router = useMemo(() => adminPostRouter(expoRouter, Platform.OS === "web"), []);

  const editEventIdParam = firstParam(params.editEventId);

  const editEventId = editEventIdParam ? Number(editEventIdParam) : null;

  const rawAdminSection = firstParam(params.section);

  const rawAdminLinkKey = [rawAdminSection ?? "", firstParam(params.scope) ?? "", editEventIdParam ?? ""].join(":");

  const user = useUserStore((state) => state.user);

  const queryClient = useQueryClient();

  const [section, setSectionState] = useState<AdminSection>(() => resolveAdminSection(pathname, params.section, Platform.OS));
  const setSection = useCallback((next: AdminSection) => {
    setSectionState(next);
    if (Platform.OS === "web" && pathname !== adminSectionPath(next)) router.navigate(adminSectionPath(next) as never);
  }, [pathname, router]);

  const [auditPage, setAuditPage] = useState(1);

  const [boardManagementScope, setBoardManagementScope] = useState<AdminContentScope>("all");

  const [boardManagementBoardId, setBoardManagementBoardId] = useState<number | null>(null);

  const [boardManagementTab, setBoardManagementTab] = useState<AdminBoardManagementTab>("content");

  const [creatingBoard, setCreatingBoard] = useState(false);
  const [pageOperationPending, setPageOperationPending] = useState(false);
  const [memberSavePending, setMemberSavePending] = useState(false);

  const [boardSettingsDraft, setBoardSettingsDraft] = useState<AdminBoardSettingsDraft | null>(null);

  const [boardSettingsSaving, setBoardSettingsSaving] = useState(false);

  const [optimisticManagedBoard, setOptimisticManagedBoard] = useState<OptimisticManagedBoard | null>(null);

  const [pendingBoardNavigationIntent, setPendingBoardNavigationIntent] = useState<AdminBoardNavigationIntent | null>(null);

  const pendingBoardNavigationIntentRef = useRef<AdminBoardNavigationIntent | null>(null);

  const boardManagementBoardIdRef = useRef<number | null>(null);

  const boardSettingsSavingRef = useRef(false);

  const handledLegacySection = useRef<string | null>(null);

  const deferredEventNavigationRef = useRef(adminDeferredEventGateInitialState(rawAdminLinkKey));

  const eventFormEditIdRef = useRef(editEventId);

  const [postSearch, setPostSearch] = useState("");

  const [appliedPostSearch, setAppliedPostSearch] = useState("");

  const [postMode, setPostMode] = useState<AdminPostMode>("all");

  const adminPostPaginationContextKey = [
    section,
    boardManagementScope,
    boardManagementBoardId ?? "all",
    appliedPostSearch.trim(),
    postMode,
  ].join("::");

  const [adminPostPagination, setAdminPostPagination] = useState({
    contextKey: adminPostPaginationContextKey,
    page: 1,
  });

  const adminPostPage = adminPostPageForContext(adminPostPagination, adminPostPaginationContextKey);

  const [pendingAdminPostDelete, setPendingAdminPostDelete] = useState<PostListItem | null>(null);

  const [adminPostDeleting, setAdminPostDeleting] = useState(false);

  const [adminPostDeleteError, setAdminPostDeleteError] = useState<string | null>(null);

  const [saveSuccessFeedback, setSaveSuccessFeedback] = useState<AdminSaveFeedbackPresentation | null>(null);

  const [replacingRepresentativeImagePostId, setReplacingRepresentativeImagePostId] = useState<number | null>(null);

  const [mutualAidFilter, setMutualAidFilter] = useState<MutualAidStatus | "all">("processing");

  const [suggestionFilter, setSuggestionFilter] = useState<SuggestionAdminFilter>("received");

  const [reportStatus, setReportStatus] = useState<ReportStatus | "all">("open");

  const [userSearch, setUserSearch] = useState("");

  const [appliedUserSearch, setAppliedUserSearch] = useState("");

  const [memberEditing, setMemberEditing] = useState<AdminUserItem | null>(null);

  const [editingBannerId, setEditingBannerId] = useState<number | null>(null);

  const [bannerForm, setBannerForm] = useState<BannerForm>(emptyBanner);

  const [bannerUploadSlot, setBannerUploadSlot] = useState<BannerImageSlot | null>(null);

  const [bannerSaving, setBannerSaving] = useState(false);

  const [bannerSaveMessage, setBannerSaveMessage] = useState<BannerSaveMessage>(null);

  const [boardForm, setBoardForm] = useState<BoardForm>(emptyBoard);

  const [selectedNoticeBoardId, setSelectedNoticeBoardId] = useState<number | null>(null);

  const selectedNoticeBoardIdRef = useRef<number | null>(null);

  const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null);

  const editingNoticeIdRef = useRef<number | null>(null);

  const [editingNoticeBoardId, setEditingNoticeBoardId] = useState<number | null>(null);

  const noticeEditRequestRef = useRef(0);

  const [noticeForm, setNoticeForm] = useState<NoticeForm>(emptyNotice);
  const noticeBodySelectionRef = useRef<NoticeBodySelection | null>(null);
  const [noticePollBusy, setNoticePollBusy] = useState(false);
  const noticePollBusyRef = useRef(false);
  const handleNoticePollBusy = useCallback((busy: boolean) => {
    noticePollBusyRef.current = busy;
    setNoticePollBusy(busy);
  }, []);

  const [noticeAttachments, setNoticeAttachments] = useState<MediaAsset[]>([]);

  const [noticeMetadata, setNoticeMetadata] = useState<Record<string, unknown>>({});

  const [noticeOperationKind, setNoticeOperationKind] = useState<NoticeEditorOperation["kind"] | null>(null);

  const noticeOperationRef = useRef<NoticeEditorOperation | null>(null);

  const noticeOperationIdRef = useRef(0);

  const [noticeUploadProgress, setNoticeUploadProgress] = useState<number | null>(0);

  const [noticeUploadIssue, setNoticeUploadIssue] = useState<string | null>(null);

  const [currentCouncils, setCurrentCouncils] = useState<CurrentCouncilFormData[]>([]);

  const [currentCouncilUploading, setCurrentCouncilUploading] = useState<IntroImageTarget | null>(null);

  const [executivesSaving, setExecutivesSaving] = useState(false);

  const [cohortLeaders, setCohortLeaders] = useState<CohortLeaderForm[]>([]);

  const [cohortLeaderUploading, setCohortLeaderUploading] = useState<IntroImageTarget | null>(null);

  const [cohortLeadersSaving, setCohortLeadersSaving] = useState(false);

  const [pastCouncils, setPastCouncils] = useState<PastCouncilForm[]>([]);

  const [pastCouncilUploading, setPastCouncilUploading] = useState<IntroImageTarget | null>(null);

  const [pastCouncilsSaving, setPastCouncilsSaving] = useState(false);

  const [editingFAQId, setEditingFAQId] = useState<number | null>(null);

  const [faqForm, setFAQForm] = useState<FAQForm>(emptyFAQ);

  const [externalLinkDraftState, setExternalLinkDraftState] = useState<ExternalLinkDraftState>({ boardId: null, draft: "" });

  const externalLinkDraft = externalLinkDraftState.draft;

  const setExternalLinkDraft = (draft: string) => setExternalLinkDraftState((current) => ({ ...current, draft }));

  const [externalLinkSaving, setExternalLinkSaving] = useState(false);

  const [externalLinkError, setExternalLinkError] = useState<string | null>(null);

  const externalLinkBoardIdRef = useRef<number | null>(null);

  const externalLinkSelectedBoardRef = useRef<Board | undefined>(undefined);

  const externalLinkSavingRef = useRef(false);

  const [newMajorName, setNewMajorName] = useState("");

  const [newMajorOrder, setNewMajorOrder] = useState("50");

  const [policyVersion, setPolicyVersion] = useState("");

  const [policyEffectiveAt, setPolicyEffectiveAt] = useState("");

  useEffect(() => {
    setAdminPostPagination((current) => current.contextKey === adminPostPaginationContextKey
      ? current
      : { contextKey: adminPostPaginationContextKey, page: 1 });
  }, [adminPostPaginationContextKey]);

  const isAdmin = user?.role === "admin";

  const bannersQuery = useQuery({
    queryKey: ["admin-banners"],
    queryFn: () => bannerApi.getBanners({ include_inactive: true }),
    enabled: isAdmin,
  });

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: adminApi.getStats,
    enabled: isAdmin && section === "dashboard",
  });

  const auditLogsQuery = useQuery({
    queryKey: ["admin-audit-logs", section === "audit" ? "all" : "dashboard", section === "audit" ? auditPage : 1],
    queryFn: () => adminApi.getAuditLogs({ page: section === "audit" ? auditPage : 1, size: section === "audit" ? 30 : 8 }),
    enabled: isAdmin && (section === "dashboard" || section === "audit"),
  });

  const boardsQuery = useQuery({
    queryKey: ["admin-boards"],
    queryFn: () => boardApi.getAdminBoards(),
    enabled: isAdmin,
  });

  const queriedManagedBoards = useMemo(() => boardsQuery.data?.data ?? [], [boardsQuery.data?.data]);

  const managedBoards = useMemo(
    () => optimisticManagedBoard
      ? adminBoardsWithCreatedBoard(queriedManagedBoards, optimisticManagedBoard.board)
      : queriedManagedBoards,
    [optimisticManagedBoard, queriedManagedBoards],
  );

  const boards = managedBoards;

  const managedContentTarget = adminBoardContentTarget(
    managedBoards,
    boardManagementScope,
    boardManagementBoardId,
    boardsQuery.status,
  );

  const selectedManagedBoard = managedContentTarget.status === "board" ? managedContentTarget.board : undefined;

  const selectedBoardCapability = adminBoardCapability(selectedManagedBoard);

  const hasManagedContentTarget = managedContentTarget.status === "aggregate" || managedContentTarget.status === "board";

  const isManagedContentActive = section === "boardManagement" && boardManagementTab === "content" && hasManagedContentTarget;

  const managedContentKind = selectedBoardCapability.kind;

  const externalLinkSelectedBoard = managedContentKind === "external-link" ? selectedManagedBoard : undefined;

  const externalLinkSelectedBoardId = externalLinkSelectedBoard?.id ?? null;

  externalLinkSelectedBoardRef.current = externalLinkSelectedBoard;

  const noticeQueryPolicy = adminBoardContentQueryPolicy({
    section,
    tab: boardManagementTab,
    kind: managedContentKind,
    board: selectedManagedBoard,
    targetStatus: managedContentTarget.status,
  });

  const managedStandardPostsBoardId = isManagedContentActive ? selectedManagedBoard?.id : undefined;

  const showsStandardPosts = noticeQueryPolicy.showsStandardPosts;

  const showsSuggestionContent = noticeQueryPolicy.showsSuggestions;

  const showsMutualAidContent = noticeQueryPolicy.showsMutualAid;

  const showsActivityHistoryContent = noticeQueryPolicy.showsActivityHistory;

  const publicNoticeBoardId = publicNoticeBoardSelection(managedBoards, selectedNoticeBoardId);

  const eventsQuery = useQuery({
    queryKey: ["admin-events"],
    queryFn: () => eventApi.getEvents(),
    enabled: isAdmin && adminCalendarQueryEnabled(
      section,
      Boolean(editEventId),
      isManagedContentActive,
      managedContentKind,
    ),
  });

  const adminEventList = eventsQuery.data?.data ?? [];

  const editEventExists = Boolean(editEventId) && adminEventList.some((event) => event.id === editEventId);

  const editEventMissing = eventsQuery.isSuccess && Boolean(editEventId) && !editEventExists;

  const editEventQuery = useQuery({
    queryKey: ["event", editEventId],
    queryFn: () => eventApi.getEvent(editEventId ?? 0),
    enabled: isAdmin && editEventExists,
    retry: false,
  });

  const reportsQuery = useQuery({
    queryKey: ["admin-reports", reportStatus],
    queryFn: () => reportApi.getAdminReports({ status: reportStatus, size: 50 }),
    enabled: isAdmin,
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users", appliedUserSearch],
    queryFn: () => adminApi.getUsers({ q: appliedUserSearch.trim() || undefined, size: 100 }),
    enabled: isAdmin,
  });

  const faqsQuery = useQuery({
    queryKey: ["admin-faqs"],
    queryFn: () => faqApi.getFAQs({ include_inactive: true }),
    enabled: isAdmin && adminFaqQueryEnabled(section, isManagedContentActive, managedContentKind),
  });

  const adminMajorsQuery = useQuery({
    queryKey: ["admin-registration-majors"],
    queryFn: registrationApi.getAdminMajors,
    enabled: isAdmin && section === "registration",
  });

  const adminPrivacyPolicyQuery = useQuery({
    queryKey: ["admin-registration-privacy-policy"],
    queryFn: registrationApi.getAdminPrivacyPolicy,
    enabled: isAdmin && section === "registration",
  });

  const noticePostsQuery = useQuery({
    queryKey: ["admin-notices", publicNoticeBoardId],
    queryFn: () => postApi.getPosts(publicNoticeBoardId ?? 0, 1, 50, { sort: "latest" }),
    enabled: isAdmin && noticeQueryPolicy.noticeSource === "public" && Boolean(publicNoticeBoardId),
  });

  const unifiedNoticePostsQuery = useQuery({
    queryKey: ["admin-notices", "managed", noticeQueryPolicy.noticeBoardId],
    queryFn: () => postApi.getAdminPosts({
      page: 1,
      size: 50,
      board_id: noticeQueryPolicy.noticeBoardId,
    }),
    enabled: isAdmin
      && noticeQueryPolicy.noticeSource === "admin"
      && Boolean(noticeQueryPolicy.noticeBoardId),
  });

  const adminPostsQuery = useQuery({
    queryKey: [
      "admin-posts",
      section === "dashboard" ? "dashboard" : appliedPostSearch,
      section === "dashboard" ? undefined : managedStandardPostsBoardId,
      section === "dashboard" ? "all" : postMode,
      adminPostPage,
    ],
    queryFn: () =>
      postApi.getAdminPosts(adminPostListQueryParams({
        isDashboard: section === "dashboard",
        page: adminPostPage,
        search: appliedPostSearch,
        boardId: managedStandardPostsBoardId,
        mode: postMode,
      })),
    enabled: isAdmin && (section === "dashboard" || showsStandardPosts),
  });

  const mutualAidPostsQuery = useQuery({
    queryKey: ["admin-mutual-aid", section === "dashboard" ? "dashboard" : noticeQueryPolicy.mutualAidBoardId],
    queryFn: () => postApi.getAdminPosts({
      page: 1,
      size: 100,
      board_type: "mutual_aid",
      board_id: section === "dashboard" ? undefined : noticeQueryPolicy.mutualAidBoardId,
    }),
    enabled: isAdmin && (section === "dashboard" || (showsMutualAidContent && Boolean(noticeQueryPolicy.mutualAidBoardId))),
  });

  const suggestionPostsQuery = useQuery({
    queryKey: ["admin-suggestions", section === "dashboard" ? "dashboard" : noticeQueryPolicy.suggestionBoardId],
    queryFn: () => postApi.getAdminPosts({
      page: 1,
      size: 100,
      board_type: "suggestion",
      board_id: section === "dashboard" ? undefined : noticeQueryPolicy.suggestionBoardId,
    }),
    enabled: isAdmin && (section === "dashboard" || (showsSuggestionContent && Boolean(noticeQueryPolicy.suggestionBoardId))),
  });

  const activityHistoryPostsQuery = useQuery({
    queryKey: ["admin-notices", "activity-history"],
    queryFn: () => postApi.getAdminPosts({ page: 1, size: 100, board_type: "notice" }),
    enabled: isAdmin && showsActivityHistoryContent,
  });

  const noticeBoards = useMemo(
    () => (boardsQuery.data?.data ?? []).filter((board) => board.board_type === "notice" && board.is_active !== false),
    [boardsQuery.data?.data]
  );

  const executivesBoard = useMemo(
    () => (boardsQuery.data?.data ?? []).find((board) => board.slug === "gsa-executives"),
    [boardsQuery.data?.data]
  );

  const cohortLeadersBoard = useMemo(
    () => (boardsQuery.data?.data ?? []).find((board) => board.slug === "gsa-cohort-leaders"),
    [boardsQuery.data?.data]
  );

  const pastCouncilsBoard = useMemo(
    () => (boardsQuery.data?.data ?? []).find((board) => board.slug === "gsa-past-councils"),
    [boardsQuery.data?.data]
  );

  const { control, handleSubmit, reset } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: emptyEvent,
  });

  useEffect(() => {
    const nextPublicBoardId = publicNoticeBoardSelection(noticeBoards, selectedNoticeBoardId);
    const shouldInitialize = selectedNoticeBoardId === null && nextPublicBoardId !== null;
    const shouldCorrectPublicSelection = noticeQueryPolicy.noticeSource === "public"
      && selectedNoticeBoardId !== nextPublicBoardId;
    if (!shouldInitialize && !shouldCorrectPublicSelection) return;
    noticeEditRequestRef.current += 1;
    selectedNoticeBoardIdRef.current = nextPublicBoardId;
    setSelectedNoticeBoardId(nextPublicBoardId);
    editingNoticeIdRef.current = null;
    setEditingNoticeId(null);
    setEditingNoticeBoardId(null);
    setNoticeForm(emptyNotice);
    noticeBodySelectionRef.current = null;
    setNoticeAttachments([]);
    setNoticeMetadata({});
    setNoticeUploadProgress(0);
    setNoticeUploadIssue(null);
  }, [noticeBoards, noticeQueryPolicy.noticeSource, selectedNoticeBoardId]);

  useEffect(() => {
    if (isManagedContentActive && managedContentKind === "notice" && selectedManagedBoard) {
      const transition = noticeEditorBoardTransition(
        selectedNoticeBoardIdRef.current,
        selectedManagedBoard.id,
        editingNoticeBoardId,
      );
      if (selectedNoticeBoardIdRef.current === transition.selectedBoardId) return;
      noticeEditRequestRef.current += 1;
      selectedNoticeBoardIdRef.current = transition.selectedBoardId;
      setSelectedNoticeBoardId(transition.selectedBoardId);
      if (transition.shouldResetEditor) {
        editingNoticeIdRef.current = null;
        setEditingNoticeId(null);
        setEditingNoticeBoardId(null);
        setNoticeForm(emptyNotice);
        noticeBodySelectionRef.current = null;
        setNoticeAttachments([]);
        setNoticeMetadata({});
        setNoticeUploadProgress(0);
        setNoticeUploadIssue(null);
      }
    }
  }, [editingNoticeBoardId, isManagedContentActive, managedContentKind, selectedManagedBoard]);

  useEffect(() => {
    setBoardSettingsDraft(selectedManagedBoard ? adminBoardSettingsDraft(selectedManagedBoard) : null);
  }, [selectedManagedBoard]);

  useEffect(() => {
    boardManagementBoardIdRef.current = boardManagementBoardId;
  }, [boardManagementBoardId]);

  useEffect(() => {
    const board = externalLinkSelectedBoardRef.current;
    externalLinkBoardIdRef.current = externalLinkSelectedBoardId;
    setExternalLinkDraftState((current) => externalLinkBoardTransition(current, board));
    setExternalLinkError(null);
  }, [externalLinkSelectedBoardId]);

  useEffect(() => {
    if (!optimisticManagedBoard) return;
    const queryState = queryClient.getQueryState<AdminBoardsQueryData>(["admin-boards"]);
    if (shouldClearOptimisticCreatedBoard(
      optimisticManagedBoard.board.id,
      optimisticManagedBoard.insertedGeneration,
      queryState?.dataUpdateCount ?? 0,
      queryState?.status ?? "pending",
      queriedManagedBoards,
    )) {
      setOptimisticManagedBoard(null);
    }
  }, [boardsQuery.dataUpdatedAt, boardsQuery.fetchStatus, optimisticManagedBoard, queriedManagedBoards, queryClient]);

  useEffect(() => {
    const transition = adminDeferredEventGateTransition(deferredEventNavigationRef.current, {
      type: "sync",
      rawLinkKey: rawAdminLinkKey,
    });
    deferredEventNavigationRef.current = transition.state;
  }, [rawAdminLinkKey]);

  useEffect(() => {
    const intent = pendingBoardNavigationIntent;
    if (!intent || pendingBoardNavigationIntentRef.current !== intent) return;
    const resolution = adminBoardNavigationIntentResolution(intent, boards, boardsQuery.status);
    if (resolution.status === "pending" || resolution.status === "error") return;
    if (pendingBoardNavigationIntentRef.current !== intent) return;
    pendingBoardNavigationIntentRef.current = null;
    setPendingBoardNavigationIntent(null);
    if (resolution.status === "missing") {
      Alert.alert("게시판 확인", "요청한 게시판을 찾을 수 없습니다.");
      return;
    }
    externalLinkBoardIdRef.current = resolution.destination.boardId;
    boardManagementBoardIdRef.current = resolution.destination.boardId;
    setSection("boardManagement");
    setBoardManagementScope(resolution.destination.scope);
    setBoardManagementBoardId(resolution.destination.boardId);
    setBoardManagementTab(resolution.destination.tab);
    setCreatingBoard(false);
  }, [Alert, boards, boardsQuery.status, pendingBoardNavigationIntent, setSection]);

  useEffect(() => {
    pendingBoardNavigationIntentRef.current = null;
    setPendingBoardNavigationIntent(null);
    if (noticeOperationRef.current) noticeEditRequestRef.current += 1;
  }, [editEventIdParam, params.scope, params.section]);

  useEffect(() => {
    setSectionState(resolveAdminSection(pathname, params.section, Platform.OS));
  }, [pathname, params.section]);

  useEffect(() => {
    const transition = adminEventFormRouteTransition({
      previousEditEventId: eventFormEditIdRef.current,
      nextEditEventId: editEventId,
    });
    eventFormEditIdRef.current = editEventId;
    if (!transition.shouldResetForm) return;
    reset(emptyEvent);
  }, [editEventId, reset]);

  useEffect(() => {
    const transition = adminBoardNavigationTransition(handledLegacySection.current, {
      type: "legacy",
      rawSection: rawAdminSection,
      boards,
      boardsReady: boardsQuery.isSuccess,
      rawLinkKey: rawAdminLinkKey,
    });
    if (!transition) return;
    handledLegacySection.current = transition.handledSection;
    if (!transition.destination) return;
    pendingBoardNavigationIntentRef.current = null;
    setPendingBoardNavigationIntent(null);
    boardManagementBoardIdRef.current = transition.destination.boardId;
    externalLinkBoardIdRef.current = transition.destination.boardId;
    // Legacy URLs keep their event/scope parameters while the shared page resolves them.
    setSectionState("boardManagement");
    setBoardManagementScope(transition.destination.scope);
    setBoardManagementBoardId(transition.destination.boardId);
    setBoardManagementTab(transition.destination.tab);
    setCreatingBoard(false);
  }, [boards, boardsQuery.isSuccess, rawAdminLinkKey, rawAdminSection]);

  useEffect(() => {
    if (!editEventMissing) {
      return;
    }
    const gate = adminDeferredEventGateTransition(deferredEventNavigationRef.current, {
      type: "apply",
      rawLinkKey: rawAdminLinkKey,
    });
    deferredEventNavigationRef.current = gate.state;
    if (!gate.shouldApply) return;
    const destination = adminBoardDestinationForSlug("academic-calendar", boards);
    boardManagementBoardIdRef.current = destination.boardId;
    setSectionState("boardManagement");
    setBoardManagementScope(destination.scope);
    setBoardManagementBoardId(destination.boardId);
    setBoardManagementTab(destination.tab);
    reset(emptyEvent);
    router.replace({ pathname: Platform.OS === "web" ? "/admin/boards" : "/admin", params: { section: "boardManagement" } } as never);
  }, [boards, editEventMissing, rawAdminLinkKey, reset, router]);

  useEffect(() => {
    const event = editEventQuery.data?.data;
    if (!event) {
      return;
    }
    const gate = adminDeferredEventGateTransition(deferredEventNavigationRef.current, {
      type: "apply",
      rawLinkKey: rawAdminLinkKey,
    });
    deferredEventNavigationRef.current = gate.state;
    if (!gate.shouldApply) return;
    const destination = adminBoardDestinationForSlug("academic-calendar", boards);
    boardManagementBoardIdRef.current = destination.boardId;
    setSectionState("boardManagement");
    setBoardManagementScope(destination.scope);
    setBoardManagementBoardId(destination.boardId);
    setBoardManagementTab(destination.tab);
    reset({
      title: event.title,
      category: eventDisplayCategory(event.category),
      start_at: utcApiDateTimeToKoreaInput(event.start_at),
      end_at: utcApiDateTimeToKoreaInput(event.end_at),
      location: event.location ?? "",
      description: event.description ?? "",
    });
  }, [boards, editEventQuery.data?.data, rawAdminLinkKey, reset]);

  useEffect(() => {
    const currentBanners = bannersQuery.data?.data ?? [];
    if (editingBannerId || bannerForm.sort_order !== "0" || currentBanners.length === 0) {
      return;
    }
    setBannerForm((current) => ({ ...current, sort_order: String(nextBannerOrder(currentBanners)) }));
  }, [bannerForm.sort_order, bannersQuery.data?.data, editingBannerId]);

  useEffect(() => {
    const policy = adminPrivacyPolicyQuery.data?.data;
    if (!policy) {
      return;
    }
    setPolicyVersion(policy.version);
    setPolicyEffectiveAt(policy.effective_at.slice(0, 16));
  }, [adminPrivacyPolicyQuery.data?.data]);

  useEffect(() => {
    if (!executivesBoard) return;
    const current = currentCouncilFormsFromMetadata(executivesBoard.metadata)[0];
    setCurrentCouncils([{ ...(current ?? emptyCurrentCouncil), members: [...(current?.members ?? [])] }]);
  }, [executivesBoard]);

  useEffect(() => {
    if (!cohortLeadersBoard) return;
    setCohortLeaders(cohortLeaderFormsFromMetadata(cohortLeadersBoard.metadata));
  }, [cohortLeadersBoard]);

  useEffect(() => {
    if (!pastCouncilsBoard) return;
    setPastCouncils(pastCouncilFormsFromMetadata(pastCouncilsBoard.metadata).map((card) => {
      const { activities, ...rest } = card;
      return { ...rest, activities_text: formatPastCouncilActivitiesForEditing(activities) };
    }));
  }, [pastCouncilsBoard]);

  const banners = bannersQuery.data?.data ?? [];

  const sortedBanners = [...banners].sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0) || left.id - right.id);

  const reports = reportsQuery.data?.data ?? [];

  const users = usersQuery.data?.data ?? [];

  const faqs = faqsQuery.data?.data ?? [];

  const adminMajors: MajorOption[] = adminMajorsQuery.data?.data ?? [];

  const adminPrivacyPolicy: PrivacyPolicyVersion | undefined = adminPrivacyPolicyQuery.data?.data;

  const events = adminEventList;

  const activeNoticePostsQuery = noticeQueryPolicy.noticeSource === "admin"
    ? unifiedNoticePostsQuery
    : noticePostsQuery;

  const noticePosts = activeNoticePostsQuery.data?.data ?? [];

  const adminPosts = adminPostsQuery.data?.data ?? [];

  const activityHistoryPosts = (activityHistoryPostsQuery.data?.data ?? [])
    .filter((item) => item.metadata?.show_in_council_activity === true);

  const mutualAidPosts = mutualAidPostsQuery.data?.data ?? [];

  const visibleMutualAidPosts = mutualAidFilter === "all"
    ? mutualAidPosts
    : mutualAidPosts.filter((item) => item.mutual_aid?.status === mutualAidFilter);

  const processingMutualAidCount = mutualAidPosts.filter((item) => item.mutual_aid?.status === "processing").length;

  const suggestionPosts = suggestionPostsQuery.data?.data ?? [];

  const visibleSuggestionPosts = suggestionFilter === "all"
    ? suggestionPosts
    : suggestionPosts.filter((item) => item.suggestion?.status === suggestionFilter);

  const pendingSuggestionCount = suggestionPosts.filter((item) => item.suggestion?.status !== "answered").length;

  const adminPostTotal = adminPostsQuery.data?.pagination?.total ?? adminPosts.length;

  const adminPostTotalPages = adminPostsQuery.data?.pagination?.total_pages ?? 1;

  const stats = statsQuery.data?.data;

  const auditLogs: AdminAuditLog[] = auditLogsQuery.data?.data ?? [];

  const selectedNoticeBoard = noticeBoards.find((board) => board.id === selectedNoticeBoardId)
    ?? (managedContentKind === "notice" ? selectedManagedBoard : undefined);

  const activeBannerCount = banners.filter((item) => item.is_active).length;

  const councilBoardCount = boards.filter((board) => ["council", "gsa"].includes(board.category)).length;

  const clubPromoBoard = boards.find((board) => board.slug === "club-promo");

  const networkingProgramsBoard = boards.find((board) => board.slug === "networking-programs");

  const selectedBannerPosition = bannerPosition(sortedBanners, editingBannerId);

  const nextBannerPosition = sortedBanners.length + 1;

  const suggestedBannerOrder = nextBannerOrder(sortedBanners);

  const previewBannerPosition = editingBannerId ? selectedBannerPosition ?? 1 : nextBannerPosition;

  const previewBannerTotal = editingBannerId ? Math.max(sortedBanners.length, 1) : nextBannerPosition;

  const noticeOperationPending = noticeOperationKind !== null || noticePollBusy;

  const managedNavigationLocked = boardSettingsSaving || externalLinkSaving || noticeOperationPending || pageOperationPending || memberSavePending;

  const clearPendingBoardNavigationIntent = () => {
    pendingBoardNavigationIntentRef.current = null;
    setPendingBoardNavigationIntent(null);
  };

  const beginExplicitAdminNavigation = () => {
    const eventCancellation = adminDeferredEventGateTransition(deferredEventNavigationRef.current, {
      type: "cancel",
      rawLinkKey: rawAdminLinkKey,
    });
    deferredEventNavigationRef.current = eventCancellation.state;
    const acknowledgement = adminBoardNavigationTransition(handledLegacySection.current, {
      type: "explicit",
      rawLinkKey: rawAdminLinkKey,
    });
    if (acknowledgement) handledLegacySection.current = acknowledgement.handledSection;
    clearPendingBoardNavigationIntent();
  };

  const openAdminSection = (nextSection: AdminSection) => {
    if (boardSettingsSavingRef.current || externalLinkSavingRef.current || noticeOperationRef.current) return;
    beginExplicitAdminNavigation();
    if (Platform.OS === "web") setSection(nextSection);
    else { setSectionState(nextSection); router.setParams({ section: nextSection, editEventId: undefined, scope: undefined }); }
  };

  const openMemberScreen = () => {
    if (boardSettingsSavingRef.current || externalLinkSavingRef.current || noticeOperationRef.current) return;
    beginExplicitAdminNavigation();
    expoRouter.push("/(tabs)/home" as never);
  };

  const dispatchEventReminders = async () => {
    try {
      const response = await adminApi.dispatchEventReminders();
      Alert.alert("D-day 알림 처리 완료", `${response.data.created}개의 알림을 생성했습니다.`);
      queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] });
    } catch {
      Alert.alert("처리 실패", "D-day 알림 작업을 실행하지 못했습니다.");
    }
  };

  const handleCreateMajor = async () => {
    if (!newMajorName.trim()) {
      Alert.alert("입력 확인", "전공명을 입력해주세요.");
      return;
    }
    try {
      await registrationApi.createMajor({ name: newMajorName.trim(), sort_order: Number(newMajorOrder || 0) });
      setNewMajorName("");
      setNewMajorOrder(String((adminMajors.length + 2) * 10));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-registration-majors"] }),
        queryClient.invalidateQueries({ queryKey: ["registration-options"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] }),
      ]);
    } catch {
      Alert.alert("저장 실패", "같은 이름의 전공이 있는지 확인해주세요.");
    }
  };

  const handleSaveMajor = async (
    majorId: number,
    payload: { name: string; sort_order: number; is_active: boolean }
  ) => {
    if (!payload.name) {
      Alert.alert("입력 확인", "전공명을 입력해주세요.");
      return;
    }
    try {
      await registrationApi.updateMajor(majorId, payload);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-registration-majors"] }),
        queryClient.invalidateQueries({ queryKey: ["registration-options"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] }),
      ]);
    } catch {
      Alert.alert("저장 실패", "중복 전공명 또는 최소 1개의 활성 전공 조건을 확인해주세요.");
    }
  };

  const handleSavePrivacyPolicy = async () => {
    if (!policyVersion.trim() || !policyEffectiveAt) {
      Alert.alert("입력 확인", "정책 버전과 시행일시를 입력해주세요.");
      return;
    }
    try {
      await registrationApi.updatePrivacyPolicy({
        version: policyVersion.trim(),
        effective_at: policyEffectiveAt,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-registration-privacy-policy"] }),
        queryClient.invalidateQueries({ queryKey: ["registration-options"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] }),
      ]);
      Alert.alert("저장 완료", "신규 회원가입에 적용할 개인정보 처리방침 버전을 변경했습니다.");
    } catch {
      Alert.alert("저장 실패", "정책 버전과 시행일시를 확인해주세요.");
    }
  };

  const syncPushReceipts = async () => {
    try {
      const response = await adminApi.syncPushReceipts();
      Alert.alert("푸시 영수증 확인", `확인 ${response.data.checked}건 · 성공 ${response.data.delivered}건 · 실패 ${response.data.failed}건`);
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch {
      Alert.alert("처리 실패", "푸시 영수증을 확인하지 못했습니다.");
    }
  };

  const resetBannerForm = () => {
    setEditingBannerId(null);
    setBannerForm({ ...emptyBanner, sort_order: String(suggestedBannerOrder) });
    setBannerSaveMessage({ tone: "info", text: `${nextBannerPosition}번째 배너를 새로 등록합니다.` });
  };

  const handleEditBanner = (item: BannerItem) => {
    setEditingBannerId(item.id);
    setBannerForm(bannerFormFromItem(item));
    const position = bannerPosition(sortedBanners, item.id);
    setBannerSaveMessage({ tone: "info", text: `${position ?? "-"}번째 배너를 수정 중입니다.` });
  };

  const handleUploadBannerImage = async (slot: BannerImageSlot) => {
    try {
      setBannerUploadSlot(slot);
      const uploaded = await pickAndUploadBannerImage();
      if (!uploaded?.url) {
        return;
      }
      const field = `${slot}_image_url` as keyof Pick<
        BannerForm,
        "mobile_image_url" | "tablet_image_url" | "desktop_image_url"
      >;
      setBannerForm((current) => ({ ...current, [field]: uploaded.url ?? "" }));
    } catch {
      Alert.alert("업로드 실패", "배너 이미지 파일을 업로드할 수 없습니다.");
    } finally {
      setBannerUploadSlot(null);
    }
  };

  const handleSaveBanner = async () => {
    if (bannerSaving) {
      return;
    }

    const startsAt = bannerForm.starts_at.trim() ? koreaDateTimeInputToUtcISOString(bannerForm.starts_at) : null;
    const endsAt = bannerForm.ends_at.trim() ? koreaDateTimeInputToUtcISOString(bannerForm.ends_at) : null;
    if ((bannerForm.starts_at.trim() && !startsAt) || (bannerForm.ends_at.trim() && !endsAt)) {
      setBannerSaveMessage({ tone: "error", text: "노출 날짜와 시간을 확인해주세요." });
      return;
    }
    if (startsAt && endsAt && endsAt <= startsAt) {
      setBannerSaveMessage({ tone: "error", text: "노출 종료는 시작보다 늦게 설정해주세요." });
      return;
    }

    const rawImageUrls = {
      mobile: cleanOptional(bannerForm.mobile_image_url),
      tablet: cleanOptional(bannerForm.tablet_image_url),
      desktop: cleanOptional(bannerForm.desktop_image_url),
    };
    const imageUrls = Object.fromEntries(
      Object.entries(rawImageUrls).filter((entry): entry is [string, string] => Boolean(entry[1]))
    );
    const primaryImage = imageUrls.desktop ?? imageUrls.tablet ?? imageUrls.mobile;
    if (!primaryImage) {
      const text = "홈 배너는 이미지 등록이 필수입니다. 모바일·태블릿·데스크톱 중 하나 이상 업로드해주세요.";
      setBannerSaveMessage({ tone: "error", text });
      Alert.alert("배너 이미지 필요", text);
      return;
    }
    const payload = {
      placement: "home" as const,
      title: null,
      subtitle: null,
      badge_text: null,
      cta_label: null,
      cta_href: cleanNullable(bannerForm.cta_href),
      image_url: primaryImage,
      image_urls: Object.keys(imageUrls).length > 0 ? imageUrls : null,
      theme: "none" as const,
      sort_order: parseSort(bannerForm.sort_order),
      is_active: bannerForm.is_active,
      starts_at: startsAt,
      ends_at: endsAt,
      deadline_at: null,
    };

    try {
      setBannerSaving(true);
      setBannerSaveMessage({ tone: "info", text: "배너를 저장하는 중입니다." });
      let savedBanner: BannerItem;
      if (editingBannerId) {
        const response = await bannerApi.updateBanner(editingBannerId, payload);
        savedBanner = response.data;
      } else {
        const response = await bannerApi.createBanner(payload);
        savedBanner = response.data;
      }
      setEditingBannerId(savedBanner.id);
      setBannerForm(bannerFormFromItem(savedBanner));
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      queryClient.invalidateQueries({ queryKey: ["banners"] });
      const savedPosition = editingBannerId ? selectedBannerPosition : nextBannerPosition;
      setBannerSaveMessage({
        tone: "success",
        text: `${savedPosition ?? "-"}번째 배너가 ${editingBannerId ? "저장" : "등록"}되었습니다.`,
      });
      Alert.alert("저장 완료", "배너가 저장되었습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "배너 입력 정보를 확인하세요.";
      setBannerSaveMessage({ tone: "error", text: `저장 실패: ${message}` });
      Alert.alert("저장 실패", "배너 입력 정보를 확인하세요.");
    } finally {
      setBannerSaving(false);
    }
  };

  const handleHideBanner = (item: BannerItem) => {
    Alert.alert("배너 숨김", "이 배너를 홈에서 숨길까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "숨김",
        style: "destructive",
        onPress: async () => {
          try {
            await bannerApi.deleteBanner(item.id);
            queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
            queryClient.invalidateQueries({ queryKey: ["banners"] });
            if (editingBannerId === item.id) {
              setBannerForm((current) => ({ ...current, is_active: false }));
            }
            const position = bannerPosition(sortedBanners, item.id);
            setBannerSaveMessage({ tone: "success", text: `${position ?? "-"}번째 배너를 숨김 처리했습니다.` });
          } catch {
            setBannerSaveMessage({ tone: "error", text: "배너를 숨길 수 없습니다." });
            Alert.alert("처리 실패", "배너를 숨길 수 없습니다.");
          }
        },
      },
    ]);
  };

  const resetBoardForm = () => {
    setBoardForm(emptyBoard);
    setCreatingBoard(false);
  };

  const acceptCreatedBoard = (board: Board) => {
    const result = adminBoardCreationResult(managedBoards, board);
    queryClient.setQueryData<AdminBoardsQueryData>(["admin-boards"], (current) => ({
      ...(current ?? { status: "success" as const }),
      data: adminBoardsWithCreatedBoard(current?.data ?? result.boards, board),
    }));
    const insertedGeneration = queryClient.getQueryState<AdminBoardsQueryData>(["admin-boards"])?.dataUpdateCount ?? 0;
    setOptimisticManagedBoard({board,insertedGeneration});
    syncExternalLinkNavigationBoardId(board.id);
    boardManagementBoardIdRef.current=board.id;
    setBoardManagementScope(result.transition.scope);
    setBoardManagementBoardId(board.id);
    setBoardManagementTab("content");
    setCreatingBoard(false);
  };

  const handleSaveBoard = async () => {
    if (!boardForm.name.trim() || !boardForm.slug.trim() || !boardForm.category.trim()) {
      Alert.alert("게시판 확인", "이름, 슬러그, 카테고리를 입력하세요.");
      return;
    }

    const payload = {
      name: boardForm.name.trim(),
      slug: boardForm.slug.trim(),
      category: boardForm.category.trim(),
      board_type: boardForm.board_type,
      description: cleanOptional(boardForm.description),
      sort_order: parseSort(boardForm.sort_order),
      allow_anonymous: boardForm.allow_anonymous,
      read_permission: boardForm.read_permission,
      write_permission: boardForm.write_permission,
      is_active: boardForm.is_active,
    };

    try {
      const created = await boardApi.createAdminBoard(payload);
      const creationResult = adminBoardCreationResult(managedBoards, created.data);
      const transition = creationResult.transition;
      queryClient.setQueryData<AdminBoardsQueryData>(["admin-boards"], (current) => ({
        ...(current ?? { status: "success" as const }),
        data: adminBoardsWithCreatedBoard(current?.data ?? creationResult.boards, created.data),
      }));
      const insertedGeneration = queryClient.getQueryState<AdminBoardsQueryData>(["admin-boards"])?.dataUpdateCount ?? 0;
      setOptimisticManagedBoard({ board: created.data, insertedGeneration });
      syncExternalLinkNavigationBoardId(transition.boardId);
      boardManagementBoardIdRef.current = transition.boardId;
      setBoardManagementScope(transition.scope);
      setBoardManagementBoardId(transition.boardId);
      setBoardManagementTab(transition.tab);
      setCreatingBoard(transition.creatingBoard);
      resetBoardForm();
      queryClient.invalidateQueries({ queryKey: ["admin-boards"] });
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      Alert.alert("저장 완료", "게시판 설정이 저장되었습니다.");
    } catch {
      Alert.alert("저장 실패", "슬러그 중복 또는 입력값을 확인하세요.");
    }
  };

  const syncExternalLinkNavigationBoardId = (nextBoardId: number | null) => {
    const transition = externalLinkNavigationTransition(
      externalLinkBoardIdRef.current,
      nextBoardId,
      externalLinkSavingRef.current,
    );
    if (!transition.accepted) return false;
    externalLinkBoardIdRef.current = transition.boardId;
    return true;
  };

  const openManagedBoardDestination = (destination: AdminBoardDestination | null) => {
    if (!destination) return;
    if (boardSettingsSavingRef.current || externalLinkSavingRef.current || noticeOperationRef.current) return;
    beginExplicitAdminNavigation();
    if (!syncExternalLinkNavigationBoardId(destination.boardId)) return;
    boardManagementBoardIdRef.current = destination.boardId;
    setSection("boardManagement");
    setBoardManagementScope(destination.scope);
    setBoardManagementBoardId(destination.boardId);
    setBoardManagementTab(destination.tab);
    setCreatingBoard(false);
  };

  const openManagedBoard = (slug: string, tab: AdminBoardManagementTab = "content") => {
    if (boardSettingsSavingRef.current || externalLinkSavingRef.current || noticeOperationRef.current) return;
    beginExplicitAdminNavigation();
    const intent = { slug, tab };
    const resolution = adminBoardNavigationIntentResolution(intent, boards, boardsQuery.status);
    if (resolution.status === "pending" || resolution.status === "error") {
      pendingBoardNavigationIntentRef.current = intent;
      setPendingBoardNavigationIntent(intent);
      return;
    }
    if (resolution.status === "missing") {
      Alert.alert("게시판 확인", "요청한 게시판을 찾을 수 없습니다.");
      return;
    }
    openManagedBoardDestination(resolution.destination);
  };

  const openAllManagedPosts = () => {
    openManagedBoardDestination(adminBoardDestinationForLegacySection("posts", boards));
  };

  const handleBoardManagementScopeChange = (nextScope: AdminContentScope) => {
    if (boardSettingsSavingRef.current || externalLinkSavingRef.current || noticeOperationRef.current) return;
    beginExplicitAdminNavigation();
    const transition = adminBoardScopeTransition(boards, boardManagementBoardId, nextScope);
    if (!syncExternalLinkNavigationBoardId(transition.boardId)) return;
    boardManagementBoardIdRef.current = transition.boardId;
    setBoardManagementScope(transition.scope);
    setBoardManagementBoardId(transition.boardId);
    setBoardManagementTab(transition.tab);
    setCreatingBoard(transition.creatingBoard);
  };

  const handleBoardManagementBoardChange = (boardId: number | null) => {
    if (boardSettingsSavingRef.current || externalLinkSavingRef.current || noticeOperationRef.current) return;
    beginExplicitAdminNavigation();
    if (managedContentKind === "notice" && boardId !== selectedNoticeBoardIdRef.current) {
      resetNoticeForm();
    }
    const transition = adminBoardSelectionTransition(boardId);
    if (!syncExternalLinkNavigationBoardId(transition.boardId)) return;
    boardManagementBoardIdRef.current = transition.boardId;
    setBoardManagementBoardId(transition.boardId);
    setBoardManagementTab(transition.tab);
    setCreatingBoard(transition.creatingBoard);
  };

  const handleCreateManagedBoard = () => {
    if (boardSettingsSavingRef.current || externalLinkSavingRef.current || noticeOperationRef.current) return;
    beginExplicitAdminNavigation();
    const transition = adminBoardCreateTransition();
    resetBoardForm();
    setCreatingBoard(transition.creatingBoard);
    setBoardManagementTab(transition.tab);
  };

  const handleBoardManagementTabChange = (tab: AdminBoardManagementTab) => {
    if (boardSettingsSavingRef.current || externalLinkSavingRef.current || noticeOperationRef.current) return;
    beginExplicitAdminNavigation();
    setBoardManagementTab(tab);
  };

  const handleSaveBoardSettings = async () => {
    if (!selectedManagedBoard || !boardSettingsDraft || boardSettingsSavingRef.current) return;
    const targetBoardId = selectedManagedBoard.id;
    let payload: ReturnType<typeof adminBoardSettingsPayload>;
    try {
      payload = adminBoardSettingsPayload(boardSettingsDraft, selectedManagedBoard);
    } catch {
      Alert.alert("저장 실패", "게시판 설정 입력값을 확인하세요.");
      return;
    }

    boardSettingsSavingRef.current = true;
    setBoardSettingsSaving(true);
    try {
      const response = await boardApi.updateAdminBoard(
        targetBoardId,
        payload,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-boards"] }),
        queryClient.invalidateQueries({ queryKey: ["boards"] }),
      ]);
      const savedDraft = adminBoardSettingsDraft(response.data);
      const result = boardSettingsSaveResult(
        targetBoardId,
        boardManagementBoardIdRef.current,
        boardSettingsDraft,
        savedDraft,
        "success",
      );
      if (result.applyDraft) {
        setBoardSettingsDraft(result.nextDraft);
      }
      if (result.notification === "success") {
        Alert.alert("저장 완료", "게시판 운영 설정이 저장되었습니다.");
      }
    } catch {
      const result = boardSettingsSaveResult(
        targetBoardId,
        boardManagementBoardIdRef.current,
        boardSettingsDraft,
        boardSettingsDraft,
        "failure",
      );
      if (result.notification === "failure") {
        Alert.alert("저장 실패", "게시판 설정 입력값을 확인하세요.");
      }
    } finally {
      boardSettingsSavingRef.current = false;
      setBoardSettingsSaving(false);
    }
  };

  const handleCancelBoardForm = () => {
    beginExplicitAdminNavigation();
    const wasCreatingBoard = creatingBoard;
    resetBoardForm();
    if (wasCreatingBoard) {
      const transition = adminBoardCreateCancelTransition();
      setCreatingBoard(transition.creatingBoard);
      setBoardManagementTab(transition.tab);
    }
  };

  const renderBoardFormPanel = () => (
    <Panel>
      <View style={{ gap: 10 }}>
        <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>
          게시판 등록
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field value={boardForm.name} onChangeText={(value) => setBoardForm((current) => ({ ...current, name: value }))} placeholder="게시판 이름" />
          </View>
          <View style={{ flex: 1 }}>
            <Field value={boardForm.slug} onChangeText={(value) => setBoardForm((current) => ({ ...current, slug: value }))} placeholder="slug" />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field value={boardForm.category} onChangeText={(value) => setBoardForm((current) => ({ ...current, category: value }))} placeholder="카테고리" />
          </View>
          <View style={{ flex: 1 }}>
            <Field value={boardForm.sort_order} onChangeText={(value) => setBoardForm((current) => ({ ...current, sort_order: value }))} placeholder="순서" />
          </View>
        </View>
        <Field value={boardForm.description} onChangeText={(value) => setBoardForm((current) => ({ ...current, description: value }))} placeholder="설명" multiline />
        <Text style={{ color: COLORS.muted, fontWeight: "600" }}>게시판 유형</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(BOARD_TYPE_LABELS).map(([value, label]) => (
            <Chip
              key={value}
              active={boardForm.board_type === value}
              label={label}
              onPress={() => setBoardForm((current) => ({ ...current, board_type: value }))}
            />
          ))}
        </View>
        <Text style={{ color: COLORS.muted, fontWeight: "600" }}>권한</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {adminBoardPermissionOptions("read").map((permission) => (
            <Chip key={`read-${permission}`} active={boardForm.read_permission === permission} label={`읽기 ${permission}`} onPress={() => setBoardForm((current) => ({ ...current, read_permission: permission }))} />
          ))}
          {(["user", "admin"] as const).map((permission) => (
            <Chip key={`write-${permission}`} active={boardForm.write_permission === permission} label={`쓰기 ${permission}`} onPress={() => setBoardForm((current) => ({ ...current, write_permission: permission }))} />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <ActionButton
              label={boardForm.allow_anonymous ? "익명 허용" : "실명 게시"}
              onPress={() => setBoardForm((current) => ({ ...current, allow_anonymous: !current.allow_anonymous }))}
              tone={boardForm.allow_anonymous ? "primary" : "outline"}
            />
          </View>
          <View style={{ flex: 1 }}>
            <ActionButton
              label={boardForm.is_active ? "활성" : "숨김"}
              onPress={() => setBoardForm((current) => ({ ...current, is_active: !current.is_active }))}
              tone={boardForm.is_active ? "primary" : "muted"}
            />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <ActionButton icon="save-outline" label="게시판 등록" onPress={handleSaveBoard} />
          </View>
          {creatingBoard ? (
            <View style={{ flex: 1 }}>
              <ActionButton label="취소" onPress={handleCancelBoardForm} tone="outline" />
            </View>
          ) : null}
        </View>
      </View>
    </Panel>
  );

  const currentNoticeEditorTarget = () => ({
    boardId: selectedNoticeBoardIdRef.current ?? -1,
    editingNoticeId: editingNoticeIdRef.current,
    generation: noticeEditRequestRef.current,
  });

  const startNoticeEditorOperation = (kind: NoticeEditorOperation["kind"]) => {
    if (noticePollBusyRef.current) return null;
    const boardId = selectedNoticeBoardIdRef.current;
    if (boardId === null) return null;
    const nextOperation: NoticeEditorOperation = {
      id: ++noticeOperationIdRef.current,
      kind,
      boardId,
      editingNoticeId: editingNoticeIdRef.current,
      generation: noticeEditRequestRef.current,
    };
    const transition = beginNoticeEditorOperation(noticeOperationRef.current, nextOperation);
    if (!transition.accepted) return null;
    noticeOperationRef.current = transition.operation;
    setNoticeOperationKind(kind);
    return transition.operation;
  };

  const finishNoticeEditorOperation = (operation: NoticeEditorOperation) => {
    if (noticeOperationRef.current?.id !== operation.id) return;
    noticeOperationRef.current = null;
    setNoticeOperationKind(null);
  };

  const resetNoticeForm = () => {
    if (noticePollBusyRef.current) return;
    noticeBodySelectionRef.current = null;
    noticeEditRequestRef.current += 1;
    editingNoticeIdRef.current = null;
    setEditingNoticeId(null);
    setEditingNoticeBoardId(null);
    setNoticeForm(emptyNotice);
    setNoticeAttachments([]);
    setNoticeMetadata({});
    setNoticeUploadProgress(0);
    setNoticeUploadIssue(null);
  };

  const handleSelectNoticeBoard = (nextBoardId: number) => {
    if (noticeOperationRef.current || noticePollBusyRef.current) return;
    const transition = noticeEditorBoardTransition(
      selectedNoticeBoardIdRef.current,
      nextBoardId,
      editingNoticeBoardId,
    );
    if (transition.shouldResetEditor) resetNoticeForm();
    selectedNoticeBoardIdRef.current = transition.selectedBoardId;
    setSelectedNoticeBoardId(transition.selectedBoardId);
  };

  const handleEditNotice = async (item: Pick<PostListItem,"id"|"board_id">) => {
    if (noticeOperationRef.current || noticePollBusyRef.current) return false;
    const targetBoardId = item.board_id;
    const requestId = ++noticeEditRequestRef.current;
    try {
      const detail = await postApi.getPostDetail(item.id);
      if (
        noticeEditRequestRef.current !== requestId
        || selectedNoticeBoardIdRef.current !== targetBoardId
      ) return false;
      editingNoticeIdRef.current = item.id;
      setEditingNoticeId(item.id);
      setEditingNoticeBoardId(targetBoardId);
      noticeBodySelectionRef.current = null;
      setNoticeForm({
        inline_images: noticeBodyDraft(noticeBodyBlocks(detail.data.content, detail.data.metadata?.notice_body, detail.data.attachments ?? [])).images,
        poll: noticePollDraft(detail.data.poll),
        poll_revision: detail.data.poll?.revision,
        title: detail.data.title,
        content: detail.data.content,
        category: Platform.OS === "web" ? normalizeNoticeCategoryValue(detail.data.category) === "webinar" ? "event" : normalizeNoticeCategoryValue(detail.data.category) === "all" ? "other" : normalizeNoticeCategoryValue(detail.data.category) : normalizeNoticeCategoryValue(detail.data.category),
        is_pinned: detail.data.is_pinned,
        show_in_council_activity: detail.data.metadata?.show_in_council_activity === true,
        deadline_at: utcApiDateTimeToKoreaInput(detail.data.deadline_at),
      });
      setNoticeAttachments(detail.data.attachments ?? []);
      setNoticeMetadata(detail.data.metadata ?? {});
      return true;
    } catch {
      if (noticeEditRequestRef.current !== requestId) return false;
      Alert.alert("불러오기 실패", "공지 상세를 불러올 수 없습니다.");
      return false;
    }
  };

  const handleUploadNoticeImage = async () => {
    Keyboard.dismiss();
    const operation = startNoticeEditorOperation("upload");
    if (!operation) return;
    try {
      setNoticeUploadProgress(null);
      setNoticeUploadIssue(null);
      const uploaded = await pickAndUploadImages(undefined, {
        retainSuccessfulUploads: true,
        onBatchIssue: (issue) => {
          if (noticeEditorOperationResult(operation, currentNoticeEditorTarget(), "success").apply) {
            setNoticeUploadIssue(noticeImageUploadIssueMessage(issue));
          }
        },
      });
      const result = noticeEditorOperationResult(operation, currentNoticeEditorTarget(), "success");
      if (uploaded.length > 0 && result.apply) {
        setNoticeAttachments((current) => mergeNoticeAttachments(current, uploaded));
      }
    } catch {
      const result = noticeEditorOperationResult(operation, currentNoticeEditorTarget(), "failure");
      if (result.notification === "failure") {
        setNoticeUploadIssue((current) => current ?? "이미지 파일을 다시 선택해주세요.");
      }
    } finally {
      finishNoticeEditorOperation(operation);
    }
  };

  const handleReloadNoticePoll = async (origin: NoticeEditorOperation) => {
    if (!origin.editingNoticeId || !noticeEditorOperationResult(origin, currentNoticeEditorTarget(), "success").apply) return;
    const operation = startNoticeEditorOperation("reload");
    if (!operation || !operation.editingNoticeId) return;
    try {
      const detail = await postApi.getPostDetail(operation.editingNoticeId);
      if (noticeEditorOperationResult(operation, currentNoticeEditorTarget(), "success").apply) {
        setNoticeForm(current => ({...current, poll: noticePollDraft(detail.data.poll), poll_revision: detail.data.poll?.revision}));
      }
    } catch (error) {
      if (noticeEditorOperationResult(operation, currentNoticeEditorTarget(), "failure").notification) {
        Alert.alert("불러오기 실패", noticeSaveIssue(error).message);
      }
    } finally { finishNoticeEditorOperation(operation); }
  };

  const handleSaveNotice = async () => {
    if (noticePollBusy) return;
    if (!selectedNoticeBoardId) {
      Alert.alert("공지 확인", "공지 게시판을 선택하세요.");
      return;
    }
    if (editingNoticeId && editingNoticeBoardId !== selectedNoticeBoardId) {
      Alert.alert("공지 확인", "다른 공지 게시판의 수정 내용입니다. 공지를 다시 선택해주세요.");
      return;
    }
    if (!noticeForm.title.trim() || !noticeForm.content.trim()) {
      Alert.alert("공지 확인", "제목과 내용을 입력하세요.");
      return;
    }
    if (noticeForm.show_in_council_activity && !noticeAttachments.some((attachment) => attachment.content_type.startsWith("image/"))) {
      Alert.alert("원우회 활동내역", "활동내역에 표시할 공지에는 사진을 1장 이상 첨부하세요.");
      return;
    }

    let poll;
    try {poll = noticePollPayload(noticeForm.poll ?? null);}
    catch (error) {Alert.alert("투표 확인", error instanceof Error ? error.message : "투표 정보를 확인해 주세요."); return;}
    const deadline = noticeForm.deadline_at ? koreaDateTimeInputToUtcISOString(noticeForm.deadline_at) : null;
    if (noticeForm.deadline_at && !deadline) {
      Alert.alert("마감 확인", "신청·접수 마감 날짜와 시간을 확인해주세요.");
      return;
    }
    const body = noticeBodyDraft(noticeBodyBlocks(noticeForm.content, {version: 1, images: noticeForm.inline_images ?? []}, noticeAttachments), true);
    const operation = startNoticeEditorOperation("save");
    if (!operation) return;

    const payload = {
      poll,
      poll_revision: noticeForm.poll?.revision ?? noticeForm.poll_revision,
      title: noticeForm.title.trim(),
      content: body.content,
      category: cleanOptional(noticeForm.category),
      is_anonymous: false,
      attachment_ids: noticeAttachments.map((attachment) => attachment.id),
      metadata: {
        ...noticeMetadata,
        notice_body: {version: 1, images: body.images},
        show_in_council_activity: noticeForm.show_in_council_activity,
      },
      deadline_at: deadline,
    };

    try {
      const outcome = await runAdminMutation({
        primary: async () => {
          if (operation.editingNoticeId) {
            await postApi.updatePost(operation.editingNoticeId, payload);
            return operation.editingNoticeId;
          }
          const response = await postApi.createPost(operation.boardId, payload);
          return response.data.id;
        },
        secondary: async (postId) => {
          if (operation.editingNoticeId || noticeForm.is_pinned) {
            await postApi.setPin(postId, noticeForm.is_pinned);
          }
        },
        afterPrimarySuccess: async (postId) => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["admin-notices"] }),
            queryClient.invalidateQueries({ queryKey: ["post", postId] }),
            queryClient.invalidateQueries({ queryKey: ["notice-poll"] }),
            queryClient.invalidateQueries({ queryKey: ["notice-poll-participants"] }),
            invalidatePostMutationCaches(queryClient, postMutationCacheTargets(operation.boardId, selectedNoticeBoard)),
          ]);
        },
      });
      const result = noticeEditorOperationResult(
        operation,
        currentNoticeEditorTarget(),
        outcome.status === "primary_failure" ? "failure" : "success",
      );
      if (outcome.status === "primary_failure") {
        if (result.notification === "failure") {
          const issue = noticeSaveIssue(outcome.primaryError);
          Alert.alert("저장 실패", issue.message, issue.reloadPoll && operation.editingNoticeId ? [
            {text: "계속 수정", style: "cancel"},
            {text: "최신 투표 불러오기", onPress: () => {
              if (!noticeEditorOperationResult(operation, currentNoticeEditorTarget(), "success").apply) return;
              Alert.alert("투표 다시 불러오기", "투표의 미저장 수정·추가·삭제 내용은 최신 투표로 교체됩니다. 공지 제목·본문·마감·첨부 이미지는 유지됩니다. 불러올까요?", [
                {text: "취소", style: "cancel"}, {text: "불러오기", onPress: () => {void handleReloadNoticePoll(operation);}},
              ]);
            }},
          ] : undefined);
        }
        return;
      }
      if (result.apply) resetNoticeForm();
      if (result.notification === "success") {
        if (outcome.status === "partial") {
          Alert.alert("부분 저장", "공지사항은 저장했지만 고정 상태를 변경하지 못했습니다.");
        } else {
          setSaveSuccessFeedback(adminSaveFeedback("notice", operation.editingNoticeId ? "update" : "create"));
        }
      }
    } finally {
      finishNoticeEditorOperation(operation);
    }
  };

  const handlePinNotice = async (item: PostListItem) => {
    try {
      await postApi.setPin(item.id, !item.is_pinned);
      const board = boards.find((candidate) => candidate.id === item.board_id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-notices"] }),
        invalidatePostMutationCaches(queryClient, postMutationCacheTargets(item.board_id, board)),
      ]);
    } catch {
      Alert.alert("처리 실패", "공지 고정 상태를 변경할 수 없습니다.");
    }
  };

  const handleDeleteNotice = (item: PostListItem) => {
    Alert.alert("공지 삭제", "이 공지사항을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await postApi.deletePost(item.id);
            const board = boards.find((candidate) => candidate.id === item.board_id);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["admin-notices"] }),
              invalidatePostMutationCaches(queryClient, postMutationCacheTargets(item.board_id, board)),
            ]);
          } catch {
            Alert.alert("삭제 실패", "공지사항을 삭제할 수 없습니다.");
          }
        },
      },
    ]);
  };

  const updateCurrentCouncil = (cardIndex: number, patch: Partial<CurrentCouncilFormData>) => {
    setCurrentCouncils((current) => current.map((item, index) => index === cardIndex ? { ...item, ...patch } : item));
  };

  const updateCurrentCouncilMember = (cardIndex: number, memberIndex: number, patch: Partial<ExecutiveFormMember>) => {
    setCurrentCouncils((current) => current.map((card, index) => index === cardIndex
      ? { ...card, members: card.members.map((member, itemIndex) => itemIndex === memberIndex ? { ...member, ...patch } : member) }
      : card));
  };

  const handleUploadCurrentCouncilImage = async (cardIndex: number, memberIndex?: number) => {
    if (currentCouncilUploading) return;
    try {
      setCurrentCouncilUploading({ cardIndex, memberIndex });
      if (memberIndex === undefined) {
        const uploaded = await pickAndUploadImages();
        const addedUrls = uploaded.flatMap((item) => item.url ? [item.url] : []);
        if (addedUrls.length > 0) {
          setCurrentCouncils((current) => current.map((card, index) => index === cardIndex
            ? { ...card, ...appendedIntroGalleryPatch(card, addedUrls) }
            : card));
        }
      } else {
        const uploaded = await pickAndUploadContentImage();
        if (uploaded?.url) updateCurrentCouncilMember(cardIndex, memberIndex, { image_url: uploaded.url });
      }
    } catch {
      Alert.alert("사진 업로드 실패", "원우회 소개 이미지를 다시 선택해주세요.");
    } finally {
      setCurrentCouncilUploading(null);
    }
  };

  const handleSaveExecutives = async () => {
    if (!executivesBoard) {
      Alert.alert("임원진 저장", "gsa-executives 게시판을 찾을 수 없습니다.");
      return;
    }
    const normalized = currentCouncils.slice(0, 1).map((card) => {
      const gallery = councilGalleryFields({ photoUrls: card.photo_urls, bannerImageUrl: card.banner_image_url });
      return {
        title: card.title.trim(),
        greeting: card.greeting.trim(),
        intro: card.intro.trim(),
        banner_image_url: gallery.banner_image_url,
        photo_urls: gallery.photo_urls,
        members: card.members.map((member) => ({
          name: member.name.trim(), cohort: member.cohort.trim(), role: member.role.trim(),
          image_url: member.image_url.trim(), intro: member.intro.trim(),
        })),
      };
    });
    if (!canSaveCurrentCouncilCards(normalized)) {
      Alert.alert("원우회 소개 저장", "원우회 이름·소개글과 모든 임원의 이름·기수·직책을 입력하세요.");
      return;
    }
    try {
      setExecutivesSaving(true);
      await boardApi.updateAdminBoard(executivesBoard.id, {
        metadata: withCurrentCouncilMetadata(executivesBoard.metadata, normalized),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-boards"] }),
        queryClient.invalidateQueries({ queryKey: ["boards"] }),
      ]);
      Alert.alert("저장 완료", "원우회 소개와 임원 카드가 저장되었습니다.");
    } catch {
      Alert.alert("저장 실패", "임원진 소개를 저장할 수 없습니다.");
    } finally {
      setExecutivesSaving(false);
    }
  };

  const updateCohortLeader = (index: number, patch: Partial<CohortLeaderForm>) => {
    setCohortLeaders((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const updateCohortLeaderMember = (cardIndex: number, memberIndex: number, patch: Partial<ExecutiveFormMember>) => {
    setCohortLeaders((current) => current.map((card, index) => index === cardIndex
      ? { ...card, members: card.members.map((member, itemIndex) => itemIndex === memberIndex ? { ...member, ...patch } : member) }
      : card));
  };

  const handleUploadCohortLeaderImage = async (cardIndex: number, memberIndex?: number) => {
    if (cohortLeaderUploading) return;
    try {
      setCohortLeaderUploading({ cardIndex, memberIndex });
      if (memberIndex === undefined) {
        const uploaded = await pickAndUploadImages();
        const addedUrls = uploaded.flatMap((item) => item.url ? [item.url] : []);
        if (addedUrls.length > 0) {
          setCohortLeaders((current) => current.map((card, index) => index === cardIndex
            ? { ...card, ...appendedIntroGalleryPatch(card, addedUrls) }
            : card));
        }
      } else {
        const uploaded = await pickAndUploadContentImage();
        if (uploaded?.url) updateCohortLeaderMember(cardIndex, memberIndex, { image_url: uploaded.url });
      }
    } catch {
      Alert.alert("사진 업로드 실패", "기장단 이미지를 다시 선택해주세요.");
    } finally {
      setCohortLeaderUploading(null);
    }
  };

  const handleSaveCohortLeaders = async () => {
    if (!cohortLeadersBoard) {
      Alert.alert("기장단 저장", "gsa-cohort-leaders 게시판을 찾을 수 없습니다.");
      return;
    }
    const normalized = cohortLeaders.map((item) => {
      const gallery = councilGalleryFields({ photoUrls: item.photo_urls, bannerImageUrl: item.banner_image_url });
      return {
        cohort: item.cohort.trim().replace(/기$/, ""),
        greeting: item.greeting.trim(),
        intro: item.intro.trim(),
        banner_image_url: gallery.banner_image_url,
        photo_urls: gallery.photo_urls,
        members: item.members.map((member) => ({
          name: member.name.trim(), cohort: member.cohort.trim(), role: member.role.trim(),
          image_url: member.image_url.trim(), intro: member.intro.trim(),
        })),
      };
    });
    if (!canSaveCohortLeaderCards(normalized)) {
      Alert.alert("기장단 저장", "각 기수의 기수·소개글과 모든 임원의 이름·기수·직책을 입력하세요.");
      return;
    }
    try {
      setCohortLeadersSaving(true);
      await boardApi.updateAdminBoard(cohortLeadersBoard.id, {
        metadata: withCohortLeaderMetadata(cohortLeadersBoard.metadata, normalized),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-boards"] }),
        queryClient.invalidateQueries({ queryKey: ["boards"] }),
      ]);
      Alert.alert("저장 완료", "기수별 기장단 소개가 저장되었습니다.");
    } catch {
      Alert.alert("저장 실패", "기장단 소개를 저장할 수 없습니다.");
    } finally {
      setCohortLeadersSaving(false);
    }
  };

  const updatePastCouncil = (index: number, patch: Partial<PastCouncilForm>) => {
    setPastCouncils((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const updatePastCouncilMember = (cardIndex: number, memberIndex: number, patch: Partial<ExecutiveFormMember>) => {
    setPastCouncils((current) => current.map((card, index) => index === cardIndex
      ? { ...card, members: card.members.map((member, itemIndex) => itemIndex === memberIndex ? { ...member, ...patch } : member) }
      : card));
  };

  const handleUploadPastCouncilImage = async (cardIndex: number, memberIndex?: number) => {
    if (pastCouncilUploading) return;
    try {
      setPastCouncilUploading({ cardIndex, memberIndex });
      if (memberIndex === undefined) {
        const uploaded = await pickAndUploadImages();
        const addedUrls = uploaded.flatMap((item) => item.url ? [item.url] : []);
        if (addedUrls.length > 0) {
          setPastCouncils((current) => current.map((card, index) => index === cardIndex
            ? { ...card, ...appendedIntroGalleryPatch(card, addedUrls) }
            : card));
        }
      } else {
        const uploaded = await pickAndUploadContentImage();
        if (uploaded?.url) updatePastCouncilMember(cardIndex, memberIndex, { image_url: uploaded.url });
      }
    } catch {
      Alert.alert("사진 업로드 실패", "역대 원우회 이미지를 다시 선택해주세요.");
    } finally {
      setPastCouncilUploading(null);
    }
  };

  const handleSavePastCouncils = async () => {
    if (!pastCouncilsBoard) {
      Alert.alert("역대 원우회 저장", "gsa-past-councils 게시판을 찾을 수 없습니다.");
      return;
    }
    const normalized = pastCouncils.map((item) => {
      const gallery = councilGalleryFields({ photoUrls: item.photo_urls, bannerImageUrl: item.banner_image_url });
      return {
        cohort: item.cohort.trim().replace(/기$/, ""),
        greeting: item.greeting.trim(),
        intro: item.intro.trim(),
        activities: parsePastCouncilActivitiesForStorage(item.activities_text),
        banner_image_url: gallery.banner_image_url,
        photo_urls: gallery.photo_urls,
        members: item.members.map((member) => ({
          name: member.name.trim(), cohort: member.cohort.trim(), role: member.role.trim(),
          image_url: member.image_url.trim(), intro: member.intro.trim(),
        })),
      };
    });
    if (!canSavePastCouncilCards(normalized)) {
      Alert.alert("역대 원우회 저장", "각 원우회의 대수·소개글과 모든 임원의 이름·기수·직책을 입력하세요.");
      return;
    }
    try {
      setPastCouncilsSaving(true);
      await boardApi.updateAdminBoard(pastCouncilsBoard.id, { metadata: withPastCouncilMetadata(pastCouncilsBoard.metadata, normalized) });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["admin-boards"] }), queryClient.invalidateQueries({ queryKey: ["boards"] })]);
      Alert.alert("저장 완료", "역대 원우회 정보가 저장되었습니다.");
    } catch {
      Alert.alert("저장 실패", "역대 원우회 정보를 저장할 수 없습니다.");
    } finally {
      setPastCouncilsSaving(false);
    }
  };

  const handleSaveExternalLink = async () => {
    if (
      !selectedManagedBoard
      || managedContentKind !== "external-link"
      || externalLinkSavingRef.current
    ) return;

    const validationError = validateExternalHttpUrl(externalLinkDraft);
    if (validationError) {
      setExternalLinkError(validationError);
      return;
    }

    const targetBoardId = selectedManagedBoard.id;
    const targetDraft = externalLinkDraft.trim();
    try {
      externalLinkSavingRef.current = true;
      setExternalLinkSaving(true);
      setExternalLinkError(null);
      await boardApi.updateAdminBoard(targetBoardId, {
        metadata: externalLinkMetadata(selectedManagedBoard, targetDraft),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-boards"] }),
        queryClient.invalidateQueries({ queryKey: ["boards"] }),
      ]);
      if (externalLinkBoardIdRef.current === targetBoardId) {
        setExternalLinkDraftState((current) => externalLinkSaveTransition(current, targetBoardId, targetDraft));
        Alert.alert("저장 완료", "외부 링크가 저장되었습니다.");
      }
    } catch {
      if (externalLinkBoardIdRef.current === targetBoardId) {
        setExternalLinkError("외부 링크를 저장하지 못했습니다. 입력값을 유지했으니 다시 저장해주세요.");
      }
    } finally {
      externalLinkSavingRef.current = false;
      setExternalLinkSaving(false);
    }
  };

  const handleReplacePostRepresentativeImage = async (item: PostListItem) => {
    const itemBoard = boards.find((board) => board.id === item.board_id);
    if (!adminBoardContentControl(itemBoard).canReplaceRepresentativeImage) {
      Alert.alert("대표 이미지 변경", "동아리 또는 네트워킹 안내 게시글에서만 변경할 수 있습니다.");
      return;
    }
    if (replacingRepresentativeImagePostId !== null) return;

    try {
      setReplacingRepresentativeImagePostId(item.id);
      const replacement = await pickAndUploadContentImage();
      if (!replacement) return;

      await postApi.replaceRepresentativeImage(item.id, replacement.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-posts"] }),
        invalidatePostMutationCaches(queryClient, postMutationCacheTargets(item.board_id, itemBoard)),
        queryClient.invalidateQueries({ queryKey: ["post", item.id] }),
      ]);
      Alert.alert("변경 완료", "대표 이미지가 변경되었습니다.");
    } catch {
      Alert.alert("변경 실패", "대표 이미지를 변경할 수 없습니다. 이미지 파일과 게시글 상태를 확인해주세요.");
    } finally {
      setReplacingRepresentativeImagePostId(null);
    }
  };

  const handlePinAdminPost = async (item: PostListItem) => {
    try {
      await postApi.setPin(item.id, !item.is_pinned);
      const board = boards.find((candidate) => candidate.id === item.board_id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-posts"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-notices"] }),
        invalidatePostMutationCaches(queryClient, postMutationCacheTargets(item.board_id, board)),
      ]);
    } catch {
      Alert.alert("처리 실패", "게시글 고정 상태를 변경할 수 없습니다.");
    }
  };

  const handleDeleteAdminPost = (item: PostListItem) => {
    if (adminPostDeleting) return;
    setAdminPostDeleteError(null);
    setPendingAdminPostDelete(item);
  };

  const closeAdminPostDeleteConfirm = () => {
    if (adminPostDeleting) return;
    setPendingAdminPostDelete(null);
    setAdminPostDeleteError(null);
  };

  const confirmAdminPostDelete = async () => {
    if (!pendingAdminPostDelete || adminPostDeleting) return;
    const item = pendingAdminPostDelete;
    setAdminPostDeleting(true);
    setAdminPostDeleteError(null);
    try {
      const board = boards.find((candidate) => candidate.id === item.board_id);
      const nextPage = await runAdminPostDelete({
        postId: item.id,
        currentPage: adminPostPage,
        currentItemCount: adminPosts.length,
        deletePost: async (postId) => { await postApi.deletePost(postId); },
        afterDelete: async () => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["admin-posts"] }),
            queryClient.invalidateQueries({ queryKey: ["admin-notices"] }),
            invalidatePostMutationCaches(queryClient, postMutationCacheTargets(item.board_id, board)),
          ]);
        },
      });
      setAdminPostPagination({ contextKey: adminPostPaginationContextKey, page: nextPage });
      setPendingAdminPostDelete(null);
    } catch {
      setAdminPostDeleteError("게시글을 삭제할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setAdminPostDeleting(false);
    }
  };

  const handleReplaceNoticeImage = async (attachmentId: number) => {
    const operation = startNoticeEditorOperation("upload");
    if (!operation) return;
    try {
      setNoticeUploadProgress(0);
      setNoticeUploadIssue(null);
      const replacement = await pickAndUploadContentImage((progress) => {
        if (noticeEditorOperationResult(operation, currentNoticeEditorTarget(), "success").apply) {
          setNoticeUploadProgress(progress);
        }
      });
      const result = noticeEditorOperationResult(operation, currentNoticeEditorTarget(), "success");
      if (replacement && result.apply) {
        setNoticeForm(current => {
          const body = noticeBodyDraft(replaceNoticeBodyImage(noticeBodyBlocks(current.content, {version: 1, images: current.inline_images ?? []}, noticeAttachments), attachmentId, replacement.id));
          return {...current, content: body.content, inline_images: body.images};
        });
        setNoticeAttachments((current) => replaceNoticeAttachment(current, attachmentId, replacement));
      }
    } catch {
      const result = noticeEditorOperationResult(operation, currentNoticeEditorTarget(), "failure");
      if (result.notification === "failure") {
        setNoticeUploadIssue("이미지 변경에 실패했습니다. 다시 선택해주세요.");
      }
    } finally {
      finishNoticeEditorOperation(operation);
    }
  };

  const handleReportStatus = async (report: AdminReportItem, status: ReportStatus) => {
    try {
      await reportApi.updateAdminReport(report.id, { status });
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    } catch {
      Alert.alert("처리 실패", "신고 상태를 변경할 수 없습니다.");
    }
  };

  const handleDeleteTarget = (report: AdminReportItem) => {
    const targetLabel = report.target_type === "post" ? "게시글" : "댓글";
    Alert.alert(`${targetLabel} 삭제`, `신고된 ${targetLabel}을 삭제하고 처리 완료로 표시할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          const outcome = await runAdminMutation({
            primary: async () => {
              if (report.target_type === "post") {
                await postApi.deletePost(report.target.post_id ?? report.target_id);
              } else {
                await commentApi.deleteComment(report.target_id);
              }
            },
            secondary: async () => {
              await reportApi.updateAdminReport(report.id, { status: "resolved" });
            },
            afterPrimarySuccess: async () => {
              const invalidations = [queryClient.invalidateQueries({ queryKey: ["admin-reports"] })];
              if (report.target.board_id) {
                const board = boards.find((candidate) => candidate.id === report.target.board_id);
                invalidations.push(invalidatePostMutationCaches(
                  queryClient,
                  postMutationCacheTargets(report.target.board_id, board, {
                    refreshHomeNotices: report.target_type === "comment" ? false : undefined,
                  }),
                ));
              }
              await Promise.all(invalidations);
            },
          });
          if (outcome.status === "primary_failure") {
            Alert.alert("삭제 실패", `신고된 ${targetLabel}을 삭제할 수 없습니다.`);
          } else if (outcome.status === "partial") {
            Alert.alert("부분 처리", `${targetLabel}은 삭제했지만 신고 상태를 처리 완료로 변경하지 못했습니다.`);
          } else {
            Alert.alert("처리 완료", `${targetLabel}을 삭제했습니다.`);
          }
        },
      },
    ]);
  };

  const handleUserRoleToggle = (item: AdminUserItem) => {
    const nextRole = item.role === "admin" ? "user" : "admin";
    Alert.alert("권한 변경", `${item.nickname}님을 ${USER_ROLE_LABELS[nextRole]} 권한으로 변경할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "변경",
        onPress: async () => {
          try {
            await adminApi.updateUser(item.id, { role: nextRole });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
          } catch {
            Alert.alert("변경 실패", "회원 권한을 변경할 수 없습니다.");
          }
        },
      },
    ]);
  };

  const handleUserActiveToggle = (item: AdminUserItem) => {
    const nextActive = !item.is_active;
    Alert.alert("회원 상태 변경", `${item.nickname}님 계정을 ${nextActive ? "복구" : "비활성화"}할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: nextActive ? "복구" : "비활성화",
        style: nextActive ? "default" : "destructive",
        onPress: async () => {
          try {
            await adminApi.updateUser(item.id, { is_active: nextActive });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
          } catch {
            Alert.alert("변경 실패", "회원 상태를 변경할 수 없습니다.");
          }
        },
      },
    ]);
  };

  const handleUserEligibilityChange = async (
    item: AdminUserItem,
    payload: Partial<Pick<AdminUserItem, "enrollment_status">>
  ) => {
    try {
      await adminApi.updateUser(item.id, payload);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch {
      Alert.alert("변경 실패", "회원의 재학 상태를 변경할 수 없습니다.");
    }
  };

  const resetFAQForm = () => {
    setEditingFAQId(null);
    setFAQForm(emptyFAQ);
  };

  const handleEditFAQ = (item: FAQItem) => {
    setEditingFAQId(item.id);
    setFAQForm({
      question: item.question,
      answer: item.answer,
      category: item.category ?? "general",
      sort_order: String(item.sort_order ?? 0),
    });
  };

  const handleSaveFAQ = async () => {
    const question = faqForm.question.trim();
    const answer = faqForm.answer.trim();
    if (!question || !answer) {
      Alert.alert("FAQ 확인", "질문과 답변을 입력하세요.");
      return;
    }

    const payload = {
      question,
      answer,
      category: faqForm.category.trim() || undefined,
      sort_order: parseSort(faqForm.sort_order),
      is_active: true,
    };

    try {
      if (editingFAQId) {
        await faqApi.updateFAQ(editingFAQId, payload);
      } else {
        await faqApi.createFAQ(payload);
      }
      resetFAQForm();
      queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
      Alert.alert("저장 완료", "FAQ가 저장되었습니다.");
    } catch {
      Alert.alert("저장 실패", "FAQ 입력 정보를 확인하세요.");
    }
  };

  const handleDeleteFAQ = (item: FAQItem) => {
    Alert.alert("FAQ 숨김", "이 FAQ를 사용자 화면에서 숨길까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "숨김",
        style: "destructive",
        onPress: async () => {
          try {
            await faqApi.deleteFAQ(item.id);
            queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
            queryClient.invalidateQueries({ queryKey: ["faqs"] });
          } catch {
            Alert.alert("처리 실패", "FAQ를 숨길 수 없습니다.");
          }
        },
      },
    ]);
  };

  const onSubmitEvent = async (values: EventForm) => {
    const eventUpdateId = editEventQuery.data?.data?.id ?? null;
    if (editEventId && !eventUpdateId) {
      Alert.alert("일정 확인", "이미 삭제되었거나 없는 일정입니다. 목록에서 다시 선택해주세요.");
      openManagedBoard("academic-calendar");
      reset(emptyEvent);
      router.replace({ pathname: Platform.OS === "web" ? "/admin/boards" : "/admin", params: { section: "boardManagement" } } as never);
      return;
    }

    const startAt = koreaDateTimeInputToUtcISOString(values.start_at);
    const endAt = values.end_at ? koreaDateTimeInputToUtcISOString(values.end_at) : null;
    if (!startAt || (values.end_at && !endAt)) {
      Alert.alert("일정 시간 확인", "날짜를 선택하고 시간은 HH:mm 형식으로 입력해주세요.");
      return;
    }

    const payload = {
      title: values.title,
      category: eventCategoryValueForSubmit(eventDisplayCategory(values.category)),
      start_at: startAt,
      end_at: endAt ?? undefined,
      location: cleanOptional(values.location ?? ""),
      description: cleanOptional(values.description ?? ""),
    };

    try {
      if (eventUpdateId) {
        await eventApi.updateEvent(eventUpdateId, payload);
        router.replace({ pathname: Platform.OS === "web" ? "/admin/boards" : "/admin", params: { section: "boardManagement" } } as never);
      } else {
        await eventApi.createEvent(payload);
      }
      reset(emptyEvent);
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    } catch {
      Alert.alert("저장 실패", "일정 입력 정보를 확인하세요.");
    }
  };

  const handleEditEvent = (event: EventItem) => {
    openManagedBoard("academic-calendar");
    router.push({ pathname: Platform.OS === "web" ? "/admin/boards" : "/admin", params: { section: "boardManagement", editEventId: String(event.id) } } as never);
  };

  const deleteEventFromList = async (event: EventItem) => {
    try {
      await eventApi.deleteEvent(event.id);
      if (editEventId === event.id) {
        reset(emptyEvent);
        router.replace({ pathname: Platform.OS === "web" ? "/admin/boards" : "/admin", params: { section: "boardManagement" } } as never);
      }
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      Alert.alert("삭제 완료", "일정이 삭제되었습니다.");
    } catch {
      Alert.alert("삭제 실패", "이미 삭제되었거나 일정을 삭제할 수 없습니다.");
    }
  };

  const handleDeleteEventFromList = (event: EventItem) => {
    if (Platform.OS === "web") {
      const ok = window.confirm(`"${event.title}" 일정을 삭제할까요?`);
      if (ok) {
        void deleteEventFromList(event);
      }
      return;
    }

    Alert.alert("일정 삭제", `"${event.title}" 일정을 삭제할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => void deleteEventFromList(event),
      },
    ]);
  };

  const handleEditActivityHistoryNotice = (item: PostListItem) => {
    if (noticeOperationRef.current) return;
    beginExplicitAdminNavigation();
    if (!syncExternalLinkNavigationBoardId(item.board_id)) return;
    resetNoticeForm();
    selectedNoticeBoardIdRef.current = item.board_id;
    setSelectedNoticeBoardId(item.board_id);
    boardManagementBoardIdRef.current = item.board_id;
    setBoardManagementScope("notices");
    setBoardManagementBoardId(item.board_id);
    setBoardManagementTab("content");
    setCreatingBoard(false);
    void handleEditNotice(item);
  };

  const renderNoticeContent = (editorOnly = false) => (
    <View style={{ gap: 12 }}>
      <Panel>
        <View style={{ gap: 10 }}>
          <BoardSectionTitle style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>
            {editingNoticeId ? "공지사항 수정" : "공지사항 등록"}
          </BoardSectionTitle>
          {!isManagedContentActive ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {noticeBoards.map((board) => (
                <Chip
                  key={board.id}
                  active={selectedNoticeBoardId === board.id}
                  label={board.name}
                  onPress={noticeOperationPending ? undefined : () => handleSelectNoticeBoard(board.id)}
                />
              ))}
            </ScrollView>
          ) : null}
          <Field value={noticeForm.title} onChangeText={(value) => setNoticeForm((current) => ({ ...current, title: value }))} placeholder="공지 제목" editable={!noticeOperationPending} />
          <AdminNoticeBodyEditor key={`${selectedNoticeBoardId}:${editingNoticeId}:${noticeEditRequestRef.current}`}
            content={noticeForm.content} images={noticeForm.inline_images ?? []} attachments={noticeAttachments} disabled={noticeOperationPending}
            onSelectionChange={selection => {noticeBodySelectionRef.current = selection;}}
            onChange={body => {
              if (!noticeOperationPending) setNoticeForm(current => ({...current, content: body.content, inline_images: body.images}));
            }} />
          {Platform.OS === "web" ? <AdminNoticePollEditor key={`${user?.id}:${selectedNoticeBoardId}:${editingNoticeId}:${noticeEditRequestRef.current}`}
            sessionKey={`${user?.id}:${selectedNoticeBoardId}:${noticeEditRequestRef.current}`} value={noticeForm.poll ?? null} postId={editingNoticeId}
            onChange={poll => setNoticeForm(current => ({...current, poll}))} disabled={noticeOperationPending} onBusy={handleNoticePollBusy} /> : null}
          <AdminBannerSchedule label="신청·접수 마감" value={noticeForm.deadline_at} fallbackTime="18:00" disabled={noticeOperationPending}
            onChange={value => {if (!noticeOperationPending) setNoticeForm(current => ({...current, deadline_at: value}));}} />
          {noticeForm.poll ? <Text style={{fontSize:13,color:COLORS.muted,lineHeight:21}}>신청·접수 마감은 투표 종료 날짜가 아닙니다. 날짜가 지나도 투표는 열려 있으며, 관리자가 ‘투표 종료’를 눌러야 종료됩니다.</Text> : null}
          <View style={{ gap: 8 }}>
            <Text style={{ color: COLORS.text, fontWeight: "600" }}>분류</Text>
            <BoardFilterRow>{NOTICE_CATEGORY_OPTIONS.filter(option => Platform.OS !== "web" || !["all", "webinar"].includes(option.value)).map((option) => (
                <Chip
                  key={option.value}
                  variant="filter"
                  active={noticeForm.category === option.value}
                  label={option.label}
                  onPress={noticeOperationPending ? undefined : () => setNoticeForm((current) => ({ ...current, category: option.value }))}
                />
              ))}
            </BoardFilterRow>
          </View>
          <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, padding: 12, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.text, fontWeight: "600" }}>공지 이미지</Text>
                <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 3 }}>
                  첨부한 이미지는 본문 안에 넣거나, 본문 아래에 표시할 수 있습니다.
                </Text>
              </View>
              <ActionButton
                icon="image-outline"
                label={noticeOperationKind === "upload" ? noticeUploadButtonLabel(noticeUploadProgress) : "이미지 첨부"}
                onPress={handleUploadNoticeImage}
                tone={noticeAttachments.length > 0 ? "outline" : "primary"}
                disabled={noticeOperationPending}
              />
            </View>
            {noticeAttachments.length === 0 ? (
              <Text style={{ color: COLORS.muted, fontSize: 13 }}>아직 첨부된 이미지가 없습니다.</Text>
            ) : null}
            {noticeAttachments.map((attachment) => {
              const url = mediaUrl(attachment.url);
              const isImage = attachment.content_type?.startsWith("image/");
              return (
                <View
                  key={attachment.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    borderRadius: RADIUS.button,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    backgroundColor: COLORS.surface,
                    padding: 10,
                  }}
                >
                  {isImage && url ? (
                    <MediaImage media={attachment} style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: COLORS.primary50 }} />
                  ) : (
                    <View style={{ width: 56, height: 56, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary50 }}>
                      <Ionicons name="document-attach-outline" size={22} color={COLORS.primary} />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: COLORS.text, fontWeight: "600" }} numberOfLines={1}>
                      {attachment.original_filename}
                    </Text>
                    <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>
                      {Math.ceil((attachment.file_size ?? 0) / 1024)} KB
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {isImage ? <ActionButton label={noticeForm.inline_images?.some(image => image.media_id === attachment.id) ? "본문에 사용 중" : "본문에 넣기"}
                      tone="outline" disabled={noticeOperationPending || noticeForm.inline_images?.some(image => image.media_id === attachment.id)}
                      onPress={() => {
                        if (noticeOperationPending) return;
                        setNoticeForm(current => {
                          const body = noticeBodyDraft(insertNoticeBodyImage(noticeBodyBlocks(current.content, {version: 1, images: current.inline_images ?? []}, noticeAttachments), attachment.id, noticeBodySelectionRef.current));
                          noticeBodySelectionRef.current = null;
                          return {...current, content: body.content, inline_images: body.images};
                        });
                      }} /> : null}
                    {isImage ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${attachment.original_filename} 이미지 변경`}
                        disabled={noticeOperationPending}
                        hitSlop={8}
                        onPress={() => void handleReplaceNoticeImage(attachment.id)}
                      >
                        <Ionicons name="create-outline" size={22} color={COLORS.subtle} />
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${attachment.original_filename} 삭제`}
                      disabled={noticeOperationPending}
                      hitSlop={8}
                      onPress={() => {
                        if (noticeOperationPending) return;
                        setNoticeForm(current => {
                          const body = noticeBodyDraft(removeNoticeBodyImage(noticeBodyBlocks(current.content, {version: 1, images: current.inline_images ?? []}, noticeAttachments), attachment.id));
                          noticeBodySelectionRef.current = null;
                          return {...current, content: body.content, inline_images: body.images};
                        });
                        setNoticeAttachments(current => current.filter(item => item.id !== attachment.id));
                      }}
                    >
                      <Ionicons name="close-circle" size={22} color={COLORS.subtle} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
            <NoticeImageUploadFeedback message={noticeUploadIssue} />
          </View>
          <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: noticeForm.show_in_council_activity ? COLORS.primary : COLORS.border, backgroundColor: noticeForm.show_in_council_activity ? COLORS.primary50 : COLORS.surfaceAlt, padding: 12, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.text, fontWeight: "600" }}>원우회 활동내역 연동</Text>
                <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 3 }}>
                  이 공지의 사진과 본문을 원우회 활동내역 목록·상세에도 표시합니다.
                </Text>
              </View>
              <ActionButton
                icon={noticeForm.show_in_council_activity ? "checkmark-circle" : "ellipse-outline"}
                label={noticeForm.show_in_council_activity ? "연동함" : "연동 안 함"}
                onPress={() => setNoticeForm((current) => ({ ...current, show_in_council_activity: !current.show_in_council_activity }))}
                tone={noticeForm.show_in_council_activity ? "primary" : "outline"}
                disabled={noticeOperationPending}
              />
            </View>
            {noticeForm.show_in_council_activity && noticeAttachments.length === 0 ? (
              <Text style={{ color: "#B45309", fontSize: 12, fontWeight: "600" }}>연동하려면 공지 이미지를 1장 이상 첨부해야 합니다.</Text>
            ) : null}
          </View>
          {Platform.OS === "web" ? <AdminNoticePreview notice={noticeForm} attachments={noticeAttachments} disabled={noticeOperationPending} /> : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ActionButton
                label={noticeForm.is_pinned ? "상단 고정" : "일반 공지"}
                icon="pin-outline"
                onPress={() => setNoticeForm((current) => ({ ...current, is_pinned: !current.is_pinned }))}
                tone={noticeForm.is_pinned ? "primary" : "outline"}
                disabled={noticeOperationPending}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton icon="save-outline" label={noticeOperationKind === "save" ? "저장 중" : noticeOperationKind === "reload" ? "불러오는 중" : editingNoticeId ? "공지 저장" : "공지 등록"} onPress={handleSaveNotice} disabled={noticeOperationPending} />
            </View>
          </View>
          {editingNoticeId ? <ActionButton label="수정 취소" onPress={resetNoticeForm} tone="outline" disabled={noticeOperationPending} /> : null}
        </View>
      </Panel>
      {!editorOnly ? <>
      <BoardSectionTitle style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>
        {selectedNoticeBoard?.name ?? "공지 게시판"} 목록
      </BoardSectionTitle>
      <AdminBoardContentQueryState
        isLoading={activeNoticePostsQuery.isLoading}
        isError={activeNoticePostsQuery.isError}
        isEmpty={noticePosts.length === 0}
        emptyMessage="표시할 공지사항이 없습니다."
        onRetry={() => void activeNoticePostsQuery.refetch()}
      />
      {noticePosts.map((item) => (
        <NoticeCard key={item.id} item={item} onEdit={handleEditNotice} onPinToggle={handlePinNotice} onDelete={handleDeleteNotice} />
      ))}
      </> : null}
    </View>
  );

  const renderStandardPostContent = () => {
    const contentBoard = selectedManagedBoard;
    const contentControl = adminBoardContentControl(contentBoard);
    return (
      <View style={{ gap: 12 }}>
        <Panel>
          <View style={{ gap: 10 }}>
            <BoardSectionTitle style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>
              {contentBoard ? `${contentBoard.name} 콘텐츠 관리` : "전체 게시글 관리"}
            </BoardSectionTitle>
            <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
              게시글을 검색하고 열기, 수정, 고정, 삭제와 지원 게시판의 대표 이미지를 관리합니다.
            </Text>
            {contentBoard ? (
              <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.primary100, backgroundColor: COLORS.primary50, padding: 12, gap: 9 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: COLORS.primary900, fontSize: 16, fontWeight: "600" }}>{contentBoard.name} 관리</Text>
                  <Chip active label={BOARD_TYPE_LABELS[contentBoard.board_type] ?? contentBoard.board_type} />
                </View>
                <Text style={{ color: COLORS.muted, lineHeight: 19 }}>{contentControl.description}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {contentControl.createLabel ? (
                    <ActionButton
                      icon="add-circle-outline"
                      label={contentControl.createLabel}
                      onPress={() => router.push({ pathname: "/board/post/create", params: { boardId: String(contentBoard.id) } } as never)}
                    />
                  ) : null}
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <ActionButton
                  icon="add-circle-outline"
                  label="동아리 안내 등록"
                  disabled={!clubPromoBoard}
                  onPress={() => {
                    if (clubPromoBoard) router.push({ pathname: "/board/post/create", params: { boardId: String(clubPromoBoard.id) } } as never);
                  }}
                  tone="outline"
                />
                <ActionButton
                  icon="git-network-outline"
                  label="네트워킹 안내 등록"
                  disabled={!networkingProgramsBoard}
                  onPress={() => {
                    if (networkingProgramsBoard) router.push({ pathname: "/board/post/create", params: { boardId: String(networkingProgramsBoard.id) } } as never);
                  }}
                  tone="outline"
                />
              </View>
            )}
            <Field value={postSearch} onChangeText={setPostSearch} placeholder="제목, 내용, 작성자, 게시판명 검색" />
            <ActionButton
              icon="search-outline"
              label="검색"
              onPress={() => {
                setAdminPostPagination({ contextKey: adminPostPaginationContextKey, page: 1 });
                setAppliedPostSearch(postSearch);
              }}
            />
            <Text style={{ color: COLORS.muted, fontWeight: "600" }}>상태 필터</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ADMIN_POST_MODE_FILTERS.map((item) => (
                <Chip
                  key={item.key}
                  active={postMode === item.key}
                  label={item.label}
                  onPress={() => {
                    setAdminPostPagination({ contextKey: adminPostPaginationContextKey, page: 1 });
                    setPostMode(item.key);
                  }}
                />
              ))}
            </View>
            <Text style={{ color: COLORS.subtle, fontSize: 12, fontWeight: "600" }}>총 {adminPostTotal}개 게시글</Text>
          </View>
        </Panel>
        <AdminBoardContentQueryState
          isLoading={adminPostsQuery.isLoading}
          isError={adminPostsQuery.isError}
          isEmpty={adminPosts.length === 0}
          emptyMessage="표시할 게시글이 없습니다."
          onRetry={() => void adminPostsQuery.refetch()}
        />
        {adminPosts.map((item) => (
          <AdminPostCard
            key={item.id}
            item={item}
            board={boards.find((board) => board.id === item.board_id)}
            onPinToggle={handlePinAdminPost}
            onDelete={handleDeleteAdminPost}
            onRepresentativeImageChange={(post) => void handleReplacePostRepresentativeImage(post)}
            isReplacingRepresentativeImage={replacingRepresentativeImagePostId === item.id}
            showActivityCertificationBankAccount={contentBoard?.board_type === "activity_certification"}
          />
        ))}
        {adminPostTotalPages > 1 ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <ActionButton
              label="이전"
              tone="outline"
              disabled={adminPostPage <= 1 || adminPostsQuery.isFetching}
              onPress={() => setAdminPostPagination({
                contextKey: adminPostPaginationContextKey,
                page: Math.max(1, adminPostPage - 1),
              })}
            />
            <Text style={{ color: COLORS.text, fontWeight: "600" }}>{adminPostPage} / {adminPostTotalPages}</Text>
            <ActionButton
              label="다음"
              tone="outline"
              disabled={adminPostPage >= adminPostTotalPages || adminPostsQuery.isFetching}
              onPress={() => setAdminPostPagination({
                contextKey: adminPostPaginationContextKey,
                page: Math.min(adminPostTotalPages, adminPostPage + 1),
              })}
            />
          </View>
        ) : null}
      </View>
    );
  };

  const renderMutualAidContent = () => (
    <View style={{ gap: 12 }}>
      <Panel>
        <View style={{ gap: 10 }}>
          <BoardSectionTitle style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>상조회 신청 관리</BoardSectionTitle>
          <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
            신청 상세에서 증빙서류를 확인한 후 처리 완료 또는 반려를 선택합니다. 반려 시 사유 입력이 필수입니다.
          </Text>
          <BoardFilterRow>{([['processing', '처리중'], ['completed', '처리 완료'], ['rejected', '반려'], ['all', '전체']] as const).map(([value, label]) => (
              <Chip key={value} active={mutualAidFilter === value} label={label} onPress={() => setMutualAidFilter(value)} />
            ))}
          </BoardFilterRow>
          <Text style={{ color: COLORS.subtle, fontSize: 12, fontWeight: "600" }}>
            처리 대기 {processingMutualAidCount}건 · 전체 {mutualAidPosts.length}건
          </Text>
        </View>
      </Panel>
      <AdminBoardContentQueryState
        isLoading={mutualAidPostsQuery.isLoading}
        isError={mutualAidPostsQuery.isError}
        isEmpty={visibleMutualAidPosts.length === 0}
        emptyMessage="해당 상태의 상조회 신청이 없습니다."
        onRetry={() => void mutualAidPostsQuery.refetch()}
      />
      {visibleMutualAidPosts.map((item) => <MutualAidAdminCard key={item.id} item={item} />)}
    </View>
  );

  const renderSuggestionContent = () => (
    <View style={{ gap: 12 }}>
      <Panel>
        <View style={{ gap: 10 }}>
          <BoardSectionTitle style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>건의사항 답변 관리</BoardSectionTitle>
          <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
            작성자는 익명으로 유지됩니다. 상세 화면에서 공식 답변을 입력하면 답변완료로 처리되고 작성자에게 알림이 전송됩니다.
          </Text>
          <BoardFilterRow>{([['received', '대기중'], ['answered', '답변완료'], ['all', '전체']] as const).map(([value, label]) => (
              <Chip key={value} active={suggestionFilter === value} label={label} onPress={() => setSuggestionFilter(value)} />
            ))}
          </BoardFilterRow>
          <Text style={{ color: COLORS.subtle, fontSize: 12, fontWeight: "600" }}>
            답변 대기 {pendingSuggestionCount}건 · 전체 {suggestionPosts.length}건
          </Text>
        </View>
      </Panel>
      <AdminBoardContentQueryState
        isLoading={suggestionPostsQuery.isLoading}
        isError={suggestionPostsQuery.isError}
        isEmpty={visibleSuggestionPosts.length === 0}
        emptyMessage="해당 상태의 건의사항이 없습니다."
        onRetry={() => void suggestionPostsQuery.refetch()}
      />
      {visibleSuggestionPosts.map((item) => <SuggestionAdminCard key={item.id} item={item} />)}
    </View>
  );

  const renderActivityHistoryContent = () => (
    <View style={{ gap: 12 }}>
      <Panel>
        <View style={{ gap: 8 }}>
          <BoardSectionTitle style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>원우회 활동내역 연동 공지</BoardSectionTitle>
          <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
            원우회 활동내역 연동이 켜진 공지만 표시합니다. 수정하면 같은 게시판 관리 화면에서 실제 공지 게시판으로 전환됩니다.
          </Text>
        </View>
      </Panel>
      <AdminBoardContentQueryState
        isLoading={activityHistoryPostsQuery.isLoading}
        isError={activityHistoryPostsQuery.isError}
        isEmpty={activityHistoryPosts.length === 0}
        emptyMessage="연동된 공지사항이 없습니다."
        onRetry={() => void activityHistoryPostsQuery.refetch()}
      />
      {activityHistoryPosts.map((item) => (
        <NoticeCard
          key={item.id}
          item={item}
          onEdit={handleEditActivityHistoryNotice}
          onPinToggle={handlePinNotice}
          onDelete={handleDeleteNotice}
        />
      ))}
    </View>
  );

  const renderExecutivesContent = () => (
    <View style={{ gap: 12 }}>
      <Panel>
        <View style={{ gap: 10 }}>
          <BoardSectionTitle style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>원우회 소개 관리</BoardSectionTitle>
          <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
            현재 원우회의 소개 사진 여러 장, 인사말, 소개글과 임원 카드를 등록하면 원우회 소개 화면에 바로 반영됩니다.
          </Text>
        </View>
      </Panel>
      {!executivesBoard ? <Panel><Text style={{ color: COLORS.error, fontWeight: "600" }}>gsa-executives 게시판을 찾을 수 없습니다.</Text></Panel> : null}
      {currentCouncils.map((council, cardIndex) => (
        <Panel key={`current-council-${cardIndex}`}>
          <View style={{ gap: 10 }}>
            <Text style={{ color: COLORS.primary900, fontSize: 16, fontWeight: "600" }}>{council.title || "현재 원우회"}</Text>
            <Field value={council.title} onChangeText={(value) => updateCurrentCouncil(cardIndex, { title: value })} placeholder="원우회 이름 예: 제30대 원우회" />
            <Field value={council.greeting} onChangeText={(value) => updateCurrentCouncil(cardIndex, { greeting: value })} placeholder="인사말" multiline />
            <Field value={council.intro} onChangeText={(value) => updateCurrentCouncil(cardIndex, { intro: value })} placeholder="원우회 소개글" multiline />
            <IntroPhotoGalleryEditor
              values={council.photo_urls ?? []}
              uploading={currentCouncilUploading?.cardIndex === cardIndex && currentCouncilUploading.memberIndex === undefined}
              disabled={Boolean(currentCouncilUploading)}
              onUpload={() => void handleUploadCurrentCouncilImage(cardIndex)}
              onRemove={(photoIndex) => updateCurrentCouncil(cardIndex, introGalleryPatch((council.photo_urls ?? []).filter((_, index) => index !== photoIndex)))}
              onMove={(fromIndex, toIndex) => updateCurrentCouncil(cardIndex, introGalleryPatch(moveCouncilIntroductionItem(council.photo_urls ?? [], fromIndex, toIndex)))}
            />
            {council.members.map((member, memberIndex) => (
              <IntroMemberEditor
                key={`current-council-${cardIndex}-member-${memberIndex}`}
                member={member}
                index={memberIndex}
                uploading={currentCouncilUploading?.cardIndex === cardIndex && currentCouncilUploading.memberIndex === memberIndex}
                uploadDisabled={Boolean(currentCouncilUploading)}
                canMoveUp={memberIndex > 0}
                canMoveDown={memberIndex < council.members.length - 1}
                onChange={(patch) => updateCurrentCouncilMember(cardIndex, memberIndex, patch)}
                onUpload={() => void handleUploadCurrentCouncilImage(cardIndex, memberIndex)}
                onMoveUp={() => updateCurrentCouncil(cardIndex, { members: moveCouncilIntroductionItem(council.members, memberIndex, memberIndex - 1) })}
                onMoveDown={() => updateCurrentCouncil(cardIndex, { members: moveCouncilIntroductionItem(council.members, memberIndex, memberIndex + 1) })}
                onRemove={() => updateCurrentCouncil(cardIndex, { members: council.members.filter((_, index) => index !== memberIndex) })}
              />
            ))}
            <ActionButton icon="person-add-outline" label="임원 카드 추가" onPress={() => updateCurrentCouncil(cardIndex, { members: [...council.members, { ...emptyExecutiveMember }] })} disabled={Boolean(currentCouncilUploading)} tone="outline" />
          </View>
        </Panel>
      ))}
      <Panel><ActionButton icon="save-outline" label={executivesSaving ? "저장 중" : "원우회 소개 저장"} onPress={() => void handleSaveExecutives()} disabled={executivesSaving || Boolean(currentCouncilUploading) || !executivesBoard} /></Panel>
    </View>
  );

  const renderCohortLeadersContent = () => (
    <View style={{ gap: 12 }}>
      <Panel>
        <View style={{ gap: 10 }}>
          <BoardSectionTitle style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>기수별 기장단 소개 관리</BoardSectionTitle>
          <Text style={{ color: COLORS.muted, lineHeight: 20 }}>기수별 소개 사진 여러 장, 인사말, 소개글과 필요한 만큼의 임원 카드를 등록할 수 있습니다.</Text>
        </View>
      </Panel>
      {!cohortLeadersBoard ? <Panel><Text style={{ color: COLORS.error, fontWeight: "600" }}>gsa-cohort-leaders 게시판을 찾을 수 없습니다.</Text></Panel> : null}
      {cohortLeaders.map((leader, index) => (
        <Panel key={`cohort-leader-${index}`}>
          <View style={{ gap: 10 }}>
            <Text style={{ color: COLORS.primary900, fontSize: 16, fontWeight: "600" }}>{leader.cohort || "새 기수"} 기장단</Text>
            <Field value={leader.cohort} onChangeText={(value) => updateCohortLeader(index, { cohort: value })} placeholder="기수 예: 75" />
            <Field value={leader.greeting} onChangeText={(value) => updateCohortLeader(index, { greeting: value })} placeholder="인사말 예: 안녕하세요, 75기 기장 홍길동입니다!" />
            <Field value={leader.intro} onChangeText={(value) => updateCohortLeader(index, { intro: value })} placeholder="기장단 소개글" multiline />
            <IntroPhotoGalleryEditor
              values={leader.photo_urls ?? []}
              uploading={cohortLeaderUploading?.cardIndex === index && cohortLeaderUploading.memberIndex === undefined}
              disabled={Boolean(cohortLeaderUploading)}
              onUpload={() => void handleUploadCohortLeaderImage(index)}
              onRemove={(photoIndex) => updateCohortLeader(index, introGalleryPatch((leader.photo_urls ?? []).filter((_, itemIndex) => itemIndex !== photoIndex)))}
              onMove={(fromIndex, toIndex) => updateCohortLeader(index, introGalleryPatch(moveCouncilIntroductionItem(leader.photo_urls ?? [], fromIndex, toIndex)))}
            />
            {leader.members.map((member, memberIndex) => (
              <IntroMemberEditor
                key={`cohort-leader-${index}-member-${memberIndex}`}
                member={member}
                index={memberIndex}
                uploading={cohortLeaderUploading?.cardIndex === index && cohortLeaderUploading.memberIndex === memberIndex}
                uploadDisabled={Boolean(cohortLeaderUploading)}
                canMoveUp={memberIndex > 0}
                canMoveDown={memberIndex < leader.members.length - 1}
                onChange={(patch) => updateCohortLeaderMember(index, memberIndex, patch)}
                onUpload={() => void handleUploadCohortLeaderImage(index, memberIndex)}
                onMoveUp={() => updateCohortLeader(index, { members: moveCouncilIntroductionItem(leader.members, memberIndex, memberIndex - 1) })}
                onMoveDown={() => updateCohortLeader(index, { members: moveCouncilIntroductionItem(leader.members, memberIndex, memberIndex + 1) })}
                onRemove={() => updateCohortLeader(index, { members: leader.members.filter((_, itemIndex) => itemIndex !== memberIndex) })}
              />
            ))}
            <ActionButton icon="person-add-outline" label="임원 카드 추가" onPress={() => updateCohortLeader(index, { members: [...leader.members, { ...emptyExecutiveMember }] })} disabled={Boolean(cohortLeaderUploading)} tone="outline" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><ActionButton icon="chevron-up-outline" label="기수 위로" onPress={() => setCohortLeaders((current) => moveCouncilIntroductionItem(current, index, index - 1))} disabled={Boolean(cohortLeaderUploading) || index === 0} tone="outline" /></View>
              <View style={{ flex: 1 }}><ActionButton icon="chevron-down-outline" label="기수 아래로" onPress={() => setCohortLeaders((current) => moveCouncilIntroductionItem(current, index, index + 1))} disabled={Boolean(cohortLeaderUploading) || index === cohortLeaders.length - 1} tone="outline" /></View>
            </View>
            <ActionButton icon="trash-outline" label="이 기수 삭제" onPress={() => setCohortLeaders((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={Boolean(cohortLeaderUploading)} tone="danger" />
          </View>
        </Panel>
      ))}
      <Panel><View style={{ gap: 8 }}><ActionButton icon="person-add-outline" label="기수 추가" onPress={() => setCohortLeaders((current) => [...current, { ...emptyCohortLeader, members: [] }])} disabled={Boolean(cohortLeaderUploading)} tone="outline" /><ActionButton icon="save-outline" label={cohortLeadersSaving ? "저장 중" : "기장단 소개 저장"} onPress={() => void handleSaveCohortLeaders()} disabled={cohortLeadersSaving || Boolean(cohortLeaderUploading) || !cohortLeadersBoard} /></View></Panel>
    </View>
  );

  const renderPastCouncilsContent = () => (
    <View style={{ gap: 12 }}>
      <Panel><View style={{ gap: 8 }}><BoardSectionTitle style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>역대 원우회 관리</BoardSectionTitle><Text style={{ color: COLORS.muted, lineHeight: 20 }}>대수별 소개 사진 여러 장, 인사말, 소개글, 활동내역과 필요한 만큼의 임원 카드를 등록합니다.</Text></View></Panel>
      {!pastCouncilsBoard ? <Panel><Text style={{ color: COLORS.error, fontWeight: "600" }}>gsa-past-councils 게시판을 찾을 수 없습니다. 게시판 목록을 다시 불러와주세요.</Text></Panel> : null}
      {pastCouncils.map((council, index) => (
        <Panel key={`past-council-${index}`}>
          <View style={{ gap: 10 }}>
            <Text style={{ color: COLORS.primary900, fontSize: 16, fontWeight: "600" }}>{council.cohort || "새 역대 원우회"} 원우회</Text>
            <Field value={council.cohort} onChangeText={(value) => updatePastCouncil(index, { cohort: value })} placeholder="원우회 대수 예: 29" />
            <Field value={council.greeting} onChangeText={(value) => updatePastCouncil(index, { greeting: value })} placeholder="인사말" multiline />
            <Field value={council.intro} onChangeText={(value) => updatePastCouncil(index, { intro: value })} placeholder="원우회 소개글" multiline />
            <Field value={council.activities_text} onChangeText={(value) => updatePastCouncil(index, { activities_text: value })} placeholder={'활동내역을 한 줄에 하나씩 입력\n예: 25.05.05 기말 세미나 개최'} multiline />
            <IntroPhotoGalleryEditor
              values={council.photo_urls ?? []}
              uploading={pastCouncilUploading?.cardIndex === index && pastCouncilUploading.memberIndex === undefined}
              disabled={Boolean(pastCouncilUploading)}
              onUpload={() => void handleUploadPastCouncilImage(index)}
              onRemove={(photoIndex) => updatePastCouncil(index, introGalleryPatch((council.photo_urls ?? []).filter((_, itemIndex) => itemIndex !== photoIndex)))}
              onMove={(fromIndex, toIndex) => updatePastCouncil(index, introGalleryPatch(moveCouncilIntroductionItem(council.photo_urls ?? [], fromIndex, toIndex)))}
            />
            {council.members.map((member, memberIndex) => (
              <IntroMemberEditor
                key={`past-council-${index}-member-${memberIndex}`}
                member={member}
                index={memberIndex}
                uploading={pastCouncilUploading?.cardIndex === index && pastCouncilUploading.memberIndex === memberIndex}
                uploadDisabled={Boolean(pastCouncilUploading)}
                canMoveUp={memberIndex > 0}
                canMoveDown={memberIndex < council.members.length - 1}
                onChange={(patch) => updatePastCouncilMember(index, memberIndex, patch)}
                onUpload={() => void handleUploadPastCouncilImage(index, memberIndex)}
                onMoveUp={() => updatePastCouncil(index, { members: moveCouncilIntroductionItem(council.members, memberIndex, memberIndex - 1) })}
                onMoveDown={() => updatePastCouncil(index, { members: moveCouncilIntroductionItem(council.members, memberIndex, memberIndex + 1) })}
                onRemove={() => updatePastCouncil(index, { members: council.members.filter((_, itemIndex) => itemIndex !== memberIndex) })}
              />
            ))}
            <ActionButton icon="person-add-outline" label="임원 카드 추가" onPress={() => updatePastCouncil(index, { members: [...council.members, { ...emptyExecutiveMember }] })} disabled={Boolean(pastCouncilUploading)} tone="outline" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><ActionButton icon="chevron-up-outline" label="원우회 위로" onPress={() => setPastCouncils((current) => moveCouncilIntroductionItem(current, index, index - 1))} disabled={Boolean(pastCouncilUploading) || index === 0} tone="outline" /></View>
              <View style={{ flex: 1 }}><ActionButton icon="chevron-down-outline" label="원우회 아래로" onPress={() => setPastCouncils((current) => moveCouncilIntroductionItem(current, index, index + 1))} disabled={Boolean(pastCouncilUploading) || index === pastCouncils.length - 1} tone="outline" /></View>
            </View>
            <ActionButton icon="trash-outline" label="이 원우회 삭제" onPress={() => setPastCouncils((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={Boolean(pastCouncilUploading)} tone="danger" />
          </View>
        </Panel>
      ))}
      <Panel><View style={{ gap: 8 }}><ActionButton icon="add-circle-outline" label="역대 원우회 추가" onPress={() => setPastCouncils((current) => [...current, { ...emptyPastCouncil, members: [] }])} disabled={Boolean(pastCouncilUploading)} tone="outline" /><ActionButton icon="save-outline" label={pastCouncilsSaving ? "저장 중" : "역대 원우회 저장"} onPress={() => void handleSavePastCouncils()} disabled={pastCouncilsSaving || Boolean(pastCouncilUploading) || !pastCouncilsBoard} /></View></Panel>
    </View>
  );

  const renderOrganizationIntroContent = () => {
    switch (selectedManagedBoard?.slug) {
      case "gsa-executives":
        return renderExecutivesContent();
      case "gsa-cohort-leaders":
        return renderCohortLeadersContent();
      case "gsa-past-councils":
        return renderPastCouncilsContent();
      default:
        return <UnsupportedBoardContent board={selectedManagedBoard} />;
    }
  };

  const renderFaqContent = () => (
    <View style={{ gap: 12 }}>
      <Panel>
        <View style={{ gap: 10 }}>
          <BoardSectionTitle style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>{editingFAQId ? "FAQ 수정" : "FAQ 등록"}</BoardSectionTitle>
          <Field value={faqForm.question} onChangeText={(value) => setFAQForm((current) => ({ ...current, question: value }))} placeholder="질문" />
          <Field value={faqForm.answer} onChangeText={(value) => setFAQForm((current) => ({ ...current, answer: value }))} placeholder="답변" multiline />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Field value={faqForm.category} onChangeText={(value) => setFAQForm((current) => ({ ...current, category: value }))} placeholder="분류" /></View>
            <View style={{ width: 92 }}><Field value={faqForm.sort_order} onChangeText={(value) => setFAQForm((current) => ({ ...current, sort_order: value }))} placeholder="순서" /></View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><ActionButton icon="save-outline" label={editingFAQId ? "FAQ 저장" : "FAQ 등록"} onPress={handleSaveFAQ} /></View>
            {editingFAQId ? <View style={{ flex: 1 }}><ActionButton label="취소" onPress={resetFAQForm} tone="outline" /></View> : null}
          </View>
        </View>
      </Panel>
      <AdminBoardContentQueryState isLoading={faqsQuery.isLoading} isError={faqsQuery.isError} isEmpty={faqs.length === 0} emptyMessage="등록된 FAQ가 없습니다." onRetry={() => void faqsQuery.refetch()} />
      {faqs.map((item) => <FAQCard key={item.id} item={item} onEdit={handleEditFAQ} onDelete={handleDeleteFAQ} />)}
    </View>
  );

  const renderCalendarContent = () => (
    <View style={{ gap: 12 }}>
      <Panel>
        <View style={{ gap: 10 }}>
          <BoardSectionTitle style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>{editEventId ? "일정 수정" : "일정 등록"}</BoardSectionTitle>
          <Controller control={control} name="title" render={({ field }) => <Field onChangeText={field.onChange} placeholder="일정 제목" value={field.value ?? ""} />} />
          <Controller control={control} name="category" render={({ field }) => (
            <View style={{ gap: 7 }}>
              <Text style={{ color: COLORS.text, fontWeight: "600" }}>일정 분류</Text>
              <BoardFilterRow>{EVENT_CATEGORY_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    active={eventDisplayCategory(field.value) === option.value}
                    label={option.label}
                    onPress={() => field.onChange(option.value)}
                  />
                ))}
              </BoardFilterRow>
            </View>
          )} />
          <Controller control={control} name="start_at" render={({ field }) => <EventDateTimePicker label="시작일시" value={field.value ?? ""} onChange={field.onChange} fallbackTime="09:00" />} />
          <Controller control={control} name="end_at" render={({ field }) => <EventDateTimePicker label="종료일시" value={field.value ?? ""} onChange={field.onChange} fallbackTime="11:00" />} />
          <Controller control={control} name="location" render={({ field }) => <Field onChangeText={field.onChange} placeholder="장소" value={field.value ?? ""} />} />
          <Controller control={control} name="description" render={({ field }) => <Field multiline onChangeText={field.onChange} placeholder="상세 설명" value={field.value ?? ""} />} />
          <ActionButton icon="save-outline" label={editEventId ? "일정 저장" : "일정 등록"} onPress={() => { Keyboard.dismiss(); handleSubmit(onSubmitEvent)(); }} />
        </View>
      </Panel>
      <AdminBoardContentQueryState isLoading={eventsQuery.isLoading} isError={eventsQuery.isError} isEmpty={events.length === 0} emptyMessage="등록된 일정이 없습니다." onRetry={() => void eventsQuery.refetch()} />
      {events.map((event) => <View key={event.id} style={{ gap: 8 }}><EventCard event={event} onEdit={handleEditEvent} /><ActionButton icon="trash-outline" label="일정 삭제" onPress={() => handleDeleteEventFromList(event)} tone="danger" /></View>)}
    </View>
  );

  const renderExternalLinkContent = () => (
    <View style={{ gap: 12 }}>
      <Panel>
        <View style={{ gap: 10 }}>
          <BoardSectionTitle style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>외부 링크 관리</BoardSectionTitle>
          <Text style={{ color: COLORS.muted, lineHeight: 20 }}>사용자 화면에서 열 외부 HTTP(S) 주소를 입력하세요.</Text>
          <Field value={externalLinkDraft} onChangeText={(value) => { setExternalLinkDraft(value); setExternalLinkError(null); }} placeholder="https://example.com" editable={!externalLinkSaving} />
          {externalLinkError ? <Text style={{ color: COLORS.error, fontWeight: "600" }}>{externalLinkError}</Text> : null}
          <ActionButton icon="save-outline" label={externalLinkSaving ? "저장 중" : "외부 링크 저장"} onPress={() => void handleSaveExternalLink()} disabled={externalLinkSaving} />
        </View>
      </Panel>
    </View>
  );

  const renderGuideContent = () => (
    <Panel>
      <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
        이 가이드는 별도 콘텐츠 저장 형식을 사용하지 않습니다. 이름, 설명, 노출과 권한은 운영 설정에서 관리할 수 있습니다.
      </Text>
    </Panel>
  );

  const managedContentRenderers: Partial<Record<AdminBoardContentKind, () => ReactNode>> = {
    "aggregate-posts": renderStandardPostContent,
    "posts": renderStandardPostContent,
    "resource": renderStandardPostContent,
    "album": renderStandardPostContent,
    "activity-certification": renderStandardPostContent,
    "notice": renderNoticeContent,
    "suggestion": renderSuggestionContent,
    "mutual-aid": renderMutualAidContent,
    "activity-history": renderActivityHistoryContent,
    "organization-intro": renderOrganizationIntroContent,
    calendar: renderCalendarContent,
    faq: renderFaqContent,
    "external-link": renderExternalLinkContent,
    guide: renderGuideContent,
  };
  return {
    activeBannerCount,
    adminMajors,
    adminMajorsQuery,
    adminPostDeleteError,
    adminPostDeleting,
    adminPostTotal,
    adminPosts,
    adminPostsQuery,
    adminPrivacyPolicy,
    adminPrivacyPolicyQuery,
    auditLogs,
    auditLogsQuery,
    auditPage,
    bannerForm,
    bannerSaveMessage,
    bannerSaving,
    bannerUploadSlot,
    banners,
    bannersQuery,
    boardManagementBoardId,
    boardManagementScope,
    boardManagementTab,
    boardSettingsDraft,
    boardSettingsSaving,
    boards,
    boardsQuery,
    closeAdminPostDeleteConfirm,
    clubPromoBoard,
    cohortLeaders,
    confirmAdminPostDelete,
    councilBoardCount,
    creatingBoard,
    currentCouncils,
    dispatchEventReminders,
    editingBannerId,
    events,
    faqs,
    handleBoardManagementBoardChange,
    handleBoardManagementScopeChange,
    handleBoardManagementTabChange,
    handleCreateMajor,
    handleCreateManagedBoard,
    acceptCreatedBoard,
    handleDeleteAdminPost,
    handleDeleteTarget,
    handleEditBanner,
    handleEditNotice,
    handleHideBanner,
    handlePinAdminPost,
    handleReplacePostRepresentativeImage,
    handleReportStatus,
    handleSaveBanner,
    handleSaveBoardSettings,
    handleSaveMajor,
    handleSavePrivacyPolicy,
    handleSelectNoticeBoard,
    handleUploadBannerImage,
    handleUserActiveToggle,
    handleUserEligibilityChange,
    handleUserRoleToggle,
    hasManagedContentTarget,
    isAdmin,
    managedContentRenderers,
    managedContentTarget,
    managedNavigationLocked,
    networkingProgramsBoard,
    newMajorName,
    newMajorOrder,
    nextBannerPosition,
    noticeBoards,
    noticePosts,
    noticePostsQuery,
    openAdminSection,
    openMemberScreen,
    openAllManagedPosts,
    openManagedBoard,
    pastCouncils,
    pendingAdminPostDelete,
    pendingBoardNavigationIntent,
    pendingSuggestionCount,
    policyEffectiveAt,
    policyVersion,
    previewBannerPosition,
    previewBannerTotal,
    processingMutualAidCount,
    renderBoardFormPanel,
    renderNoticeEditor: () => renderNoticeContent(true),
    noticeEditorDraft: JSON.stringify({form:noticeForm,attachments:noticeAttachments.map(a=>a.id)}),
    noticeHasContent: Boolean(noticeForm.title || noticeForm.content || noticeAttachments.length || noticeForm.poll),
    startWebNoticeDraft: (category?: string) => { resetNoticeForm(); setNoticeForm({...emptyNotice,category:category??"other"}); },
    resetNoticeForm,
    reportStatus,
    reports,
    reportsQuery,
    resetBannerForm,
    saveSuccessFeedback,
    section,
    selectedBannerPosition,
    selectedBoardCapability,
    selectedManagedBoard,
    selectedNoticeBoard,
    selectedNoticeBoardId,
    setAppliedUserSearch,
    memberEditing,
    setMemberEditing,
    setAuditPage,
    setBannerForm,
    setBoardSettingsDraft,
    setMutualAidFilter,
    setPageOperationPending,
    setMemberSavePending,
    setNewMajorName,
    setNewMajorOrder,
    setPolicyEffectiveAt,
    setPolicyVersion,
    setReportStatus,
    setSaveSuccessFeedback,
    setSuggestionFilter,
    setUserSearch,
    sortedBanners,
    stats,
    syncPushReceipts,
    user,
    userSearch,
    users,
    usersQuery
  };
}
export type AdminWorkspaceState = ReturnType<typeof useAdminController>;
