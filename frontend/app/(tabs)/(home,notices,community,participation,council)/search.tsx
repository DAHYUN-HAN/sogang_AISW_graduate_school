import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, Keyboard, Platform, Pressable, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../../../components/AppTypography";
import { useLoadErrorOverlay } from "../../../components/NetworkErrorState";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { searchApi } from "../../../services/api";
import LoadingState from "../../../components/LoadingState";
import NoticeRow from "../../../components/NoticeRow";
import type { SearchResult } from "../../../types";
import { formatBoardDate } from "../../../utils/dateFormat";
import { navigateToTabRoot } from "../../../utils/tabNavigation";

import { BackIcon, ClearSearchIcon, EmptyCalendarIcon, SearchIcon } from "../../../components/icons";
const COLORS = {
  primary: "#2761FF",
  text: "#15171C", // Figma Notice/Search 입력 글자
  muted: "#6B7280",
  subtle: "#8A919C", // Figma Component — Search Bar 돋보기·안내 글자
  divider: "#EEF0F3",
  bg: "#FFFFFF",
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

// 앱에서 들어오는 검색은 공지사항 검색(/search?scope=notices) 하나뿐이다.
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const detailReturnRoute = "/(tabs)/search?scope=notices" as const;
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [selectedNoticeFilter, setSelectedNoticeFilter] = useState<NoticeFilter>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [requestError, setRequestError] = useState<unknown>(null);
  const retryPage = useRef(1);
  // 검색 결과를 받지 못하면(4xx 포함) 앱 전체 LoadError로 덮고, 다시 시도는 같은 검색을 다시 보낸다.
  useLoadErrorOverlay(requestError, () => void runSearch(retryPage.current, searchedQuery || query.trim()));

  const handleBack = useCallback(() => {
    Keyboard.dismiss();
    // 검색은 들어온 탭 스택 위에 쌓이므로 아래 화면(공지사항)으로 돌아간다.
    if (router.canGoBack()) router.back();
    else navigateToTabRoot("notices");
  }, []);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== "android") return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => subscription.remove();
  }, [handleBack]));

  const runSearch = async (nextPage = 1, keyword = query.trim(), noticeFilter = selectedNoticeFilter) => {
    // 한 글자부터 검색한다(2026-10-16 사용자 결정). 빈 검색어만 보내지 않는다.
    if (!keyword) {
      setRequestError(null);
      return;
    }
    retryPage.current = nextPage;
    try {
      if (nextPage === 1) setIsLoading(true);
      else setIsLoadingMore(true);
      setRequestError(null);
      const response = await searchApi.search({
        q: keyword,
        scope: "notices",
        notice_category: noticeFilter !== "all" ? noticeFilter : undefined,
        page: nextPage,
        size: 20,
      });
      setResults((current) => (nextPage === 1 ? response.data : [...current, ...response.data]));
      setSearchedQuery(keyword);
      setQuery(keyword);
      setPage(response.pagination?.page ?? nextPage);
      setTotalPages(response.pagination?.total_pages ?? nextPage);
    } catch (error) {
      setRequestError(error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const selectNoticeFilter = (filter: NoticeFilter) => {
    setSelectedNoticeFilter(filter);
    if (searchedQuery) void runSearch(1, searchedQuery, filter);
  };

  const hasSearched = Boolean(searchedQuery);

  const searchInput = (
    <View style={styles.inputWrap}>
      <SearchIcon size={18} color={COLORS.subtle} />
      <TextInput
        onChangeText={(value) => {
          setQuery(value);
          setRequestError(null);
        }}
        onSubmitEditing={() => void runSearch()}
        placeholder="검색어를 입력하세요"
        placeholderTextColor={COLORS.subtle}
        returnKeyType="search"
        style={[styles.input, { outlineStyle: "none" } as never]}
        value={query}
      />
      {query ? (
        <Pressable accessibilityRole="button" accessibilityLabel="검색어 지우기" hitSlop={12} onPress={() => setQuery("")}>
          <ClearSearchIcon />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.noticeSearchHeader, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable accessibilityLabel="뒤로" onPress={handleBack} style={[styles.iconButton, styles.noticeBackButton]}>
          <BackIcon size={24} color={COLORS.text} />
        </Pressable>
        {searchInput}
      </View>

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


      {!hasSearched && !isLoading ? <NoticeEmptyState /> : null}
      {isLoading ? (
        <LoadingState />
      ) : null}
      {!isLoading && hasSearched ? (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={results}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.listContent, results.length === 0 ? styles.emptyContent : null]}
          onEndReached={() => {
            if (page < totalPages && !isLoadingMore) void runSearch(page + 1, searchedQuery);
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<NoticeEmptyState />}
          ListFooterComponent={isLoadingMore ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 18 }} /> : null}
          renderItem={({ item, index }) => (
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
          )}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  noticeSearchHeader: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 0, paddingLeft: 10, paddingRight: 16, paddingBottom: 14 },
  noticeBackButton: { width: 26, height: 44 },
  inputWrap: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 22, backgroundColor: "#F7F8FA", paddingHorizontal: 16 }, // Figma Component — Search Bar: 44h, 좌우 16, gap 8
  input: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: "400", lineHeight: 22 },
  noticeFilters: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 },
  noticeFilter: { alignItems: "center", justifyContent: "center", borderRadius: 999, borderWidth: 0.5, borderColor: "#E1E4E9", paddingHorizontal: 14, paddingVertical: 8 },
  noticeFilterActive: { borderColor: "#15171C", backgroundColor: "#15171C" },
  noticeFilterText: { color: COLORS.muted, fontSize: 13, fontWeight: "400" },
  noticeFilterTextActive: { color: "#FFFFFF" },
  noticeEmptyState: { flex: 1, minHeight: 300, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingBottom: 70 },
  noticeEmptyTitle: { color: "#2C3038", fontSize: 18, fontWeight: "500", lineHeight: 26, marginTop: 8 },
  noticeEmptyDescription: { color: "#8A919C", fontSize: 13, fontWeight: "400", lineHeight: 18, marginTop: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  emptyContent: { flexGrow: 1 },
});
