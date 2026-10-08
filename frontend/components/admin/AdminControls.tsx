import { Ionicons } from "@expo/vector-icons";
import { router as expoRouter } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { z } from "zod";
import { AppText as Text, AppTextInput as TextInput } from "../../components/AppTypography";
import { BackIcon } from "../../components/icons";
import MediaImage, { MediaImageBackground } from "../../components/MediaImage";
import { API_ORIGIN } from "../../services/api";
import type { AdminReportItem, AdminUserItem, ApiSuccess, BannerItem, Board, EventItem, FAQItem, MajorOption, MutualAidStatus, PostListItem, ReportStatus } from "../../types";
import { adminActivityCertificationBankAccount, adminBoardContentControl } from "../../utils/adminContentManagement";
import { councilGalleryFields, type CohortLeaderFormData, type CouncilMemberFormData, type CurrentCouncilFormData, type PastCouncilFormData } from "../../utils/councilIntroductions";
import { formatBoardDateTime, utcApiDateTimeToKoreaInput } from "../../utils/dateFormat";
import { eventCategoryLabel } from "../../utils/eventCategoryPresentation";
import { toAbsoluteMediaUrl } from "../../utils/mediaAccess";
import { formatCohortName } from "../../utils/userLabel";

import { adminPostRouter } from "../../utils/adminPostRouter";
import { BOARD_WEB_COLORS, BOARD_WEB_STYLES, useAdminBoardWebTheme } from "./AdminBoardTheme";
const router = adminPostRouter(expoRouter, Platform.OS === "web");

export const COLORS = {
  primary: "#2761FF",
  primary50: "#EDF2FE",
  primary100: "#D5E0FE",
  primary700: "#0B3AC4",
  primary900: "#111827",
  cyan: "#1FA9BD",
  success: "#2FA365",
  warning: "#E5A500",
  error: "#D94343",
  bg: "#FFFFFF",
  surface: "#ffffff",
  surfaceAlt: "#F8FAFC",
  border: "#E1E4E9",
  borderStrong: "#C7CDD4",
  text: "#111827",
  muted: "#6B7280",
  subtle: "#8A919C",
};


export const RADIUS = {
  button: 6,
  card: 8,
};


export const ELEVATION = {
  shadowColor: "#0B1F56",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.04,
  shadowRadius: 12,
  elevation: 1,
};


export const eventSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  start_at: z.string().min(1),
  end_at: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
});


export type EventForm = z.infer<typeof eventSchema>;

export type AdminBoardsQueryData = ApiSuccess<Board[]>;

export type OptimisticManagedBoard = { board: Board; insertedGeneration: number };

export type AdminSection = import("../../utils/adminNavigation").AdminSection;

export type AdminPostMode = "all" | "notice" | "pinned";

export type SuggestionAdminFilter = "received" | "answered" | "all";

export type IconName = keyof typeof Ionicons.glyphMap;

export type BannerImageSlot = "mobile" | "tablet" | "desktop";

export type BannerSaveMessage = { tone: "success" | "error" | "info"; text: string } | null;


export type BannerForm = {
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


export type BoardForm = {
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


export type NoticeForm = {
  inline_images?: import("../../utils/noticeBody").NoticeBodyImage[];
  poll?: import("../../types").NoticePollDraft | null;
  poll_revision?: number;
  title: string;
  content: string;
  category: string;
  is_pinned: boolean;
  show_in_council_activity: boolean;
  deadline_at: string;
};


export type ExecutiveFormMember = CouncilMemberFormData;

export type CohortLeaderForm = CohortLeaderFormData;

export type PastCouncilForm = Omit<PastCouncilFormData, "activities"> & { activities_text: string };

export type IntroImageTarget = { cardIndex: number; memberIndex?: number };


export type FAQForm = {
  question: string;
  answer: string;
  category: string;
  sort_order: string;
};


export const emptyEvent: EventForm = {
  title: "",
  category: "event",
  start_at: "",
  end_at: "",
  location: "",
  description: "",
};


export const emptyBanner: BannerForm = {
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


export const emptyBoard: BoardForm = {
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


export const emptyNotice: NoticeForm = {
  title: "",
  content: "",
  category: "all",
  is_pinned: false,
  show_in_council_activity: false,
  deadline_at: "",
};


export const emptyExecutiveMember: ExecutiveFormMember = {
  name: "",
  cohort: "",
  role: "",
  image_url: "",
  intro: "",
};


export const emptyCurrentCouncil: CurrentCouncilFormData = {
  title: "",
  greeting: "",
  intro: "",
  banner_image_url: "",
  photo_urls: [],
  members: [],
};


export const emptyCohortLeader: CohortLeaderForm = {
  cohort: "",
  greeting: "",
  intro: "",
  banner_image_url: "",
  photo_urls: [],
  members: [],
};


export const emptyPastCouncil: PastCouncilForm = {
  cohort: "",
  greeting: "",
  intro: "",
  activities_text: "",
  banner_image_url: "",
  photo_urls: [],
  members: [],
};


export const emptyFAQ: FAQForm = {
  question: "",
  answer: "",
  category: "general",
  sort_order: "0",
};


export const SECTIONS: { key: AdminSection; label: string; icon: IconName }[] = [
  { key: "main", label: "메인", icon: "home-outline" },
  { key: "dashboard", label: "대시보드", icon: "speedometer-outline" },
  { key: "banners", label: "배너", icon: "albums-outline" },
  { key: "boardManagement", label: "게시판 관리", icon: "grid-outline" },
  { key: "accounts", label: "계정", icon: "people-outline" },
  { key: "studentRoster", label: "원우 명부", icon: "people-circle-outline" },
  { key: "duesPayments", label: "원우회비", icon: "receipt-outline" },
  { key: "reports", label: "신고", icon: "flag-outline" },
  { key: "registration", label: "가입 설정", icon: "person-add-outline" },
  { key: "audit", label: "운영 기록", icon: "time-outline" },
];


export const ADMIN_SECTION_KEYS = SECTIONS.map((item) => item.key);


export const ADMIN_POST_MODE_FILTERS: { key: AdminPostMode; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "notice", label: "공지글" },
  { key: "pinned", label: "고정글" },
];


export const NOTICE_CATEGORY_OPTIONS = [
  { value: "all", label: "전체 공지" },
  { value: "academic", label: "학사 공지" },
  { value: "event", label: "행사 공지" },
  { value: "webinar", label: "웨비나/특강 공지" },
  { value: "other", label: "기타 공지" },
] as const;


export const EVENT_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export const EVENT_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minute}`;
});


export const BOARD_TYPE_LABELS: Record<string, string> = {
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


export function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}


export function parseAdminSection(value?: string | string[]) {
  const raw = firstParam(value);
  return ADMIN_SECTION_KEYS.includes(raw as AdminSection) ? (raw as AdminSection) : null;
}


export const REPORT_STATUS_LABELS: Record<ReportStatus | "all", string> = {
  all: "전체",
  open: "접수",
  reviewing: "검토 중",
  resolved: "처리 완료",
  dismissed: "기각",
};


export const REPORT_REASON_LABELS: Record<string, string> = {
  inappropriate: "부적절한 내용",
  spam: "스팸/홍보",
  harassment: "비방/괴롭힘",
  privacy: "개인정보 노출",
  other: "기타",
};


export const USER_ROLE_LABELS: Record<AdminUserItem["role"], string> = {
  user: "일반",
  admin: "관리자",
};


export const BANNER_IMAGE_SLOTS: { key: BannerImageSlot; label: string; hint: string }[] = [
  { key: "mobile", label: "모바일", hint: "권장 640x400 · 8:5" },
  { key: "tablet", label: "태블릿", hint: "권장 960x600 · 8:5" },
  { key: "desktop", label: "데스크톱", hint: "권장 1280x800 · 8:5" },
];


export function cleanOptional(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}


export function cleanNullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}


export function normalizeNoticeCategoryValue(value?: string | null) {
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


export function bannerPosition(banners: BannerItem[], bannerId: number | null) {
  if (!bannerId) {
    return null;
  }
  const index = banners.findIndex((item) => item.id === bannerId);
  return index >= 0 ? index + 1 : null;
}


export function nextBannerOrder(banners: BannerItem[]) {
  if (banners.length === 0) {
    return 1;
  }
  return Math.max(...banners.map((item) => item.sort_order ?? 0)) + 1;
}


export function bannerFormFromItem(item: BannerItem): BannerForm {
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
    starts_at: utcApiDateTimeToKoreaInput(item.starts_at),
    ends_at: utcApiDateTimeToKoreaInput(item.ends_at),
    deadline_at: item.deadline_at?.slice(0, 16) ?? "",
  };
}


export function mediaUrl(value?: string | null) {
  return toAbsoluteMediaUrl(value, API_ORIGIN);
}


export type IntroGalleryForm = { photo_urls?: string[]; banner_image_url: string };


export function introGalleryPatch(photoUrls: readonly string[]) {
  const gallery = councilGalleryFields({ photoUrls });
  return {
    photo_urls: gallery.photo_urls,
    banner_image_url: gallery.banner_image_url,
  };
}


export function appendedIntroGalleryPatch(card: IntroGalleryForm, addedUrls: readonly string[]) {
  const current = councilGalleryFields({
    photoUrls: card.photo_urls,
    bannerImageUrl: card.banner_image_url,
  });
  return introGalleryPatch([...current.photo_urls, ...addedUrls]);
}


export function parseSort(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}


export function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}


export function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}


export function dateOnlyValue(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}


export function timeOnlyValue(value?: string | null, fallback = "09:00") {
  if (!value) {
    return fallback;
  }
  const [, time = ""] = value.split("T");
  return time || fallback;
}


export function makeDateTimeValue(date: Date, time: string) {
  return `${dateOnlyValue(date)}T${time.trim() || "09:00"}`;
}


export function parseDateTimeValue(value?: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}


export function monthLabelValue(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}


export function buildAdminCalendarCells(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const lastDate = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: { key: string; date?: Date }[] = [];
  for (let index = 0;index < firstDay;index += 1) {
    cells.push({ key: `blank-${index}` });
  }
  for (let day = 1;day <= lastDate;day += 1) {
    cells.push({ key: `day-${day}`, date: new Date(month.getFullYear(), month.getMonth(), day) });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `blank-${cells.length}` });
  }
  return cells;
}


export function sameDate(left: Date | null, right?: Date) {
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


export function Panel({ children }: { children: ReactNode }) {
  const boardTheme = useAdminBoardWebTheme();
  return (
    <View
      style={{
        borderRadius: RADIUS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        padding: 16,
        ...(boardTheme ? { padding: 20 } : {}),
        ...(Platform.OS === "web" ? {} : ELEVATION),
      }}
    >
      {children}
    </View>
  );
}


export function UnsupportedBoardContent({ board }: { board?: Board }) {
  return (
    <Panel>
      <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
        {board ? `${board.name}의 전용 콘텐츠 편집기를 지원하지 않습니다.` : "게시판을 선택해주세요."}
      </Text>
    </Panel>
  );
}


export function Field({
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
  const boardTheme = useAdminBoardWebTheme();
  return (
    <TextInput
      editable={editable}
      multiline={multiline}
      onChangeText={onChangeText}
      accessibilityLabel={placeholder}
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
        ...(boardTheme ? { fontSize: 13, color: BOARD_WEB_COLORS.text, backgroundColor: editable ? BOARD_WEB_COLORS.surface : BOARD_WEB_COLORS.subtle } : {}),
      }}
      value={value}
    />
  );
}


export function EventDateTimePicker({
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
          <Text style={{ color: COLORS.text, fontWeight: "600" }}>{label}</Text>
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
        <Text style={{ color: COLORS.primary900, fontSize: 16, fontWeight: "600" }}>{monthLabelValue(visibleMonth)}</Text>
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
              fontWeight: "600",
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
                  <Text style={{ color: selected ? "#ffffff" : COLORS.text, fontWeight: "600" }}>{cell.date.getDate()}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: COLORS.muted, fontWeight: "600" }}>시간</Text>
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
            <Text style={{ color: COLORS.text, fontWeight: "600" }}>{time}</Text>
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
                    <Text style={{ color: selected ? COLORS.primary : COLORS.text, fontSize: 12, fontWeight: "600" }}>{option}</Text>
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


export function ActionButton({
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
  const boardTheme = useAdminBoardWebTheme();
  const background =
    tone === "primary" ? COLORS.primary : tone === "danger" ? COLORS.error : tone === "muted" ? COLORS.surfaceAlt : COLORS.surface;
  const borderColor = tone === "outline" || tone === "muted" ? COLORS.border : background;
  const color = tone === "primary" || tone === "danger" ? "#ffffff" : tone === "muted" ? COLORS.muted : COLORS.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 6,
        borderRadius: RADIUS.button,
        borderWidth: 1,
        borderColor: boardTheme && tone === "danger" ? COLORS.border : borderColor,
        backgroundColor: boardTheme && tone === "danger" ? COLORS.surface : background,
        opacity: disabled ? 0.5 : 1,
        paddingHorizontal: 12,
        paddingVertical: 11,
        ...(boardTheme ? { minHeight: 40, alignSelf: "flex-start" as const, paddingVertical: 9 } : {}),
      }}
    >
      {icon ? <Ionicons name={icon} size={17} color={boardTheme && tone === "danger" ? COLORS.error : color} /> : null}
      <Text style={{ color: boardTheme && tone === "danger" ? COLORS.error : color, fontWeight: "600", ...(boardTheme ? { fontSize: 13 } : {}) }}>{label}</Text>
    </Pressable>
  );
}


export function IntroPhotoGalleryEditor({
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
  const boardTheme = useAdminBoardWebTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: COLORS.primary900, fontSize: 14, fontWeight: "600" }}>소개 사진</Text>
      <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18 }}>첫 번째 사진이 대표 이미지로 표시됩니다. 사진을 추가한 뒤 위·아래로 순서를 바꿀 수 있습니다.</Text>
      {values.length === 0 ? (
        <View style={{ alignItems: "center", justifyContent: "center", minHeight: 96, borderRadius: 8, borderWidth: 1, borderStyle: "dashed", borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, padding: 12 }}>
          <Ionicons name="images-outline" size={28} color={COLORS.muted} />
          <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>등록된 소개 사진이 없습니다.</Text>
        </View>
      ) : values.map((value, index) => (
        <View key={`${value}-${index}`} style={{ gap: 8, borderRadius: RADIUS.card, borderWidth: 1, borderColor: boardTheme ? COLORS.border : index === 0 ? COLORS.primary : COLORS.border, backgroundColor: boardTheme ? COLORS.surface : COLORS.surfaceAlt, padding: 10 }}>
          <Text style={{ color: index === 0 ? COLORS.primary : COLORS.primary900, fontSize: 12, fontWeight: "600" }}>
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


export function IntroMemberEditor({
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
  const boardTheme = useAdminBoardWebTheme();
  const previewUrl = mediaUrl(member.image_url);
  return (
    <View style={{ gap: 10, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: boardTheme ? COLORS.surface : COLORS.surfaceAlt, padding: boardTheme ? 16 : 12 }}>
      <Text style={{ color: COLORS.primary900, fontWeight: "600" }}>임원 카드 {index + 1}</Text>
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


export function MajorOptionEditor({
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
          <Text style={{ flex: 1, color: COLORS.primary900, fontSize: 16, fontWeight: "600" }}>{item.name}</Text>
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


export function Chip({
  label,
  active,
  onPress,
  tone = "primary",
  variant,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: "primary" | "success" | "warning" | "danger" | "muted";
  variant?: "filter";
}) {
  const boardTheme = useAdminBoardWebTheme();
  const filter = boardTheme && (Boolean(onPress) || variant === "filter");
  const toneColor =
    tone === "success" ? boardTheme ? "#168A72" : COLORS.success : tone === "warning" ? boardTheme ? "#A66B13" : COLORS.warning : tone === "danger" ? boardTheme ? "#D92D52" : COLORS.error : tone === "muted" ? COLORS.muted : COLORS.primary;
  const activeBg =
    tone === "success"
      ? boardTheme ? "#ECF8F3" : "#EAF7EF"
      : tone === "warning"
        ? boardTheme ? "#FFF7E8" : "#FFF7D9"
        : tone === "danger"
          ? boardTheme ? "#FFF0F2" : "#FDECEC"
          : tone === "muted"
            ? boardTheme ? BOARD_WEB_COLORS.subtle : COLORS.surfaceAlt
            : COLORS.primary50;
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      aria-pressed={onPress ? !!active : undefined}
      onPress={onPress}
      style={[{
        borderRadius: RADIUS.button,
        borderWidth: 1,
        borderColor: active ? toneColor : COLORS.border,
        backgroundColor: active ? activeBg : COLORS.surface,
        paddingHorizontal: 10,
        paddingVertical: 7,
      }, boardTheme ? filter ? {
          borderRadius: 0, borderWidth: 0, borderBottomWidth: 2,
          borderBottomColor: active ? COLORS.primary : "transparent",
          backgroundColor: COLORS.surface, paddingHorizontal: 14, paddingVertical: 12,
        } : { borderWidth: 0, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 5 } : null]}
    >
      <Text style={{ color: active ? toneColor : filter ? BOARD_WEB_COLORS.muted : COLORS.muted, fontSize: filter ? 13 : boardTheme ? 11 : 12, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}


export function StatusText({ active, activeLabel = "노출", inactiveLabel = "숨김" }: { active: boolean; activeLabel?: string; inactiveLabel?: string }) {
  return <Chip active label={active ? activeLabel : inactiveLabel} tone={active ? "success" : "danger"} />;
}


export function BannerImageControl({
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
          <Text style={{ color: COLORS.text, fontWeight: "600" }}>{label}</Text>
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
      {fileName ? <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: "600" }}>{fileName}</Text> : null}
      <Field value={value} onChangeText={onChangeText} placeholder={`${label} 이미지 URL`} />
    </View>
  );
}


export function BannerPreview({ form, index = 0, total = 1, slot = "mobile" }: { form: BannerForm; index?: number; total?: number; slot?: BannerImageSlot }) {
  const imageUrl = mediaUrl(cleanOptional(form[`${slot}_image_url`]) ?? cleanOptional(form.mobile_image_url) ?? cleanOptional(form.tablet_image_url) ?? cleanOptional(form.desktop_image_url));
  const pageTotal = Math.max(total, 1);
  const pageIndex = Math.min(index + 1, pageTotal);

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: COLORS.primary900, fontSize: 13, fontWeight: "600" }}>등록 이미지 미리보기</Text>
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
              <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>{pageIndex}/{pageTotal}</Text>
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


export function BannerCard({
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
      <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "600" }}>{item.title || "이미지 배너"}</Text>
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


export function NoticeCard({
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
        <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "600" }} numberOfLines={2}>
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


export function ShortcutCard({
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
      accessibilityRole="button"
      accessibilityLabel={title}
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
          <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "600" }}>{title}</Text>
          <Text style={{ color: COLORS.muted, lineHeight: 19, marginTop: 3 }}>{description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.subtle} />
      </View>
      <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: "600" }}>{meta}</Text>
    </Pressable>
  );
}


export function MetricCard({ label, value, hint }: { label: string; value: number | string; hint: string }) {
  return (
    <View style={{ flex: 1, minWidth: 132, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14 }}>
      <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color: COLORS.primary900, fontSize: 24, fontWeight: "600", marginTop: 6 }}>{value}</Text>
      <Text style={{ color: COLORS.subtle, fontSize: 12, marginTop: 4 }}>{hint}</Text>
    </View>
  );
}


export function AdminPostCard({
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
      <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} 상세 열기`} onPress={() => router.push(`/board/post/${item.id}` as never)}>
        <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "600" }} numberOfLines={2}>
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
          <Text style={{ color: COLORS.primary900, fontSize: 12, fontWeight: "600" }}>계좌번호</Text>
          <Text selectable style={{ color: COLORS.text, fontSize: 15, fontWeight: "600" }}>{bankAccount}</Text>
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
            <Text style={{ color: COLORS.text, fontWeight: "600" }}>현재 대표 이미지</Text>
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


export const MUTUAL_AID_ADMIN_STATUS: Record<MutualAidStatus, { label: string; tone: "primary" | "success" | "danger" }> = {
  processing: { label: "처리중", tone: "primary" },
  completed: { label: "처리 완료", tone: "success" },
  rejected: { label: "반려", tone: "danger" },
};


export function MutualAidAdminCard({ item }: { item: PostListItem }) {
  const boardTheme = useAdminBoardWebTheme();
  const request = item.mutual_aid;
  const status = MUTUAL_AID_ADMIN_STATUS[request?.status ?? "processing"];
  return (
    <View style={[{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14, gap: 10 }, boardTheme && BOARD_WEB_STYLES.row]}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Chip active label={status.label} tone={status.tone} />
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>{formatDate(item.created_at)}</Text>
      </View>
      <Text style={{ color: COLORS.text, fontSize: boardTheme ? 14 : 17, fontWeight: "600" }}>{item.title}</Text>
      <Text style={{ color: COLORS.muted, fontSize: 13 }}>
        신청자 {formatCohortName(item.author_cohort, item.author_nickname)}
        {request ? ` · ${request.event_type} · ${request.event_date} · ${request.relation}` : ""}
      </Text>
      {request?.rejection_reason ? (
        <View style={{ borderRadius: RADIUS.button, backgroundColor: "#FDECEF", padding: 10 }}>
          <Text style={{ color: COLORS.error, fontSize: 12, fontWeight: "600" }}>반려 사유</Text>
          <Text style={{ color: COLORS.text, lineHeight: 19, marginTop: 4 }}>{request.rejection_reason}</Text>
        </View>
      ) : null}
      <ActionButton
        icon="open-outline"
        label={request?.status === "processing" ? "검토 · 처리" : "신청 상세 보기"}
        onPress={() => router.push(`/board/post/${item.id}` as never)}
        tone={boardTheme ? "outline" : "primary"}
      />
    </View>
  );
}


export function SuggestionAdminCard({ item }: { item: PostListItem }) {
  const boardTheme = useAdminBoardWebTheme();
  const answered = item.suggestion?.status === "answered";
  return (
    <View style={[{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14, gap: 10 }, boardTheme && BOARD_WEB_STYLES.row]}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Chip active label={answered ? "답변완료" : "대기중"} tone={answered ? "success" : "warning"} />
        <Chip active label="익명" tone="muted" />
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>{formatDate(item.created_at)}</Text>
      </View>
      <Text style={{ color: COLORS.text, fontSize: boardTheme ? 14 : 17, fontWeight: "600" }}>{item.title}</Text>
      {item.content_preview ? <Text style={{ color: COLORS.muted, lineHeight: 20 }} numberOfLines={3}>{item.content_preview}</Text> : null}
      {item.suggestion?.admin_reply ? (
        <View style={{ borderRadius: RADIUS.button, backgroundColor: boardTheme ? BOARD_WEB_COLORS.subtle : COLORS.primary50, padding: 10 }}>
          <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: "600" }}>원우회 답변</Text>
          <Text style={{ color: COLORS.text, lineHeight: 19, marginTop: 4 }} numberOfLines={3}>{item.suggestion.admin_reply}</Text>
        </View>
      ) : null}
      <ActionButton
        icon={answered ? "create-outline" : "chatbox-ellipses-outline"}
        label={answered ? "답변 확인 · 수정" : "답변 작성"}
        onPress={() => router.push(`/board/post/${item.id}` as never)}
        tone={boardTheme ? "outline" : "primary"}
      />
    </View>
  );
}


export function UserCard({
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
      <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "600" }}>{item.nickname}</Text>
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


export function ReportCard({
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
      <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "600" }} numberOfLines={2}>
        {report.target.title ?? "삭제되었거나 찾을 수 없는 대상"}
      </Text>
      {report.target.content_preview ? (
        <Text style={{ color: COLORS.muted, lineHeight: 20 }} numberOfLines={3}>
          {report.target.content_preview}
        </Text>
      ) : null}
      <Text style={{ color: COLORS.text, fontWeight: "600" }}>사유: {REPORT_REASON_LABELS[report.reason] ?? report.reason}</Text>
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


export function FAQCard({ item, onEdit, onDelete }: { item: FAQItem; onEdit: (item: FAQItem) => void; onDelete: (item: FAQItem) => void }) {
  const boardTheme = useAdminBoardWebTheme();
  return (
    <View style={[{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14, gap: 8 }, boardTheme && BOARD_WEB_STYLES.row]}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <StatusText active={item.is_active} />
        {item.category ? <Chip active label={item.category} /> : null}
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>순서 {item.sort_order}</Text>
      </View>
      <Text style={{ color: COLORS.text, fontSize: boardTheme ? 14 : 17, fontWeight: "600" }}>{item.question}</Text>
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


export function EventCard({ event, onEdit }: { event: EventItem; onEdit: (event: EventItem) => void }) {
  return (
    <View style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
        <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: "600" }}>
          {eventCategoryLabel(event.category)}
        </Text>
      </View>
      <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "600" }}>{event.title}</Text>
      <Text style={{ color: COLORS.muted }}>{formatBoardDateTime(event.start_at)}</Text>
      {/* 일정 전용 화면이 없어져 "보기"는 갈 곳이 없다. 내용은 "수정"에서 다 보인다. */}
      <ActionButton label="수정" onPress={() => onEdit(event)} tone="outline" />
    </View>
  );
}
