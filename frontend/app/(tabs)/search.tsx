import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { searchApi } from "../../services/api";
import LoadingState from "../../components/LoadingState";
import NoticeRow from "../../components/NoticeRow";
import type { SearchResult } from "../../types";
import { formatBoardDate } from "../../utils/dateFormat";
import { formatCohortName } from "../../utils/userLabel";
import { postDetailRoute } from "../../utils/appRoutes";

import { BackIcon, EmptyCalendarIcon } from "../../components/icons";
const COLORS = {
  primary: "#2761FF",
  primary50: "#EDF2FE",
  text: "#111827",
  muted: "#6B7280",
  subtle: "#9AA3B2",
  border: "#E5E7EB",
  divider: "#EEF0F3",
  bg: "#FFFFFF",
  danger: "#DC2626",
  pink50: "#FFEAF1",
  pink700: "#B91C4C",
};

type NoticeFilter = "all" | "academic" | "event" | "other";

const NOTICE_FILTERS: { key: NoticeFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "academic", label: "학사공지" },
  { key: "event", label: "행사공지" },
  { key: "other", label: "기타공지" },
];

function noticeCategoryLabel(item: SearchResult) {
  const raw = (item.category ?? item.board_name).trim();
  const lower = raw.toLowerCase();
  if (lower.includes("academic") || lower.includes("학사")) return "학사공지";
  if (lower.includes("event") || lower.includes("webinar") || raw.includes("행사") || raw.includes("특강")) return "행사공지";
  return "기타공지";
}

function NoticeEmptyState() {
  return (
    <View style={styles.noticeEmptyState}>
      <EmptyCalendarIcon size={32} />
      <Text style={styles.noticeEmptyTitle}>검색 결과가 없어요</Text>
      <Text style={styles.noticeEmptyDescription}>다른 검색어로 다시 시도해보세요</Text>
    </View>
  );
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{ scope?: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isNoticeSearch = params.scope === "notices";
  const detailReturnRoute = isNoticeSearch ? "/(tabs)/search?scope=notices" as const : "/(tabs)/search" as const;
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [selectedNoticeFilter, setSelectedNoticeFilter] = useState<NoticeFilter>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const recentQuery = useQuery({ queryKey: ["recent-searches"], queryFn: searchApi.recent, enabled: !isNoticeSearch });

  const handleBack = useCallback(() => {
    Keyboard.dismiss();
    if (isNoticeSearch) router.navigate("/(tabs)/notices");
    else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  }, [isNoticeSearch]);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== "android") return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => subscription.remove();
  }, [handleBack]));

  const runSearch = async (nextPage = 1, keyword = query.trim(), noticeFilter = selectedNoticeFilter) => {
    if (keyword.length < 2) {
      setError("검색어를 두 글자 이상 입력해주세요.");
      return;
    }
    try {
      if (nextPage === 1) setIsLoading(true);
      else setIsLoadingMore(true);
      setError("");
      const response = await searchApi.search({
        q: keyword,
        scope: isNoticeSearch ? "notices" : undefined,
        notice_category: isNoticeSearch && noticeFilter !== "all" ? noticeFilter : undefined,
        page: nextPage,
        size: 20,
      });
      setResults((current) => (nextPage === 1 ? response.data : [...current, ...response.data]));
      setSearchedQuery(keyword);
      setQuery(keyword);
      setPage(response.pagination?.page ?? nextPage);
      setTotalPages(response.pagination?.total_pages ?? nextPage);
      queryClient.invalidateQueries({ queryKey: ["recent-searches"] });
    } catch {
      setError("검색 결과를 불러오지 못했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const selectRecent = (keyword: string) => {
    setQuery(keyword);
    void runSearch(1, keyword);
  };

  const selectNoticeFilter = (filter: NoticeFilter) => {
    setSelectedNoticeFilter(filter);
    if (searchedQuery) void runSearch(1, searchedQuery, filter);
  };

  const recents = recentQuery.data?.data ?? [];
  const hasSearched = Boolean(searchedQuery);

  const searchInput = (
    <View style={[styles.inputWrap, isNoticeSearch ? styles.noticeInputWrap : null]}>
      <Ionicons name="search-outline" size={18} color={COLORS.subtle} />
      <TextInput
        onChangeText={(value) => {
          setQuery(value);
          setError("");
        }}
        onSubmitEditing={() => void runSearch()}
        placeholder={isNoticeSearch ? "검색어를 입력하세요" : "게시글, 작성자 검색"}
        placeholderTextColor={COLORS.subtle}
        returnKeyType="search"
        style={[styles.input, { outlineStyle: "none" } as never]}
        value={query}
      />
      {query ? (
        <Pressable onPress={() => setQuery("")}>
          <Ionicons name="close-circle" size={18} color={COLORS.subtle} />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      {isNoticeSearch ? (
        <View style={[styles.noticeSearchHeader, { paddingTop: Math.max(insets.top, 10) }]}>
          <Pressable accessibilityLabel="뒤로" onPress={handleBack} style={[styles.iconButton, styles.noticeBackButton]}>
            <BackIcon size={24} color={COLORS.text} />
          </Pressable>
          {searchInput}
        </View>
      ) : (
        <>
          <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
            <Pressable accessibilityLabel="뒤로" onPress={handleBack} style={styles.iconButton}>
              <BackIcon size={24} color={COLORS.text} />
            </Pressable>
            <Text style={styles.appBarTitle}>검색</Text>
            <View style={styles.iconButton} />
          </View>
          <View style={styles.searchRow}>
            {searchInput}
            <Pressable disabled={isLoading} onPress={() => void runSearch()} style={styles.searchButton}>
              <Text style={styles.searchButtonText}>검색</Text>
            </Pressable>
          </View>
        </>
      )}

      {isNoticeSearch ? (
        <View style={styles.noticeFilters}>
          {NOTICE_FILTERS.map((filter) => {
            const active = selectedNoticeFilter === filter.key;
            return (
              <Pressable key={filter.key} onPress={() => selectNoticeFilter(filter.key)} style={[styles.noticeFilter, active ? styles.noticeFilterActive : null]}>
                <Text style={[styles.noticeFilterText, active ? styles.noticeFilterTextActive : null]}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!isNoticeSearch && !hasSearched && !isLoading ? (
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>최근 검색어</Text>
          {recentQuery.isError ? <Text style={styles.emptyText}>최근 검색어를 불러오지 못했습니다.</Text> : null}
          {!recentQuery.isLoading && !recentQuery.isError && recents.length === 0 ? <Text style={styles.emptyText}>최근 검색어가 없습니다.</Text> : null}
          <View style={styles.chips}>
            {recents.map((item, index) => (
              <Pressable key={`${item.keyword}-${index}`} onPress={() => selectRecent(item.keyword)} style={styles.chip}>
                <Ionicons name="time-outline" size={14} color={COLORS.muted} />
                <Text style={styles.chipText}>{item.keyword}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {isNoticeSearch && !hasSearched && !isLoading ? <NoticeEmptyState /> : null}
      {isLoading ? (
        <LoadingState />
      ) : null}
      {!isLoading && hasSearched ? (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={results}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.listContent, isNoticeSearch ? styles.noticeListContent : null, results.length === 0 ? styles.emptyContent : null]}
          onEndReached={() => {
            if (page < totalPages && !isLoadingMore) void runSearch(page + 1, searchedQuery);
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={isNoticeSearch ? <NoticeEmptyState /> : <View style={styles.center}><Text style={styles.emptyText}>검색 결과가 없습니다.</Text></View>}
          ListFooterComponent={isLoadingMore ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 18 }} /> : null}
          renderItem={({ item, index }) => {
            if (isNoticeSearch) {
              return (
                <NoticeRow
                  isLast={index === results.length - 1}
                  returnTo={detailReturnRoute}
                  item={{
                    key: String(item.id),
                    postId: item.id,
                    title: item.title,
                    category: noticeCategoryLabel(item),
                    date: formatBoardDate(item.created_at),
                  }}
                />
              );
            }
            return (
              <Pressable onPress={() => router.push(postDetailRoute(item.id, undefined, detailReturnRoute) as never)} style={styles.resultRow}>
                <View style={styles.boardPill}><Text style={styles.boardPillText}>{item.board_name}</Text></View>
                <Text numberOfLines={2} style={styles.resultTitle}>{item.title}</Text>
                <Text numberOfLines={2} style={styles.preview}>{item.content_preview}</Text>
                <Text style={styles.meta}>
                  {item.board_slug === "lecture-reviews"
                    ? formatBoardDate(item.created_at)
                    : `${formatCohortName(item.author_cohort, item.author_nickname)} · ${formatBoardDate(item.created_at)}`}
                </Text>
              </Pressable>
            );
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  appBar: { minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 10 },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  appBarTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  noticeSearchHeader: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 0, paddingLeft: 10, paddingRight: 16, paddingBottom: 14 },
  noticeBackButton: { width: 26, height: 44 },
  searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  inputWrap: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 9, paddingHorizontal: 13 },
  noticeInputWrap: { minHeight: 44, borderWidth: 0, borderRadius: 22, backgroundColor: "#F7F8FA" },
  input: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: "400", lineHeight: 22 },
  searchButton: { minWidth: 58, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: COLORS.primary },
  searchButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  noticeFilters: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 },
  noticeFilter: { alignItems: "center", justifyContent: "center", borderRadius: 999, borderWidth: 0.5, borderColor: "#E1E4E9", paddingHorizontal: 14, paddingVertical: 8 },
  noticeFilterActive: { borderColor: "#15171C", backgroundColor: "#15171C" },
  noticeFilterText: { color: COLORS.muted, fontSize: 13, fontWeight: "400" },
  noticeFilterTextActive: { color: "#FFFFFF" },
  errorText: { color: COLORS.danger, fontSize: 12, fontWeight: "800", paddingHorizontal: 20, paddingBottom: 8 },
  recentSection: { paddingHorizontal: 20, paddingTop: 12 },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900", marginBottom: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 16, backgroundColor: COLORS.primary50, paddingHorizontal: 11, paddingVertical: 8 },
  chipText: { color: COLORS.primary, fontSize: 12, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: COLORS.muted, fontSize: 13, fontWeight: "700" },
  noticeEmptyState: { flex: 1, minHeight: 300, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingBottom: 70 },
  noticeEmptyTitle: { color: "#2C3038", fontSize: 18, fontWeight: "500", lineHeight: 26, marginTop: 8 },
  noticeEmptyDescription: { color: "#8A919C", fontSize: 13, fontWeight: "400", lineHeight: 18, marginTop: 8 },
  listContent: { paddingBottom: 32 },
  noticeListContent: { paddingHorizontal: 16, paddingBottom: 20 },
  emptyContent: { flexGrow: 1 },
  resultRow: { borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingHorizontal: 22, paddingVertical: 15 },
  boardPill: { alignSelf: "flex-start", borderRadius: 6, backgroundColor: COLORS.primary50, paddingHorizontal: 8, paddingVertical: 4 },
  boardPillText: { color: COLORS.primary, fontSize: 11, fontWeight: "900" },
  resultTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900", lineHeight: 22, marginTop: 7 },
  preview: { color: COLORS.muted, fontSize: 13, fontWeight: "700", lineHeight: 19, marginTop: 4 },
  meta: { color: COLORS.subtle, fontSize: 12, fontWeight: "700", marginTop: 7 },
});
