import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { createElement, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../AppTypography";
import { postApi } from "../../services/api";
import type { Board } from "../../types";
import { formatBoardDate } from "../../utils/dateFormat";
import { ActionButton, Chip, COLORS, Field } from "./AdminControls";

export default function AdminBannerPostPicker({ value, onChange, boards }: {
  value: string; onChange: (value: string) => void; boards: Board[];
}) {
  const [boardId, setBoardId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [manualOpen, setManualOpen] = useState(false);
  const postIdMatch = /^\/(?:\(tabs\)\/)?board\/post\/(\d+)(?:\?.*)?$/.exec(value);
  const selectedPostId = postIdMatch ? Number(postIdMatch[1]) : null;
  const posts = useQuery({
    queryKey: ["admin-posts", "banner-link", boardId, appliedSearch, page],
    queryFn: () => postApi.getAdminPosts({ page, size: 10, status: "published", board_id: boardId ?? undefined, q: appliedSearch || undefined }),
    staleTime: 0,
  });
  const selectedPost = useQuery({
    queryKey: ["post", selectedPostId],
    queryFn: () => postApi.getPostDetail(selectedPostId!),
    enabled: selectedPostId !== null,
  });
  const pages = posts.data?.pagination?.total_pages ?? 0;
  const total = posts.data?.pagination?.total ?? 0;
  const applySearch = () => { setAppliedSearch(search.trim()); setPage(1); };
  const chooseBoard = (id: number | null) => { setBoardId(id); setPage(1); };

  return <View style={{ gap: 16 }}>
    <View style={styles.selection}>
      <Ionicons name={value ? "link-outline" : "document-text-outline"} size={20} color={COLORS.primary} />
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text style={styles.title}>{selectedPostId ? selectedPost.data?.data.title ?? `연결된 게시글 #${selectedPostId}` : value || "연결할 게시글을 선택해주세요."}</Text>
        <Text style={styles.muted}>{selectedPostId ? "선택한 게시글로 이동합니다." : value ? "직접 입력한 링크가 연결되어 있습니다." : "연결하지 않으면 배너를 눌러도 이동하지 않습니다."}</Text>
        {selectedPost.isError && <Text style={styles.muted}>연결된 글을 확인할 수 없습니다. 목록에서 다른 글을 선택할 수 있습니다.</Text>}
      </View>
      {value ? <ActionButton label="연결 해제" tone="outline" onPress={() => onChange("")} /> : null}
    </View>

    <View style={styles.searchRow}>
      {Platform.OS === "web" ? <View style={{ width: 180 }}>
        {createElement("select", {
          "aria-label": "배너 연결 게시판", value: boardId ?? "",
          onChange: (event: { target: { value: string } }) => chooseBoard(event.target.value ? Number(event.target.value) : null),
          style: { width: "100%", minHeight: 44, padding: "10px 12px", border: "1px solid #E1E4E9", borderRadius: 8, backgroundColor: "white", color: "#15171C", fontFamily: "Pretendard-Regular, sans-serif", fontSize: 13 },
        }, createElement("option", { value: "" }, "전체 게시판"),
        ...boards.filter((board) => board.is_active).map((board) => createElement("option", { key: board.id, value: board.id }, board.name)))}
      </View> : null}
      <TextInput accessibilityLabel="배너 연결 게시글 검색" placeholder="게시글 제목·내용 검색" placeholderTextColor={COLORS.muted}
        value={search} onChangeText={setSearch} onSubmitEditing={applySearch} style={styles.searchInput} />
      <ActionButton label="검색" icon="search-outline" tone="outline" onPress={applySearch} />
      <ActionButton label="게시글 새로고침" icon="refresh-outline" tone="outline" onPress={() => void posts.refetch()} />
    </View>
    {Platform.OS !== "web" ? <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
      <Chip label="전체 게시판" active={boardId === null} onPress={() => chooseBoard(null)} />
      {boards.filter((board) => board.is_active).map((board) => <Chip key={board.id} label={board.name} active={board.id === boardId} onPress={() => chooseBoard(board.id)} />)}
    </ScrollView> : null}

    <ScrollView style={{ maxHeight: 344 }} contentContainerStyle={{ flexGrow: 1 }}>
      {posts.isPending ? <ActivityIndicator style={{ padding: 20 }} /> : null}
      {posts.isError ? <View style={{ paddingVertical: 20, gap: 10 }}><Text style={styles.muted}>게시글 목록을 불러오지 못했습니다.</Text><ActionButton label="게시글 다시 시도" tone="outline" onPress={() => void posts.refetch()} /></View> : null}
      {!posts.isPending && !posts.isError && posts.data?.data.length === 0 ? <Text style={[styles.muted, { paddingVertical: 24 }]}>조건에 맞는 게시글이 없습니다.</Text> : null}
      {posts.data?.data.map((post) => {
        const selected = selectedPostId === post.id;
        return <Pressable key={post.id} accessibilityRole="button" accessibilityLabel={`${post.title} 배너 연결`} aria-pressed={selected}
          onPress={() => { onChange(`/board/post/${post.id}`); setManualOpen(false); }}
          style={[styles.postRow, selected && { backgroundColor: COLORS.primary50 }]}>
          <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={19} color={selected ? COLORS.primary : COLORS.borderStrong} />
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <Text style={[styles.title, selected && { color: COLORS.primary }]} numberOfLines={2}>{post.title}</Text>
            <Text style={styles.muted}>{post.board_name ?? "게시글"} · {formatBoardDate(post.created_at)}</Text>
          </View>
          <Text style={{ fontSize: 12, color: selected ? COLORS.primary : COLORS.muted }}>{selected ? "선택됨" : "선택"}</Text>
        </Pressable>;
      })}
    </ScrollView>
    <View style={styles.pagination}>
      <Text style={styles.muted}>{posts.isPending ? "조회 중" : `전체 ${total}개`}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <ActionButton label="게시글 이전" tone="outline" disabled={page <= 1 || posts.isFetching} onPress={() => setPage((current) => current - 1)} />
        <Text style={styles.muted}>{page} / {Math.max(pages, 1)}</Text>
        <ActionButton label="게시글 다음" tone="outline" disabled={page >= pages || posts.isFetching} onPress={() => setPage((current) => current + 1)} />
        {page > Math.max(pages, 1) && <ActionButton label="게시글 첫 페이지" tone="outline" onPress={() => setPage(1)} />}
      </View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="직접 링크 입력" aria-expanded={manualOpen} onPress={() => setManualOpen((open) => !open)}>
      <Text style={{ color: COLORS.muted, fontSize: 12 }}>직접 링크 입력 {manualOpen ? "접기" : "→"}</Text>
    </Pressable>
    {manualOpen ? <Field value={value} onChangeText={onChange} placeholder="배너 이동 링크" /> : null}
  </View>;
}

const styles = StyleSheet.create({
  title: { color: COLORS.text, fontSize: 13, fontWeight: "500", lineHeight: 20 },
  muted: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  selection: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, paddingHorizontal: 14, backgroundColor: "#F7F8FA", borderRadius: 8 },
  searchRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, minWidth: 160, minHeight: 44, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text },
  postRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 16, borderBottomWidth: 1, borderColor: COLORS.border },
  pagination: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 },
});
