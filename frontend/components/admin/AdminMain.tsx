import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { AppText as Text } from "../AppTypography";
import { adminApi } from "../../services/api";
import type { AdminMainOverview, AdminMainQueue, AdminMainRequest } from "../../types";
import { auditActionLabel, auditSummary, currentMainRequests, koreaDate, metricValue, millisecondsToKoreaMidnight, requestPresentation } from "../../utils/adminMain";
import { formatBoardDateTime } from "../../utils/dateFormat";
import { formatCohortName } from "../../utils/userLabel";
import AdminRequestPanel from "./AdminRequestPanel";

export function MainTextButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={{ minHeight: 36, justifyContent: "center", opacity: disabled ? 0.4 : 1 }}><Text style={{ color: "#2761FF", fontSize: 12, fontWeight: "600" }}>{label}</Text></Pressable>;
}

function RequestQueue({ title, queue, onOpen, onAll, onPage, busy, date, freshDay }: { title: string; queue: AdminMainQueue; onOpen: (item: AdminMainRequest) => void; onAll: () => void; onPage: (page: number) => void; busy: boolean; date: string; freshDay: boolean }) {
  const items = currentMainRequests(queue.items, date);
  return <View style={{ flex: 1, minWidth: 0 }}>
    <View style={[styles.row, { borderBottomWidth: 1, borderColor: "#E1E4E9", paddingBottom: 14, flexWrap: "wrap" }]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.pendingBadge}>미처리 {queue.pending_count}건</Text><Text style={styles.handledBadge}>오늘 처리 {freshDay ? `${queue.today_handled_count}건` : "—"}</Text>
      <View style={{ marginLeft: "auto" }}><MainTextButton label="전체 보기 →" onPress={onAll} /></View>
    </View>
    {items.length === 0 ? <Text style={[styles.muted, { paddingVertical: 28 }]}>표시할 내역이 없습니다.</Text> : items.map((item) => {
      const presentation = requestPresentation(item);
      return <View key={item.id} style={styles.requestRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} 상세 열기`} onPress={() => onOpen(item)} style={{ flex: 1, minWidth: 0, gap: 8 }}>
          <Text numberOfLines={2} style={{ color: "#15171C", fontWeight: "600", fontSize: 14 }}>{item.title}</Text>
          <Text style={styles.muted}>{formatCohortName(item.author_cohort, item.author_label)} · {presentation.dateLabel} {presentation.date ? formatBoardDateTime(presentation.date) : "—"}</Text>
        </Pressable>
        <Text style={[styles.status, presentation.tone === "warning" ? styles.warning : presentation.tone === "danger" ? styles.danger : styles.success]}>{presentation.label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} ${item.kind === "mutual_aid" ? "신청 확인" : "답변 확인"}`} onPress={() => onOpen(item)} style={styles.outlineButton}><Text style={{ color: "#15171C", fontSize: 12 }}>{item.kind === "mutual_aid" ? "신청 확인" : "답변 확인"}</Text></Pressable>
      </View>;
    })}
    {queue.total_pages > 1 && <View style={[styles.row, { justifyContent: "flex-end", paddingTop: 12 }]}>
      <MainTextButton label="이전" disabled={busy || queue.page <= 1} onPress={() => onPage(queue.page - 1)} /><Text style={styles.muted}>{queue.page} / {queue.total_pages}</Text>
      <MainTextButton label="다음" disabled={busy || queue.page >= queue.total_pages} onPress={() => onPage(queue.page + 1)} />
    </View>}
  </View>;
}

export function AdminMainMetrics({ data, onDashboard, freshDay }: { data: AdminMainOverview; onDashboard: () => void; freshDay: boolean }) {
  const definitions = [
    ["visits_today", "오늘 방문 수", "회"], ["visitors_today", "오늘 방문자 수", "명"], ["page_views_today", "오늘 페이지 조회", "회"],
    ["posts_yesterday", "어제 작성 게시글", "개"], ["posts_today", "오늘 작성 게시글", "개"],
    ["comments_yesterday", "어제 작성 댓글", "개"], ["comments_today", "오늘 작성 댓글", "개"],
  ] as const;
  return <View style={styles.metrics}>{definitions.map(([key, label, unit]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${label} 대시보드에서 보기`} onPress={onDashboard} style={styles.metric}>
    <Text style={styles.muted}>{label}</Text><Text style={{ color: "#15171C", fontSize: !freshDay || data.metrics[key] === null ? 16 : 27, fontWeight: "600", marginTop: 16 }}>{freshDay ? metricValue(data.metrics[key], unit, data.traffic.status) : "집계 불가"}</Text>
  </Pressable>)}</View>;
}

export default function AdminMain({ onSection, onAll }: { onSection: (section: "dashboard" | "audit" | "reports") => void; onAll: (kind: "mutual_aid" | "suggestion") => void }) {
  const { width } = useWindowDimensions();
  const [mutualPage, setMutualPage] = useState(1);
  const [suggestionPage, setSuggestionPage] = useState(1);
  const [selected, setSelected] = useState<AdminMainRequest | null>(null);
  const [date, setDate] = useState(koreaDate);
  const overview = useQuery({ queryKey: ["admin-main", mutualPage, suggestionPage], queryFn: () => adminApi.getMain({ mutual_page: mutualPage, suggestion_page: suggestionPage }), staleTime: 30000, refetchOnMount: "always", retry: 1 });
  const logs = useQuery({ queryKey: ["admin-audit-logs", "main"], queryFn: () => adminApi.getAuditLogs({ size: 5 }), staleTime: 30000, refetchOnMount: "always", retry: 1 });
  const refetchOverview = overview.refetch;
  const refetchLogs = logs.refetch;
  useEffect(() => {
    const refresh = () => { setDate(koreaDate()); void refetchOverview(); void refetchLogs(); };
    let midnightTimer: ReturnType<typeof setTimeout>;
    const schedule = () => { midnightTimer = setTimeout(() => { refresh(); schedule(); }, millisecondsToKoreaMidnight() + 20); };
    schedule();
    const interval = setInterval(refresh, 60000);
    const visible = () => { if (!document.hidden) refresh(); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", visible);
    return () => { clearTimeout(midnightTimer); clearInterval(interval); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", visible); };
  }, [refetchOverview, refetchLogs]);
  const data = overview.data?.data;
  const freshDay = data?.date === date;
  return <>
    <ScrollView style={{ flex: 1, backgroundColor: "#FFFFFF" }} contentContainerStyle={{ padding: width >= 1280 ? 28 : 20, paddingBottom: 40 }}>
      <Text style={{ color: "#15171C", fontSize: 24, fontWeight: "600", marginBottom: 34 }}>관리자님, 안녕하세요</Text>
      {overview.isPending && <ActivityIndicator accessibilityLabel="관리자 현황 불러오는 중" color="#2761FF" />}
      {overview.isError && <View accessibilityRole="alert" style={{ gap: 8, marginBottom: 20 }}><Text style={{ color: "#D92D52" }}>관리자 현황을 불러오지 못했습니다.</Text><MainTextButton label="다시 시도" onPress={() => void overview.refetch()} /></View>}
      {data && <>
        <AdminMainMetrics data={data} freshDay={freshDay} onDashboard={() => onSection("dashboard")} />
        <View style={styles.pendingSummary}>
          <Pressable accessibilityRole="button" onPress={() => onAll("mutual_aid")}><Text style={styles.summary}>상조회 처리 대기　<Text style={{ color: "#2761FF" }}>{data.pending.mutual_aid}건</Text></Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => onAll("suggestion")}><Text style={styles.summary}>건의사항 답변 대기　<Text style={{ color: "#2761FF" }}>{data.pending.suggestions}건</Text></Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => onSection("reports")}><Text style={styles.summary}>미처리 신고　<Text style={{ color: "#2761FF" }}>{data.pending.reports}건</Text></Text></Pressable>
        </View>
        <View style={{ flexDirection: width >= 1200 ? "row" : "column", gap: 32, marginTop: 24 }}>
          <RequestQueue title="상조회 신청 내역" queue={data.mutual_aid} onOpen={setSelected} onAll={() => onAll("mutual_aid")} onPage={setMutualPage} busy={overview.isFetching} date={date} freshDay={freshDay} />
          <RequestQueue title="건의사항 접수 내역" queue={data.suggestions} onOpen={setSelected} onAll={() => onAll("suggestion")} onPage={setSuggestionPage} busy={overview.isFetching} date={date} freshDay={freshDay} />
        </View>
      </>}
      <View style={{ marginTop: 42 }}>
        <View style={[styles.row, { justifyContent: "space-between", paddingBottom: 14, borderBottomWidth: 1, borderColor: "#E1E4E9" }]}><Text style={styles.sectionTitle}>최근 운영 기록</Text><MainTextButton label="전체 보기 →" onPress={() => onSection("audit")} /></View>
        {logs.isPending && <ActivityIndicator style={{ margin: 20 }} />}
        {logs.isError && <View style={{ paddingVertical: 16 }}><Text style={styles.muted}>운영 기록을 불러오지 못했습니다.</Text><MainTextButton label="다시 시도" onPress={() => void logs.refetch()} /></View>}
        {logs.data?.data.length === 0 && <Text style={[styles.muted, { paddingVertical: 24 }]}>아직 기록된 관리자 작업이 없습니다.</Text>}
        {width >= 1024 && <View style={[styles.auditRow, { paddingVertical: 12 }]}><Text style={[styles.muted, { flex: 1 }]}>작업</Text><Text style={[styles.muted, { flex: 2 }]}>대상 · 변경 내용</Text><Text style={[styles.muted, { width: 100 }]}>관리자</Text><Text style={[styles.muted, { width: 140 }]}>시각</Text></View>}
        {logs.data?.data.map((item) => <View key={item.id} style={[styles.auditRow, width < 1024 && { flexDirection: "column", alignItems: "flex-start", gap: 8 }]}>
          <Text style={{ flex: width >= 1024 ? 1 : undefined, fontWeight: "600", color: "#15171C", fontSize: 13 }}>{auditActionLabel(item.action)}</Text>
          <View style={{ flex: width >= 1024 ? 2 : undefined, gap: 6 }}><Text style={{ color: "#15171C", fontSize: 13, fontWeight: "500" }}>{typeof item.details?.title === "string" ? item.details.title : `${item.target_type}${item.target_id ? ` #${item.target_id}` : ""}`}</Text>{auditSummary(item.details) && <Text style={styles.muted}>{auditSummary(item.details)}</Text>}</View>
          <Text style={{ width: width >= 1024 ? 100 : undefined, color: "#15171C", fontSize: 12 }}>{item.actor_nickname}</Text><Text style={[styles.muted, { width: width >= 1024 ? 140 : undefined }]}>{formatBoardDateTime(item.created_at)}</Text>
        </View>)}
      </View>
    </ScrollView>
    {selected && <AdminRequestPanel key={selected.id} item={selected} onClose={() => setSelected(null)} />}
  </>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 }, sectionTitle: { color: "#15171C", fontSize: 15, fontWeight: "600" },
  muted: { color: "#6B7280", fontSize: 12, lineHeight: 18 },
  metrics: { flexDirection: "row", flexWrap: "wrap", columnGap: 20, rowGap: 22, paddingBottom: 28 },
  metric: { flex: 1, minWidth: 115 }, summary: { color: "#15171C", fontSize: 13, fontWeight: "500" },
  pendingSummary: { flexDirection: "row", flexWrap: "wrap", gap: 30, paddingVertical: 24, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E1E4E9" },
  pendingBadge: { backgroundColor: "#EDF2FE", color: "#2761FF", paddingHorizontal: 7, paddingVertical: 4, borderRadius: 4, fontSize: 11 },
  handledBadge: { backgroundColor: "#F7F8FA", color: "#6B7280", paddingHorizontal: 7, paddingVertical: 4, borderRadius: 4, fontSize: 11 },
  requestRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 20, borderBottomWidth: 1, borderColor: "#E1E4E9" },
  outlineButton: { minHeight: 40, paddingHorizontal: 12, borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 8, justifyContent: "center" },
  status: { fontSize: 11, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 4 },
  warning: { color: "#A66B13", backgroundColor: "#FFF7E8" }, success: { color: "#168A72", backgroundColor: "#ECF8F3" }, danger: { color: "#D92D52", backgroundColor: "#FFF0F2" },
  auditRow: { flexDirection: "row", alignItems: "center", gap: 20, paddingHorizontal: 16, paddingVertical: 22, borderBottomWidth: 1, borderColor: "#E1E4E9" },
});
