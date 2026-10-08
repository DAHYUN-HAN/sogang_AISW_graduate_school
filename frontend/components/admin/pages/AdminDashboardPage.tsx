import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { adminApi } from "../../../services/api";
import type { AdminDashboardOverview, AdminDashboardPageData } from "../../../types";
import { dashboardDateError, dashboardMetricValue, dashboardPageRange, shiftDashboardDate, trafficBarHeights } from "../../../utils/adminDashboard";
import { koreaDate, millisecondsToKoreaMidnight } from "../../../utils/adminMain";
import { adminPostPath } from "../../../utils/adminNavigation";
import { formatBoardDateTime } from "../../../utils/dateFormat";
import { formatCohortName } from "../../../utils/userLabel";
import { AppText as Text, AppTextInput as TextInput } from "../../AppTypography";
import { useAdminWorkspace } from "../AdminWorkspace";
import AdminDashboardLegacy from "./AdminDashboardLegacy";

function Button({ label, onPress, disabled = false, selected = false }: { label: string; onPress: () => void; disabled?: boolean; selected?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress} style={[styles.button, selected && styles.selectedButton, disabled && { opacity: 0.4 }]}>
    <Text style={{ color: selected ? "#2761FF" : "#15171C", fontSize: 13, fontWeight: selected ? "600" : "400" }}>{label}</Text>
  </Pressable>;
}

function Pagination({ data, onPage, busy, kind }: { data: AdminDashboardPageData<unknown>; onPage: (page: number) => void; busy: boolean; kind: string }) {
  return <View style={[styles.row, { paddingTop: 14, flexWrap: "wrap", justifyContent: "flex-end" }]}>
    <Text style={[styles.muted, { marginRight: "auto" }]}>{dashboardPageRange(data)}</Text>
    <Button label={`${kind} 이전`} onPress={() => onPage(data.page - 1)} disabled={busy || data.page <= 1} />
    <Text style={styles.muted}>{data.total_pages === 0 ? 0 : data.page} / {data.total_pages}</Text>
    <Button label={`${kind} 다음`} onPress={() => onPage(data.page + 1)} disabled={busy || data.page >= data.total_pages} />
    {data.total_pages > 0 && data.page > data.total_pages && <Button label={`${kind} 첫 페이지`} onPress={() => onPage(1)} disabled={busy} />}
  </View>;
}

const trafficChoices = [
  { key: "visits", label: "방문 수", unit: "회" },
  { key: "visitors", label: "방문자 수", unit: "명" },
  { key: "page_views", label: "페이지 조회", unit: "회" },
] as const;

function TrafficChart({ data }: { data: AdminDashboardOverview }) {
  const [metric, setMetric] = useState<(typeof trafficChoices)[number]["key"]>("visits");
  const choice = trafficChoices.find((item) => item.key === metric)!;
  const heights = trafficBarHeights(data.trend.map((item) => item[metric]));
  return <View style={styles.panel}>
    <View style={[styles.row, { justifyContent: "space-between", flexWrap: "wrap" }]}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>최근 7일 접속 트래픽</Text>
      <View style={[styles.row, { flexWrap: "wrap" }]}>{trafficChoices.map((item) => <Button key={item.key} label={item.label} selected={metric === item.key} onPress={() => setMetric(item.key)} />)}</View>
    </View>
    {data.traffic.status === "disabled" && <Text style={[styles.muted, { marginTop: 14 }]}>접속 통계 수집이 비활성화되어 있습니다.</Text>}
    {data.traffic.status === "not_started" && <Text style={[styles.muted, { marginTop: 14 }]}>접속 통계 수집이 시작되면 그래프에 표시됩니다.</Text>}
    <View style={styles.chart}>
      {data.trend.map((item, index) => <View key={item.date} accessibilityLabel={`${item.date} ${choice.label} ${dashboardMetricValue(item[metric], choice.unit, data.traffic.status)}`} style={styles.chartColumn}>
        <Text style={[styles.muted, { fontSize: item[metric] === null ? 10 : 12, textAlign: "center" }]}>{item[metric] === null ? data.traffic.status === "disabled" ? "집계 불가" : "미수집" : item[metric]!.toLocaleString("ko-KR")}</Text>
        <View style={styles.barSpace}>{heights[index] === null ? <View style={styles.missingBar} /> : <View style={[styles.bar, { height: `${heights[index]}%`, backgroundColor: item.date === data.date ? "#2761FF" : "#AFC5FF" }]} />}</View>
        <Text style={[styles.muted, { textAlign: "center", paddingTop: 10 }]}>{item.date.slice(5).replace("-", "/")}</Text>
      </View>)}
    </View>
  </View>;
}

function ContentTables({ data, busy, onPostPage, onCommentPage }: { data: AdminDashboardOverview; busy: boolean; onPostPage: (page: number) => void; onCommentPage: (page: number) => void }) {
  const { width } = useWindowDimensions();
  const openPost = (id: number) => router.push((Platform.OS === "web" ? adminPostPath("detail", id) : `/board/post/${id}`) as never);
  return <View style={{ flexDirection: width >= 1700 ? "row" : "column", gap: 20 }}>
    <View style={[styles.panel, { flex: 1, minWidth: 0 }]}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>작성 게시글 <Text style={styles.muted}>{data.posts.total.toLocaleString("ko-KR")}개</Text></Text>
      <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, minWidth: 600 }}>
          <View style={[styles.tableRow, styles.tableHeader]}><Text style={[styles.muted, { flex: 2 }]}>게시글 · 게시판</Text><Text style={[styles.muted, { flex: 1 }]}>작성자</Text><Text style={[styles.muted, { width: 138 }]}>작성 시각</Text></View>
          {data.posts.items.length === 0 && <Text style={styles.empty}>이 날짜에 표시할 게시글이 없습니다.</Text>}
          {data.posts.items.map((item) => <View key={item.id} style={styles.tableRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} 게시글 열기`} onPress={() => openPost(item.id)} style={{ flex: 2, minWidth: 0, gap: 6 }}><Text numberOfLines={2} style={styles.link}>{item.title}</Text><Text style={styles.muted}>{item.board_name}</Text></Pressable>
            <Text numberOfLines={2} style={[styles.body, { flex: 1 }]}>{formatCohortName(item.author_cohort, item.author_label)}</Text>
            <Text style={[styles.muted, { width: 138 }]}>{formatBoardDateTime(item.created_at)}</Text>
          </View>)}
        </View>
      </ScrollView>
      <Pagination data={data.posts} onPage={onPostPage} busy={busy} kind="게시글" />
    </View>
    <View style={[styles.panel, { flex: 1, minWidth: 0 }]}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>작성 댓글 <Text style={styles.muted}>{data.comments.total.toLocaleString("ko-KR")}개</Text></Text>
      <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, minWidth: 600 }}>
          <View style={[styles.tableRow, styles.tableHeader]}><Text style={[styles.muted, { flex: 2 }]}>댓글 · 원문</Text><Text style={[styles.muted, { flex: 1 }]}>작성자</Text><Text style={[styles.muted, { width: 138 }]}>작성 시각</Text></View>
          {data.comments.items.length === 0 && <Text style={styles.empty}>이 날짜에 표시할 댓글이 없습니다.</Text>}
          {data.comments.items.map((item) => <View key={item.id} style={styles.tableRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${item.post_title} 댓글 원문 열기`} onPress={() => openPost(item.post_id)} style={{ flex: 2, minWidth: 0, gap: 6 }}><Text numberOfLines={3} style={styles.body}>{item.content}</Text><Text numberOfLines={1} style={styles.link}>{item.post_title}</Text></Pressable>
            <Text numberOfLines={2} style={[styles.body, { flex: 1 }]}>{formatCohortName(item.author_cohort, item.author_label)}</Text>
            <Text style={[styles.muted, { width: 138 }]}>{formatBoardDateTime(item.created_at)}</Text>
          </View>)}
        </View>
      </ScrollView>
      <Pagination data={data.comments} onPage={onCommentPage} busy={busy} kind="댓글" />
    </View>
  </View>;
}

export default function AdminDashboardPage() {
  const { isAdmin } = useAdminWorkspace();
  const [selectedDate, setSelectedDate] = useState(koreaDate);
  const [draftDate, setDraftDate] = useState(koreaDate);
  const [dateError, setDateError] = useState<string | null>(null);
  const [followToday, setFollowToday] = useState(true);
  const [postPage, setPostPage] = useState(1);
  const [commentPage, setCommentPage] = useState(1);
  const overview = useQuery({
    queryKey: ["admin-dashboard", selectedDate, postPage, commentPage],
    queryFn: () => adminApi.getDashboard({ date: selectedDate, post_page: postPage, comment_page: commentPage, size: 20 }),
    enabled: isAdmin,
    staleTime: 30000, retry: 1, refetchOnMount: "always", refetchInterval: followToday ? 60000 : false,
  });
  const applyDate = (value: string) => {
    const error = dashboardDateError(value);
    setDateError(error);
    if (error) return;
    setSelectedDate(value); setDraftDate(value); setFollowToday(value === koreaDate()); setPostPage(1); setCommentPage(1);
  };
  useEffect(() => {
    if (!followToday) return;
    let timer: ReturnType<typeof setTimeout>;
    const refreshDate = () => {
      const today = koreaDate();
      if (selectedDate === today) return;
      setSelectedDate(today); setDraftDate(today); setPostPage(1); setCommentPage(1);
    };
    const schedule = () => { timer = setTimeout(() => { refreshDate(); schedule(); }, millisecondsToKoreaMidnight() + 20); };
    schedule();
    if (Platform.OS !== "web") return () => clearTimeout(timer);
    const visible = () => { if (!document.hidden) refreshDate(); };
    window.addEventListener("focus", refreshDate);
    document.addEventListener("visibilitychange", visible);
    return () => { clearTimeout(timer); window.removeEventListener("focus", refreshDate); document.removeEventListener("visibilitychange", visible); };
  }, [followToday, selectedDate]);
  const data = overview.data?.data;
  const currentDay = selectedDate === koreaDate();
  const metrics = [
    ["visits_today", `${currentDay ? "오늘" : "선택일"} 방문 수`, "회"],
    ["visitors_today", `${currentDay ? "오늘" : "선택일"} 방문자 수`, "명"],
    ["page_views_today", `${currentDay ? "오늘" : "선택일"} 페이지 조회`, "회"],
    ["posts_yesterday", `${currentDay ? "어제" : "전일"} 작성 게시글`, "개"],
    ["posts_today", `${currentDay ? "오늘" : "선택일"} 작성 게시글`, "개"],
    ["comments_yesterday", `${currentDay ? "어제" : "전일"} 작성 댓글`, "개"],
    ["comments_today", `${currentDay ? "오늘" : "선택일"} 작성 댓글`, "개"],
  ] as const;
  return <View style={{ gap: 24 }}>
    <View style={[styles.row, { flexWrap: "wrap", gap: 12 }]}>
      <Text style={styles.body}>조회 날짜</Text>
      {Platform.OS === "web" ? <input type="date" aria-label="대시보드 조회 날짜" min="1000-01-01" max={koreaDate()} value={draftDate} onChange={(event) => { setDraftDate(event.target.value); setDateError(null); }} style={{ border: "1px solid #E1E4E9", borderRadius: 8, padding: "10px 12px", fontFamily: "Pretendard_400Regular", fontSize: 13, color: "#15171C", backgroundColor: "#FFFFFF" }} /> : <TextInput accessibilityLabel="대시보드 조회 날짜" value={draftDate} onChangeText={setDraftDate} placeholder="YYYY-MM-DD" style={[styles.button, { width: 160 }]} />}
      <Button label="날짜 적용" onPress={() => applyDate(draftDate)} />
      <Button label="전날" onPress={() => applyDate(shiftDashboardDate(selectedDate, -1))} />
      <Button label="다음 날" disabled={currentDay} onPress={() => applyDate(shiftDashboardDate(selectedDate, 1))} />
      <Button label="오늘" selected={currentDay} onPress={() => applyDate(koreaDate())} />
      <View style={{ marginLeft: "auto" }}><Button label="새로고침" disabled={overview.isFetching} onPress={() => void overview.refetch()} /></View>
    </View>
    {dateError && <Text accessibilityRole="alert" style={styles.error}>{dateError}</Text>}
    {overview.isPending && <ActivityIndicator accessibilityLabel="대시보드 불러오는 중" color="#2761FF" />}
    {overview.isError && <View accessibilityRole="alert" style={{ gap: 10 }}><Text style={styles.error}>대시보드를 불러오지 못했습니다.</Text><Button label="대시보드 다시 시도" onPress={() => void overview.refetch()} /></View>}
    {data && <>
      <View style={styles.metrics}>{metrics.map(([key, label, unit]) => <View key={key} style={styles.metric}><Text style={styles.muted}>{label}</Text><Text style={{ color: "#15171C", fontSize: data.metrics[key] === null ? 16 : 27, fontWeight: "600", marginTop: 16 }}>{dashboardMetricValue(data.metrics[key], unit, data.traffic.status)}</Text></View>)}</View>
      <TrafficChart data={data} />
      <ContentTables data={data} busy={overview.isFetching} onPostPage={setPostPage} onCommentPage={setCommentPage} />
    </>}
    {Platform.OS !== "web" && <View style={{ borderTopWidth: 1, borderColor: "#E1E4E9", paddingTop: 24, marginTop: 8 }}><AdminDashboardLegacy /></View>}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  body: { color: "#15171C", fontSize: 13, lineHeight: 20 },
  muted: { color: "#6B7280", fontSize: 12, lineHeight: 18 },
  error: { color: "#D92D52", fontSize: 13 },
  sectionTitle: { color: "#15171C", fontSize: 16, fontWeight: "600" },
  button: { minHeight: 38, paddingHorizontal: 12, borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  selectedButton: { borderColor: "#C7D7FF", backgroundColor: "#EDF2FE" },
  panel: { padding: 20, borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 10, backgroundColor: "#FFFFFF" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 20, paddingTop: 4, paddingBottom: 12 },
  metric: { flex: 1, minWidth: 120 },
  chart: { flexDirection: "row", gap: 18, paddingTop: 28 },
  chartColumn: { flex: 1, minWidth: 0, gap: 8 },
  barSpace: { height: 160, justifyContent: "flex-end", alignItems: "center", borderBottomWidth: 1, borderColor: "#E1E4E9" },
  bar: { width: "62%", maxWidth: 64, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  missingBar: { width: "62%", maxWidth: 64, height: 160, borderWidth: 1, borderStyle: "dashed", borderColor: "#E1E4E9", backgroundColor: "#FAFBFC" },
  tableRow: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 18, borderBottomWidth: 1, borderColor: "#E1E4E9" },
  tableHeader: { paddingTop: 20, paddingBottom: 12 },
  link: { color: "#2761FF", fontSize: 13, fontWeight: "500", lineHeight: 20 },
  empty: { color: "#6B7280", fontSize: 13, paddingVertical: 28 },
});
