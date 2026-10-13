import { BackIcon, EmptyCalendarIcon, SearchIcon } from "../../../components/icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../../components/AppTypography";
import { useLoadErrorOverlay } from "../../../components/NetworkErrorState";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBoardsQuery } from "../../../hooks/useApi";
import { useIsStackRoot } from "../../../hooks/useIsStackRoot";
import LoadingState from "../../../components/LoadingState";
import NoticeRow, { type NoticeRowModel } from "../../../components/NoticeRow";
import { useAggregatePosts } from "../../../hooks/usePosts";
import { useTabRootResetStore } from "../../../stores/tabRootResetStore";
import type { Board } from "../../../types";
import { formatBoardDate } from "../../../utils/dateFormat";
import { noticeDeadlineLabel } from "../../../utils/homeNoticeDeadline";
import { NOTICES_TAB_ROUTE } from "../../../utils/appRoutes";
import {
  noticeRefreshControlRefreshing,
  refreshQueries,
  selectNoticeFilterAndRefresh,
} from "../../../utils/pullToRefresh";
import {
  canLoadNextNoticePage,
  categoryFromNoticePost,
  createNoticeFeedRetryActions,
  isNoticeContentBoard,
  NOTICE_FILTERS,
  noticeFeedFailureState,
  noticeFeedQueryFilters,
  type NoticeFilter,
} from "../../../utils/noticeFeed";

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
  danger50: "#FFF1F2",
  cyan50: "#E6F9FB",
  cyan700: "#14788A",
};

// 게시판 목록은 받았지만 공지 게시판이 하나도 없을 때도 조회 실패와 같이 LoadError로 덮는다.
const MISSING_NOTICE_BOARDS = new Error("notice boards are missing");

function flattenBoards(groups?: { boards: Board[] }[]) {
  return groups?.flatMap((group) => group.boards) ?? [];
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
  const isStackRoot = useIsStackRoot();
  const [selectedFilter, setSelectedFilter] = useState<NoticeFilter>("all");
  // 당겨서 새로고침 표시는 사용자가 실제로 당겼을 때만 켠다.
  // 탭 진입 시 자동으로 도는 백그라운드 refetch(isRefetching)에 연동하면
  // Android 기본 새로고침 아이콘(흰 원)이 탭을 바꿀 때마다 잠깐 떠 보인다.
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const { data: boardData, isLoading: boardsLoading, isError: boardsError, error: boardsLoadError, isRefetching: boardsRefetching, refetch: refetchBoards } = useBoardsQuery();

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
      date: [formatBoardDate(post.created_at), noticeDeadlineLabel(post.deadline_at)].filter(Boolean).join(" · "),
      isPinned: post.is_pinned,
    }));
  }, [boardById, postsQuery.items]);

  const missingNoticeBoards = !boardsLoading && !boardsError && noticeBoards.length === 0;
  // 첫 쪽·다음 쪽·당겨서 새로고침 중 무엇이 실패해도 앱 전체 LoadError로 덮고, 다시 시도는 실패한 조회만 다시 받는다.
  const noticeLoadError = boardsLoadError
    ?? (feedFailures.initial || feedFailures.nextPage ? postsQuery.error : null)
    ?? postsQuery.refreshFirstPageError
    ?? (missingNoticeBoards ? MISSING_NOTICE_BOARDS : null);
  useLoadErrorOverlay(noticeLoadError, () => {
    if (boardsError || missingNoticeBoards) void refetchBoards();
    if (feedFailures.initial) void retryActions.retryInitial();
    if (feedFailures.nextPage) void retryActions.retryNextPage();
    if (feedFailures.refresh) void retryActions.retryRefresh();
  });
  const isLoading = boardsLoading || postsQuery.isLoading;
  const visibleRows = realRows;

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
        {/* 하단 탭으로 열면 뒤로가기 없이 자리만 맞추고, 홈 "더보기"로 열면 홈으로 돌아간다. */}
        {isStackRoot ? (
          <View style={styles.iconButton} />
        ) : (
          <Pressable accessibilityLabel="뒤로" onPress={() => router.back()} style={styles.iconButton}>
            <BackIcon size={24} color={COLORS.text} />
          </Pressable>
        )}
        <Text style={styles.appBarTitle}>공지사항</Text>
        {/* 돋보기는 다른 게시판과 같은 피그마 아이콘(20px 상자, 모양 15px)을 쓴다. */}
        <Pressable accessibilityLabel="검색" onPress={() => router.push("/search?scope=notices" as never)} style={styles.iconButton}>
          <SearchIcon size={20} color={COLORS.text} />
        </Pressable>
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
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingRows />
          ) : noticeLoadError ? null : (
            <EmptyState title="등록된 공지사항이 없어요" description="새로운 공지가 등록되면 알려드릴게요" />
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
  feedFooter: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
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
