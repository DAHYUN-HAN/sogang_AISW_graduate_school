import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, FlatList, Linking, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ImageViewerModal from "../../../components/ImageViewerModal";
import MediaImage, { MediaImageBackground } from "../../../components/MediaImage";
import { BackIcon, EmptyCalendarIcon, LedgerIcon, SearchBackIcon, SearchIcon } from "../../../components/icons";
import LoadingState from "../../../components/LoadingState";
import PostCard from "../../../components/PostCard";
import { useBoardsQuery } from "../../../hooks/useApi";
import { useAggregatePosts, useBoardPosts } from "../../../hooks/usePosts";
import { API_ORIGIN } from "../../../services/api";
import { useUserStore } from "../../../stores/userStore";
import type { Board, PostListItem } from "../../../types";
import { boardParentRoute, boardRoute, handleNestedBoardHardwareBack, participationGroupDefaultSlug, postCreateRouteFromBoardList, postDetailRoute, type PostDetailReturnRoute } from "../../../utils/appRoutes";
import { tabNameFromRoute, useTabHighlightStore } from "../../../stores/tabHighlightStore";
import {
  activityCertificationBadgeLabel,
  activityCertificationCardTitle,
  activityCertificationPreview,
  shouldShowActivityCertificationBadge,
} from "../../../utils/activityCertification";
import { formatBoardDate } from "../../../utils/dateFormat";
import {
  cohortLeaderFormsFromMetadata,
  councilIntroductionContent,
  currentCouncilScreenState,
  pastCouncilFormsFromMetadata,
  sortCouncilCardsDescending,
  type CouncilMemberFormData,
} from "../../../utils/councilIntroductions";
import { toAbsoluteMediaUrl } from "../../../utils/mediaAccess";
import { pastCouncilActivitiesFromMetadata } from "../../../utils/pastCouncil";
import PhotoPager from "../../../components/PhotoPager";
import {
  boardFeedFooterState,
  boardFeedMode,
  boardFeedQueryEnabled,
  canLoadNextBoardFeedPage,
  createBoardFeedController,
} from "../../../utils/aggregateBoardFeeds";
import {
  RESOURCE_FILTERS,
  RESOURCE_FILTER_SLUGS,
  resourceFilterAfterNavigation,
} from "../../../utils/resourceBoards";
import type { ResourceFilter } from "../../../utils/resourceBoards";
import { formatCohortName } from "../../../utils/userLabel";

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
};

const BOARD_DISPLAY: Record<string, { name: string; description?: string }> = {
  "all-notices": { name: "공지사항" },
  "academic-notices": { name: "공지사항" },
  "event-notices": { name: "공지사항" },
  "academic-calendar": { name: "일정" },
  "webinar-notices": { name: "공지사항" },
  "event-album": { name: "커뮤니티" },
  "lecture-reviews": { name: "커뮤니티" },
  "exam-archive": { name: "커뮤니티" },
  "comprehensive-exam": { name: "커뮤니티" },
  "graduation-thesis": { name: "커뮤니티" },
  "club-activity": { name: "참여활동" },
  "study-activity": { name: "참여활동" },
  "networking-activity": { name: "참여활동" },
  "study-recruit": { name: "참여활동" },
  "club-promo": { name: "참여활동" },
  "club-apply": { name: "참여활동" },
  "alumni-directory": { name: "참여활동" },
  "networking-programs": { name: "참여활동" },
  "alumni-photo": { name: "참여활동" },
  "gsa-executives": { name: "원우회 임원진 소개" },
  "gsa-cohort-leaders": { name: "기수별 기장단 소개" },
  "gsa-past-councils": { name: "역대 원우회" },
  "council-activity": { name: "원우회 활동내역" },
  "gsa-activity": { name: "원우회 활동내역" },
  suggestions: { name: "건의사항" },
  "mutual-aid": { name: "원우회 상조회" },
  accounting: { name: "회계장부" },
};

const NOTICE_FILTERS = ["전체", "학사공지", "행사공지"];
const STUDY_FILTERS = ["모집", "활동 인증"];
const PARTICIPATION_FILTERS = ["안내", "활동 인증"];
const PARTICIPATION_GROUPS = [
  { key: "club", label: "동아리", guideSlug: "club-promo", certificationSlug: "club-activity" },
  { key: "study", label: "스터디", guideSlug: "study-recruit", certificationSlug: "study-activity" },
  { key: "networking", label: "네트워킹", guideSlug: "networking-programs", certificationSlug: "networking-activity" },
] as const;
const ALBUM_GRADIENTS: readonly (readonly [string, string])[] = [
  ["#2761FF", "#86C8FF"],
  ["#5B49C8", "#B7A4F8"],
  ["#0E7B60", "#55C69A"],
  ["#B94A2F", "#F39A7D"],
];
type SectionTab = {
  label: string;
  active: boolean;
  target?: Board;
  initialFilter?: ResourceFilter;
};
type ExecutiveMember = {
  name: string;
  cohort?: string;
  role: string;
  imageUrl?: string;
};
type CurrentCouncilSummary = {
  id: string;
  title: string;
  greeting?: string;
  intro: string;
  bannerImageUrl?: string;
  photoUrls: string[];
  members: ExecutiveMember[];
};
type CohortLeaderSummary = {
  id: string;
  cohort: string;
  greeting?: string;
  intro: string;
  bannerImageUrl?: string;
  photoUrls: string[];
  members: ExecutiveMember[];
};
type PastCouncilSummary = {
  id: string;
  cohort: string;
  greeting?: string;
  intro?: string;
  bannerImageUrl?: string;
  photoUrls: string[];
  members: ExecutiveMember[];
  activities: { date?: string; title: string }[];
};

function flattenBoards(groups?: { boards: Board[] }[]) {
  return groups?.flatMap((group) => group.boards) ?? [];
}

function getBoardDisplay(board?: Board | null) {
  if (!board) {
    return { name: "게시판", description: undefined };
  }
  return BOARD_DISPLAY[board.slug] ?? { name: board.name, description: board.description };
}

function filterOptions(board?: Board | null) {
  if (!board) return ["전체"];
  const groupKey = participationGroupKey(board);
  if (board.board_type === "notice") return NOTICE_FILTERS;
  if (board.board_type === "resource") return RESOURCE_FILTERS;
  if (groupKey === "study") return STUDY_FILTERS;
  if (board.board_type === "activity_certification") return PARTICIPATION_FILTERS;
  if (groupKey) return PARTICIPATION_FILTERS;
  return ["전체"];
}

function defaultFilterForBoard(board?: Board | null, requestedFilter?: ResourceFilter) {
  if (!board) return "전체";
  if (board.board_type === "resource") return resourceFilterAfterNavigation(board, requestedFilter);
  if (board.board_type === "activity_certification") return "활동 인증";
  if (participationGroupKey(board) === "study") return "모집";
  if (participationGroupKey(board)) return "안내";
  return "전체";
}

function categoryForFilter(filter: string, board?: Board | null) {
  if (board?.board_type === "activity_certification" || participationGroupKey(board)) {
    return undefined;
  }
  if (board?.board_type === "resource") {
    return filter === "전체" || RESOURCE_FILTER_SLUGS[filter] ? undefined : filter;
  }
  return filter === "전체" || filter === "모집" || filter === "안내" ? undefined : filter;
}

function findBoardBySlug(boards: Board[], slug: string) {
  return boards.find((item) => item.slug === slug);
}

function participationGroupKey(board?: Board | null) {
  if (!board) return null;
  if (board.slug.includes("club") || board.category === "club") return "club";
  if (board.slug.includes("study") || board.category === "study") return "study";
  if (board.slug.includes("networking") || board.slug.includes("alumni") || board.category === "alumni") return "networking";
  return null;
}

function sectionTabs(board: Board | undefined, boards: Board[]): SectionTab[] {
  if (!board) return [];
  const isCommunityResource = board.slug === "event-album" || board.board_type === "resource" || board.category === "resources";
  if (isCommunityResource) {
    return [
      { label: "행사 사진첩", active: board.slug === "event-album", target: findBoardBySlug(boards, "event-album") },
      {
        label: "자료공유",
        active: board.board_type === "resource" || board.category === "resources",
        target: findBoardBySlug(boards, "lecture-reviews") ?? boards.find((item) => item.board_type === "resource"),
        initialFilter: "전체",
      },
    ];
  }

  const groupKey = participationGroupKey(board);
  if (groupKey) {
    return PARTICIPATION_GROUPS.map((item) => ({
      label: item.label,
      active: item.key === groupKey,
      target: findBoardBySlug(boards, participationGroupDefaultSlug(item.key)),
    }));
  }
  return [];
}

// 뒤로가기는 Figma TopBar의 22x22 벡터를 그대로 옮긴 BackIcon을 쓴다. Ionicons의
// chevron-back은 획 두께와 꺾임 위치가 달라 일정 화면과 다르게 보였다.
function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityLabel="뒤로" onPress={onPress} style={styles.iconButton}>
      <BackIcon size={24} color={COLORS.text} />
    </Pressable>
  );
}

function imageUrl(value?: string | null) {
  return toAbsoluteMediaUrl(value, API_ORIGIN);
}

function compactPreview(post: PostListItem) {
  const title = post.title.trim();
  const preview = post.content_preview.trim();
  const withoutDuplicateTitle = preview.startsWith(title) ? preview.slice(title.length).trim() : preview;
  return withoutDuplicateTitle
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && line !== title) ?? "";
}

function metadataString(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function executiveMembersFromForms(members: CouncilMemberFormData[]): ExecutiveMember[] {
  return members.flatMap((member) => member.name && member.role ? [{
    name: member.name,
    cohort: member.cohort || undefined,
    role: member.role,
    imageUrl: member.image_url || undefined,
  }] : []);
}

function currentCouncilFromMetadata(metadata: Record<string, unknown> | null | undefined): CurrentCouncilSummary | null {
  const state = currentCouncilScreenState(metadata);
  if (state.kind === "empty") return null;
  const card = state.council;
  return {
    id: "current-council",
    title: card.title,
    greeting: card.greeting || undefined,
    intro: card.intro,
    bannerImageUrl: card.banner_image_url || undefined,
    photoUrls: card.photo_urls ?? [],
    members: executiveMembersFromForms(card.members),
  };
}

function cleanPostTitle(title: string) {
  return title.replace(/^\[[^\]]+\]\s*/, "").trim();
}

function extractCohort(title: string, content: string) {
  const source = `${title}\n${content}`;
  const match = source.match(/(\d{2})\s*기/);
  return match ? `${match[1]}기` : "기수";
}

function extractLeaderName(content: string, cohort: string) {
  const escapedCohort = cohort.replace("기", "\\s*기");
  const namePattern = "([가-힣]{2,4})(?=입니다|[\\s(),.!?]|$)";
  const patterns = [
    new RegExp(`기장(?:\\s*[:：\\-]|\\s+)\\s*(?:${escapedCohort}\\s*)?${namePattern}`),
    new RegExp(`${escapedCohort}\\s*기장\\s+${namePattern}`),
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

function extractViceLeaderName(content: string, cohort: string) {
  const escapedCohort = cohort.replace("기", "\\s*기");
  const namePattern = "([가-힣]{2,4})(?=입니다|[\\s(),.!?]|$)";
  const patterns = [
    new RegExp(`부기장(?:\\s*[:：\\-]|\\s+)\\s*(?:${escapedCohort}\\s*)?${namePattern}`),
    new RegExp(`${escapedCohort}\\s*부기장\\s+${namePattern}`),
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function firstMeaningfulParagraph(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*#&\s]+/, "").trim())
    .filter(Boolean);
  return lines.find((line) => !line.includes("기장단 소개") && !line.includes("[구성]")) ?? "";
}

function cohortLeaderSummaries(posts: PostListItem[], metadata?: Record<string, unknown> | null) {
  const configured = sortCouncilCardsDescending(cohortLeaderFormsFromMetadata(metadata)).map((card, index): CohortLeaderSummary => {
    const cohort = card.cohort.endsWith("기") ? card.cohort : `${card.cohort}기`;
    return {
      id: `configured-${cohort}-${index}`,
      cohort,
      greeting: card.greeting || undefined,
      intro: card.intro,
      bannerImageUrl: card.banner_image_url || undefined,
      photoUrls: card.photo_urls ?? [],
      members: executiveMembersFromForms(card.members),
    };
  });
  if (configured.length > 0) {
    return configured;
  }

  return sortCouncilCardsDescending(
    posts.map((post) => {
      const content = post.content_preview || post.title;
      const cohort = extractCohort(post.title, content);
      const captain = extractLeaderName(content, cohort) || cleanPostTitle(post.title).replace(/^안녕하세요[!,.\s]*/, "").slice(0, 4) || "기장";
      return {
        id: `legacy-${post.id}`,
        cohort,
        intro: firstMeaningfulParagraph(content),
        photoUrls: [],
        members: [
          { name: captain, cohort, role: "기장" },
          ...(extractViceLeaderName(content, cohort) ? [{ name: extractViceLeaderName(content, cohort) as string, cohort, role: "부기장" }] : []),
        ],
      };
    }),
  );
}

function CohortLeaderScreen({
  board,
  posts,
  isLoading,
  isError,
  refreshing,
  onRefresh,
  onRetry,
  onBack,
  onNestedBackHandlerChange,
  topInset,
}: {
  board?: Board | null;
  posts: PostListItem[];
  isLoading: boolean;
  isError: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  onBack: () => void;
  onNestedBackHandlerChange: (handler: (() => void) | null) => void;
  topInset: number;
}) {
  const [selected, setSelected] = useState<CohortLeaderSummary | null>(null);
  const leaders = useMemo(() => cohortLeaderSummaries(posts, board?.metadata), [board?.metadata, posts]);

  useEffect(() => {
    setSelected(null);
  }, [posts]);

  const headerTitle = selected ? `${selected.cohort} 기장단` : "기수별 기장단 소개";
  const handleBack = useCallback(() => {
    if (selected) {
      setSelected(null);
      return;
    }
    onBack();
  }, [onBack, selected]);

  useEffect(() => {
    onNestedBackHandlerChange(handleBack);
    return () => onNestedBackHandlerChange(null);
  }, [handleBack, onNestedBackHandlerChange]);

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(topInset, 10) }]}>
        <BackButton onPress={handleBack} />
        <Text style={styles.appBarTitle}>{headerTitle}</Text>
        <View style={styles.iconButton} />
      </View>
      {isLoading ? (
        <LoadingState />
      ) : selected ? (
        <CouncilIntroductionDetail
          id={selected.id}
          photoUrls={selected.photoUrls}
          bannerImageUrl={selected.bannerImageUrl}
          greeting={selected.greeting}
          intro={selected.intro}
        />
      ) : (
        <FlatList
          data={leaders}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={[styles.executiveContent, leaders.length === 0 ? styles.emptyContent : null]}
          ListEmptyComponent={
            isError ? (
              <Pressable onPress={onRetry} style={styles.errorBox}>
                <Text style={styles.errorTitle}>기장단 정보를 불러오지 못했습니다.</Text>
                <Text style={styles.errorText}>탭해서 다시 시도하세요.</Text>
              </Pressable>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>기장단 정보가 없습니다.</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => setSelected(item)} style={styles.cohortCard}>
              <View style={styles.cohortBadge}>
                <Text style={styles.cohortBadgeText}>{item.cohort}</Text>
              </View>
              <View style={styles.executiveText}>
                <Text style={styles.executiveRole}>{item.members[0]?.role || "임원진"}</Text>
                <Text style={styles.executiveName}>{item.members[0]?.name || "등록된 임원 없음"}{item.members.length > 1 ? ` 외 ${item.members.length - 1}명` : ""}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function pastCouncilsFromMetadata(metadata?: Record<string, unknown> | null): PastCouncilSummary[] {
  return sortCouncilCardsDescending(
    pastCouncilFormsFromMetadata(metadata).map((card, index): PastCouncilSummary => {
      const cohort = card.cohort.endsWith("대") ? card.cohort : `${card.cohort.replace(/기$/, "")}대`;
      return {
        id: `past-${cohort}-${index}`,
        cohort,
        greeting: card.greeting || undefined,
        intro: card.intro || undefined,
        bannerImageUrl: card.banner_image_url || undefined,
        photoUrls: card.photo_urls ?? [],
        members: executiveMembersFromForms(card.members),
        activities: pastCouncilActivitiesFromMetadata(card.activities),
      };
    }),
  );
}

function PhotoSlider({ photos }: { photos: string[] }) {
  const [index, setIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const current = Math.min(index, Math.max(photos.length - 1, 0));
  // 화살표는 양 끝에서 순환하지만, 쓸어 넘기기는 네이티브 스크롤이라 순환하지 않는다.
  // 끝에서 더 밀면 제자리로 돌아온다.
  const step = (delta: number) => setIndex((prev) => (prev + delta + photos.length) % photos.length);
  return (
    <View style={styles.pastPhotoSlider}>
      {photos.length > 0 ? (
        <PhotoPager
          index={current}
          items={photos}
          itemKey={(url, itemIndex) => `${url}:${itemIndex}`}
          onIndexChange={setIndex}
          renderItem={(url, itemIndex) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${itemIndex + 1}번째 사진 크게 보기`}
              onPress={() => setViewerIndex(itemIndex)}
            >
              <MediaImage media={{ url }} resizeMode="contain" style={styles.pastPhoto} />
            </Pressable>
          )}
        />
      ) : (
        <LinearGradient colors={["#534AB7", "#AFA9EC"]} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.pastPhoto} />
      )}
      {photos.length > 1 ? (
        <>
          <Pressable
            accessibilityLabel="이전 사진"
            onPress={() => step(-1)}
            style={[styles.pastPhotoNav, { left: 10 }]}
          >
            <Ionicons name="chevron-back" size={16} color="#FFFFFF" />
          </Pressable>
          <Pressable
            accessibilityLabel="다음 사진"
            onPress={() => step(1)}
            style={[styles.pastPhotoNav, { right: 10 }]}
          >
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
          </Pressable>
          <View style={styles.pastPhotoIndicator}>
            <Text style={styles.pastPhotoIndicatorText}>{current + 1} / {photos.length}</Text>
          </View>
        </>
      ) : null}
      {viewerIndex !== null ? (
        <ImageViewerModal
          images={photos.map((url) => ({ url }))}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </View>
  );
}

function CouncilIntroductionDetail({
  id,
  photoUrls,
  bannerImageUrl,
  greeting,
  intro,
}: {
  id: string;
  photoUrls: string[];
  bannerImageUrl?: string;
  greeting?: string;
  intro?: string;
}) {
  const content = councilIntroductionContent({ photoUrls, bannerImageUrl, greeting, intro });

  return (
    <ScrollView style={styles.executiveScroller} contentContainerStyle={styles.cohortDetailContent}>
      {content.representativeImages.length > 0 ? <PhotoSlider key={id} photos={content.representativeImages} /> : null}
      {content.textSections.map((section) => (
        <Text key={section.kind} style={section.kind === "greeting" ? styles.cohortGreeting : styles.cohortIntroText}>
          {section.text}
        </Text>
      ))}
    </ScrollView>
  );
}

function PastCouncilScreen({
  board,
  topInset,
  onBack,
  onNestedBackHandlerChange,
}: {
  board?: Board | null;
  topInset: number;
  onBack: () => void;
  onNestedBackHandlerChange: (handler: (() => void) | null) => void;
}) {
  const councils = useMemo(() => pastCouncilsFromMetadata(board?.metadata), [board?.metadata]);
  const [selected, setSelected] = useState<PastCouncilSummary | null>(null);
  const handleBack = useCallback(() => selected ? setSelected(null) : onBack(), [onBack, selected]);
  useEffect(() => {
    onNestedBackHandlerChange(handleBack);
    return () => onNestedBackHandlerChange(null);
  }, [handleBack, onNestedBackHandlerChange]);
  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(topInset, 10) }]}>
        <BackButton onPress={handleBack} />
        <Text style={styles.appBarTitle}>{selected ? `${selected.cohort} 원우회 임원진` : "역대 원우회"}</Text>
        <View style={styles.iconButton} />
      </View>
      {selected ? (
        <CouncilIntroductionDetail
          id={selected.id}
          photoUrls={selected.photoUrls}
          bannerImageUrl={selected.bannerImageUrl}
          greeting={selected.greeting}
          intro={selected.intro}
        />
      ) : (
        <FlatList
          data={councils}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.executiveContent, councils.length === 0 ? styles.emptyContent : null]}
          ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyText}>등록된 역대 원우회가 없습니다.</Text></View>}
          renderItem={({ item }) => (
            <Pressable onPress={() => setSelected(item)} style={styles.cohortCard}>
              <View style={styles.cohortBadge}><Text style={styles.cohortBadgeText}>{item.cohort}</Text></View>
              <View style={styles.executiveText}>
                <Text style={styles.executiveRole}>{item.members[0]?.role || "임원진"}</Text>
                <Text style={styles.executiveName}>{item.members[0]?.name || "등록된 임원 없음"}{item.members.length > 1 ? ` 외 ${item.members.length - 1}명` : ""}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function participationBadgeLabel(post: PostListItem, board?: Board | null) {
  const raw = post.category?.trim();
  if (board?.slug === "study-recruit") {
    const recruitmentStatus = String(post.metadata?.recruitment_status ?? raw ?? "").toLowerCase();
    return recruitmentStatus.includes("closed") || recruitmentStatus.includes("마감") ? "마감" : "진행중";
  }
  if (raw) return raw.length <= 8 ? raw : "동아리 홍보";
  if (board?.slug === "club-promo") return "모집중";
  return "안내";
}

function ExecutiveIntroScreen({ board, topInset, onBack }: { board?: Board | null; topInset: number; onBack: () => void }) {
  const council = useMemo(() => currentCouncilFromMetadata(board?.metadata), [board?.metadata]);

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(topInset, 10) }]}>
        <BackButton onPress={onBack} />
        <Text style={styles.appBarTitle}>원우회 임원진 소개</Text>
        <View style={styles.iconButton} />
      </View>
      {council ? (
        <CouncilIntroductionDetail
          id={council.id}
          photoUrls={council.photoUrls}
          bannerImageUrl={council.bannerImageUrl}
          greeting={council.greeting}
          intro={council.intro}
        />
      ) : (
        <View style={styles.executiveEmptyState}>
          <Ionicons name="people-outline" size={32} color="#AAB2BF" />
          <Text style={styles.executiveEmptyTitle}>등록된 원우회 소개가 없어요</Text>
          <Text style={styles.executiveEmptyDescription}>관리자에서 대표 이미지와 소개를 등록해주세요</Text>
        </View>
      )}
    </View>
  );
}

function BoardFeedFooter({
  state,
  onRetry,
}: {
  state: "loading" | "retry" | "idle";
  onRetry: () => void;
}) {
  if (state === "idle") return null;
  if (state === "loading") {
    return (
      <View style={styles.feedFooter}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }
  return (
    <Pressable onPress={onRetry} style={styles.feedFooter}>
      <Text style={styles.feedFooterRetry}>다음 게시글을 불러오지 못했습니다. 탭해서 다시 시도하세요.</Text>
    </Pressable>
  );
}

function FeedRefreshErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <Pressable onPress={onRetry} style={styles.feedRefreshError}>
      <Ionicons name="refresh-outline" size={16} color={COLORS.danger} />
      <Text style={styles.feedRefreshErrorText}>
        새로고침하지 못했습니다. 탭해서 다시 시도하세요.
      </Text>
    </Pressable>
  );
}

function CouncilActivityHistoryScreen({
  posts,
  isLoading,
  isError,
  refreshing,
  refreshError,
  onRefresh,
  onRetry,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  onLoadMore,
  onBack,
  originBoardId,
  detailReturnRoute,
  topInset,
}: {
  posts: PostListItem[];
  isLoading: boolean;
  isError: boolean;
  refreshing: boolean;
  refreshError: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  onLoadMore: () => void;
  onBack: () => void;
  originBoardId: number;
  detailReturnRoute: PostDetailReturnRoute;
  topInset: number;
}) {
  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(topInset, 10) }]}>
        <BackButton onPress={onBack} />
        <Text style={styles.appBarTitle}>원우회 활동내역</Text>
        <View style={styles.iconButton} />
      </View>
      {refreshError ? <FeedRefreshErrorBanner onRetry={onRefresh} /> : null}
      {isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={[styles.councilActivityContent, posts.length === 0 ? styles.emptyContent : null]}
          onEndReached={() => {
            if (canLoadNextBoardFeedPage({
              hasNextPage,
              isFetchingNextPage,
              isRefreshingFirstPage: refreshing,
            })) {
              onLoadMore();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            <BoardFeedFooter
              state={boardFeedFooterState({ isFetchingNextPage, isFetchNextPageError })}
              onRetry={onLoadMore}
            />
          }
          ListEmptyComponent={
            isError ? (
              <Pressable onPress={onRetry} style={styles.errorBox}>
                <Text style={styles.errorTitle}>활동내역을 불러오지 못했습니다.</Text>
                <Text style={styles.errorText}>탭해서 다시 시도하세요.</Text>
              </Pressable>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>활동내역이 없습니다.</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(postDetailRoute(item.id, originBoardId, detailReturnRoute) as never)} style={styles.councilActivityRow}>
              <View style={styles.councilActivityText}>
                <Text style={styles.councilActivityDate}>{formatBoardDate(item.created_at)}</Text>
                <Text numberOfLines={1} style={styles.councilActivityTitle}>
                  {item.title}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function AccountingExternalScreen({ board, topInset, onBack }: { board?: Board | null; topInset: number; onBack: () => void }) {
  const accountingUrl = metadataString(board?.metadata, ["notion_url", "external_url", "url", "link"]);
  const openAccounting = () => {
    if (!accountingUrl) {
      Alert.alert("회계장부 링크", "관리자 페이지에서 Notion 링크를 등록해 주세요.");
      return;
    }
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.assign(accountingUrl);
      return;
    }
    Linking.openURL(accountingUrl);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(topInset, 10) }]}>
        <BackButton onPress={onBack} />
        <Text style={styles.appBarTitle}>회계장부</Text>
        <View style={styles.iconButton} />
      </View>
      <View style={styles.accountingContent}>
        <LedgerIcon size={40} />
        <Text style={styles.accountingTitle}>회계장부는 외부 페이지에서 관리하고 있어요</Text>
        <Text style={styles.accountingDescription}>
          {"원우회 회비 입출금 내역을 투명하게 공개하고 있어요.\n아래 버튼을 누르면 외부 회계장부 페이지로 연결돼요."}
        </Text>
        <Pressable onPress={openAccounting} style={styles.accountingButton}>
          <Text style={styles.accountingButtonText}>회계장부 보러가기</Text>
        </Pressable>
      </View>
    </View>
  );
}

type BoardPostsScreenProps = {
  initialBoardId?: number;
  isTabRoot?: boolean;
};

function AlbumTile({ post, index, onPress }: { post: PostListItem; index: number; onPress: (postId: number) => void }) {
  const gradient = ALBUM_GRADIENTS[index % ALBUM_GRADIENTS.length];
  const thumbnailUrl = imageUrl(post.thumbnail_url);
  return (
    <Pressable onPress={() => onPress(post.id)} style={styles.albumTile}>
      {thumbnailUrl ? (
        <MediaImageBackground media={{ id: post.thumbnail_media_id, url: thumbnailUrl }} imageStyle={styles.albumImage} style={styles.albumThumb}>
          <View style={styles.albumScrim} />
          <View style={styles.albumCountPill}>
            <Text style={styles.albumCountText}>{post.attachment_count || 1}장</Text>
          </View>
        </MediaImageBackground>
      ) : (
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.albumThumb}>
          <View style={styles.albumCountPill}>
            <Text style={styles.albumCountText}>{post.attachment_count || 1}장</Text>
          </View>
        </LinearGradient>
      )}
      <Text numberOfLines={1} style={styles.albumTitle}>
        {post.title}
      </Text>
      <Text style={styles.albumDate}>{formatBoardDate(post.created_at)}</Text>
    </Pressable>
  );
}

function guideBadgeTone(label: string) {
  if (label.includes("상시")) return { bg: "#EEEDFE", fg: "#3C3489" };
  if (label.includes("마감")) return { bg: "#F0F0EE", fg: "#5B5B57" };
  return { bg: "#E6F1FB", fg: "#0C447C" };
}

function ParticipationGuideTile({ post, board, index, onPress }: { post: PostListItem; board?: Board | null; index: number; onPress: (postId: number) => void }) {
  const gradient = ALBUM_GRADIENTS[index % ALBUM_GRADIENTS.length];
  const thumbnailUrl = imageUrl(post.thumbnail_url);
  const preview = compactPreview(post);
  const badge = participationBadgeLabel(post, board);
  const tone = guideBadgeTone(badge);

  return (
    <Pressable onPress={() => onPress(post.id)} style={styles.guideCard}>
      {thumbnailUrl ? (
        <MediaImageBackground media={{ id: post.thumbnail_media_id, url: thumbnailUrl }} imageStyle={styles.guideImage} style={styles.guideThumb}>
          <View style={styles.guideScrim} />
        </MediaImageBackground>
      ) : (
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.guideThumb} />
      )}
      <View style={styles.guideBody}>
        <View style={[styles.guidePill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.guidePillText, { color: tone.fg }]}>{badge}</Text>
        </View>
        <Text numberOfLines={2} style={styles.guideTitle}>
          {post.title}
        </Text>
        {preview ? (
          <Text numberOfLines={2} style={styles.guidePreview}>
            {preview}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function ActivityTile({ post, boardSlug, index, isLast, onPress }: { post: PostListItem; boardSlug?: string; index: number; isLast?: boolean; onPress: (postId: number) => void }) {
  const gradient = ALBUM_GRADIENTS[index % ALBUM_GRADIENTS.length];
  const cardTitle = activityCertificationCardTitle(post, boardSlug);
  // 동아리·네트워킹 인증은 기존처럼 소감과 배지를 우선하고, 스터디만 모집/스터디 제목을 함께 표시한다.
  const preview = activityCertificationPreview(post, boardSlug);
  const thumbnailUrl = imageUrl(post.thumbnail_url);
  const activityDate =
    typeof post.metadata?.activity_date === "string" && post.metadata.activity_date.trim()
      ? post.metadata.activity_date
      : post.created_at;

  return (
    <Pressable onPress={() => onPress(post.id)} style={[styles.activityCard, isLast ? styles.activityCardLast : null]}>
      {thumbnailUrl ? (
        <MediaImageBackground media={{ id: post.thumbnail_media_id, url: thumbnailUrl }} imageStyle={styles.activityImage} style={styles.activityThumb}>
          <View style={styles.activityScrim} />
        </MediaImageBackground>
      ) : (
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.activityThumb} />
      )}
      <View style={styles.activityBody}>
        {shouldShowActivityCertificationBadge(boardSlug) ? (
          <View style={styles.activityPill}>
            <Text style={styles.activityPillText}>{activityCertificationBadgeLabel(post, boardSlug)}</Text>
          </View>
        ) : null}
        {cardTitle ? (
          <Text numberOfLines={2} style={styles.activityTitle}>
            {cardTitle}
          </Text>
        ) : null}
        {preview ? (
          <Text numberOfLines={2} style={styles.activityPreview}>
            {preview}
          </Text>
        ) : null}
        <Text style={styles.activityDate}>
          {`${formatCohortName(post.author_cohort, post.author_nickname)} · ${formatBoardDate(activityDate)}`}
        </Text>
      </View>
    </Pressable>
  );
}

// ponytail: embedded (initialBoardId) == rendered inside a tab screen, so it must stay a tab root
// and switch boards via state instead of router.replace, which would leave the (tabs) group and hide the tab bar.
export default function BoardPostsScreen({ initialBoardId, isTabRoot = initialBoardId !== undefined }: BoardPostsScreenProps = {}) {
  const params = useLocalSearchParams<{ boardId: string }>();
  const insets = useSafeAreaInsets();
  const routeBoardId = Number(params.boardId);
  const [embeddedBoardId, setEmbeddedBoardId] = useState(initialBoardId);
  const boardId = embeddedBoardId ?? routeBoardId;
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("전체");
  const [resourceSort, setResourceSort] = useState<"latest" | "popular">("latest");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [filterOwnerBoardId, setFilterOwnerBoardId] = useState<number | null>(null);
  const requestedBoardFilterRef = useRef<ResourceFilter | undefined>(undefined);
  const nestedBackHandlerRef = useRef<(() => void) | null>(null);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const user = useUserStore((state) => state.user);

  const { data: boardsRes } = useBoardsQuery();
  const boards = useMemo(() => flattenBoards(boardsRes?.data), [boardsRes?.data]);
  const board = useMemo(() => boards.find((item) => item.id === boardId), [boardId, boards]);
  const setHighlightTab = useTabHighlightStore((state) => state.setTab);
  useEffect(() => {
    if (board) setHighlightTab(tabNameFromRoute(boardParentRoute(board)));
  }, [board, setHighlightTab]);
  const detailReturnRoute = isTabRoot ? boardParentRoute(board) : boardRoute(boardId);
  const display = getBoardDisplay(board);
  const filters = filterOptions(board);
  const isAlbum = board?.board_type === "album";
  const isActivityCards = board?.board_type === "activity_certification";
  const isMutualAid = board?.board_type === "mutual_aid";
  const isSuggestion = board?.board_type === "suggestion";
  const isStudyRecruit = board?.slug === "study-recruit";
  const isParticipationGuideCards = Boolean(participationGroupKey(board)) && !isActivityCards && !isStudyRecruit;
  const tabs = sectionTabs(board, boards);
  const canWriteBoard = !board || board.write_permission !== "admin" || user?.role === "admin";
  const canShowCreateButton = canWriteBoard && board?.board_type !== "notice" && board?.board_type !== "album" && (!isParticipationGuideCards || board?.slug === "study-recruit");
  const isResourceBoard = board?.board_type === "resource";
  const feedMode = boardFeedMode({
    activeBoardId: boardId,
    resolvedBoard: board ? {
      id: board.id,
      boardType: board.board_type,
      boardSlug: board.slug,
    } : null,
    filterOwnerBoardId,
    selectedFilter,
  });
  const queryEnabled = boardFeedQueryEnabled(feedMode);
  const isResourceAll = queryEnabled.resources;
  const isCouncilActivityHistory = queryEnabled.councilActivity;
  const boardPostsQuery = useBoardPosts(boardId, {
    q: query || undefined,
    category: categoryForFilter(selectedFilter, board),
    sort: isResourceBoard ? resourceSort : "latest",
  }, queryEnabled.board);
  const resourceAllQuery = useAggregatePosts("resources", {
    q: query || undefined,
    sort: resourceSort,
  }, isResourceAll);
  const councilActivityQuery = useAggregatePosts("council_activity", {
    sort: "latest",
  }, isCouncilActivityHistory);
  const feedController = createBoardFeedController(feedMode, {
    board: boardPostsQuery,
    resources: resourceAllQuery,
    councilActivity: councilActivityQuery,
  });
  const activePostsQuery = feedController.query;
  const posts = activePostsQuery?.items ?? [];
  const isLoading = feedMode === "pending" || activePostsQuery?.isLoading === true;
  const isError = activePostsQuery?.isError === true;
  const isRefreshingFirstPage = activePostsQuery?.isRefreshingFirstPage === true;
  const refreshFirstPageError = activePostsQuery?.refreshFirstPageError ?? null;
  const hasNextPage = activePostsQuery?.hasNextPage === true;
  const isFetchingNextPage = activePostsQuery?.isFetchingNextPage === true;
  const isFetchNextPageError = activePostsQuery?.isFetchNextPageError === true;
  const feedFooterState = activePostsQuery ? boardFeedFooterState(activePostsQuery) : "idle";

  useEffect(() => {
    if (initialBoardId) {
      setEmbeddedBoardId(initialBoardId);
    }
  }, [initialBoardId]);

  useEffect(() => {
    if (!board) return;
    const requestedFilter = requestedBoardFilterRef.current;
    requestedBoardFilterRef.current = undefined;
    setSelectedFilter(defaultFilterForBoard(board, requestedFilter));
    setFilterOwnerBoardId(board.id);
  }, [board]);

  const navigateToBoard = (target?: Board, requestedFilter?: ResourceFilter) => {
    if (!target) return;
    if (target.id === boardId) {
      requestedBoardFilterRef.current = undefined;
      if (requestedFilter) setSelectedFilter(requestedFilter);
      return;
    }

    if (participationGroupKey(board)) {
      setShowSearch(false);
      setQuery("");
      setQueryInput("");
    }

    requestedBoardFilterRef.current = requestedFilter;
    if (requestedFilter) setSelectedFilter(requestedFilter);
    if (isTabRoot) {
      setEmbeddedBoardId(target.id);
      return;
    }

    router.replace(`/board/${target.id}` as never);
  };

  const exitBoardDepth = useCallback(() => {
    if (isTabRoot) return;
    router.replace(boardParentRoute(board) as never);
  }, [board, isTabRoot]);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    setQuery("");
    setQueryInput("");
  }, []);

  const registerNestedBackHandler = useCallback((handler: (() => void) | null) => {
    nestedBackHandlerRef.current = handler;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return undefined;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (sortMenuOpen) {
          setSortMenuOpen(false);
          return true;
        }
        if (showSearch) {
          closeSearch();
          return true;
        }
        if (isTabRoot) return false;
        return handleNestedBoardHardwareBack(nestedBackHandlerRef.current, exitBoardDepth);
      });
      return () => subscription.remove();
    }, [closeSearch, exitBoardDepth, isTabRoot, showSearch, sortMenuOpen])
  );

  const handleFilterPress = (item: string) => {
    const groupKey = participationGroupKey(board);
    if (groupKey) {
      const group = PARTICIPATION_GROUPS.find((entry) => entry.key === groupKey);
      const targetSlug = item === "활동 인증" ? group?.certificationSlug : group?.guideSlug;
      setSelectedFilter(item);
      navigateToBoard(targetSlug ? findBoardBySlug(boards, targetSlug) : undefined);
      return;
    }

    setSelectedFilter(item);
    if (board?.board_type === "resource" && item === "전체") {
      return;
    }

    const resourceSlug = board?.board_type === "resource" ? RESOURCE_FILTER_SLUGS[item] : undefined;
    if (resourceSlug) {
      navigateToBoard(findBoardBySlug(boards, resourceSlug));
    }
  };

  const openCreate = () => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    const category = selectedFilter !== "전체" ? selectedFilter : "";
    closeSearch();
    // 자료공유 `전체`는 여러 게시판을 모아 보여주는 상태다. 마지막으로 들른
    // 게시판을 임의로 집어넣지 말고, 글쓰기 화면에서 고르게 그룹만 넘긴다.
    const boardUnresolved = feedMode === "resources";
    router.push(postCreateRouteFromBoardList(
      boardUnresolved ? null : boardId,
      category,
      isTabRoot,
      isActivityCards,
      detailReturnRoute,
      boardUnresolved ? board?.category : undefined,
    ) as never);
  };

  if (board?.slug === "accounting") {
    return <AccountingExternalScreen board={board} topInset={insets.top} onBack={exitBoardDepth} />;
  }

  if (board?.slug === "gsa-executives") {
    return <ExecutiveIntroScreen board={board} topInset={insets.top} onBack={exitBoardDepth} />;
  }

  if (board?.slug === "gsa-cohort-leaders") {
    return (
      <CohortLeaderScreen
        board={board}
        posts={posts}
        isLoading={isLoading}
        isError={isError}
        refreshing={isRefreshingFirstPage}
        onRefresh={() => void feedController.refreshFirstPage()}
        onRetry={() => void feedController.retry()}
        topInset={insets.top}
        onBack={exitBoardDepth}
        onNestedBackHandlerChange={registerNestedBackHandler}
      />
    );
  }

  if (board?.slug === "gsa-past-councils") {
    return (
      <PastCouncilScreen
        board={board}
        topInset={insets.top}
        onBack={exitBoardDepth}
        onNestedBackHandlerChange={registerNestedBackHandler}
      />
    );
  }

  if (board?.slug === "council-activity" || board?.slug === "gsa-activity") {
    return (
      <CouncilActivityHistoryScreen
        posts={posts}
        isLoading={isLoading}
        isError={isError}
        refreshing={isRefreshingFirstPage}
        refreshError={refreshFirstPageError !== null}
        onRefresh={() => void feedController.refreshFirstPage()}
        onRetry={() => void feedController.retry()}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isFetchNextPageError={isFetchNextPageError}
        onLoadMore={() => void feedController.loadMore()}
        originBoardId={boardId}
        detailReturnRoute={detailReturnRoute}
        topInset={insets.top}
        onBack={exitBoardDepth}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
        {showSearch ? (
          <>
            <Pressable
              accessibilityLabel="검색 닫기"
              onPress={closeSearch}
              style={styles.iconButton}
            >
              <SearchBackIcon size={16} />
            </Pressable>
            <View style={styles.searchBar}>
              <SearchIcon size={18} color="#8A919C" />
              <TextInput
                autoFocus
                value={queryInput}
                onChangeText={setQueryInput}
                onSubmitEditing={() => setQuery(queryInput.trim())}
                returnKeyType="search"
                placeholder="검색어를 입력하세요"
                placeholderTextColor="#A6ACB7"
                style={[styles.searchBarInput, { outlineStyle: "none" } as never]}
              />
            </View>
          </>
        ) : (
          <>
            {isTabRoot ? (
              <View style={styles.iconButton} />
            ) : (
              <BackButton onPress={exitBoardDepth} />
            )}
            <Text style={styles.appBarTitle}>{display.name}</Text>
            {/* 참여활동은 활동 인증에서만 검색을 제공한다. */}
            {isParticipationGuideCards || isStudyRecruit ? (
              <View style={styles.iconButton} />
            ) : (
              <Pressable accessibilityLabel="검색" onPress={() => setShowSearch(true)} style={styles.iconButton}>
                <SearchIcon size={20} />
              </Pressable>
            )}
          </>
        )}
      </View>

      {!showSearch && tabs.length > 0 ? (
        <View style={styles.sectionTabs}>
          {tabs.map((item) => (
            <Pressable key={item.label} onPress={() => navigateToBoard(item.target, item.initialFilter)} style={[styles.sectionTab, item.active ? styles.sectionTabActive : null]}>
              <Text style={[styles.sectionTabText, item.active ? styles.sectionTabTextActive : null]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {filters.length > 1 ? (
      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          bounces={false}
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroller}
          contentContainerStyle={styles.filterContent}
        >
          {filters.map((item) => {
            const active = selectedFilter === item;
            return (
              <Pressable key={item} onPress={() => handleFilterPress(item)} style={[styles.filterChip, active ? styles.filterChipActive : null]}>
                <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>{item}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      ) : null}

      {isResourceBoard ? (
        <>
          <View style={styles.sortRowWrap}>
            <View style={styles.sortRow}>
              <Pressable accessibilityLabel="정렬 변경" onPress={() => setSortMenuOpen((open) => !open)} style={styles.sortButton}>
                <Text style={styles.sortButtonText}>{resourceSort === "latest" ? "최신순" : "인기순"}</Text>
                <Ionicons name="chevron-down" size={12} color={COLORS.muted} />
              </Pressable>
            </View>
            {sortMenuOpen ? (
              <View style={styles.sortMenu}>
                {([["latest", "최신순"], ["popular", "인기순"]] as const).map(([value, label]) => {
                  const active = resourceSort === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => {
                        setResourceSort(value);
                        setSortMenuOpen(false);
                      }}
                      style={styles.sortOption}
                    >
                      <Text style={[styles.sortOptionText, active ? styles.sortOptionTextActive : null]}>{label}</Text>
                      {active ? <Ionicons name="checkmark" size={14} color={COLORS.primary} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
          <View style={styles.sortDivider} />
        </>
      ) : null}

      {refreshFirstPageError ? (
        <FeedRefreshErrorBanner onRetry={() => void feedController.refreshFirstPage()} />
      ) : null}

      {isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          key={isAlbum ? "album" : isParticipationGuideCards ? "participation-guide" : isActivityCards ? "activity" : "list"}
          numColumns={isAlbum ? 2 : 1}
          data={posts}
          keyExtractor={(item) => String(item.id)}
          refreshing={isRefreshingFirstPage}
          onRefresh={() => void feedController.refreshFirstPage()}
          contentContainerStyle={[
            isAlbum ? styles.albumContent : isParticipationGuideCards ? styles.guideContent : isActivityCards ? styles.cardContent : styles.listContent,
            posts.length === 0 ? styles.emptyContent : null,
          ]}
          columnWrapperStyle={isAlbum ? styles.albumRow : undefined}
          ListEmptyComponent={
            isError ? (
              <Pressable onPress={() => void feedController.retry()} style={styles.errorBox}>
                <Text style={styles.errorTitle}>게시글을 불러오지 못했습니다.</Text>
                <Text style={styles.errorText}>탭해서 다시 시도하세요.</Text>
              </Pressable>
            ) : (
              <View style={styles.emptyBox}>
                <EmptyCalendarIcon size={32} />
                <Text style={styles.emptyText}>
                  {query ? "검색 결과가 없어요" : isMutualAid ? "등록된 상조회 신청이 없어요" : isSuggestion ? "등록된 건의사항이 없어요" : board?.slug === "study-recruit" ? "모집 중인 스터디가 없어요" : isParticipationGuideCards ? (participationGroupKey(board) === "networking" ? "등록된 네트워킹이 없어요" : "등록된 동아리가 없어요") : isAlbum ? "등록된 사진이 없어요" : "아직 게시물이 없어요"}
                </Text>
                <Text style={styles.emptySubText}>
                  {query ? "다른 검색어로 다시 시도해보세요" : isMutualAid ? "경조사 발생 시 신청해보세요" : isSuggestion ? "원우회에 건의하고 싶은 내용을 남겨보세요" : board?.slug === "study-recruit" ? "첫 스터디를 모집해보세요" : isParticipationGuideCards ? (participationGroupKey(board) === "networking" ? "새로운 네트워킹이 등록되면 알려드릴게요" : "새로운 동아리가 등록되면 알려드릴게요") : isAlbum ? "행사 사진이 등록되면 알려드릴게요" : "첫 게시글을 남겨보세요"}
                </Text>
              </View>
            )
          }
          renderItem={({ item, index }) => {
            const itemBoard = boards.find((candidate) => candidate.id === item.board_id) ?? board;
            return isAlbum ? (
              <AlbumTile post={item} index={index} onPress={(postId) => router.push(postDetailRoute(postId, boardId, detailReturnRoute) as never)} />
            ) : isParticipationGuideCards ? (
              <ParticipationGuideTile post={item} board={itemBoard} index={index} onPress={(postId) => router.push(postDetailRoute(postId, boardId, detailReturnRoute) as never)} />
            ) : isActivityCards ? (
              <ActivityTile post={item} boardSlug={itemBoard?.slug ?? board?.slug} index={index} isLast={index === posts.length - 1} onPress={(postId) => router.push(postDetailRoute(postId, boardId, detailReturnRoute) as never)} />
            ) : (
              <PostCard post={item} boardType={itemBoard?.board_type} boardSlug={itemBoard?.slug} isLast={index === posts.length - 1} onPress={(postId) => router.push(postDetailRoute(postId, boardId, detailReturnRoute) as never)} />
            );
          }}
          onEndReached={() => {
            void feedController.loadMore();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={<BoardFeedFooter state={feedFooterState} onRetry={() => void feedController.loadMore()} />}
        />
      )}

      {canShowCreateButton ? (
        <Pressable onPress={openCreate} style={styles.fab}>
          <Ionicons name="add" size={22} color="#FFFFFF" />
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
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "500",
  },
  searchBar: {
    flex: 1,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F7F8FA",
    borderRadius: 999,
    paddingHorizontal: 16,
    marginLeft: 4,
  },
  searchBarInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 22,
  },
  sectionTabs: {
    height: 46,
    flexDirection: "row",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: "#E1E4E9",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
  },
  sectionTab: {
    flex: 1,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  sectionTabActive: {
    borderBottomColor: COLORS.text,
  },
  sectionTabText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "400",
  },
  sectionTabTextActive: {
    color: COLORS.text,
    fontWeight: "500",
  },
  filterWrap: {
    height: 54, // Figma: 서브필터 54h, padding 12/16 (일반 게시판은 하단 구분선 없음)
    backgroundColor: COLORS.surface,
  },
  filterScroller: {
    height: 54,
    flexGrow: 0,
  },
  filterContent: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterChip: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: "#E1E4E9",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipActive: {
    borderColor: "#15171C",
    backgroundColor: "#15171C",
  },
  filterText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  // Figma: 정렬버튼행 padding 0/16/10, 라벨 13/16 #6B7280, 아래 1px 구분선
  sortRowWrap: {
    position: "relative",
    zIndex: 20,
  },
  sortMenu: {
    // Figma: 드롭다운 160w, radius 12, shadow 0 4 16 12%
    position: "absolute",
    top: 34,
    right: 16,
    width: 160,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingVertical: 6,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 30,
  },
  sortOption: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sortOptionText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 17,
  },
  sortOptionTextActive: {
    color: COLORS.primary,
    fontWeight: "500",
  },
  sortRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  sortButton: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  sortButtonText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
  },
  sortDivider: {
    height: 1,
    backgroundColor: "#E1E4E9",
  },
  listContent: {
    paddingBottom: 92,
  },
  feedFooter: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  feedFooterRetry: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  feedRefreshError: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#FECACA",
    backgroundColor: COLORS.danger50,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  feedRefreshErrorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  albumContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 92,
  },
  albumRow: {
    gap: 10,
  },
  albumTile: {
    flex: 1,
    maxWidth: "50%",
    marginBottom: 12,
  },
  albumThumb: {
    // Figma: 썸네일 155x140, 카운트 배지 좌8/하10 위치
    position: "relative",
    aspectRatio: 155 / 140,
    justifyContent: "flex-end",
    borderRadius: 10,
    overflow: "hidden",
    paddingLeft: 10,
    paddingBottom: 8,
  },
  albumImage: {
    borderRadius: 10,
  },
  albumScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,24,39,0.08)",
  },
  albumCountPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  albumCountText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 13,
  },
  albumTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 16,
    marginTop: 8,
  },
  albumDate: {
    color: "#A6ACB7",
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 13,
    marginTop: 8, // Figma: 앨범카드 요소 간격 8
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 92,
  },
  guideContent: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  guideCard: {
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    paddingBottom: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E1E4E9",
  },
  guideThumb: {
    position: "relative",
    width: "100%",
    aspectRatio: 1.565,
    overflow: "hidden",
  },
  guideImage: {},
  guideScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,24,39,0.06)",
  },
  guideBody: {
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  guidePill: {
    alignSelf: "flex-start",
    borderRadius: 8,
    backgroundColor: COLORS.primary50,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  guidePillText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "400",
  },
  guideTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 22,
    marginTop: 8,
  },
  guidePreview: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 20,
    marginTop: 8,
  },
  activityCard: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E1E4E9",
  },
  activityCardLast: {
    borderBottomWidth: 0, // 마지막 인증 카드 아래에는 구분선을 긋지 않는다
  },
  activityThumb: {
    position: "relative",
    // Figma 인증피드카드(117:61)의 인증사진 328x219. 카드 폭은 좌우 16 여백을 뺀
    // 328이라 그대로 맞는다. 예전 2.05는 같은 폭에서 높이가 160으로 59px 낮았다.
    aspectRatio: 328 / 219,
    borderRadius: 8,
    overflow: "hidden",
  },
  activityImage: {
    borderRadius: 8,
  },
  activityScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,24,39,0.06)",
  },
  activityBody: {
    paddingTop: 8,
  },
  activityPill: {
    alignSelf: "flex-start",
    borderRadius: 8,
    backgroundColor: "#E6F1FB",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activityPillText: {
    color: "#0C447C",
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 13,
  },
  activityTitle: {
    color: COLORS.text,
    fontSize: 15, // Figma 인증피드카드 제목 15/18 Medium
    fontWeight: "500",
    lineHeight: 18,
  },
  activityPreview: {
    color: COLORS.muted, // Figma 소감 13/150% #6B7280
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 20,
    marginTop: 8,
  },
  activityDate: {
    color: "#A6ACB7", // Figma 메타 12/15 #A6ACB7
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 15,
    marginTop: 8,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  centerText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  accountingContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 40,
    gap: 16,
  },
  accountingTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 18,
    textAlign: "center",
  },
  accountingDescription: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 21,
    textAlign: "center",
  },
  accountingButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  accountingButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 17,
  },
  executiveScroller: {
    flex: 1,
  },
  executiveContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  executiveText: {
    flex: 1,
    minWidth: 0,
  },
  executiveName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "500", // Figma 229:11
  },
  executiveRole: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "400",
    marginTop: 2,
  },
  councilActivityContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  executiveEmptyState: {
    flex: 1,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  executiveEmptyTitle: {
    color: "#2C3038",
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 26,
    marginTop: 8,
  },
  executiveEmptyDescription: {
    color: "#8A919C",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
    marginTop: 8,
  },
  councilActivityRow: {
    minHeight: 60,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingVertical: 12,
  },
  councilActivityText: {
    flex: 1,
    minWidth: 0,
  },
  councilActivityDate: {
    color: "#A6ACB7",
    fontSize: 11,
    fontWeight: "400",
    marginBottom: 4,
  },
  councilActivityTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
  },
  cohortCard: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10, // Figma 62:46 card
    borderWidth: 1,
    borderColor: "#E1E4E9",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  cohortBadge: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#E6F1FB", // Figma 62:46 badge
    marginRight: 12,
  },
  cohortBadgeText: {
    color: "#0C447C",
    fontSize: 13,
    fontWeight: "500", // Figma: Medium
  },
  cohortDetailContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 32,
  },
  pastPhotoSlider: {
    marginHorizontal: -20, // full-bleed (cancel content padding)
    marginTop: -14,
    height: 240, // Figma 사진슬라이더
    marginBottom: 8,
  },
  pastPhoto: {
    width: "100%",
    height: 240,
    backgroundColor: "#F7F7F5", // contain 시 여백(레터박스) 배경
  },
  pastPhotoNav: {
    position: "absolute",
    top: 106,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  pastPhotoIndicator: {
    position: "absolute",
    right: 16,
    bottom: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  pastPhotoIndicatorText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "400",
  },
  cohortGreeting: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400", // Figma: Regular
    lineHeight: 23,
  },
  cohortIntroText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400", // Figma: Regular
    lineHeight: 23,
    marginTop: 14,
    marginBottom: 4,
  },
  emptyContent: {
    flexGrow: 1,
  },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: {
    color: "#2C3038",
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 26,
    marginTop: 8,
  },
  emptySubText: {
    color: "#8A919C",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
    marginTop: 8,
  },
  errorBox: {
    margin: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: COLORS.danger50,
    padding: 16,
  },
  errorTitle: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: "900",
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 5,
  },
  fab: {
    // Figma: FAB 52px, + 아이콘 22px
    position: "absolute",
    right: 16,
    bottom: 24,
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    shadowColor: "#0B1F56",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
});
