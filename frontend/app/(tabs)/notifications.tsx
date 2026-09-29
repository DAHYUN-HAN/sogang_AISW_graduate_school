import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BackIcon,
  NotificationCommentIcon,
  NotificationNoticeIcon,
  NotificationCouncilIcon,
  NotificationEventIcon,
  NotificationLikeIcon,
  NotificationSuggestionIcon,
} from "../../components/icons";

import LoadingState from "../../components/LoadingState";
import { notificationApi } from "../../services/api";
import type { NotificationItem } from "../../types";
import { formatKoreanTime, formatShortDate } from "../../utils/dateFormat";
import { notificationContentRoute } from "../../utils/appRoutes";

const COLORS = {
  primary: "#2761FF",
  text: "#15171C",
  muted: "#6B7280",
  subtle: "#A6ACB7",
  border: "#E1E4E9",
  bg: "#FFFFFF",
  emptyIcon: "#A6ACB7",
  emptyTitle: "#2C3038",
  emptySub: "#8A919C",
};

// 디자인 원본 SVG가 있는 타입은 전용 아이콘(배경 원 포함)을 쓴다.
const CUSTOM_TYPE_ICONS: Record<string, (props: { size?: number }) => React.JSX.Element> = {
  comment: NotificationCommentIcon,
  notice: NotificationNoticeIcon,
  event: NotificationEventIcon,
  council: NotificationCouncilIcon,
  like: NotificationLikeIcon,
  admin_reply: NotificationSuggestionIcon,
};

const TYPE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  notice: { icon: "notifications-outline", color: "#0C447C", bg: "#E6F1FB" },
  event: { icon: "calendar-outline", color: "#3B6D11", bg: "#EAF3DE" },
  comment: { icon: "chatbubble-ellipses-outline", color: "#3C3489", bg: "#EEEDFE" },
  like: { icon: "heart-outline", color: "#993556", bg: "#FBEAF0" },
  admin_reply: { icon: "chatbox-ellipses-outline", color: "#0C447C", bg: "#E6F1FB" },
  report: { icon: "flag-outline", color: "#993556", bg: "#FBEAF0" },
  council: { icon: "flower-outline", color: "#A9600F", bg: "#FCEFDE" },
};

function dayNumber(value: string) {
  const [year, month, day] = formatShortDate(value).split(".").map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  return Date.UTC(2000 + year, month - 1, day) / 86400000;
}

function daysAgo(value: string) {
  const todayNumber = dayNumber(new Date().toISOString());
  const valueNumber = dayNumber(value);
  return todayNumber === null || valueNumber === null ? null : todayNumber - valueNumber;
}

function sectionLabel(value: string) {
  const elapsedDays = daysAgo(value);
  if (elapsedDays === null) return "";
  if (elapsedDays === 0) return "오늘";
  if (elapsedDays > 0 && elapsedDays <= 7) return "지난 7일";
  return formatShortDate(value);
}

function timeLabel(value: string) {
  if (daysAgo(value) === 0) return formatKoreanTime(value);
  return formatShortDate(value);
}

function decorateItems(items: NotificationItem[]) {
  let lastSection = "";
  return items.map((item) => {
    const section = sectionLabel(item.created_at);
    const showSection = section !== lastSection;
    lastSection = section;
    return { item, section, showSection };
  });
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, isRefetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: ({ pageParam }) => notificationApi.getNotifications(pageParam, 30),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination && lastPage.pagination.page < lastPage.pagination.total_pages
        ? lastPage.pagination.page + 1
        : undefined,
  });
  const rows = decorateItems(data?.pages.flatMap((page) => page.data) ?? []);

  const markReadInCache = (id: number) => {
    queryClient.setQueryData<typeof data>(["notifications"], (current) => {
      if (!current) return current;
      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          data: page.data.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
        })),
      };
    });
  };

  const openNotification = async (notification: NotificationItem) => {
    if (!notification.is_read) {
      markReadInCache(notification.id);
      notificationApi
        .markRead(notification.id)
        .then(() => queryClient.invalidateQueries({ queryKey: ["notifications", "home-badge"] }))
        .catch(() => undefined);
    }
    // 일정 알림은 짝이 되는 공지가 있을 때만 이동한다. 없으면 읽음 처리만 하고 머문다.
    const target = notificationContentRoute(notification);
    if (target) router.push(target as never);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable
          accessibilityLabel="뒤로"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/home");
          }}
          style={styles.iconButton}
        >
          <BackIcon size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.appBarTitle}>알림</Text>
        <View style={styles.iconButton} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={({ item }) => String(item.id)}
          onRefresh={refetch}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) void fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          refreshing={isRefetching}
          contentContainerStyle={[styles.listContent, rows.length === 0 ? styles.emptyContent : null]}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              {isError ? (
                <Text style={styles.emptyText}>알림을 불러오지 못했습니다. 당겨서 다시 시도해주세요.</Text>
              ) : (
                <>
                  <Ionicons name="calendar-outline" size={32} color={COLORS.emptyIcon} />
                  <Text style={styles.emptyTitle}>아직 알림이 없어요</Text>
                  <Text style={styles.emptySub}>새로운 소식이 있으면 알려드릴게요</Text>
                </>
              )}
            </View>
          }
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 18 }} /> : null}
          renderItem={({ item: row }) => {
            const meta = TYPE_META[row.item.notification_type] ?? TYPE_META.notice;
            return (
              <View>
                {row.showSection ? <Text style={styles.sectionLabel}>{row.section}</Text> : null}
                <Pressable onPress={() => openNotification(row.item)} style={styles.notificationRow}>
                  {(() => {
                    const CustomIcon = CUSTOM_TYPE_ICONS[row.item.notification_type];
                    return CustomIcon ? (
                      <CustomIcon size={36} />
                    ) : (
                      <View style={[styles.iconCircle, { backgroundColor: meta.bg }]}>
                        <Ionicons name={meta.icon} size={18} color={meta.color} />
                      </View>
                    );
                  })()}
                  <View style={styles.notificationText}>
                    <View style={styles.messageRow}>
                      <Text numberOfLines={2} style={styles.message}>
                        {row.item.message}
                      </Text>
                      {!row.item.is_read ? <View style={styles.unreadDot} /> : null}
                    </View>
                    <Text style={styles.time}>{timeLabel(row.item.created_at)}</Text>
                  </View>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  appBar: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.bg,
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: 32,
  },
  emptyContent: {
    flexGrow: 1,
  },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  emptyText: {
    color: COLORS.subtle,
    fontSize: 14,
    fontWeight: "400",
  },
  emptyTitle: {
    color: COLORS.emptyTitle,
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 26,
    marginTop: 2,
  },
  emptySub: {
    color: COLORS.emptySub,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
  sectionLabel: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "500",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    marginHorizontal: 16,
    paddingVertical: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  notificationText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  message: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 19,
  },
  time: {
    color: COLORS.subtle,
    fontSize: 11,
    fontWeight: "400",
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 6,
  },
});
