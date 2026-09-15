import { Ionicons } from "@expo/vector-icons";
import { EmptyCalendarIcon } from "../../components/icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBoardsQuery } from "../../hooks/useApi";
import LoadingState from "../../components/LoadingState";
import NoticeRow, { type NoticeRowModel } from "../../components/NoticeRow";
import { useAggregatePosts } from "../../hooks/usePosts";
import { useTabRootResetStore } from "../../stores/tabRootResetStore";
import type { Board } from "../../types";
import { formatBoardDate } from "../../utils/dateFormat";
import { NOTICES_TAB_ROUTE } from "../../utils/appRoutes";
import {
  noticeRefreshControlRefreshing,
  refreshQueries,
  selectNoticeFilterAndRefresh,
} from "../../utils/pullToRefresh";
import {
  canLoadNextNoticePage,
  categoryFromNoticePost,
  createNoticeFeedRetryActions,
  isNoticeContentBoard,
  NOTICE_FILTERS,
  noticeFeedFailureState,
  noticeFeedQueryFilters,
  type NoticeFilter,
} from "../../utils/noticeFeed";

const COLORS = {
  primary: "#2761FF",
  primary50: "#EDF2FE",
  primary100: "#D5E0FE",
  text: "#15171C",
  navy: "#0B1F56",
  muted: "#6B7280",
  subtle: "#8A919C",
  border: "#E1E4E9",
  divider: "#EEF0F3",
  surface: "#FFFFFF",
  page: "#FFFFFF",
  danger: "#B91C1C",
  danger50: "#FFF1F2",
  pink50: "#FFEAF1",
  pink700: "#B91C4C",
  cyan50: "#E6F9FB",
  cyan700: "#14788A",
};

type IconName = keyof typeof Ionicons.glyphMap;

function flattenBoards(groups?: { boards: Board[] }[]) {
  return groups?.flatMap((group) => group.boards) ?? [];
}

function deadlineLabel(value?: string | null) {
  if (!value) return "";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const days = Math.round((targetDay.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "마감";
  if (days === 0) return "마감 D-day";
  return `마감 D-${days}`;
}

function IconButton({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={styles.iconButton}>
      <Ionicons name={icon} size={24} color={COLORS.text} />
    </Pressable>
  );
}

function LoadingRows() {
  return <LoadingState compact />;
}

function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.emptyState}>
      <EmptyCalendarIcon size={32} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDescription}>{description}</Text> : null}
    </View>
  );
}

export default function NoticesScreen() {
  const resetRevision = useTabRootResetStore((state) => state.revisions.notices);

  return <NoticesContent key={resetRevision} />;
}

function NoticesContent() {
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState<NoticeFilter>("all");
  // 당겨서 새로고침 표시는 사용자가 실제로 당겼을 때만 켠다.
  // 탭 진입 시 자동으로 도는 백그라운드 refetch(isRefetching)에 연동하면
  // Android 기본 새로고침 아이콘(흰 원)이 탭을 바꿀 때마다 잠깐 떠 보인다.
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const { data: boardData, isLoading: boardsLoading, isError: boardsError, isRefetching: boardsRefetching, refetch: refetchBoards } = useBoardsQuery();

  const noticeBoards = useMemo(
    () =>
      flattenBoards(boardData?.data)
        .filter(isNoticeContentBoard)
        .sort((left, right) => left.sort_order - right.sort_order),
    [boardData?.data]
  );
  const boardById = useMemo(() => new Map(noticeBoards.map((board) => [board.id, board])), [noticeBoards]);
  const noticeFilters = useMemo(() => noticeFeedQueryFilters(selectedFilter), [selectedFilter]);
  const postsQuery = useAggregatePosts("notices", noticeFilters);
  const feedFailures = noticeFeedFailureState({
    hasData: postsQuery.data !== undefined,
    isError: postsQuery.isError,
    isFetchNextPageError: postsQuery.isFetchNextPageError,
    refreshFirstPageError: postsQuery.refreshFirstPageError,
  });
  const retryActions = createNoticeFeedRetryActions(postsQuery);

  const realRows = useMemo<NoticeRowModel[]>(() => {
    return postsQuery.items.map((post) => ({
      key: `post-${post.id}`,
      postId: post.id,
      title: post.title,
      category: categoryFromNoticePost(post, boardById.get(post.board_id)),
      date: [formatBoardDate(post.created_at), deadlineLabel(post.deadline_at)].filter(Boolean).join(" · "),
      isPinned: post.is_pinned,
    }));
  }, [boardById, postsQuery.items]);

  const isOfflinePreview = boardsError || feedFailures.initial || (!boardsLoading && noticeBoards.length === 0);
  const isLoading = boardsLoading || postsQuery.isLoading;
  const visibleRows = realRows;

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
        {/* 공지사항은 하단 탭 루트이므로 뒤로가기 없이 좌측은 자리만 맞춘다. */}
        <View style={styles.iconButton} />
        <Text style={styles.appBarTitle}>공지사항</Text>
        <IconButton icon="search-outline" label="검색" onPress={() => router.push("/search?scope=notices" as never)} />
      </View>

      <View style={styles.filterWrap}>
        {NOTICE_FILTERS.map((item) => {
          const active = selectedFilter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                void selectNoticeFilterAndRefresh(
                  item.key,
                  selectedFilter,
                  setSelectedFilter,
                  refetchBoards,
                  postsQuery.refreshFirstPage,
                );
              }}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}
            >
              <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {isOfflinePreview ? (
        <Pressable
          onPress={() => {
            void refetchBoards();
            void retryActions.retryInitial();
          }}
          style={styles.connectionStrip}
        >
          <Ionicons name="cloud-offline-outline" size={16} color={COLORS.danger} />
          <Text numberOfLines={1} style={styles.connectionText}>
            데이터 서버 연결 필요 · 탭하면 다시 시도
          </Text>
        </Pressable>
      ) : null}

      {feedFailures.refresh ? (
        <Pressable onPress={() => void retryActions.retryRefresh()} style={styles.refreshErrorStrip}>
          <Ionicons name="refresh-outline" size={16} color={COLORS.danger} />
          <Text style={styles.refreshErrorText}>새로고침하지 못했습니다. 탭해서 다시 시도하세요.</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={visibleRows}
        style={styles.listScroller}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, !isLoading && visibleRows.length === 0 ? styles.listContentEmpty : null]}
        keyExtractor={(item) => item.key}
        renderItem={({ item, index }) => (
          <NoticeRow
            item={item}
            isLast={index === visibleRows.length - 1}
            returnTo={NOTICES_TAB_ROUTE}
          />
        )}
        refreshing={noticeRefreshControlRefreshing({
          boardsLoading,
          postsLoading: postsQuery.isLoading,
          pullRefreshing,
        })}
        onRefresh={() => {
          setPullRefreshing(true);
          void refreshQueries([refetchBoards, postsQuery.refreshFirstPage]).finally(() => setPullRefreshing(false));
        }}
        onEndReached={() => {
          if (canLoadNextNoticePage(postsQuery)) {
            void retryActions.retryNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          !isLoading && !boardsRefetching && !postsQuery.isRefreshingFirstPage && postsQuery.isFetchingNextPage ? (
            <View style={styles.feedFooter}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : feedFailures.nextPage ? (
            <Pressable onPress={() => void retryActions.retryNextPage()} style={styles.feedFooter}>
              <Text style={styles.feedFooterRetry}>다음 공지를 불러오지 못했습니다. 탭해서 다시 시도하세요.</Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingRows />
          ) : (
            <EmptyState
              title={isOfflinePreview ? "공지사항을 불러오지 못했습니다." : "등록된 공지사항이 없어요"}
              description={isOfflinePreview ? "잠시 후 다시 시도해주세요" : "새로운 공지가 등록되면 알려드릴게요"}
            />
          )
        }
      />
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
  filterWrap: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 14,
    backgroundColor: COLORS.surface,
  },
  filterChip: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.5,
    borderColor: "#E1E4E9",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: "#15171C",
    borderColor: "#15171C",
  },
  filterText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "400",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  connectionStrip: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#FECACA",
    backgroundColor: COLORS.danger50,
    paddingHorizontal: 24,
  },
  connectionText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: "800",
  },
  refreshErrorStrip: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#FECACA",
    backgroundColor: COLORS.danger50,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  refreshErrorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: "700",
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
    fontWeight: "700",
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  listScroller: {
    flex: 1,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  loadingWrap: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  emptyState: {
    flex: 1,
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  emptyTitle: {
    color: "#2C3038",
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 26,
  },
  emptyDescription: {
    color: "#8A919C",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
});
