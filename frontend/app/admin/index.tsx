import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { z } from "zod";

import BackButton from "../../components/BackButton";
import AdminBoardContentPanel, {
  AdminBoardContentQueryState,
  AdminBoardTargetQueryState,
  NoticeImageUploadFeedback,
  adminBoardContentQueryPolicy,
  beginNoticeEditorOperation,
  mergeNoticeAttachments,
  noticeEditorBoardTransition,
  noticeEditorOperationResult,
  noticeImageUploadIssueMessage,
  noticeUploadButtonLabel,
  publicNoticeBoardSelection,
  replaceNoticeAttachment,
  type NoticeEditorOperation,
} from "../../components/admin/AdminBoardContentPanel";
import AdminBoardManagementNavigator, {
  adminBoardContentTarget,
  adminBoardCreateCancelTransition,
  adminBoardCreationResult,
  adminBoardCreateTransition,
  adminBoardNavigationIntentResolution,
  adminBoardScopeTransition,
  adminBoardSelectionTransition,
  adminBoardsWithCreatedBoard,
  boardSettingsSaveResult,
  shouldClearOptimisticCreatedBoard,
  type AdminBoardNavigationIntent,
} from "../../components/admin/AdminBoardManagementNavigator";
import AdminBoardSettingsPanel, { adminBoardPermissionOptions } from "../../components/admin/AdminBoardSettingsPanel";
import DuesPayerSection from "../../components/admin/DuesPayerSection";
import DuesRosterSection from "../../components/admin/DuesRosterSection";
import AdminPostDeleteConfirm from "../../components/admin/AdminPostDeleteConfirm";
import AdminSaveSuccessModal from "../../components/admin/AdminSaveSuccessModal";
import MediaImage, { MediaImageBackground } from "../../components/MediaImage";
import { invalidatePostMutationCaches, postMutationCacheTargets } from "../../hooks/usePosts";
import { API_ORIGIN, adminApi, bannerApi, boardApi, commentApi, eventApi, faqApi, postApi, registrationApi, reportApi } from "../../services/api";
import { useUserStore } from "../../stores/userStore";
import {
  adminActivityCertificationBankAccount,
  adminBoardCapability,
  adminBoardContentControl,
  adminBoardDestinationForLegacySection,
  adminBoardDestinationForSlug,
  adminBoardNavigationTransition,
  adminDeferredEventGateInitialState,
  adminDeferredEventGateTransition,
  adminCalendarQueryEnabled,
  adminFaqQueryEnabled,
  adminPostListQueryParams,
  adminPostPageForContext,
  runAdminPostDelete,
  type AdminBoardContentKind,
  type AdminBoardDestination,
  type AdminBoardManagementTab,
  type AdminContentScope,
} from "../../utils/adminContentManagement";
import { adminSaveFeedback, type AdminSaveFeedbackPresentation } from "../../utils/adminSaveFeedback";
import { runAdminMutation } from "../../utils/adminMutationCoordinator";
import { adminEventFormRouteTransition } from "../../utils/adminEventForm";
import {
  formatBoardDateTime,
  koreaDateTimeInputToUtcISOString,
  utcApiDateTimeToKoreaInput,
} from "../../utils/dateFormat";
import {
  EVENT_CATEGORY_OPTIONS,
  eventCategoryLabel,
  eventCategoryValueForSubmit,
  eventDisplayCategory,
} from "../../utils/eventCategoryPresentation";
import {
  adminBoardSettingsDraft,
  adminBoardSettingsPayload,
  externalLinkMetadata,
  validateExternalHttpUrl,
  type AdminBoardSettingsDraft,
} from "../../utils/adminBoardSettings";
import { pickAndUploadBannerImage, pickAndUploadContentImage, pickAndUploadImages } from "../../utils/mediaPicker";
import { toAbsoluteMediaUrl } from "../../utils/mediaAccess";
import { formatPastCouncilActivitiesForEditing, parsePastCouncilActivitiesForStorage } from "../../utils/pastCouncil";
import {
  canSaveCohortLeaderCards,
  canSaveCurrentCouncilCards,
  canSavePastCouncilCards,
  councilGalleryFields,
  cohortLeaderFormsFromMetadata,
  currentCouncilFormsFromMetadata,
  moveCouncilIntroductionItem,
  pastCouncilFormsFromMetadata,
  withCohortLeaderMetadata,
  withCurrentCouncilMetadata,
  withPastCouncilMetadata,
  type CohortLeaderFormData,
  type CouncilMemberFormData,
  type CurrentCouncilFormData,
  type PastCouncilFormData,
} from "../../utils/councilIntroductions";
import { formatCohortName } from "../../utils/userLabel";
import type {
  ApiSuccess,
  AdminReportItem,
  AdminAuditLog,
  AdminUserItem,
  BannerItem,
  Board,
  EventItem,
  FAQItem,
  MediaAsset,
  MajorOption,
  PostListItem,
  PrivacyPolicyVersion,
  ReportStatus,
  MutualAidStatus,
} from "../../types";

import { BackIcon } from "../../components/icons";
const COLORS = {
  primary: "#2761FF",
  primary50: "#EDF2FE",
  primary100: "#D5E0FE",
  primary700: "#0B3AC4",
  primary900: "#0B1F56",
  cyan: "#1FA9BD",
  purple: "#6C4FCB",
  success: "#2FA365",
  warning: "#E5A500",
  error: "#D94343",
  bg: "#F7F8FA",
  surface: "#ffffff",
  surfaceAlt: "#F8FAFC",
  border: "#E1E4E9",
  borderStrong: "#C7CDD4",
  text: "#111827",
  muted: "#6B7280",
  subtle: "#8A919C",
};

const RADIUS = {
  button: 6,
  card: 8,
};

const ELEVATION = {
  shadowColor: "#0B1F56",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.04,
  shadowRadius: 12,
  elevation: 1,
};

const eventSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  start_at: z.string().min(1),
  end_at: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
});

type EventForm = z.infer<typeof eventSchema>;
type AdminBoardsQueryData = ApiSuccess<Board[]>;
type OptimisticManagedBoard = { board: Board; insertedGeneration: number };
type AdminSection = "dashboard" | "banners" | "boardManagement" | "accounts" | "studentRoster" | "duesPayers" | "reports" | "registration";
type AdminPostMode = "all" | "notice" | "pinned";
type SuggestionAdminFilter = "received" | "answered" | "all";
type IconName = keyof typeof Ionicons.glyphMap;
type BannerImageSlot = "mobile" | "tablet" | "desktop";
type BannerSaveMessage = { tone: "success" | "error" | "info"; text: string } | null;

type BannerForm = {
  title: string;
  subtitle: string;
  badge_text: string;
  cta_label: string;
  cta_href: string;
  mobile_image_url: string;
  tablet_image_url: string;
  desktop_image_url: string;
  theme: BannerItem["theme"];
  sort_order: string;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
  deadline_at: string;
};

type BoardForm = {
  name: string;
  slug: string;
  category: string;
  board_type: string;
  description: string;
  sort_order: string;
  allow_anonymous: boolean;
  read_permission: string;
  write_permission: string;
  is_active: boolean;
};

type NoticeForm = {
  title: string;
  content: string;
  category: string;
  is_pinned: boolean;
  show_in_council_activity: boolean;
  deadline_at: string;
};

type ExecutiveFormMember = CouncilMemberFormData;
type CohortLeaderForm = CohortLeaderFormData;
type PastCouncilForm = Omit<PastCouncilFormData, "activities"> & { activities_text: string };
type IntroImageTarget = { cardIndex: number; memberIndex?: number };

type FAQForm = {
  question: string;
  answer: string;
  category: string;
  sort_order: string;
};

const emptyEvent: EventForm = {
  title: "",
  category: "event",
  start_at: "",
  end_at: "",
  location: "",
  description: "",
};

const emptyBanner: BannerForm = {
  title: "",
  subtitle: "",
  badge_text: "",
  cta_label: "",
  cta_href: "",
  mobile_image_url: "",
  tablet_image_url: "",
  desktop_image_url: "",
  theme: "none",
  sort_order: "0",
  is_active: true,
  starts_at: "",
  ends_at: "",
  deadline_at: "",
};

const emptyBoard: BoardForm = {
  name: "",
  slug: "",
  category: "community",
  board_type: "post",
  description: "",
  sort_order: "100",
  allow_anonymous: false,
  read_permission: "user",
  write_permission: "user",
  is_active: true,
};

const emptyNotice: NoticeForm = {
  title: "",
  content: "",
  category: "all",
  is_pinned: false,
  show_in_council_activity: false,
  deadline_at: "",
};

const emptyExecutiveMember: ExecutiveFormMember = {
  name: "",
  cohort: "",
  role: "",
  image_url: "",
  intro: "",
};

const emptyCurrentCouncil: CurrentCouncilFormData = {
  title: "",
  greeting: "",
  intro: "",
  banner_image_url: "",
  photo_urls: [],
  members: [],
};

const emptyCohortLeader: CohortLeaderForm = {
  cohort: "",
  greeting: "",
  intro: "",
  banner_image_url: "",
  photo_urls: [],
  members: [],
};

const emptyPastCouncil: PastCouncilForm = {
  cohort: "",
  greeting: "",
  intro: "",
  activities_text: "",
  banner_image_url: "",
  photo_urls: [],
  members: [],
};

const emptyFAQ: FAQForm = {
  question: "",
  answer: "",
  category: "general",
  sort_order: "0",
};

const SECTIONS: { key: AdminSection; label: string; icon: IconName }[] = [
  { key: "dashboard", label: "콘솔", icon: "speedometer-outline" },
  { key: "banners", label: "배너", icon: "albums-outline" },
  { key: "boardManagement", label: "게시판 관리", icon: "grid-outline" },
  { key: "accounts", label: "계정", icon: "people-outline" },
  { key: "studentRoster", label: "원우 명부", icon: "people-circle-outline" },
  { key: "duesPayers", label: "원우회비", icon: "receipt-outline" },
  { key: "reports", label: "신고", icon: "flag-outline" },
  { key: "registration", label: "가입 설정", icon: "person-add-outline" },
];

const ADMIN_SECTION_KEYS = SECTIONS.map((item) => item.key);

const ADMIN_POST_MODE_FILTERS: { key: AdminPostMode; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "notice", label: "공지글" },
  { key: "pinned", label: "고정글" },
];

const NOTICE_CATEGORY_OPTIONS = [
  { value: "all", label: "전체 공지" },
  { value: "academic", label: "학사 공지" },
  { value: "event", label: "행사 공지" },
  { value: "webinar", label: "웨비나/특강 공지" },
  { value: "other", label: "기타 공지" },
] as const;

const EVENT_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const EVENT_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minute}`;
});

const BOARD_TYPE_LABELS: Record<string, string> = {
  post: "일반",
  notice: "공지",
  calendar: "캘린더",
  album: "앨범",
  resource: "자료",
  activity_certification: "활동인증",
  guide: "가이드",
  faq: "FAQ",
  organization_intro: "조직소개",
  activity_history: "활동내역",
  external_link: "외부링크",
  suggestion: "건의",
  mutual_aid: "상조회",
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function parseAdminSection(value?: string | string[]) {
  const raw = firstParam(value);
  return ADMIN_SECTION_KEYS.includes(raw as AdminSection) ? (raw as AdminSection) : null;
}

const REPORT_STATUS_LABELS: Record<ReportStatus | "all", string> = {
  all: "전체",
  open: "접수",
  reviewing: "검토 중",
  resolved: "처리 완료",
  dismissed: "기각",
};

const REPORT_REASON_LABELS: Record<string, string> = {
  inappropriate: "부적절한 내용",
  spam: "스팸/홍보",
  harassment: "비방/괴롭힘",
  privacy: "개인정보 노출",
  other: "기타",
};

const USER_ROLE_LABELS: Record<AdminUserItem["role"], string> = {
  user: "일반",
  admin: "관리자",
};

const BANNER_IMAGE_SLOTS: { key: BannerImageSlot; label: string; hint: string }[] = [
  { key: "mobile", label: "모바일", hint: "권장 640x400 · 8:5" },
  { key: "tablet", label: "태블릿", hint: "권장 960x600 · 8:5" },
  { key: "desktop", label: "데스크톱", hint: "권장 1280x800 · 8:5" },
];

function cleanOptional(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function cleanNullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeNoticeCategoryValue(value?: string | null) {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw || raw === "all" || raw.includes("전체")) {
    return "all";
  }
  if (raw.includes("academic") || raw.includes("calendar") || raw.includes("학사")) {
    return "academic";
  }
  if (raw.includes("webinar") || raw.includes("특강") || raw.includes("웨비나")) {
    return "webinar";
  }
  if (raw.includes("event") || raw.includes("행사")) {
    return "event";
  }
  if (raw.includes("other") || raw.includes("general") || raw.includes("기타")) {
    return "other";
  }
  return "all";
}

function bannerPosition(banners: BannerItem[], bannerId: number | null) {
  if (!bannerId) {
    return null;
  }
  const index = banners.findIndex((item) => item.id === bannerId);
  return index >= 0 ? index + 1 : null;
}

function nextBannerOrder(banners: BannerItem[]) {
  if (banners.length === 0) {
    return 1;
  }
  return Math.max(...banners.map((item) => item.sort_order ?? 0)) + 1;
}

function bannerFormFromItem(item: BannerItem): BannerForm {
  return {
    title: item.title ?? "",
    subtitle: item.subtitle ?? "",
    badge_text: item.badge_text ?? "",
    cta_label: item.cta_label ?? "",
    cta_href: item.cta_href ?? "",
    mobile_image_url: item.image_urls?.mobile ?? item.image_url ?? "",
    tablet_image_url: item.image_urls?.tablet ?? "",
    desktop_image_url: item.image_urls?.desktop ?? item.image_url ?? "",
    theme: item.theme,
    sort_order: String(item.sort_order ?? 0),
    is_active: item.is_active,
    starts_at: item.starts_at?.slice(0, 16) ?? "",
    ends_at: item.ends_at?.slice(0, 16) ?? "",
    deadline_at: item.deadline_at?.slice(0, 16) ?? "",
  };
}

function mediaUrl(value?: string | null) {
  return toAbsoluteMediaUrl(value, API_ORIGIN);
}

type IntroGalleryForm = { photo_urls?: string[]; banner_image_url: string };

function introGalleryPatch(photoUrls: readonly string[]) {
  const gallery = councilGalleryFields({ photoUrls });
  return {
    photo_urls: gallery.photo_urls,
    banner_image_url: gallery.banner_image_url,
  };
}

function appendedIntroGalleryPatch(card: IntroGalleryForm, addedUrls: readonly string[]) {
  const current = councilGalleryFields({
    photoUrls: card.photo_urls,
    bannerImageUrl: card.banner_image_url,
  });
  return introGalleryPatch([...current.photo_urls, ...addedUrls]);
}

function parseSort(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function dateOnlyValue(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function timeOnlyValue(value?: string | null, fallback = "09:00") {
  if (!value) {
    return fallback;
  }
  const [, time = ""] = value.split("T");
  return time || fallback;
}

function makeDateTimeValue(date: Date, time: string) {
  return `${dateOnlyValue(date)}T${time.trim() || "09:00"}`;
}

function parseDateTimeValue(value?: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function monthLabelValue(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function buildAdminCalendarCells(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const lastDate = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: { key: string; date?: Date }[] = [];
  for (let index = 0; index < firstDay; index += 1) {
    cells.push({ key: `blank-${index}` });
  }
  for (let day = 1; day <= lastDate; day += 1) {
    cells.push({ key: `day-${day}`, date: new Date(month.getFullYear(), month.getMonth(), day) });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `blank-${cells.length}` });
  }
  return cells;
}

function sameDate(left: Date | null, right?: Date) {
  if (!left || !right) {
    return false;
  }
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

export type ExternalLinkDraftState = { boardId: number | null; draft: string };

export function externalLinkBoardTransition(
  current: ExternalLinkDraftState,
  board?: Board,
): ExternalLinkDraftState {
  const boardId = board?.id ?? null;
  if (current.boardId === boardId) return current;
  const metadata = board?.metadata ?? {};
  const key = (["notion_url", "external_url", "url", "link"] as const)
    .find((candidate) => typeof metadata[candidate] === "string");
  return { boardId, draft: key ? String(metadata[key]) : "" };
}

export function externalLinkSaveTransition(
  current: ExternalLinkDraftState,
  targetBoardId: number,
  savedUrl: string,
): ExternalLinkDraftState {
  if (current.boardId !== targetBoardId) return current;
  return { ...current, draft: savedUrl.trim() };
}

export function externalLinkNavigationTransition(
  currentBoardId: number | null,
  nextBoardId: number | null,
  saving: boolean,
): { accepted: boolean; boardId: number | null } {
  return saving
    ? { accepted: false, boardId: currentBoardId }
    : { accepted: true, boardId: nextBoardId };
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        borderRadius: RADIUS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        padding: 16,
        ...ELEVATION,
      }}
    >
      {children}
    </View>
  );
}

function UnsupportedBoardContent({ board }: { board?: Board }) {
  return (
    <Panel>
      <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
        {board ? `${board.name}의 전용 콘텐츠 편집기를 지원하지 않습니다.` : "게시판을 선택해주세요."}
      </Text>
    </Panel>
  );
}

function Field({
  value,
  onChangeText,
  placeholder,
  multiline,
  editable = true,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  editable?: boolean;
}) {
  return (
    <TextInput
      editable={editable}
      multiline={multiline}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#8b97a9"
      style={{
        minHeight: multiline ? 108 : 44,
        borderRadius: RADIUS.button,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: editable ? COLORS.surface : COLORS.surfaceAlt,
        color: COLORS.text,
        paddingHorizontal: 12,
        paddingVertical: 10,
        textAlignVertical: multiline ? "top" : "center",
      }}
      value={value}
    />
  );
}

function EventDateTimePicker({
  label,
  value,
  onChange,
  fallbackTime,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  fallbackTime: string;
}) {
  const selectedDate = parseDateTimeValue(value);
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? new Date());
  const [timeOpen, setTimeOpen] = useState(false);

  useEffect(() => {
    const nextSelectedDate = parseDateTimeValue(value);
    if (nextSelectedDate) {
      setVisibleMonth(new Date(nextSelectedDate.getFullYear(), nextSelectedDate.getMonth(), 1));
    }
  }, [value]);

  const cells = buildAdminCalendarCells(visibleMonth);
  const time = timeOnlyValue(value, fallbackTime);

  const changeMonth = (delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const selectDate = (date: Date) => {
    onChange(makeDateTimeValue(date, time));
  };

  const changeTime = (nextTime: string) => {
    const baseDate = selectedDate ?? visibleMonth;
    onChange(makeDateTimeValue(baseDate, nextTime));
    setTimeOpen(false);
  };

  return (
    <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, padding: 12, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: COLORS.text, fontWeight: "900" }}>{label}</Text>
          <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 3 }}>
            {value ? value.replace("T", " ") : "달력에서 날짜를 선택하세요."}
          </Text>
        </View>
        <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable hitSlop={8} onPress={() => changeMonth(-1)} style={{ padding: 6 }}>
          <BackIcon size={20} color={COLORS.text} />
        </Pressable>
        <Text style={{ color: COLORS.primary900, fontSize: 16, fontWeight: "900" }}>{monthLabelValue(visibleMonth)}</Text>
        <Pressable hitSlop={8} onPress={() => changeMonth(1)} style={{ padding: 6 }}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {EVENT_WEEKDAYS.map((day, index) => (
          <Text
            key={`${label}-${day}`}
            style={{
              width: `${100 / 7}%`,
              textAlign: "center",
              color: index === 0 ? COLORS.error : COLORS.muted,
              fontSize: 12,
              fontWeight: "900",
              paddingVertical: 5,
            }}
          >
            {day}
          </Text>
        ))}
        {cells.map((cell) => {
          const selected = sameDate(selectedDate, cell.date);
          return (
            <Pressable
              key={`${label}-${cell.key}`}
              disabled={!cell.date}
              onPress={() => cell.date && selectDate(cell.date)}
              style={{ width: `${100 / 7}%`, alignItems: "center", paddingVertical: 4 }}
            >
              {cell.date ? (
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: selected ? 0 : 1,
                    borderColor: COLORS.border,
                    backgroundColor: selected ? COLORS.primary : COLORS.surface,
                  }}
                >
                  <Text style={{ color: selected ? "#ffffff" : COLORS.text, fontWeight: "900" }}>{cell.date.getDate()}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: COLORS.muted, fontWeight: "900" }}>시간</Text>
        <View style={{ flex: 1, gap: 8 }}>
          <Pressable
            onPress={() => setTimeOpen((current) => !current)}
            style={{
              minHeight: 44,
              borderRadius: RADIUS.button,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.surface,
              paddingHorizontal: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Text style={{ color: COLORS.text, fontWeight: "900" }}>{time}</Text>
            <Ionicons name={timeOpen ? "chevron-up" : "chevron-down"} size={18} color={COLORS.muted} />
          </Pressable>
          {timeOpen ? (
            <View
              style={{
                borderRadius: RADIUS.button,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: COLORS.surface,
                padding: 8,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {EVENT_TIME_OPTIONS.map((option) => {
                const selected = option === time;
                return (
                  <Pressable
                    key={`${label}-${option}`}
                    onPress={() => changeTime(option)}
                    style={{
                      width: "23%",
                      minHeight: 34,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: RADIUS.button,
                      borderWidth: 1,
                      borderColor: selected ? COLORS.primary : COLORS.border,
                      backgroundColor: selected ? COLORS.primary50 : COLORS.surfaceAlt,
                    }}
                  >
                    <Text style={{ color: selected ? COLORS.primary : COLORS.text, fontSize: 12, fontWeight: "900" }}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  tone = "primary",
  disabled,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  tone?: "primary" | "outline" | "danger" | "muted";
  disabled?: boolean;
}) {
  const background =
    tone === "primary" ? COLORS.primary : tone === "danger" ? COLORS.error : tone === "muted" ? COLORS.surfaceAlt : COLORS.surface;
  const borderColor = tone === "outline" || tone === "muted" ? COLORS.border : background;
  const color = tone === "primary" || tone === "danger" ? "#ffffff" : tone === "muted" ? COLORS.muted : COLORS.text;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 6,
        borderRadius: RADIUS.button,
        borderWidth: 1,
        borderColor,
        backgroundColor: background,
        opacity: disabled ? 0.5 : 1,
        paddingHorizontal: 12,
        paddingVertical: 11,
      }}
    >
      {icon ? <Ionicons name={icon} size={17} color={color} /> : null}
      <Text style={{ color, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

function IntroPhotoGalleryEditor({
  values,
  uploading,
  disabled,
  onUpload,
  onRemove,
  onMove,
}: {
  values: string[];
  uploading: boolean;
  disabled: boolean;
  onUpload: () => void;
  onRemove: (index: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: COLORS.primary900, fontSize: 14, fontWeight: "900" }}>소개 사진</Text>
      <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18 }}>첫 번째 사진이 대표 이미지로 표시됩니다. 사진을 추가한 뒤 위·아래로 순서를 바꿀 수 있습니다.</Text>
      {values.length === 0 ? (
        <View style={{ alignItems: "center", justifyContent: "center", minHeight: 96, borderRadius: 8, borderWidth: 1, borderStyle: "dashed", borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, padding: 12 }}>
          <Ionicons name="images-outline" size={28} color={COLORS.muted} />
          <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>등록된 소개 사진이 없습니다.</Text>
        </View>
      ) : values.map((value, index) => (
        <View key={`${value}-${index}`} style={{ gap: 8, borderRadius: RADIUS.card, borderWidth: 1, borderColor: index === 0 ? COLORS.primary : COLORS.border, backgroundColor: COLORS.surfaceAlt, padding: 10 }}>
          <Text style={{ color: index === 0 ? COLORS.primary : COLORS.primary900, fontSize: 12, fontWeight: "900" }}>
            {index === 0 ? "대표 이미지" : `사진 ${index + 1}`}
          </Text>
          {mediaUrl(value) ? (
            <MediaImage media={{ url: value }} style={{ width: "100%", aspectRatio: 2.2, borderRadius: 8, backgroundColor: COLORS.primary50 }} />
          ) : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><ActionButton icon="chevron-up-outline" label="위로" onPress={() => onMove(index, index - 1)} disabled={disabled || index === 0} tone="outline" /></View>
            <View style={{ flex: 1 }}><ActionButton icon="chevron-down-outline" label="아래로" onPress={() => onMove(index, index + 1)} disabled={disabled || index === values.length - 1} tone="outline" /></View>
            <View style={{ flex: 1 }}><ActionButton icon="trash-outline" label="삭제" onPress={() => onRemove(index)} disabled={disabled} tone="danger" /></View>
          </View>
        </View>
      ))}
      <ActionButton icon="images-outline" label={uploading ? "업로드 중" : "사진 여러 장 추가"} onPress={onUpload} disabled={disabled} tone="outline" />
    </View>
  );
}

function IntroMemberEditor({
  member,
  index,
  uploading,
  uploadDisabled,
  canMoveUp,
  canMoveDown,
  onChange,
  onUpload,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  member: ExecutiveFormMember;
  index: number;
  uploading: boolean;
  uploadDisabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (patch: Partial<ExecutiveFormMember>) => void;
  onUpload: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const previewUrl = mediaUrl(member.image_url);
  return (
    <View style={{ gap: 10, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, padding: 12 }}>
      <Text style={{ color: COLORS.primary900, fontWeight: "900" }}>임원 카드 {index + 1}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {previewUrl ? (
          <MediaImage media={{ url: member.image_url }} style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primary50 }} />
        ) : (
          <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary50 }}>
            <Ionicons name="person" size={30} color={COLORS.primary} />
          </View>
        )}
        <View style={{ flex: 1, gap: 8 }}>
          <ActionButton icon="image-outline" label={uploading ? "업로드 중" : "프로필 사진"} onPress={onUpload} disabled={uploadDisabled} tone="outline" />
          {member.image_url ? <ActionButton label="사진 삭제" onPress={() => onChange({ image_url: "" })} tone="danger" /> : null}
        </View>
      </View>
      <Field value={member.name} onChangeText={(value) => onChange({ name: value })} placeholder="이름" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Field value={member.cohort} onChangeText={(value) => onChange({ cohort: value })} placeholder="기수 예: 75기" /></View>
        <View style={{ flex: 1 }}><Field value={member.role} onChangeText={(value) => onChange({ role: value })} placeholder="직책" /></View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><ActionButton icon="chevron-up-outline" label="위로" onPress={onMoveUp} disabled={uploadDisabled || !canMoveUp} tone="outline" /></View>
        <View style={{ flex: 1 }}><ActionButton icon="chevron-down-outline" label="아래로" onPress={onMoveDown} disabled={uploadDisabled || !canMoveDown} tone="outline" /></View>
      </View>
      <ActionButton icon="trash-outline" label="이 임원 카드 삭제" onPress={onRemove} disabled={uploadDisabled} tone="danger" />
    </View>
  );
}

function MajorOptionEditor({
  item,
  onSave,
}: {
  item: MajorOption;
  onSave: (majorId: number, payload: { name: string; sort_order: number; is_active: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState(item.name);
  const [sortOrder, setSortOrder] = useState(String(item.sort_order));
  const [isActive, setIsActive] = useState(item.is_active);

  useEffect(() => {
    setName(item.name);
    setSortOrder(String(item.sort_order));
    setIsActive(item.is_active);
  }, [item.id, item.is_active, item.name, item.sort_order]);

  return (
    <Panel>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ flex: 1, color: COLORS.primary900, fontSize: 16, fontWeight: "900" }}>{item.name}</Text>
          <Chip active={isActive} label={isActive ? "활성" : "비활성"} onPress={() => setIsActive((current) => !current)} tone={isActive ? "success" : "muted"} />
        </View>
        <Field value={name} onChangeText={setName} placeholder="전공명" />
        <Field value={sortOrder} onChangeText={(value) => setSortOrder(value.replace(/\D/g, ""))} placeholder="정렬 순서" />
        <ActionButton
          icon="save-outline"
          label="전공 저장"
          onPress={() => void onSave(item.id, { name: name.trim(), sort_order: Number(sortOrder || 0), is_active: isActive })}
        />
      </View>
    </Panel>
  );
}

function Chip({
  label,
  active,
  onPress,
  tone = "primary",
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: "primary" | "success" | "warning" | "danger" | "muted";
}) {
  const toneColor =
    tone === "success" ? COLORS.success : tone === "warning" ? COLORS.warning : tone === "danger" ? COLORS.error : tone === "muted" ? COLORS.muted : COLORS.primary;
  const activeBg =
    tone === "success"
      ? "#EAF7EF"
      : tone === "warning"
        ? "#FFF7D9"
        : tone === "danger"
          ? "#FDECEC"
          : tone === "muted"
            ? COLORS.surfaceAlt
            : COLORS.primary50;
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={{
        borderRadius: RADIUS.button,
        borderWidth: 1,
        borderColor: active ? toneColor : COLORS.border,
        backgroundColor: active ? activeBg : COLORS.surface,
        paddingHorizontal: 10,
        paddingVertical: 7,
      }}
    >
      <Text style={{ color: active ? toneColor : COLORS.muted, fontSize: 12, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

function StatusText({ active, activeLabel = "노출", inactiveLabel = "숨김" }: { active: boolean; activeLabel?: string; inactiveLabel?: string }) {
  return <Chip active label={active ? activeLabel : inactiveLabel} tone={active ? "success" : "danger"} />;
}

function BannerImageControl({
  label,
  hint,
  value,
  uploading,
  onChangeText,
  onUpload,
}: {
  label: string;
  hint: string;
  value: string;
  uploading: boolean;
  onChangeText: (value: string) => void;
  onUpload: () => void;
}) {
  const fileName = value ? value.split("/").pop() : "";
  return (
    <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: COLORS.text, fontWeight: "900" }}>{label}</Text>
          <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>{hint}</Text>
        </View>
        <ActionButton
          icon="cloud-upload-outline"
          label={uploading ? "업로드 중" : "파일 업로드"}
          onPress={onUpload}
          tone={value ? "outline" : "primary"}
          disabled={uploading}
        />
      </View>
      {fileName ? <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: "800" }}>{fileName}</Text> : null}
      <Field value={value} onChangeText={onChangeText} placeholder={`${label} 이미지 URL`} />
    </View>
  );
}

function BannerPreview({ form, index = 0, total = 1 }: { form: BannerForm; index?: number; total?: number }) {
  const imageUrl = mediaUrl(cleanOptional(form.mobile_image_url) ?? cleanOptional(form.tablet_image_url) ?? cleanOptional(form.desktop_image_url));
  const pageTotal = Math.max(total, 1);
  const pageIndex = Math.min(index + 1, pageTotal);

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: COLORS.primary900, fontSize: 13, fontWeight: "900" }}>등록 이미지 미리보기</Text>
      {imageUrl ? (
        <MediaImageBackground
          media={{ url: imageUrl }}
          imageStyle={{ borderRadius: RADIUS.card }}
          resizeMode="cover"
          style={{
            aspectRatio: 8 / 5,
            borderRadius: RADIUS.card,
            overflow: "hidden",
            backgroundColor: COLORS.surfaceAlt,
            ...ELEVATION,
          }}
        >
          <View style={{ flex: 1, alignItems: "flex-end", justifyContent: "flex-end", padding: 16 }}>
            <View style={{ borderRadius: 999, backgroundColor: "rgba(0,0,0,0.28)", paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "900" }}>{pageIndex}/{pageTotal}</Text>
            </View>
          </View>
        </MediaImageBackground>
      ) : (
        <View
          style={{
            aspectRatio: 8 / 5,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: RADIUS.card,
            overflow: "hidden",
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: COLORS.borderStrong,
            backgroundColor: COLORS.surfaceAlt,
          }}
        >
          <Ionicons name="image-outline" size={28} color={COLORS.subtle} />
          <Text style={{ color: COLORS.muted, fontSize: 13, marginTop: 8 }}>배너 이미지를 등록해주세요.</Text>
        </View>
      )}
    </View>
  );
}

function BannerCard({
  item,
  position,
  selected,
  onEdit,
  onHide,
}: {
  item: BannerItem;
  position: number;
  selected?: boolean;
  onEdit: (item: BannerItem) => void;
  onHide: (item: BannerItem) => void;
}) {
  return (
    <View
      style={{
        borderRadius: RADIUS.card,
        borderWidth: 1,
        borderColor: selected ? COLORS.primary : COLORS.border,
        backgroundColor: selected ? COLORS.primary50 : COLORS.surface,
        padding: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Chip active label={`${position}번째 배너`} tone="primary" />
        <StatusText active={item.is_active} />
        <Chip active label={item.theme} />
        {item.image_urls?.mobile || item.image_urls?.tablet || item.image_urls?.desktop || item.image_url ? (
          <Chip active label="이미지" tone="success" />
        ) : null}
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>순서 {item.sort_order}</Text>
      </View>
      <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "900" }}>{item.title || "이미지 배너"}</Text>
      {item.subtitle ? <Text style={{ color: COLORS.muted, lineHeight: 20 }}>{item.subtitle}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <ActionButton icon="create-outline" label={selected ? "수정 중" : "선택/수정"} onPress={() => onEdit(item)} tone={selected ? "primary" : "outline"} />
        </View>
        <View style={{ flex: 1 }}>
          <ActionButton icon="eye-off-outline" label="숨김" onPress={() => onHide(item)} tone="danger" disabled={!item.is_active} />
        </View>
      </View>
    </View>
  );
}

function NoticeCard({
  item,
  onEdit,
  onPinToggle,
  onDelete,
}: {
  item: PostListItem;
  onEdit: (item: PostListItem) => void;
  onPinToggle: (item: PostListItem) => void;
  onDelete: (item: PostListItem) => void;
}) {
  return (
    <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {item.is_pinned ? <Chip active label="고정" tone="warning" /> : <Chip label="일반" tone="muted" />}
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>{formatDate(item.created_at)}</Text>
      </View>
      <Pressable onPress={() => router.push(`/board/post/${item.id}` as never)}>
        <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "900" }} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={{ color: COLORS.muted, lineHeight: 20, marginTop: 4 }} numberOfLines={2}>
          {item.content_preview}
        </Text>
      </Pressable>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <ActionButton icon="create-outline" label="수정" onPress={() => onEdit(item)} tone="outline" />
        <ActionButton icon={item.is_pinned ? "remove-circle-outline" : "pin-outline"} label={item.is_pinned ? "고정 해제" : "고정"} onPress={() => onPinToggle(item)} tone="outline" />
        <ActionButton icon="trash-outline" label="삭제" onPress={() => onDelete(item)} tone="danger" />
      </View>
    </View>
  );
}

function ShortcutCard({
  title,
  description,
  icon,
  meta,
  onPress,
}: {
  title: string;
  description: string;
  icon: IconName;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: RADIUS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        padding: 14,
        gap: 10,
        ...ELEVATION,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 38,
            height: 38,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: RADIUS.button,
            backgroundColor: COLORS.primary50,
          }}
        >
          <Ionicons name={icon} size={20} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "900" }}>{title}</Text>
          <Text style={{ color: COLORS.muted, lineHeight: 19, marginTop: 3 }}>{description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.subtle} />
      </View>
      <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: "900" }}>{meta}</Text>
    </Pressable>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: number | string; hint: string }) {
  return (
    <View style={{ flex: 1, minWidth: 132, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14 }}>
      <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "900" }}>{label}</Text>
      <Text style={{ color: COLORS.primary900, fontSize: 24, fontWeight: "900", marginTop: 6 }}>{value}</Text>
      <Text style={{ color: COLORS.subtle, fontSize: 12, marginTop: 4 }}>{hint}</Text>
    </View>
  );
}

function AdminPostCard({
  item,
  board,
  onPinToggle,
  onDelete,
  onRepresentativeImageChange,
  isReplacingRepresentativeImage = false,
  showActivityCertificationBankAccount = false,
}: {
  item: PostListItem;
  board?: Board;
  onPinToggle: (item: PostListItem) => void;
  onDelete: (item: PostListItem) => void;
  onRepresentativeImageChange?: (item: PostListItem) => void;
  isReplacingRepresentativeImage?: boolean;
  showActivityCertificationBankAccount?: boolean;
}) {
  const contentControl = adminBoardContentControl(board);
  const canManageRepresentativeImage = contentControl.canReplaceRepresentativeImage && Boolean(onRepresentativeImageChange);
  const hasThumbnail = Boolean(item.thumbnail_media_id || item.thumbnail_url);
  const bankAccount = adminActivityCertificationBankAccount({
    allowDisplay: showActivityCertificationBankAccount,
    boardType: board?.board_type,
    metadata: item.metadata,
  });
  return (
    <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Chip active label={item.board_name ?? `게시판 ${item.board_id}`} />
        {item.is_notice ? <Chip active label="공지" tone="warning" /> : null}
        {item.is_pinned ? <Chip active label="고정" tone="success" /> : null}
        {item.is_anonymous ? <Chip active label="익명" tone="muted" /> : null}
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>{formatDate(item.created_at)}</Text>
      </View>
      <Pressable onPress={() => router.push(`/board/post/${item.id}` as never)}>
        <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "900" }} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={{ color: COLORS.muted, lineHeight: 20, marginTop: 4 }} numberOfLines={2}>
          {item.content_preview}
        </Text>
      </Pressable>
      <Text style={{ color: COLORS.muted, fontSize: 12 }}>
        작성자 {item.author_nickname} · 댓글 {item.comment_count} · 추천 {item.like_count} · 첨부 {item.attachment_count ?? 0}
      </Text>
      {bankAccount ? (
        <View style={{ borderRadius: RADIUS.button, backgroundColor: COLORS.primary50, padding: 12, gap: 4 }}>
          <Text style={{ color: COLORS.primary900, fontSize: 12, fontWeight: "900" }}>계좌번호</Text>
          <Text selectable style={{ color: COLORS.text, fontSize: 15, fontWeight: "800" }}>{bankAccount}</Text>
        </View>
      ) : null}
      {canManageRepresentativeImage ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: RADIUS.button, backgroundColor: COLORS.surfaceAlt, padding: 10 }}>
          {hasThumbnail ? (
            <MediaImage
              media={{ id: item.thumbnail_media_id, url: item.thumbnail_url }}
              resizeMode="cover"
              style={{ width: 92, height: 58, borderRadius: RADIUS.button, backgroundColor: COLORS.border }}
            />
          ) : (
            <View style={{ width: 92, height: 58, borderRadius: RADIUS.button, backgroundColor: COLORS.primary50, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="image-outline" size={24} color={COLORS.primary} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text style={{ color: COLORS.text, fontWeight: "900" }}>현재 대표 이미지</Text>
            <Text style={{ color: COLORS.muted, fontSize: 12 }} numberOfLines={2}>
              첫 번째 이미지가 목록과 상세 상단에 표시됩니다.
            </Text>
          </View>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <ActionButton icon="open-outline" label="열기" onPress={() => router.push(`/board/post/${item.id}` as never)} tone="outline" />
        <ActionButton icon="create-outline" label="수정" onPress={() => router.push(`/board/post/edit/${item.id}` as never)} tone="outline" />
        {canManageRepresentativeImage ? (
          <ActionButton
            icon="image-outline"
            label={isReplacingRepresentativeImage ? "이미지 변경 중" : "대표 이미지 변경"}
            onPress={() => onRepresentativeImageChange?.(item)}
            disabled={isReplacingRepresentativeImage}
            tone="outline"
          />
        ) : null}
        <ActionButton icon={item.is_pinned ? "remove-circle-outline" : "pin-outline"} label={item.is_pinned ? "고정 해제" : "고정"} onPress={() => onPinToggle(item)} tone="outline" />
        <ActionButton icon="trash-outline" label="삭제" onPress={() => onDelete(item)} tone="danger" />
      </View>
    </View>
  );
}

const MUTUAL_AID_ADMIN_STATUS: Record<MutualAidStatus, { label: string; tone: "primary" | "success" | "danger" }> = {
  processing: { label: "처리중", tone: "primary" },
  completed: { label: "처리 완료", tone: "success" },
  rejected: { label: "반려", tone: "danger" },
};

function MutualAidAdminCard({ item }: { item: PostListItem }) {
  const request = item.mutual_aid;
  const status = MUTUAL_AID_ADMIN_STATUS[request?.status ?? "processing"];
  return (
    <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Chip active label={status.label} tone={status.tone} />
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>{formatDate(item.created_at)}</Text>
      </View>
      <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "900" }}>{item.title}</Text>
      <Text style={{ color: COLORS.muted, fontSize: 13 }}>
        신청자 {formatCohortName(item.author_cohort, item.author_nickname)}
        {request ? ` · ${request.event_type} · ${request.event_date} · ${request.relation}` : ""}
      </Text>
      {request?.rejection_reason ? (
        <View style={{ borderRadius: RADIUS.button, backgroundColor: "#FDECEF", padding: 10 }}>
          <Text style={{ color: COLORS.error, fontSize: 12, fontWeight: "900" }}>반려 사유</Text>
          <Text style={{ color: COLORS.text, lineHeight: 19, marginTop: 4 }}>{request.rejection_reason}</Text>
        </View>
      ) : null}
      <ActionButton
        icon="open-outline"
        label={request?.status === "processing" ? "검토 · 처리" : "신청 상세 보기"}
        onPress={() => router.push(`/board/post/${item.id}` as never)}
      />
    </View>
  );
}

function SuggestionAdminCard({ item }: { item: PostListItem }) {
  const answered = item.suggestion?.status === "answered";
  return (
    <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Chip active label={answered ? "답변완료" : "대기중"} tone={answered ? "success" : "warning"} />
        <Chip active label="익명" tone="muted" />
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>{formatDate(item.created_at)}</Text>
      </View>
      <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "900" }}>{item.title}</Text>
      {item.content_preview ? <Text style={{ color: COLORS.muted, lineHeight: 20 }} numberOfLines={3}>{item.content_preview}</Text> : null}
      {item.suggestion?.admin_reply ? (
        <View style={{ borderRadius: RADIUS.button, backgroundColor: COLORS.primary50, padding: 10 }}>
          <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: "900" }}>원우회 답변</Text>
          <Text style={{ color: COLORS.text, lineHeight: 19, marginTop: 4 }} numberOfLines={3}>{item.suggestion.admin_reply}</Text>
        </View>
      ) : null}
      <ActionButton
        icon={answered ? "create-outline" : "chatbox-ellipses-outline"}
        label={answered ? "답변 확인 · 수정" : "답변 작성"}
        onPress={() => router.push(`/board/post/${item.id}` as never)}
      />
    </View>
  );
}

function UserCard({
  item,
  onRoleToggle,
  onActiveToggle,
  onEligibilityChange,
}: {
  item: AdminUserItem;
  onRoleToggle: (item: AdminUserItem) => void;
  onActiveToggle: (item: AdminUserItem) => void;
  onEligibilityChange: (
    item: AdminUserItem,
    payload: Partial<Pick<AdminUserItem, "enrollment_status">>
  ) => void;
}) {
  return (
    <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <StatusText active={item.is_active} activeLabel="활성" inactiveLabel="비활성" />
        <Chip active={item.role === "admin"} label={USER_ROLE_LABELS[item.role]} />
        {item.cohort ? <Text style={{ color: COLORS.muted, fontSize: 12 }}>{item.cohort}기</Text> : null}
      </View>
      <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "900" }}>{item.nickname}</Text>
      <Text style={{ color: COLORS.muted }}>{item.email}</Text>
      {item.major ? <Text style={{ color: COLORS.muted }}>전공: {item.major}</Text> : null}
      {item.privacy_policy_version && item.privacy_consented_at ? (
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>
          개인정보 동의: v{item.privacy_policy_version} · {item.privacy_consented_at.slice(0, 16).replace("T", " ")}
        </Text>
      ) : (
        <Text style={{ color: COLORS.subtle, fontSize: 12 }}>개인정보 동의 기록: 없음(기존 계정)</Text>
      )}
      <View style={{ gap: 6 }}>
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>재학 상태</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {([
            ["active", "재학"],
            ["leave", "휴학"],
            ["graduated", "졸업"],
          ] as const).map(([value, label]) => (
            <Chip
              key={value}
              active={item.enrollment_status === value}
              label={label}
              onPress={() => onEligibilityChange(item, { enrollment_status: value })}
            />
          ))}
        </View>
      </View>
      <Text style={{ color: COLORS.muted, fontSize: 12 }}>가입 {formatDate(item.created_at)} / 최근 {formatDate(item.last_login_at)}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <ActionButton label={item.role === "admin" ? "일반 전환" : "관리자 지정"} onPress={() => onRoleToggle(item)} tone="outline" />
        </View>
        <View style={{ flex: 1 }}>
          <ActionButton label={item.is_active ? "비활성화" : "복구"} onPress={() => onActiveToggle(item)} tone={item.is_active ? "danger" : "primary"} />
        </View>
      </View>
    </View>
  );
}

function ReportCard({
  report,
  onStatusChange,
  onDeleteTarget,
}: {
  report: AdminReportItem;
  onStatusChange: (report: AdminReportItem, status: ReportStatus) => void;
  onDeleteTarget: (report: AdminReportItem) => void;
}) {
  const targetLabel = report.target_type === "post" ? "게시글" : "댓글";
  const canOpenTarget = report.target.post_id && !report.target.target_deleted;
  const canDeleteTarget = report.target.target_exists && !report.target.target_deleted;

  return (
    <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Chip active label={`${targetLabel} 신고`} tone="danger" />
        <Chip active label={REPORT_STATUS_LABELS[report.status]} />
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>{formatDate(report.created_at)}</Text>
      </View>
      <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "900" }} numberOfLines={2}>
        {report.target.title ?? "삭제되었거나 찾을 수 없는 대상"}
      </Text>
      {report.target.content_preview ? (
        <Text style={{ color: COLORS.muted, lineHeight: 20 }} numberOfLines={3}>
          {report.target.content_preview}
        </Text>
      ) : null}
      <Text style={{ color: COLORS.text, fontWeight: "800" }}>사유: {REPORT_REASON_LABELS[report.reason] ?? report.reason}</Text>
      {report.detail ? <Text style={{ color: COLORS.muted, lineHeight: 20 }}>상세: {report.detail}</Text> : null}
      <Text style={{ color: COLORS.muted }}>
        신고자 {report.reporter_nickname} / 작성자 {report.target.author_nickname ?? "알 수 없음"}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["open", "reviewing", "resolved", "dismissed"] as const).map((status) => (
          <Chip key={status} active={report.status === status} label={REPORT_STATUS_LABELS[status]} onPress={() => onStatusChange(report, status)} />
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <ActionButton
            label="대상 보기"
            onPress={() => {
              if (report.target.post_id) {
                router.push(`/board/post/${report.target.post_id}` as never);
              }
            }}
            tone="outline"
            disabled={!canOpenTarget}
          />
        </View>
        <View style={{ flex: 1 }}>
          <ActionButton label="대상 삭제" onPress={() => onDeleteTarget(report)} tone="danger" disabled={!canDeleteTarget} />
        </View>
      </View>
    </View>
  );
}

function FAQCard({ item, onEdit, onDelete }: { item: FAQItem; onEdit: (item: FAQItem) => void; onDelete: (item: FAQItem) => void }) {
  return (
    <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <StatusText active={item.is_active} />
        {item.category ? <Chip active label={item.category} /> : null}
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>순서 {item.sort_order}</Text>
      </View>
      <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "900" }}>{item.question}</Text>
      <Text style={{ color: COLORS.muted, lineHeight: 20 }} numberOfLines={4}>
        {item.answer}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <ActionButton label="수정" onPress={() => onEdit(item)} tone="outline" />
        </View>
        <View style={{ flex: 1 }}>
          <ActionButton label="숨김" onPress={() => onDelete(item)} tone="danger" />
        </View>
      </View>
    </View>
  );
}

function EventCard({ event, onEdit }: { event: EventItem; onEdit: (event: EventItem) => void }) {
  return (
    <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
        <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: "900" }}>
          {eventCategoryLabel(event.category)}
        </Text>
      </View>
      <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "900" }}>{event.title}</Text>
      <Text style={{ color: COLORS.muted }}>{formatBoardDateTime(event.start_at)}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <ActionButton label="수정" onPress={() => onEdit(event)} tone="outline" />
        </View>
        <View style={{ flex: 1 }}>
          <ActionButton label="보기" onPress={() => router.push(`/events/${event.id}` as never)} tone="outline" />
        </View>
      </View>
    </View>
  );
}

export default function AdminScreen() {
  const params = useLocalSearchParams<{ editEventId?: string; section?: string; scope?: string }>();
  const editEventIdParam = firstParam(params.editEventId);
  const editEventId = editEventIdParam ? Number(editEventIdParam) : null;
  const rawAdminSection = firstParam(params.section);
  const rawAdminLinkKey = [rawAdminSection ?? "", firstParam(params.scope) ?? "", editEventIdParam ?? ""].join(":");
  const user = useUserStore((state) => state.user);
  const queryClient = useQueryClient();
  const [section, setSection] = useState<AdminSection>(parseAdminSection(params.section) ?? "dashboard");
  const [boardManagementScope, setBoardManagementScope] = useState<AdminContentScope>("all");
  const [boardManagementBoardId, setBoardManagementBoardId] = useState<number | null>(null);
  const [boardManagementTab, setBoardManagementTab] = useState<AdminBoardManagementTab>("content");
  const [creatingBoard, setCreatingBoard] = useState(false);
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
    queryKey: ["admin-audit-logs"],
    queryFn: () => adminApi.getAuditLogs({ size: 8 }),
    enabled: isAdmin && section === "dashboard",
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
  }, [boards, boardsQuery.status, pendingBoardNavigationIntent]);

  useEffect(() => {
    pendingBoardNavigationIntentRef.current = null;
    setPendingBoardNavigationIntent(null);
    if (noticeOperationRef.current) noticeEditRequestRef.current += 1;
    const nextSection = parseAdminSection(params.section);
    if (nextSection) {
      setSection(nextSection);
    }
  }, [editEventIdParam, params.scope, params.section]);

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
    setSection("boardManagement");
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
    setSection("boardManagement");
    setBoardManagementScope(destination.scope);
    setBoardManagementBoardId(destination.boardId);
    setBoardManagementTab(destination.tab);
    reset(emptyEvent);
    router.replace({ pathname: "/admin", params: { section: "boardManagement" } } as never);
  }, [boards, editEventMissing, rawAdminLinkKey, reset]);

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
    setSection("boardManagement");
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

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, padding: 16 }}>
        <BackButton fallback="/(tabs)/settings" />
        <View style={{ marginTop: 16, borderRadius: RADIUS.card, borderWidth: 1, borderColor: "#F7B8B8", backgroundColor: "#FDECEC", padding: 18 }}>
          <Text style={{ color: COLORS.error, fontSize: 18, fontWeight: "900" }}>관리자 권한이 필요합니다</Text>
          <Text style={{ color: COLORS.muted, lineHeight: 21, marginTop: 8 }}>이 화면은 관리자 API 권한으로만 사용할 수 있습니다.</Text>
        </View>
      </View>
    );
  }

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
  const noticeOperationPending = noticeOperationKind !== null;
  const managedNavigationLocked = boardSettingsSaving || externalLinkSaving || noticeOperationPending;
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
    setSection(nextSection);
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
      starts_at: cleanNullable(bannerForm.starts_at),
      ends_at: cleanNullable(bannerForm.ends_at),
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
        <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>
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
        <Text style={{ color: COLORS.muted, fontWeight: "800" }}>게시판 유형</Text>
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
        <Text style={{ color: COLORS.muted, fontWeight: "800" }}>권한</Text>
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
    if (noticeOperationRef.current) return;
    const transition = noticeEditorBoardTransition(
      selectedNoticeBoardIdRef.current,
      nextBoardId,
      editingNoticeBoardId,
    );
    if (transition.shouldResetEditor) resetNoticeForm();
    selectedNoticeBoardIdRef.current = transition.selectedBoardId;
    setSelectedNoticeBoardId(transition.selectedBoardId);
  };

  const handleEditNotice = async (item: PostListItem) => {
    if (noticeOperationRef.current) return;
    const targetBoardId = item.board_id;
    const requestId = ++noticeEditRequestRef.current;
    try {
      const detail = await postApi.getPostDetail(item.id);
      if (
        noticeEditRequestRef.current !== requestId
        || selectedNoticeBoardIdRef.current !== targetBoardId
      ) return;
      editingNoticeIdRef.current = item.id;
      setEditingNoticeId(item.id);
      setEditingNoticeBoardId(targetBoardId);
      setNoticeForm({
        title: detail.data.title,
        content: detail.data.content,
        category: normalizeNoticeCategoryValue(detail.data.category),
        is_pinned: detail.data.is_pinned,
        show_in_council_activity: detail.data.metadata?.show_in_council_activity === true,
        deadline_at: detail.data.deadline_at?.slice(0, 16) ?? "",
      });
      setNoticeAttachments(detail.data.attachments ?? []);
      setNoticeMetadata(detail.data.metadata ?? {});
    } catch {
      if (noticeEditRequestRef.current !== requestId) return;
      Alert.alert("불러오기 실패", "공지 상세를 불러올 수 없습니다.");
    }
  };

  const handleUploadNoticeImage = async () => {
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

  const handleSaveNotice = async () => {
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

    const operation = startNoticeEditorOperation("save");
    if (!operation) return;

    const payload = {
      title: noticeForm.title.trim(),
      content: noticeForm.content.trim(),
      category: cleanOptional(noticeForm.category),
      is_anonymous: false,
      attachment_ids: noticeAttachments.map((attachment) => attachment.id),
      metadata: {
        ...noticeMetadata,
        show_in_council_activity: noticeForm.show_in_council_activity,
      },
      deadline_at: cleanNullable(noticeForm.deadline_at),
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
        afterPrimarySuccess: async () => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["admin-notices"] }),
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
        if (result.notification === "failure") Alert.alert("저장 실패", "공지사항 입력 정보를 확인하세요.");
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
      router.replace({ pathname: "/admin", params: { section: "boardManagement" } } as never);
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
        router.replace({ pathname: "/admin", params: { section: "boardManagement" } } as never);
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
    router.push({ pathname: "/admin", params: { section: "boardManagement", editEventId: String(event.id) } } as never);
  };

  const deleteEventFromList = async (event: EventItem) => {
    try {
      await eventApi.deleteEvent(event.id);
      if (editEventId === event.id) {
        reset(emptyEvent);
        router.replace({ pathname: "/admin", params: { section: "boardManagement" } } as never);
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

  const renderNoticeContent = () => (
    <View style={{ gap: 12 }}>
      <Panel>
        <View style={{ gap: 10 }}>
          <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>
            {editingNoticeId ? "공지사항 수정" : "공지사항 등록"}
          </Text>
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
          <Field value={noticeForm.content} onChangeText={(value) => setNoticeForm((current) => ({ ...current, content: value }))} placeholder="공지 내용" multiline editable={!noticeOperationPending} />
          <View style={{ gap: 6 }}>
            <Text style={{ color: COLORS.text, fontWeight: "900" }}>신청·접수 마감</Text>
            <Field value={noticeForm.deadline_at} onChangeText={(value) => setNoticeForm((current) => ({ ...current, deadline_at: value }))} placeholder="2026-07-31T18:00 (선택)" editable={!noticeOperationPending} />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: COLORS.text, fontWeight: "900" }}>분류</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {NOTICE_CATEGORY_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  active={noticeForm.category === option.value}
                  label={option.label}
                  onPress={noticeOperationPending ? undefined : () => setNoticeForm((current) => ({ ...current, category: option.value }))}
                />
              ))}
            </View>
          </View>
          <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, padding: 12, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.text, fontWeight: "900" }}>공지 이미지</Text>
                <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 3 }}>
                  본문에 함께 표시할 이미지를 첨부합니다.
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
                    <Text style={{ color: COLORS.text, fontWeight: "900" }} numberOfLines={1}>
                      {attachment.original_filename}
                    </Text>
                    <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>
                      {Math.ceil((attachment.file_size ?? 0) / 1024)} KB
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
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
                      onPress={() => setNoticeAttachments((current) => current.filter((item) => item.id !== attachment.id))}
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
                <Text style={{ color: COLORS.text, fontWeight: "900" }}>원우회 활동내역 연동</Text>
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
              <Text style={{ color: "#B45309", fontSize: 12, fontWeight: "800" }}>연동하려면 공지 이미지를 1장 이상 첨부해야 합니다.</Text>
            ) : null}
          </View>
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
              <ActionButton icon="save-outline" label={noticeOperationKind === "save" ? "저장 중" : editingNoticeId ? "공지 저장" : "공지 등록"} onPress={handleSaveNotice} disabled={noticeOperationPending} />
            </View>
          </View>
          {editingNoticeId ? <ActionButton label="수정 취소" onPress={resetNoticeForm} tone="outline" disabled={noticeOperationPending} /> : null}
        </View>
      </Panel>
      <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>
        {selectedNoticeBoard?.name ?? "공지 게시판"} 목록
      </Text>
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
    </View>
  );

  const renderStandardPostContent = () => {
    const contentBoard = selectedManagedBoard;
    const contentControl = adminBoardContentControl(contentBoard);
    return (
      <View style={{ gap: 12 }}>
        <Panel>
          <View style={{ gap: 10 }}>
            <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>
              {contentBoard ? `${contentBoard.name} 콘텐츠 관리` : "전체 게시글 관리"}
            </Text>
            <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
              게시글을 검색하고 열기, 수정, 고정, 삭제와 지원 게시판의 대표 이미지를 관리합니다.
            </Text>
            {contentBoard ? (
              <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.primary100, backgroundColor: COLORS.primary50, padding: 12, gap: 9 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: COLORS.primary900, fontSize: 16, fontWeight: "900" }}>{contentBoard.name} 관리</Text>
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
            <Text style={{ color: COLORS.muted, fontWeight: "800" }}>상태 필터</Text>
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
            <Text style={{ color: COLORS.subtle, fontSize: 12, fontWeight: "800" }}>총 {adminPostTotal}개 게시글</Text>
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
            <Text style={{ color: COLORS.text, fontWeight: "800" }}>{adminPostPage} / {adminPostTotalPages}</Text>
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
          <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>상조회 신청 관리</Text>
          <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
            신청 상세에서 증빙서류를 확인한 후 처리 완료 또는 반려를 선택합니다. 반려 시 사유 입력이 필수입니다.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {([['processing', '처리중'], ['completed', '처리 완료'], ['rejected', '반려'], ['all', '전체']] as const).map(([value, label]) => (
              <Chip key={value} active={mutualAidFilter === value} label={label} onPress={() => setMutualAidFilter(value)} />
            ))}
          </View>
          <Text style={{ color: COLORS.subtle, fontSize: 12, fontWeight: "800" }}>
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
          <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>건의사항 답변 관리</Text>
          <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
            작성자는 익명으로 유지됩니다. 상세 화면에서 공식 답변을 입력하면 답변완료로 처리되고 작성자에게 알림이 전송됩니다.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {([['received', '대기중'], ['answered', '답변완료'], ['all', '전체']] as const).map(([value, label]) => (
              <Chip key={value} active={suggestionFilter === value} label={label} onPress={() => setSuggestionFilter(value)} />
            ))}
          </View>
          <Text style={{ color: COLORS.subtle, fontSize: 12, fontWeight: "800" }}>
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
          <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>원우회 활동내역 연동 공지</Text>
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
          <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>원우회 소개 관리</Text>
          <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
            현재 원우회의 소개 사진 여러 장, 인사말, 소개글과 임원 카드를 등록하면 원우회 소개 화면에 바로 반영됩니다.
          </Text>
        </View>
      </Panel>
      {!executivesBoard ? <Panel><Text style={{ color: COLORS.error, fontWeight: "800" }}>gsa-executives 게시판을 찾을 수 없습니다.</Text></Panel> : null}
      {currentCouncils.map((council, cardIndex) => (
        <Panel key={`current-council-${cardIndex}`}>
          <View style={{ gap: 10 }}>
            <Text style={{ color: COLORS.primary900, fontSize: 16, fontWeight: "900" }}>{council.title || "현재 원우회"}</Text>
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
          <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>기수별 기장단 소개 관리</Text>
          <Text style={{ color: COLORS.muted, lineHeight: 20 }}>기수별 소개 사진 여러 장, 인사말, 소개글과 필요한 만큼의 임원 카드를 등록할 수 있습니다.</Text>
        </View>
      </Panel>
      {!cohortLeadersBoard ? <Panel><Text style={{ color: COLORS.error, fontWeight: "800" }}>gsa-cohort-leaders 게시판을 찾을 수 없습니다.</Text></Panel> : null}
      {cohortLeaders.map((leader, index) => (
        <Panel key={`cohort-leader-${index}`}>
          <View style={{ gap: 10 }}>
            <Text style={{ color: COLORS.primary900, fontSize: 16, fontWeight: "900" }}>{leader.cohort || "새 기수"} 기장단</Text>
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
      <Panel><View style={{ gap: 8 }}><Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>역대 원우회 관리</Text><Text style={{ color: COLORS.muted, lineHeight: 20 }}>대수별 소개 사진 여러 장, 인사말, 소개글, 활동내역과 필요한 만큼의 임원 카드를 등록합니다.</Text></View></Panel>
      {!pastCouncilsBoard ? <Panel><Text style={{ color: COLORS.error, fontWeight: "800" }}>gsa-past-councils 게시판을 찾을 수 없습니다. 게시판 목록을 다시 불러와주세요.</Text></Panel> : null}
      {pastCouncils.map((council, index) => (
        <Panel key={`past-council-${index}`}>
          <View style={{ gap: 10 }}>
            <Text style={{ color: COLORS.primary900, fontSize: 16, fontWeight: "900" }}>{council.cohort || "새 역대 원우회"} 원우회</Text>
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
          <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>{editingFAQId ? "FAQ 수정" : "FAQ 등록"}</Text>
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
          <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>{editEventId ? "일정 수정" : "일정 등록"}</Text>
          <Controller control={control} name="title" render={({ field }) => <Field onChangeText={field.onChange} placeholder="일정 제목" value={field.value ?? ""} />} />
          <Controller control={control} name="category" render={({ field }) => (
            <View style={{ gap: 7 }}>
              <Text style={{ color: COLORS.text, fontWeight: "900" }}>일정 분류</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {EVENT_CATEGORY_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    active={eventDisplayCategory(field.value) === option.value}
                    label={option.label}
                    onPress={() => field.onChange(option.value)}
                  />
                ))}
              </View>
            </View>
          )} />
          <Controller control={control} name="start_at" render={({ field }) => <EventDateTimePicker label="시작일시" value={field.value ?? ""} onChange={field.onChange} fallbackTime="09:00" />} />
          <Controller control={control} name="end_at" render={({ field }) => <EventDateTimePicker label="종료일시" value={field.value ?? ""} onChange={field.onChange} fallbackTime="11:00" />} />
          <Controller control={control} name="location" render={({ field }) => <Field onChangeText={field.onChange} placeholder="장소" value={field.value ?? ""} />} />
          <Controller control={control} name="description" render={({ field }) => <Field multiline onChangeText={field.onChange} placeholder="상세 설명" value={field.value ?? ""} />} />
          <ActionButton icon="save-outline" label={editEventId ? "일정 저장" : "일정 등록"} onPress={handleSubmit(onSubmitEvent)} />
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
          <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>외부 링크 관리</Text>
          <Text style={{ color: COLORS.muted, lineHeight: 20 }}>사용자 화면에서 열 외부 HTTP(S) 주소를 입력하세요.</Text>
          <Field value={externalLinkDraft} onChangeText={(value) => { setExternalLinkDraft(value); setExternalLinkError(null); }} placeholder="https://example.com" editable={!externalLinkSaving} />
          {externalLinkError ? <Text style={{ color: COLORS.error, fontWeight: "800" }}>{externalLinkError}</Text> : null}
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

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ gap: 14 }}>
        <BackButton fallback="/(tabs)/settings" />
        <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.primary700, backgroundColor: COLORS.primary900, padding: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.primary100} />
            <Text style={{ color: COLORS.primary100, fontSize: 12, fontWeight: "800", letterSpacing: 0 }}>AI·SW CAMPUS</Text>
          </View>
          <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: "900", marginTop: 8 }}>관리자 페이지</Text>
          <Text style={{ color: "#D5E0FE", lineHeight: 20, marginTop: 6 }}>
            배너, 공지사항, 원우회 페이지, 게시글과 운영 콘텐츠를 한곳에서 관리합니다.
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {SECTIONS.map((item) => (
            <Pressable
              key={item.key}
              accessibilityState={{ disabled: managedNavigationLocked }}
              disabled={managedNavigationLocked}
              onPress={() => openAdminSection(item.key)}
              style={{
                minWidth: 92,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 6,
                borderRadius: RADIUS.button,
                borderWidth: 1,
                borderColor: section === item.key ? COLORS.primary : COLORS.borderStrong,
                backgroundColor: section === item.key ? COLORS.primary50 : COLORS.surface,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Ionicons name={item.icon} size={17} color={section === item.key ? COLORS.primary : COLORS.muted} />
              <Text style={{ color: section === item.key ? COLORS.primary : COLORS.text, fontWeight: "900" }}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {section === "dashboard" ? (
          <View style={{ gap: 12 }}>
            <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>운영 바로가기</Text>
            <AdminBoardTargetQueryState
              status={boardsQuery.isPending ? "loading" : boardsQuery.isError ? "error" : "aggregate"}
              onRetry={() => void boardsQuery.refetch()}
            />
            {pendingBoardNavigationIntent ? (
              <Text accessibilityLiveRegion="polite" style={{ color: COLORS.muted, fontSize: 12 }}>
                게시판 목록을 확인한 뒤 요청한 바로가기로 이동합니다.
              </Text>
            ) : null}
            <ShortcutCard
              icon="albums-outline"
              title="배너 등록 · 미리보기"
              description="홈 화면에 노출되는 배너 이미지를 등록하고 모바일 미리보기를 확인합니다."
              meta={`노출 ${activeBannerCount}개 / 전체 ${banners.length}개`}
              onPress={() => openAdminSection("banners")}
            />
            <ShortcutCard
              icon="megaphone-outline"
              title="공지사항 등록"
              description="학사공지, 행사공지 등 관리자 전용 공지 게시판에 새 공지를 작성합니다."
              meta={`${noticeBoards.length}개 공지 게시판 관리`}
              onPress={() => openManagedBoard("all-notices")}
            />
            <ShortcutCard
              icon="people-circle-outline"
              title="원우회 게시판 설정"
              description="활동내역, 회계장부, 상조회 같은 원우회 메뉴 게시판의 권한과 노출을 관리합니다."
              meta={`${councilBoardCount}개 원우회 게시판 설정`}
              onPress={() => openManagedBoard("council-activity", "settings")}
            />
            <ShortcutCard
              icon="people-circle-outline"
              title="원우회 소개 등록"
              description="현재 원우회의 대표 이미지, 인사말, 소개글과 임원 카드를 등록합니다."
              meta={currentCouncils[0]?.members.length ? `${currentCouncils[0].members.length}개 임원 카드 등록` : "등록 필요"}
              onPress={() => openManagedBoard("gsa-executives")}
            />
            <ShortcutCard
              icon="ribbon-outline"
              title="기수별 기장단 등록"
              description="기장·부기장 이름, 소개글과 대표·프로필 이미지를 관리자 전용으로 등록합니다."
              meta={`${cohortLeaders.length}개 기수 등록`}
              onPress={() => openManagedBoard("gsa-cohort-leaders")}
            />
            <ShortcutCard
              icon="time-outline"
              title="역대 원우회 관리"
              description="역대 원우회 임원진, 소개와 활동내역을 별도 관리합니다."
              meta={`${pastCouncils.length}개 원우회 등록`}
              onPress={() => openManagedBoard("gsa-past-councils")}
            />
            <ShortcutCard
              icon="document-text-outline"
              title="전체 게시글 관리"
              description="전체 게시글을 검색하고 고정, 수정, 삭제 같은 운영 작업을 처리합니다."
              meta={`${adminPostTotal}개 게시글 조회`}
              onPress={openAllManagedPosts}
            />
            <ShortcutCard
              icon="flower-outline"
              title="상조회 신청 처리"
              description="신청 내용과 비공개 증빙서류를 확인하고 처리 완료 또는 반려로 변경합니다."
              meta={`처리 대기 ${processingMutualAidCount}건`}
              onPress={() => openManagedBoard("mutual-aid")}
            />
            <ShortcutCard
              icon="chatbox-ellipses-outline"
              title="건의사항 답변"
              description="익명 건의사항을 확인하고 원우회 공식 답변을 등록합니다."
              meta={`답변 대기 ${pendingSuggestionCount}건`}
              onPress={() => openManagedBoard("suggestions")}
            />
            <ShortcutCard
              icon="people-outline"
              title="동아리 게시글 등록"
              description="대표 사진과 가입 신청 링크를 포함한 동아리 소개 글을 등록합니다."
              meta={clubPromoBoard ? "관리자 전용 게시판" : "동아리 게시판 확인 필요"}
              onPress={() => openManagedBoard("club-promo")}
            />
            <ShortcutCard
              icon="git-network-outline"
              title="네트워킹 게시글 등록"
              description="대표 사진과 참가 신청 링크를 포함한 네트워킹 안내 글을 등록합니다."
              meta={networkingProgramsBoard ? "관리자 전용 게시판" : "네트워킹 게시판 확인 필요"}
              onPress={() => openManagedBoard("networking-programs")}
            />
            <ShortcutCard
              icon="help-circle-outline"
              title="FAQ 관리"
              description="FAQ 목록, 정렬 순서와 노출 상태를 관리합니다."
              meta={`${faqs.length}개 FAQ`}
              onPress={() => openManagedBoard("gsa-faq")}
            />
            <ShortcutCard
              icon="calendar-outline"
              title="일정 관리"
              description="학사 일정과 원우회 일정을 등록하고 수정합니다."
              meta={`${events.length}개 일정`}
              onPress={() => openManagedBoard("academic-calendar")}
            />
            <ShortcutCard
              icon="notifications-outline"
              title="D-day 알림 실행"
              description="오늘과 내일 일정을 확인해 중복 없이 D-day/D-1 알림을 생성합니다."
              meta="스케줄러 수동 실행"
              onPress={() => void dispatchEventReminders()}
            />
            <ShortcutCard
              icon="cloud-done-outline"
              title="푸시 전송 결과 확인"
              description="Expo Push 영수증을 동기화하고 만료된 기기 토큰을 비활성화합니다."
              meta={`전송 실패 ${stats?.push_failed ?? 0}건`}
              onPress={() => void syncPushReceipts()}
            />

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <MetricCard label="전체 회원" value={stats?.users_total ?? users.length} hint={`최근 30일 ${stats?.users_active_30d ?? 0}명`} />
              <MetricCard label="전체 게시글" value={stats?.posts ?? adminPostTotal} hint={`공지 ${stats?.notices ?? 0}개`} />
              <MetricCard label="전체 댓글" value={stats?.comments ?? 0} hint="삭제 제외 운영 지표" />
              <MetricCard label="미처리 신고" value={stats?.open_reports ?? 0} hint={`푸시 실패 ${stats?.push_failed ?? 0}건`} />
            </View>

            <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900", marginTop: 4 }}>최근 운영 기록</Text>
            {auditLogsQuery.isLoading ? <ActivityIndicator /> : null}
            {!auditLogsQuery.isLoading && auditLogs.length === 0 ? (
              <Panel><Text style={{ color: COLORS.muted }}>아직 기록된 관리자 작업이 없습니다.</Text></Panel>
            ) : null}
            {auditLogs.map((item) => (
              <Panel key={item.id}>
                <View style={{ gap: 5 }}>
                  <Text style={{ color: COLORS.text, fontWeight: "900" }}>{item.action}</Text>
                  <Text style={{ color: COLORS.muted, fontSize: 13 }}>
                    {item.actor_nickname} · {item.target_type}{item.target_id ? ` #${item.target_id}` : ""}
                  </Text>
                  <Text style={{ color: COLORS.subtle, fontSize: 12 }}>{formatDate(item.created_at)}</Text>
                </View>
              </Panel>
            ))}

            <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900", marginTop: 4 }}>최근 게시글</Text>
            {adminPostsQuery.isLoading ? <ActivityIndicator /> : null}
            {!adminPostsQuery.isLoading && adminPosts.length === 0 ? (
              <Panel>
                <Text style={{ color: COLORS.muted }}>표시할 게시글이 없습니다.</Text>
              </Panel>
            ) : null}
            {adminPosts.slice(0, 5).map((item) => (
              <AdminPostCard key={item.id} item={item} onPinToggle={handlePinAdminPost} onDelete={handleDeleteAdminPost} />
            ))}
          </View>
        ) : null}

        {section === "banners" ? (
          <View style={{ gap: 12 }}>
            <Panel>
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>배너 작업 선택</Text>
                    <Text style={{ color: COLORS.muted, lineHeight: 20, marginTop: 4 }}>
                      {editingBannerId
                        ? `${selectedBannerPosition ?? "-"}번째 배너를 수정 중입니다.`
                        : `${nextBannerPosition}번째 배너를 새로 등록합니다.`}
                    </Text>
                  </View>
                  <ActionButton icon="add-outline" label="신규 배너" onPress={resetBannerForm} tone={editingBannerId ? "outline" : "primary"} />
                </View>
                <Text style={{ color: COLORS.subtle, fontSize: 12, fontWeight: "800" }}>
                  순서 숫자가 낮을수록 홈에서 먼저 보입니다. 같은 순서는 등록 ID 순서로 정렬됩니다.
                </Text>
                {sortedBanners.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                    {sortedBanners.map((item, index) => {
                      const selected = editingBannerId === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => handleEditBanner(item)}
                          style={{
                            width: 178,
                            borderRadius: RADIUS.card,
                            borderWidth: 1,
                            borderColor: selected ? COLORS.primary : COLORS.border,
                            backgroundColor: selected ? COLORS.primary50 : COLORS.surfaceAlt,
                            padding: 12,
                            gap: 7,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <Text style={{ color: selected ? COLORS.primary : COLORS.text, fontSize: 13, fontWeight: "900" }}>
                              {index + 1}번째 배너
                            </Text>
                            <StatusText active={item.is_active} />
                          </View>
                          <Text style={{ color: COLORS.text, fontWeight: "900" }} numberOfLines={1}>
                            {item.title || "이미지 배너"}
                          </Text>
                          <Text style={{ color: COLORS.muted, fontSize: 12 }} numberOfLines={1}>
                            순서 {item.sort_order ?? 0} · {item.theme}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <Text style={{ color: COLORS.muted }}>등록된 배너가 없습니다. 신규 배너를 먼저 등록하세요.</Text>
                )}
              </View>
            </Panel>
            <Panel>
              <View style={{ gap: 10 }}>
                <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>
                  {editingBannerId ? `${selectedBannerPosition ?? "-"}번째 배너 수정` : `${nextBannerPosition}번째 홈 배너 등록`}
                </Text>
                {bannerSaveMessage ? (
                  <View
                    style={{
                      borderRadius: RADIUS.button,
                      borderWidth: 1,
                      borderColor:
                        bannerSaveMessage.tone === "success"
                          ? "#B9E5C8"
                          : bannerSaveMessage.tone === "error"
                            ? "#F7B8B8"
                            : COLORS.primary100,
                      backgroundColor:
                        bannerSaveMessage.tone === "success"
                          ? "#EAF7EF"
                          : bannerSaveMessage.tone === "error"
                            ? "#FDECEC"
                            : COLORS.primary50,
                      padding: 10,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          bannerSaveMessage.tone === "success"
                            ? COLORS.success
                            : bannerSaveMessage.tone === "error"
                              ? COLORS.error
                              : COLORS.primary,
                        fontSize: 13,
                        fontWeight: "900",
                      }}
                    >
                      {bannerSaveMessage.text}
                    </Text>
                  </View>
                ) : null}
                <View style={{ borderRadius: RADIUS.button, backgroundColor: COLORS.primary50, padding: 12 }}>
                  <Text style={{ color: COLORS.primary900, fontSize: 13, lineHeight: 19 }}>
                    홈에서는 등록한 이미지를 그대로 표시합니다. 제목·날짜·배지 문구는 이미지 제작 시 포함해주세요.
                  </Text>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={{ color: COLORS.text, fontWeight: "900" }}>노출 일정</Text>
                  <Text style={{ color: COLORS.muted, fontSize: 12 }}>형식: 2026-07-31T18:00</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Field value={bannerForm.starts_at} onChangeText={(value) => setBannerForm((current) => ({ ...current, starts_at: value }))} placeholder="노출 시작" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field value={bannerForm.ends_at} onChangeText={(value) => setBannerForm((current) => ({ ...current, ends_at: value }))} placeholder="노출 종료" />
                    </View>
                  </View>
                </View>
                <Field value={bannerForm.cta_href} onChangeText={(value) => setBannerForm((current) => ({ ...current, cta_href: value }))} placeholder="배너 선택 시 이동 링크 예: /faq (선택)" />
                <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, padding: 12, gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.text, fontWeight: "900" }}>공지글 연결</Text>
                      <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 3 }}>게시글을 선택하면 배너 링크가 자동 입력됩니다.</Text>
                    </View>
                    {bannerForm.cta_href ? <Chip active label={bannerForm.cta_href} tone="primary" /> : null}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                    {noticeBoards.map((board) => (
                      <Chip
                        key={board.id}
                        active={selectedNoticeBoardId === board.id}
                        label={board.name}
                        onPress={() => handleSelectNoticeBoard(board.id)}
                      />
                    ))}
                  </ScrollView>
                  {noticePostsQuery.isLoading ? <ActivityIndicator /> : null}
                  {!noticePostsQuery.isLoading && noticePosts.length === 0 ? (
                    <Text style={{ color: COLORS.muted, fontSize: 13 }}>선택한 공지 게시판에 게시글이 없습니다.</Text>
                  ) : null}
                  <View style={{ gap: 8 }}>
                    {noticePosts.slice(0, 6).map((item) => {
                      const href = `/board/post/${item.id}`;
                      const selected = bannerForm.cta_href === href;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => setBannerForm((current) => ({ ...current, cta_href: href }))}
                          style={{
                            borderRadius: RADIUS.button,
                            borderWidth: 1,
                            borderColor: selected ? COLORS.primary : COLORS.border,
                            backgroundColor: selected ? COLORS.primary50 : COLORS.surface,
                            padding: 10,
                            gap: 4,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Ionicons name={selected ? "checkmark-circle" : "document-text-outline"} size={16} color={selected ? COLORS.primary : COLORS.muted} />
                            <Text style={{ flex: 1, color: selected ? COLORS.primary : COLORS.text, fontWeight: "900" }} numberOfLines={1}>
                              {item.title}
                            </Text>
                          </View>
                          <Text style={{ color: COLORS.muted, fontSize: 12 }} numberOfLines={1}>
                            {selectedNoticeBoard?.name ?? item.board_name ?? "공지"} · {formatDate(item.created_at)} · {href}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View style={{ gap: 8 }}>
                  {BANNER_IMAGE_SLOTS.map((slot) => {
                    const field = `${slot.key}_image_url` as keyof Pick<
                      BannerForm,
                      "mobile_image_url" | "tablet_image_url" | "desktop_image_url"
                    >;
                    return (
                      <BannerImageControl
                        key={slot.key}
                        label={slot.label}
                        hint={slot.hint}
                        value={bannerForm[field]}
                        uploading={bannerUploadSlot === slot.key}
                        onUpload={() => handleUploadBannerImage(slot.key)}
                        onChangeText={(value) => setBannerForm((current) => ({ ...current, [field]: value }))}
                      />
                    );
                  })}
                </View>
                <BannerPreview form={bannerForm} index={previewBannerPosition - 1} total={previewBannerTotal} />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Field value={bannerForm.sort_order} onChangeText={(value) => setBannerForm((current) => ({ ...current, sort_order: value }))} placeholder="순서" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ActionButton
                      label={bannerForm.is_active ? "홈에 표시" : "홈에서 숨김"}
                      icon={bannerForm.is_active ? "eye-outline" : "eye-off-outline"}
                      onPress={() => setBannerForm((current) => ({ ...current, is_active: !current.is_active }))}
                      tone={bannerForm.is_active ? "primary" : "muted"}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <ActionButton
                      icon="save-outline"
                      label={bannerSaving ? "저장 중" : editingBannerId ? "배너 저장" : "배너 등록"}
                      onPress={handleSaveBanner}
                      disabled={bannerSaving}
                    />
                  </View>
                  {editingBannerId ? (
                    <View style={{ flex: 1 }}>
                      <ActionButton label="취소" onPress={resetBannerForm} tone="outline" />
                    </View>
                  ) : null}
                </View>
              </View>
            </Panel>
            {bannersQuery.isLoading ? <ActivityIndicator /> : null}
            {sortedBanners.map((item, index) => (
              <BannerCard
                key={item.id}
                item={item}
                position={index + 1}
                selected={editingBannerId === item.id}
                onEdit={handleEditBanner}
                onHide={handleHideBanner}
              />
            ))}
          </View>
        ) : null}

        {section === "boardManagement" ? (
          <View style={{ gap: 12 }}>
            <Panel>
              <AdminBoardManagementNavigator
                boards={boards}
                scope={boardManagementScope}
                selectedBoardId={boardManagementBoardId}
                selectedTab={boardManagementTab}
                creatingBoard={creatingBoard}
                disabled={managedNavigationLocked || !boardsQuery.isSuccess}
                onScopeChange={handleBoardManagementScopeChange}
                onBoardChange={handleBoardManagementBoardChange}
                onTabChange={handleBoardManagementTabChange}
                onCreateBoard={handleCreateManagedBoard}
              />
            </Panel>

            <AdminBoardTargetQueryState
              status={managedContentTarget.status}
              missingReason={managedContentTarget.status === "missing" ? managedContentTarget.reason : undefined}
              onRetry={() => void boardsQuery.refetch()}
            />

            {boardsQuery.isSuccess && creatingBoard && boardManagementTab === "settings" ? renderBoardFormPanel() : null}

            {!creatingBoard && boardManagementTab === "settings" && selectedManagedBoard && boardSettingsDraft ? (
              <Panel>
                <AdminBoardSettingsPanel
                  board={selectedManagedBoard}
                  draft={boardSettingsDraft}
                  lockedPolicies={selectedBoardCapability.lockedPolicies}
                  saving={boardSettingsSaving}
                  onChange={setBoardSettingsDraft}
                  onSave={() => void handleSaveBoardSettings()}
                />
              </Panel>
            ) : null}

            {!creatingBoard && boardManagementTab === "content" && hasManagedContentTarget ? (
              <AdminBoardContentPanel
                board={selectedManagedBoard}
                capability={selectedBoardCapability}
                renderers={managedContentRenderers}
              />
            ) : null}
          </View>
        ) : null}

        {section === "accounts" ? (
          <View style={{ gap: 12 }}>
            <Panel>
              <View style={{ gap: 10 }}>
                <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>계정 컨트롤</Text>
                <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
                  `sogang.ac.kr` 메일 인증을 완료한 계정의 권한과 활성 상태를 관리합니다.
                </Text>
                <Field value={userSearch} onChangeText={setUserSearch} placeholder="이메일, 닉네임, 기수 검색" />
                <ActionButton icon="search-outline" label="검색" onPress={() => setAppliedUserSearch(userSearch)} />
              </View>
            </Panel>
            {usersQuery.isLoading ? <ActivityIndicator /> : null}
            {!usersQuery.isLoading && users.length === 0 ? (
              <Panel>
                <Text style={{ color: COLORS.muted }}>표시할 회원이 없습니다.</Text>
              </Panel>
            ) : null}
            {users.map((item) => (
              <UserCard
                key={item.id}
                item={item}
                onRoleToggle={handleUserRoleToggle}
                onActiveToggle={handleUserActiveToggle}
                onEligibilityChange={handleUserEligibilityChange}
              />
            ))}
          </View>
        ) : null}

        {section === "studentRoster" ? <DuesRosterSection /> : null}
        {section === "duesPayers" ? <DuesPayerSection /> : null}

        {section === "reports" ? (
          <View style={{ gap: 12 }}>
            <Panel>
              <View style={{ gap: 10 }}>
                <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>신고 관리</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {(["open", "reviewing", "resolved", "dismissed", "all"] as const).map((status) => (
                    <Chip key={status} active={reportStatus === status} label={REPORT_STATUS_LABELS[status]} onPress={() => setReportStatus(status)} />
                  ))}
                </View>
              </View>
            </Panel>
            {reportsQuery.isLoading ? <ActivityIndicator /> : null}
            {!reportsQuery.isLoading && reports.length === 0 ? (
              <Panel>
                <Text style={{ color: COLORS.muted }}>표시할 신고가 없습니다.</Text>
              </Panel>
            ) : null}
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} onStatusChange={handleReportStatus} onDeleteTarget={handleDeleteTarget} />
            ))}
          </View>
        ) : null}

        {section === "registration" ? (
          <View style={{ gap: 12 }}>
            <Panel>
              <View style={{ gap: 10 }}>
                <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>개인정보 처리방침 버전</Text>
                <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
                  신규 회원은 저장 시점의 활성 버전에 동의해야 하며, 동의 시각과 버전이 계정에 기록됩니다.
                </Text>
                {adminPrivacyPolicy ? (
                  <Text style={{ color: COLORS.success, fontSize: 12, fontWeight: "900" }}>
                    현재 적용: v{adminPrivacyPolicy.version} · {adminPrivacyPolicy.effective_at.slice(0, 16).replace("T", " ")}
                  </Text>
                ) : null}
                <Field value={policyVersion} onChangeText={setPolicyVersion} placeholder="정책 버전 (예: 2026-07-12)" />
                <Field value={policyEffectiveAt} onChangeText={setPolicyEffectiveAt} placeholder="시행일시 (YYYY-MM-DDTHH:mm)" />
                <ActionButton icon="shield-checkmark-outline" label="정책 버전 적용" onPress={() => void handleSavePrivacyPolicy()} />
              </View>
            </Panel>

            <Panel>
              <View style={{ gap: 10 }}>
                <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>전공 추가</Text>
                <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
                  활성 전공만 회원가입 선택 목록에 노출됩니다. 기존 회원이 사용 중인 전공은 비활성화해도 기록이 유지됩니다.
                </Text>
                <Field value={newMajorName} onChangeText={setNewMajorName} placeholder="전공명" />
                <Field value={newMajorOrder} onChangeText={(value) => setNewMajorOrder(value.replace(/\D/g, ""))} placeholder="정렬 순서" />
                <ActionButton icon="add-outline" label="전공 추가" onPress={() => void handleCreateMajor()} />
              </View>
            </Panel>

            {adminMajorsQuery.isLoading || adminPrivacyPolicyQuery.isLoading ? <ActivityIndicator /> : null}
            {adminMajorsQuery.isError || adminPrivacyPolicyQuery.isError ? (
              <Panel><Text style={{ color: COLORS.error, fontWeight: "800" }}>가입 설정을 불러오지 못했습니다.</Text></Panel>
            ) : null}
            {adminMajors.map((item) => (
              <MajorOptionEditor key={item.id} item={item} onSave={handleSaveMajor} />
            ))}
          </View>
        ) : null}
        </View>
      </ScrollView>
      <AdminPostDeleteConfirm
        visible={pendingAdminPostDelete !== null}
        deleting={adminPostDeleting}
        error={adminPostDeleteError}
        onCancel={closeAdminPostDeleteConfirm}
        onConfirm={() => void confirmAdminPostDelete()}
      />
      <AdminSaveSuccessModal
        visible={saveSuccessFeedback !== null}
        title={saveSuccessFeedback?.title ?? ""}
        message={saveSuccessFeedback?.message ?? ""}
        onConfirm={() => setSaveSuccessFeedback(null)}
      />
    </>
  );
}
