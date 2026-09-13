import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Alert,
  Image,
  type ImageSourcePropType,
  Linking,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { MediaImageBackground } from "../../components/MediaImage";
import HomeSectionGate from "../../components/HomeSectionGate";
import { BackIcon, BellIcon, EmptyCalendarIcon, ForwardIcon, ProfileIcon } from "../../components/icons";
import { useMyPageDrawer } from "../../components/MyPageDrawer";
import { useBoardsQuery } from "../../hooks/useApi";
import { API_ORIGIN, bannerApi, eventApi, notificationApi, postApi } from "../../services/api";
import { requestTabRootReset } from "../../stores/tabRootResetStore";
import { useUserStore } from "../../stores/userStore";
import type { BannerItem, Board, EventItem, PostListItem } from "../../types";
import { COMMUNITY_TAB_ROUTE, HOME_TAB_ROUTE, NOTICES_TAB_ROUTE, eventDayRoute, postDetailRoute } from "../../utils/appRoutes";
import { formatBoardDate, formatHomeScheduleDate } from "../../utils/dateFormat";
import {
  calendarDateKey,
  calendarMonthRange,
  currentKoreaMonth,
  eventDaysForMonth,
  eventIsCurrentOrUpcoming,
  koreaCalendarDate,
  shiftCalendarMonth,
} from "../../utils/eventCalendar";
import { toAbsoluteMediaUrl } from "../../utils/mediaAccess";
import { homeAlumniDirectoryErrorMessage, homeAlumniDirectoryLink } from "../../utils/homeAlumniDirectory";
import { homeNoticeDeadlineSuffix, homeScheduleDdayLabel } from "../../utils/homeNoticeDeadline";
import { homeNoticeCategory, isNoticeContentBoard, loadHomeNoticePreview } from "../../utils/noticeFeed";
import { enabledRefetch, refreshQueries } from "../../utils/pullToRefresh";

const COLORS = {
  primary: "#2761FF",
  primary50: "#EDF2FE",
  primary100: "#D5E0FE",
  primary900: "#0B1F56",
  cyan: "#1FA9BD",
  purple: "#6C4FCB",
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  border: "#E1E4E9",
  text: "#15171C",
  muted: "#6B7280",
  subtle: "#A6ACB7",
};

const CARD_ELEVATION = {
  shadowColor: "#0B1F56",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.04,
  shadowRadius: 12,
  elevation: 1,
};

const POPULAR_BOARD_SLUGS = [
  "community-major",
  "community-seminar",
  "lecture-reviews",
  "mutual-aid",
];
const ALBUM_BOARD_SLUGS = ["activity-history", "event-album", "photo-album", "student-council"];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MOBILE_WEB_WIDTH = 405;
const HORIZONTAL_PADDING = 20;
const ALBUM_CARD_WIDTH = 120;
const ALBUM_CARD_GAP = 10;
const HOME_ALBUM_LIMIT = 10;
const SHOW_HOME_POPULAR_POSTS = false;
const ALBUM_GRADIENTS: readonly (readonly [string, string])[] = [
  ["#2761FF", "#8EC9FF"],
  ["#5B49C8", "#B7A4F8"],
  ["#0E7B60", "#4DBB91"],
];


function mediaUrl(value?: string | null) {
  return toAbsoluteMediaUrl(value, API_ORIGIN);
}

function pickBannerImage(banner: BannerItem | undefined, width: number) {
  if (!banner) {
    return null;
  }
  if (width >= 900) {
    return mediaUrl(banner.image_urls?.desktop ?? banner.image_urls?.tablet ?? banner.image_urls?.mobile ?? banner.image_url);
  }
  if (width >= 600) {
    return mediaUrl(banner.image_urls?.tablet ?? banner.image_urls?.desktop ?? banner.image_urls?.mobile ?? banner.image_url);
  }
  return mediaUrl(banner.image_urls?.mobile ?? banner.image_urls?.tablet ?? banner.image_urls?.desktop ?? banner.image_url);
}

function monthLabel(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function noticeDotColor(value?: string | null) {
  const category = value?.trim().toLowerCase() ?? "";
  if (category.includes("event") || category.includes("webinar") || category.includes("행사") || category.includes("특강")) {
    return "#993556"; // Figma 행사공지
  }
  if (category.includes("academic") || category.includes("학사")) {
    return "#0C447C"; // Figma 학사공지
  }
  return "#6543A2"; // Figma 기타공지
}

function flattenBoards(groups?: { boards: Board[] }[]) {
  return groups?.flatMap((group) => group.boards) ?? [];
}

function findBoardId(boards: Board[], slugs: string[], fallbackCategory?: string) {
  for (const slug of slugs) {
    const board = boards.find((item) => item.slug === slug);
    if (board) {
      return board.id;
    }
  }
  if (fallbackCategory) {
    return boards.find((item) => item.category === fallbackCategory)?.id;
  }
  return boards[0]?.id;
}

function thumbnailUrl(post: PostListItem) {
  if (post.thumbnail_url) {
    return mediaUrl(post.thumbnail_url);
  }
  const metadata = post.metadata ?? {};
  const keys = ["thumbnail_url", "image_url", "cover_url"];
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string") {
      return mediaUrl(value);
    }
  }
  return null;
}

function buildMonthCells(month: Date, activeDay: number, markedDays: Set<number>) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const lastDate = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: { key: string; day?: number; active?: boolean; marked?: boolean }[] = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push({ key: `blank-${index}` });
  }
  for (let day = 1; day <= lastDate; day += 1) {
    cells.push({ key: `day-${day}`, day, active: day === activeDay, marked: markedDays.has(day) });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `blank-${cells.length}` });
  }
  return cells;
}

function getHomeContentWidth(windowWidth: number) {
  const shellWidth = Platform.OS === "web" ? Math.min(windowWidth, MOBILE_WEB_WIDTH) : windowWidth;
  return Math.max(280, shellWidth - HORIZONTAL_PADDING * 2);
}

function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={styles.iconButton}>
      {children}
    </Pressable>
  );
}

// 홈 섹션 아이콘. 행사 사진첩=카메라, 동문회 주소록=클립보드.
const HOME_ICON_PHOTO_ALBUM: ImageSourcePropType = require("../../assets/images/home-icon-photo-album.png");
const HOME_ICON_ALUMNI: ImageSourcePropType = require("../../assets/images/home-icon-alumni.png");
// 홈 인사말 손 흔드는 아이콘.
const HOME_ICON_GREETING: ImageSourcePropType = require("../../assets/images/home-icon-greeting.png");

function SectionHeader({ title, icon, actionLabel = "더보기", onPress }: { title: string; icon?: ImageSourcePropType; actionLabel?: string; onPress?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        {icon ? <Image source={icon} style={styles.sectionTitleIcon} resizeMode="contain" /> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {onPress ? (
        <Pressable onPress={onPress} style={styles.moreButton}>
          <Text style={styles.moreText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function HomeEmptyState({ type }: { type: "notices" | "popular" | "album" }) {
  const content = {
    notices: {
      icon: <EmptyCalendarIcon size={32} />,
      title: "등록된 공지사항이 없어요",
      description: "새로운 공지가 등록되면 알려드릴게요",
    },
    popular: {
      icon: <Ionicons name="calendar-outline" size={32} color="#AAB2BF" />,
      title: "인기 게시글이 아직 없어요",
      description: "곧 다양한 게시글이 채워질 거예요",
    },
    album: {
      icon: <Ionicons name="camera-outline" size={32} color="#AAB2BF" />,
      title: "행사 사진첩이 아직 없어요",
      description: "새로운 행사 사진이 등록되면 알려드릴게요",
    },
  }[type];

  return (
    <View style={styles.emptyState}>
      {content.icon}
      <Text style={styles.emptyStateTitle}>{content.title}</Text>
      <Text style={styles.emptyStateDescription}>{content.description}</Text>
    </View>
  );
}

function HomeErrorState({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="cloud-offline-outline" size={30} color="#AAB2BF" />
      <Text style={styles.emptyStateTitle}>{label}을 불러오지 못했습니다.</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.retryButtonText}>다시 시도</Text>
      </Pressable>
    </View>
  );
}

function HomeBanner({
  banner,
  index,
  total,
  width,
}: {
  banner: BannerItem;
  index: number;
  total: number;
  width: number;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const imageUrl = pickBannerImage(banner, Platform.OS === "web" ? MOBILE_WEB_WIDTH : windowWidth);
  const pageTotal = Math.max(total, 1);
  const pageIndex = Math.min(index + 1, pageTotal);
  const linkHref = banner.cta_href?.trim();
  const handlePress = () => {
    if (!linkHref) {
      return;
    }
    if (/^https?:\/\//i.test(linkHref)) {
      Linking.openURL(linkHref);
      return;
    }
    router.push(linkHref as never);
  };

  if (!imageUrl) return null;

  const bannerView = (
    <MediaImageBackground
      media={{ url: imageUrl }}
      imageStyle={styles.bannerImage}
      resizeMode="cover"
      style={[styles.banner, { width }]}
    >
      <View pointerEvents="none" style={styles.bannerPagerPosition}>
        <View style={styles.bannerPager}>
          <Text style={styles.bannerPagerText}>{pageIndex}/{pageTotal}</Text>
        </View>
      </View>
    </MediaImageBackground>
  );

  if (!linkHref) {
    return bannerView;
  }

  return (
    <Pressable accessibilityRole="link" accessibilityLabel="홈 배너 바로가기" onPress={handlePress}>
      {bannerView}
    </Pressable>
  );
}

function HomeBannerCarousel({ banners }: { banners: BannerItem[] }) {
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const bannerWidth = measuredWidth || getHomeContentWidth(windowWidth);
  const imageSelectionWidth = Platform.OS === "web" ? MOBILE_WEB_WIDTH : windowWidth;
  const carouselItems = banners.filter((banner) => Boolean(pickBannerImage(banner, imageSelectionWidth)));
  const carouselCount = carouselItems.length;
  const isSwipeable = carouselItems.length > 1;
  const snapInterval = bannerWidth + 12;

  useEffect(() => {
    if (currentIndex < carouselCount) {
      return;
    }
    setCurrentIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [carouselCount, currentIndex]);

  useEffect(() => {
    if (!isSwipeable || measuredWidth <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setCurrentIndex((index) => {
        const nextIndex = (index + 1) % carouselCount;
        scrollRef.current?.scrollTo({ x: nextIndex * snapInterval, animated: true });
        return nextIndex;
      });
    }, 4500);

    return () => clearInterval(timer);
  }, [carouselCount, isSwipeable, measuredWidth, snapInterval]);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isSwipeable) {
      return;
    }
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
    setCurrentIndex(Math.max(0, Math.min(nextIndex, carouselCount - 1)));
  };

  if (carouselItems.length === 0) {
    return (
      <View style={[styles.emptyRow, { marginBottom: 6 }]}>
        <Text style={styles.emptyText}>현재 등록된 홈 배너가 없습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      bounces={false}
      decelerationRate="fast"
      disableIntervalMomentum
      pagingEnabled={false}
      scrollEnabled={isSwipeable}
      showsHorizontalScrollIndicator={false}
      snapToAlignment="start"
      snapToInterval={isSwipeable ? snapInterval : undefined}
      onLayout={(event: LayoutChangeEvent) => setMeasuredWidth(event.nativeEvent.layout.width)}
      onMomentumScrollEnd={handleMomentumEnd}
      style={styles.bannerCarousel}
      contentContainerStyle={styles.bannerCarouselContent}
    >
      {carouselItems.map((item, index) => (
        <HomeBanner
          key={item.id}
          banner={item}
          index={index}
          total={carouselItems.length}
          width={bannerWidth}
        />
      ))}
    </ScrollView>
  );
}

function NoticeList({
  posts,
  boards,
  loading,
  isError,
  onRetry,
}: {
  posts: PostListItem[];
  boards: Board[];
  loading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.emptyText}>공지사항을 불러오는 중이에요</Text>
      </View>
    );
  }

  if (isError) {
    return <HomeErrorState label="공지사항" onRetry={onRetry} />;
  }

  const rows = posts;
  const boardById = new Map(boards.map((board) => [board.id, board]));
  if (!rows.length) {
    return <HomeEmptyState type="notices" />;
  }

  return (
    <View style={styles.noticeList}>
      {rows.map((post, index) => {
        const category = homeNoticeCategory(post, boardById.get(post.board_id));
        return (
          <Pressable
            key={post.id}
            onPress={() => router.push(postDetailRoute(post.id, undefined, HOME_TAB_ROUTE) as never)}
            style={[styles.noticeRow, index === rows.length - 1 ? styles.noticeRowLast : null]}
          >
            <View style={[styles.noticeDot, { backgroundColor: noticeDotColor(category) }]} />
            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle} numberOfLines={1}>
                {post.title}
              </Text>
              <Text style={styles.noticeMeta} numberOfLines={1}>
                {category} · {formatBoardDate(post.created_at)}
                {homeNoticeDeadlineSuffix(post.deadline_at)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function CalendarCard({ events, month, onChangeMonth }: { events: EventItem[]; month: Date; onChangeMonth: (delta: number) => void }) {
  const today = koreaCalendarDate();
  const visibleEvents = events;
  const activeDay = today.year === month.getFullYear() && today.month === month.getMonth() + 1 ? today.day : 1;
  const markedDays = eventDaysForMonth(visibleEvents, month);
  const cells = buildMonthCells(month, activeDay, markedDays);
  const nextEvent = [...visibleEvents]
    .filter((event) => eventIsCurrentOrUpcoming(event))
    .sort((left, right) => +new Date(left.start_at) - +new Date(right.start_at))[0];

  return (
    <View style={styles.calendarCard}>
      <View style={styles.calendarHeader}>
        <Pressable accessibilityLabel="이전 달" onPress={() => onChangeMonth(-1)} style={styles.calendarArrow}>
          <BackIcon size={16} color={COLORS.subtle} />
        </Pressable>
        <Text style={styles.calendarMonth}>{monthLabel(month)}</Text>
        <Pressable accessibilityLabel="다음 달" onPress={() => onChangeMonth(1)} style={styles.calendarArrow}>
          <ForwardIcon size={16} color={COLORS.subtle} />
        </Pressable>
      </View>
      <View style={styles.calendarGrid}>
        {WEEKDAYS.map((day, index) => (
          <Text key={day} style={[styles.weekday, index === 0 ? styles.weekdaySunday : null]}>
            {day}
          </Text>
        ))}
        {cells.map((cell) => (
          <Pressable
            key={cell.key}
            accessibilityLabel={cell.day ? `${month.getMonth() + 1}월 ${cell.day}일 일정 보기` : undefined}
            disabled={!cell.day}
            onPress={() => {
              if (!cell.day) return;
              const selectedDate = new Date(month.getFullYear(), month.getMonth(), cell.day);
              router.push(eventDayRoute(calendarDateKey(selectedDate), HOME_TAB_ROUTE) as never);
            }}
            style={styles.dayCell}
          >
            {cell.day ? (
              <View style={[styles.dayBadge, cell.active ? styles.dayBadgeActive : cell.marked ? styles.dayBadgeMarked : null]}>
                <Text style={[styles.dayText, cell.active ? styles.dayTextActive : cell.marked ? styles.dayTextMarked : null]}>{cell.day}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
      {nextEvent ? (
        <Pressable onPress={() => router.push(`/events/${nextEvent.id}` as never)} style={styles.nextEvent}>
          <View style={styles.eventDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.nextEventTitle} numberOfLines={1}>
              {`${formatHomeScheduleDate(nextEvent.start_at)} · ${nextEvent.title}`}
            </Text>
          </View>
          <Text style={styles.nextEventDday}>{homeScheduleDdayLabel(nextEvent.end_at ?? nextEvent.start_at)}</Text>
        </Pressable>
      ) : (
        <View accessibilityLabel="예정된 일정이 없습니다" style={styles.nextEvent}>
          <View style={styles.eventDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.nextEventTitle} numberOfLines={1}>예정된 일정이 없습니다</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// 이 부분이 홈 인기게시글 코드입니다.
function HomePopularPostsSection({
  boardId,
  boardsError,
  compact,
  refetchBoards,
}: {
  boardId?: number;
  boardsError: boolean;
  compact: boolean;
  refetchBoards: () => Promise<unknown>;
}) {
  const popularQuery = useQuery({
    queryKey: ["home", "popular", boardId],
    queryFn: () => postApi.getPosts(boardId ?? 0, 1, 2, { sort: "popular" }),
    enabled: Boolean(boardId),
  });
  const rows = (popularQuery.data?.data ?? []).slice(0, 2);

  return (
    <>
      <SectionHeader title="🔥 인기 게시글" onPress={() => router.push((boardId ? `/board/${boardId}` : COMMUNITY_TAB_ROUTE) as never)} />
      {popularQuery.isLoading ? (
        <View style={styles.loadingBox}>
          <Text style={styles.emptyText}>인기 글을 불러오는 중이에요</Text>
        </View>
      ) : boardsError || popularQuery.isError ? (
        <HomeErrorState label="인기 게시글" onRetry={() => void Promise.all([refetchBoards(), popularQuery.refetch()])} />
      ) : rows.length === 0 ? (
        <HomeEmptyState type="popular" />
      ) : (
        <View style={[styles.popularGrid, compact ? styles.popularGridCompact : null]}>
          {rows.map((post) => (
            <Pressable key={post.id} onPress={() => router.push(postDetailRoute(post.id, undefined, HOME_TAB_ROUTE) as never)} style={styles.popularCard}>
              <View style={styles.categoryPill}>
                <Text style={styles.categoryPillText} numberOfLines={1}>
                  {post.category || "커뮤니티"}
                </Text>
              </View>
              <Text style={styles.popularTitle} numberOfLines={2}>
                {post.title}
              </Text>
              <View style={styles.postStats}>
                <Ionicons name="chatbubble-outline" size={11} color={COLORS.muted} />
                <Text style={styles.statText}>{post.comment_count}</Text>
                <Ionicons name="heart-outline" size={11} color={COLORS.muted} />
                <Text style={styles.statText}>{post.like_count}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}

function AlbumStrip({ posts }: { posts: PostListItem[] }) {
  const rows = posts.slice(0, HOME_ALBUM_LIMIT);
  if (!rows.length) {
    return <HomeEmptyState type="album" />;
  }

  return (
    <ScrollView
      horizontal
      bounces={false}
      decelerationRate="fast"
      disableIntervalMomentum
      scrollEnabled={rows.length > 2}
      showsHorizontalScrollIndicator={false}
      snapToAlignment="start"
      snapToInterval={ALBUM_CARD_WIDTH + ALBUM_CARD_GAP}
      contentContainerStyle={styles.albumContent}
    >
      {rows.map((post, index) => {
        const image = thumbnailUrl(post);
        return (
          <Pressable key={post.id} onPress={() => router.push(postDetailRoute(post.id, undefined, HOME_TAB_ROUTE) as never)} style={styles.albumCard}>
            {image ? (
              <MediaImageBackground
                media={{ id: post.thumbnail_media_id, url: image }}
                imageStyle={styles.albumImage}
                style={styles.albumImageBox}
              />
            ) : (
              <LinearGradient
                colors={ALBUM_GRADIENTS[index % ALBUM_GRADIENTS.length]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.albumFallback}
              >
                <Ionicons name="camera-outline" size={26} color="#DDE7FF" />
              </LinearGradient>
            )}
            <Text style={styles.albumTitle} numberOfLines={2}>
              {post.title}
            </Text>
            <Text style={styles.albumMeta}>{formatBoardDate(post.created_at)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const user = useUserStore((state) => state.user);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const { openDrawer } = useMyPageDrawer();
  const [month, setMonth] = useState(() => currentKoreaMonth());
  const compact = false;
  const monthRange = useMemo(() => calendarMonthRange(month), [month]);
  const {
    data: boardGroups,
    isError: boardsError,
    isLoading: boardsLoading,
    isRefetching: boardsRefetching,
    refetch: refetchBoards,
  } = useBoardsQuery();
  const boards = useMemo(() => flattenBoards(boardGroups?.data), [boardGroups?.data]);
  const noticeBoards = useMemo(() => boards.filter(isNoticeContentBoard), [boards]);
  const popularBoardId = useMemo(() => findBoardId(boards, POPULAR_BOARD_SLUGS, "community"), [boards]);
  const albumBoardId = useMemo(() => findBoardId(boards, ALBUM_BOARD_SLUGS, "participation"), [boards]);

  const bannersQuery = useQuery({
    queryKey: ["banners", "home"],
    queryFn: () => bannerApi.getBanners({ placement: "home" }),
  });
  const noticesQuery = useQuery({
    queryKey: ["home", "notices"],
    queryFn: () => loadHomeNoticePreview(postApi.getFeed),
    retry: false,
  });
  const eventsQuery = useQuery({
    queryKey: ["home", "events", monthRange.start, monthRange.end],
    queryFn: () => eventApi.getEvents({ from_date: monthRange.start, to_date: monthRange.end }),
  });
  const albumQuery = useQuery({
    queryKey: ["home", "album", albumBoardId],
    queryFn: () => postApi.getPosts(albumBoardId ?? 0, 1, HOME_ALBUM_LIMIT, { sort: "latest" }),
    enabled: Boolean(albumBoardId),
  });
  const notificationQuery = useQuery({
    queryKey: ["notifications", "home-badge"],
    queryFn: () => notificationApi.getNotifications(1, 100),
    enabled: isAuthenticated,
  });

  const banners = bannersQuery.data?.data ?? [];
  const notices = noticesQuery.data?.data ?? [];
  const events = eventsQuery.data?.data ?? [];
  const albumPosts = albumQuery.data?.data ?? [];
  const alumniDirectoryLink = useMemo(() => homeAlumniDirectoryLink(boards), [boards]);
  const hasUnreadNotifications = (notificationQuery.data?.data ?? []).some((notification) => !notification.is_read);
  const displayName = user?.nickname || "서강인";
  const isHomeLoading = boardsLoading || bannersQuery.isLoading || noticesQuery.isLoading
    || eventsQuery.isLoading || albumQuery.isLoading;
  const isRefreshing = boardsRefetching
    || bannersQuery.isRefetching
    || noticesQuery.isRefetching
    || eventsQuery.isRefetching
    || albumQuery.isRefetching
    || notificationQuery.isRefetching;
  const refreshHome = () => {
    void refreshQueries([
      refetchBoards,
      bannersQuery.refetch,
      eventsQuery.refetch,
      enabledRefetch(isAuthenticated, notificationQuery.refetch),
      noticesQuery.refetch,
      albumBoardId ? albumQuery.refetch : undefined,
    ]);
  };
  const openAlumniDirectory = () => {
    if (alumniDirectoryLink.status !== "ready") {
      Alert.alert("동문회 주소록", homeAlumniDirectoryErrorMessage(alumniDirectoryLink.status));
      return;
    }

    void Linking.openURL(alumniDirectoryLink.url).catch(() => {
      Alert.alert("동문회 주소록", homeAlumniDirectoryErrorMessage("open_failed"));
    });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 12, 21) }]}
      refreshControl={<RefreshControl refreshing={!isHomeLoading && isRefreshing} onRefresh={refreshHome} tintColor={COLORS.primary} />}
    >
      <View style={styles.header}>
        <View style={styles.greetingWrap}>
          <View style={styles.greetingRow}>
            <Text style={styles.greeting} numberOfLines={1}>
              안녕하세요, {displayName}님
            </Text>
            <Image source={HOME_ICON_GREETING} style={styles.greetingIcon} resizeMode="contain" />
          </View>
        </View>
        <View style={styles.headerActions}>
          <IconButton label="알림" onPress={() => router.push("/notifications" as never)}>
            <BellIcon size={24} hasBadge={hasUnreadNotifications} />
          </IconButton>
          <IconButton label="마이페이지" onPress={() => (isAuthenticated ? openDrawer() : router.push("/auth/login" as never))}>
            <ProfileIcon size={24} />
          </IconButton>
        </View>
      </View>

      {isHomeLoading ? <ActivityIndicator accessibilityLabel="홈 콘텐츠 로딩" size="small" color={COLORS.primary} /> : null}

      {bannersQuery.isLoading ? (
        <View style={styles.loadingBox}>
          <Text style={styles.emptyText}>배너를 불러오는 중이에요</Text>
        </View>
      ) : bannersQuery.isError ? (
        <HomeErrorState label="홈 배너" onRetry={() => void bannersQuery.refetch()} />
      ) : (
        <HomeBannerCarousel banners={banners} />
      )}

      <SectionHeader
        title="공지사항"
        onPress={() => {
          requestTabRootReset("notices");
          router.navigate(NOTICES_TAB_ROUTE as never);
        }}
      />
      <NoticeList
        posts={notices}
        boards={noticeBoards}
        loading={noticesQuery.isLoading || boardsLoading}
        isError={boardsError || noticesQuery.isError}
        onRetry={() => void Promise.all([refetchBoards(), noticesQuery.refetch()])}
      />

      <SectionHeader title="서강생활 일정" />
      {eventsQuery.isLoading ? (
        <View style={styles.loadingBox}>
          <Text style={styles.emptyText}>일정을 불러오는 중이에요</Text>
        </View>
      ) : eventsQuery.isError ? (
        <HomeErrorState label="일정" onRetry={() => void eventsQuery.refetch()} />
      ) : (
        <CalendarCard
          events={events}
          month={month}
          onChangeMonth={(delta) => setMonth((value) => shiftCalendarMonth(value, delta))}
        />
      )}

      <HomeSectionGate visible={SHOW_HOME_POPULAR_POSTS}>
        <HomePopularPostsSection
          boardId={popularBoardId}
          boardsError={boardsError}
          compact={compact}
          refetchBoards={refetchBoards}
        />
      </HomeSectionGate>

      <SectionHeader
        title="행사 사진첩"
        icon={HOME_ICON_PHOTO_ALBUM}
        onPress={() => {
          requestTabRootReset("community");
          router.navigate(COMMUNITY_TAB_ROUTE as never);
        }}
      />
      {albumQuery.isLoading ? (
        <View style={styles.loadingBox}>
          <Text style={styles.emptyText}>사진첩을 불러오는 중이에요</Text>
        </View>
      ) : boardsError || albumQuery.isError ? (
        <HomeErrorState label="행사 사진첩" onRetry={() => void Promise.all([refetchBoards(), albumQuery.refetch()])} />
      ) : (
        <AlbumStrip posts={albumPosts} />
      )}

      <Pressable
        accessibilityLabel="동문회 주소록"
        accessibilityRole="link"
        onPress={openAlumniDirectory}
        style={styles.alumniDirectoryRow}
      >
        <View style={styles.alumniDirectoryLeading}>
          <View style={styles.alumniDirectoryCopy}>
            <View style={styles.alumniDirectoryTitleRow}>
              <Image source={HOME_ICON_ALUMNI} style={styles.alumniDirectoryIcon} resizeMode="contain" />
              <Text style={styles.alumniDirectoryTitle}>동문회 주소록</Text>
            </View>
            <Text style={styles.alumniDirectoryDescription}>선배 원우들의 연락처를 확인해보세요</Text>
          </View>
        </View>
        <ForwardIcon size={18} color={COLORS.muted} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 21,
    paddingBottom: 16,
  },
  header: {
    height: 57,
    justifyContent: "flex-end",
    marginBottom: 18,
  },
  eyebrow: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  greetingWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  greetingIcon: {
    width: 22,
    height: 22,
  },
  greeting: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "500",
    lineHeight: 24,
    flexShrink: 1,
  },
  headerActions: {
    position: "absolute",
    top: 0,
    right: 0,
    flexDirection: "row",
    gap: 16,
  },
  iconButton: {
    position: "relative",
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  bannerCarousel: {
    width: "100%",
    overflow: "hidden",
  },
  bannerCarouselContent: {
    gap: 12,
  },
  banner: {
    aspectRatio: 8 / 5,
    borderRadius: 16,
    backgroundColor: "#EEF1F6",
    overflow: "hidden",
    ...CARD_ELEVATION,
  },
  bannerImage: {
    borderRadius: 16,
  },
  bannerPagerPosition: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    padding: 20,
  },
  bannerPager: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  bannerPagerText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "400",
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitleIcon: {
    width: 20,
    height: 20,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "500",
  },
  moreButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
  },
  moreText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "400",
  },
  loadingBox: {
    minHeight: 126,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyRow: {
    minHeight: 54,
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  emptyStateTitle: {
    color: "#2C3038",
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 26,
    marginTop: 8,
  },
  emptyStateDescription: {
    color: "#8A919C",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
    marginTop: 8,
  },
  retryButton: {
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 12,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  noticeList: {
    borderRadius: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    overflow: "hidden",
  },
  noticeRow: {
    minHeight: 60, // Figma 공지 항목 60h, padding 12/0
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 0,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E1E4E9",
  },
  noticeRowLast: {
    borderBottomWidth: 0,
  },
  noticeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  noticeContent: {
    flex: 1,
    minWidth: 0,
  },
  noticeTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 17,
  },
  noticeMeta: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 15,
    marginTop: 4,
  },
  calendarCard: {
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 14,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  calendarArrow: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarMonth: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 17,
  },
  calendarLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 6,
    backgroundColor: COLORS.primary50,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  calendarLinkText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 2,
  },
  weekday: {
    width: "14.285%",
    color: COLORS.subtle,
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 13,
    textAlign: "center",
    marginBottom: 8,
  },
  weekdaySunday: {
    color: "#993556",
  },
  dayCell: {
    width: "14.285%",
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  // Android(Fabric)는 배경색이 나중에 추가되는 뷰에서 borderRadius를 간헐적으로 놓친다.
  // 배경색과 radius를 항상 같은 스타일 객체에 두고, radius는 크기의 절반(14)으로 고정한다.
  dayBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  dayBadgeActive: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
  },
  dayBadgeMarked: {
    backgroundColor: "#E6F1FB",
    borderRadius: 14,
  },
  dayText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
    textAlign: "center",
    includeFontPadding: false,
  },
  dayTextActive: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  dayTextMarked: {
    color: "#0C447C",
    fontWeight: "500",
  },
  nextEvent: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  nextEventTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
  },
  nextEventDday: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 16,
  },
  nextEventMeta: {
    color: COLORS.muted,
    fontSize: 8,
    fontWeight: "700",
    marginTop: 2,
  },
  popularGrid: {
    flexDirection: "row",
    gap: 10,
  },
  popularGridCompact: {
    flexDirection: "column",
  },
  popularCard: {
    flex: 1,
    minHeight: 110,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  categoryPill: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    borderRadius: 8,
    backgroundColor: "#E6F1FB",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryPillText: {
    color: "#0C447C",
    fontSize: 11,
    fontWeight: "400",
  },
  popularTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
    marginTop: 8,
  },
  popularPreview: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    flex: 1,
  },
  postStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    // 제목이 1줄이어도 카드 하단에 붙어서 두 카드의 댓글/추천 줄 높이가 맞는다.
    marginTop: "auto",
    paddingTop: 10,
  },
  statText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 14,
    marginRight: 6,
  },
  albumContent: {
    gap: 10,
    paddingRight: 20,
  },
  albumCard: {
    width: ALBUM_CARD_WIDTH,
  },
  albumImageBox: {
    height: 120,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: COLORS.primary100,
  },
  albumImage: {
    borderRadius: 8,
  },
  albumFallback: {
    height: 120,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  albumTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 16,
    marginTop: 6,
  },
  albumMeta: {
    color: COLORS.subtle,
    fontSize: 11,
    fontWeight: "400",
    marginTop: 4,
  },
  alumniDirectoryRow: {
    minHeight: 50,
    marginTop: 24,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
  alumniDirectoryLeading: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  alumniDirectoryCopy: {
    flex: 1,
    minWidth: 0,
  },
  alumniDirectoryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  alumniDirectoryIcon: {
    width: 20,
    height: 20,
  },
  alumniDirectoryTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 18,
  },
  alumniDirectoryDescription: {
    color: COLORS.subtle,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
    marginTop: 4,
    marginLeft: 4,
  },
});
