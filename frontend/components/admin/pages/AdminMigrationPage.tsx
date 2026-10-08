import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { adminApi } from "../../../services/api";
import { AppText as Text } from "../../AppTypography";
import { ActionButton, Chip, COLORS, MetricCard } from "../AdminControls";
import AdminTable from "../AdminTable";
import { useAdminWorkspace } from "../AdminWorkspace";

const statuses = ["failed", "archived", "unmapped", "imported"] as const;
const labels = { failed: "실패", archived: "보관", unmapped: "미매핑", imported: "이관 완료" };
export default function AdminMigrationPage() {
  const { isAdmin } = useAdminWorkspace();
  const [status, setStatus] = useState<(typeof statuses)[number]>("failed");
  const [page, setPage] = useState(1);
  const summaryQuery = useQuery({ queryKey: ["legacy-import-summary"], queryFn: adminApi.getLegacyImportSummary, enabled: isAdmin });
  const recordsQuery = useQuery({ queryKey: ["legacy-import-records", status, page], queryFn: () => adminApi.getLegacyImportRecords({ status, page, size: 200 }), enabled: isAdmin });
  const pagination = recordsQuery.data?.pagination;
  const records = recordsQuery.data?.data ?? [];
  return <View style={{ gap: 20 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{statuses.map((value) => <MetricCard key={value} label={labels[value]} value={(summaryQuery.data?.data ?? []).filter((item) => item.status === value).reduce((total, item) => total + item.count, 0)} hint={value} />)}</View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{statuses.map((value) => <Chip key={value} active={status === value} label={labels[value]} onPress={() => { setStatus(value); setPage(1); }} />)}</View>
    {summaryQuery.isPending || recordsQuery.isPending ? <ActivityIndicator /> : null}
    {summaryQuery.isError || recordsQuery.isError ? <View style={{ gap: 10 }}><Text style={{ color: COLORS.error }}>이관 원장을 불러오지 못했습니다.</Text><ActionButton label="다시 시도" onPress={() => { void summaryQuery.refetch(); void recordsQuery.refetch(); }} /></View> : null}
    <Text style={{ color: COLORS.muted }}>총 {pagination?.total ?? records.length}건 · 이관 원장 조회</Text>
    {records.length ? <AdminTable minimumWidth={720} columns={[{ label: "대상 / 상태", flex: 1 }, { label: "원본 위치", flex: 1.4 }, { label: "결과 / 사유", flex: 2 }]} rows={records.map((item) => ({ key: item.id, cells: [<View key="target" style={{ gap: 6 }}><Text style={{ fontWeight: "600" }}>{item.entity_type} · {item.source_id}</Text><Text style={{ color: COLORS.muted }}>{item.status}</Text></View>, <View key="source" style={{ gap: 6 }}><Text>{item.source_sheet}</Text><Text style={{ color: COLORS.muted }}>{item.source_file}:{item.source_row}</Text></View>, <Text key="result" style={{ lineHeight: 21 }}>{item.reason || `${item.target_table || "-"} #${item.target_id || "-"}`}</Text>] }))} /> : !recordsQuery.isPending && !recordsQuery.isError ? <Text style={{ color: COLORS.muted }}>표시할 기록이 없습니다.</Text> : null}
    {(pagination?.total_pages ?? 0) > 1 && <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 }}><ActionButton label="이전" disabled={recordsQuery.isFetching || page <= 1} onPress={() => setPage(page - 1)} /><Text>{page} / {pagination?.total_pages}</Text><ActionButton label="다음" disabled={recordsQuery.isFetching || page >= (pagination?.total_pages ?? 1)} onPress={() => setPage(page + 1)} /></View>}
  </View>;
}
