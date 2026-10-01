import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../components/AppTypography";

import BackButton from "../../components/BackButton";
import { adminApi } from "../../services/api";
import type { LegacyImportRecordItem } from "../../types";

const STATUS_OPTIONS = ["failed", "archived", "unmapped", "imported"] as const;

const STATUS_COLORS: Record<string, { background: string; foreground: string }> = {
  imported: { background: "#EAF7EF", foreground: "#207A48" },
  archived: { background: "#F1F3F5", foreground: "#5E6672" },
  failed: { background: "#FFF0F2", foreground: "#B4233F" },
  unmapped: { background: "#FFF6E6", foreground: "#A05A00" },
};

function statusStyle(status: string) {
  return STATUS_COLORS[status] ?? { background: "#EEF2FF", foreground: "#2747A8" };
}

function RecordCard({ item }: { item: LegacyImportRecordItem }) {
  const colors = statusStyle(item.status);
  return (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <Text style={styles.recordTitle}>{item.entity_type} · {item.source_id}</Text>
        <View style={[styles.badge, { backgroundColor: colors.background }]}>
          <Text style={[styles.badgeText, { color: colors.foreground }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.meta}>{item.source_sheet} · {item.source_file}:{item.source_row}</Text>
      <Text style={styles.reason}>{item.reason || `${item.target_table || "-"} #${item.target_id || "-"}`}</Text>
    </View>
  );
}

export default function MigrationReviewScreen() {
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("failed");
  const summaryQuery = useQuery({ queryKey: ["legacy-import-summary"], queryFn: adminApi.getLegacyImportSummary });
  const recordsQuery = useQuery({
    queryKey: ["legacy-import-records", status],
    queryFn: () => adminApi.getLegacyImportRecords({ status, size: 200 }),
  });
  const summary = summaryQuery.data?.data ?? [];
  const records = recordsQuery.data?.data ?? [];
  const countFor = (target: string) => summary
    .filter((item) => item.status === target)
    .reduce((total, item) => total + item.count, 0);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <BackButton fallback="/admin" label="관리자" />
      <Text style={styles.eyebrow}>MIGRATION REVIEW</Text>
      <Text style={styles.title}>기존 앱 데이터 이관 검수</Text>
      <Text style={styles.description}>복제 DB의 이관 원장만 표시합니다. 개인정보 원문은 노출하지 않습니다.</Text>

      <View style={styles.summaryGrid}>
        {STATUS_OPTIONS.map((item) => {
          const colors = statusStyle(item);
          return (
            <View key={item} style={styles.summaryCard}>
              <Text style={[styles.summaryCount, { color: colors.foreground }]}>{countFor(item).toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>{item}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>상태별 기록</Text>
      <View style={styles.filters}>
        {STATUS_OPTIONS.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            onPress={() => setStatus(item)}
            style={[styles.filter, status === item && styles.filterActive]}
          >
            <Text style={[styles.filterText, status === item && styles.filterTextActive]}>{item} {countFor(item)}</Text>
          </Pressable>
        ))}
      </View>

      {summaryQuery.isLoading || recordsQuery.isLoading ? (
        <ActivityIndicator color="#2761FF" style={styles.loading} />
      ) : summaryQuery.isError || recordsQuery.isError ? (
        <View style={styles.empty}><Text style={styles.emptyText}>이관 원장을 불러오지 못했습니다.</Text></View>
      ) : records.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>{status} 기록이 없습니다.</Text></View>
      ) : (
        <View style={styles.records}>{records.map((item) => <RecordCard key={item.id} item={item} />)}</View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7F8FA" },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 20, paddingBottom: 60 },
  eyebrow: { marginTop: 28, color: "#2761FF", fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  title: { marginTop: 6, color: "#111827", fontSize: 28, fontWeight: "900" },
  description: { marginTop: 10, color: "#667085", fontSize: 14, lineHeight: 21 },
  summaryGrid: { marginTop: 22, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { minWidth: 130, flexGrow: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#E1E4E9", backgroundColor: "#FFFFFF" },
  summaryCount: { fontSize: 25, fontWeight: "900" },
  summaryLabel: { marginTop: 4, color: "#667085", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  sectionTitle: { marginTop: 30, color: "#111827", fontSize: 18, fontWeight: "900" },
  filters: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filter: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#D7DCE2", backgroundColor: "#FFFFFF" },
  filterActive: { borderColor: "#2761FF", backgroundColor: "#EDF2FE" },
  filterText: { color: "#667085", fontSize: 12, fontWeight: "800" },
  filterTextActive: { color: "#1749D1" },
  loading: { marginTop: 40 },
  records: { marginTop: 14, gap: 10 },
  recordCard: { padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#E1E4E9", backgroundColor: "#FFFFFF" },
  recordHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  recordTitle: { flex: 1, color: "#1D2939", fontSize: 14, fontWeight: "800" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "900" },
  meta: { marginTop: 7, color: "#8A919C", fontSize: 11 },
  reason: { marginTop: 6, color: "#475467", fontSize: 12, lineHeight: 18 },
  empty: { marginTop: 14, padding: 24, borderRadius: 10, backgroundColor: "#FFFFFF", alignItems: "center" },
  emptyText: { color: "#667085", fontSize: 13 },
});
