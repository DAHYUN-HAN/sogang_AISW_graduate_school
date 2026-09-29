import { useInfiniteQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import LoadingState from "../../../components/LoadingState";
import { BackIcon, BookmarkIcon } from "../../../components/icons";
import { useReturnToMyPageDrawer } from "../../../hooks/useReturnToMyPageDrawer";
import { userApi } from "../../../services/api";
import { postDetailRoute } from "../../../utils/appRoutes";
import { formatBoardDate } from "../../../utils/dateFormat";
import {
  bookmarkActivityMeta,
  userActivityCategoryLabel,
} from "../../../utils/userActivityPresentation";

const COLORS = {
  primary: "#2761FF",
  text: "#15171C",
  muted: "#6B7280",
  subtle: "#A6ACB7",
  border: "#E1E4E9",
  bg: "#FFFFFF",
};

function categoryTone(label: string) {
  if (label.includes("종합")) return { bg: "#FAEEDA", fg: "#854F0B" };
  if (label.includes("행사") || label.includes("시험") || label.includes("족보")) return { bg: "#FBEAF0", fg: "#993556" };
  if (label.includes("특강")) return { bg: "#E6F9FB", fg: "#14788A" };
  if (label.includes("기타")) return { bg: "#F0EEF9", fg: "#6543A2" };
  if (label.includes("졸업") || label.includes("논문") || label.includes("인증")) return { bg: "#EAF3DE", fg: "#3B6D11" };
  if (label.includes("강의") || label.includes("후기") || label.includes("스터디") || label.includes("모집")) return { bg: "#EEEDFE", fg: "#3C3489" };
  return { bg: "#E6F1FB", fg: "#0C447C" };
}

const FILTERS = [
  { label: "내가 쓴 글", value: "posts" },
  { label: "댓글 단 글", value: "comments" },
  { label: "스크랩한 글", value: "bookmarks" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

function normalizeType(value?: string | string[]): FilterValue {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "comments" || raw === "bookmarks" || raw === "posts" ? raw : "posts";
}

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string }>();
  const { returnToMyPageDrawer, onLayout } = useReturnToMyPageDrawer("/settings/activity");
  const [type, setType] = useState<FilterValue>(() => normalizeType(params.type));
  const { data, isLoading, isError, isRefetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["activity", type],
    queryFn: ({ pageParam }) => userApi.getActivity({ type, page: pageParam, size: 30 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination && lastPage.pagination.page < lastPage.pagination.total_pages
        ? lastPage.pagination.page + 1
        : undefined,
  });

  useEffect(() => {
    setType(normalizeType(params.type));
  }, [params.type]);

  const items = data?.pages.flatMap((page) => page.data) ?? [];
  const title = FILTERS.find((item) => item.value === type)?.label ?? "내 활동";

  return (
    <View style={styles.screen} onLayout={onLayout}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable
          accessibilityLabel="뒤로"
          onPress={returnToMyPageDrawer}
          style={styles.iconButton}
        >
          <BackIcon size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.appBarTitle}>{title}</Text>
        <View style={styles.iconButton} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          onRefresh={refetch}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) void fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          refreshing={isRefetching}
          contentContainerStyle={[styles.listContent, items.length === 0 ? styles.emptyContent : null]}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{isError ? "활동을 불러오지 못했습니다. 당겨서 다시 시도해주세요." : "표시할 활동이 없습니다."}</Text>
            </View>
          }
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 18 }} /> : null}
          renderItem={({ item }) => {
            const label = userActivityCategoryLabel(item);
            const tone = categoryTone(label);
            return (
              <Pressable onPress={() => router.push(postDetailRoute(item.post_id, undefined, `/(tabs)/settings/activity?type=${type}`) as never)} style={styles.row}>
                <View style={styles.rowText}>
                  <View style={[styles.pill, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.pillText, { color: tone.fg }]}>{label}</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.title}>
                    {item.title}
                  </Text>
                  <Text style={styles.meta}>
                    {item.type === "bookmark"
                      ? bookmarkActivityMeta(item)
                      : `${formatBoardDate(item.created_at)} · 댓글 ${item.comment_count ?? 0} · 추천 ${item.like_count ?? 0}`}
                  </Text>
                </View>
                {item.type === "bookmark" ? <View style={styles.bookmark}><BookmarkIcon filled size={18} color={COLORS.primary} /></View> : null}
              </Pressable>
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
  filterRow: {
    flexDirection: "row",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  filterChip: {
    height: 34,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    paddingHorizontal: 13,
  },
  filterChipActive: {
    borderColor: COLORS.text,
    backgroundColor: COLORS.text,
  },
  filterText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  filterTextActive: {
    color: "#FFFFFF",
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
    padding: 24,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "400",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "400",
  },
  title: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
  },
  meta: {
    color: COLORS.subtle,
    fontSize: 12,
    fontWeight: "400",
  },
  bookmark: {
    marginTop: 4,
  },
});
