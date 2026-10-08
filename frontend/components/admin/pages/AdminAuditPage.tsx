import { ActivityIndicator, View } from "react-native";
import { AppText as Text } from "../../../components/AppTypography";
import { auditActionLabel, auditSummary } from "../../../utils/adminMain";
import { ActionButton, COLORS, formatDate } from "../AdminControls";
import AdminTable from "../AdminTable";
import { useAdminWorkspace } from "../AdminWorkspace";
export default function AdminAuditPage() {
  const { auditLogs, auditLogsQuery, auditPage, setAuditPage } = useAdminWorkspace();
  return (<View style={{ gap: 12 }}>
    <Text style={{ color: COLORS.muted }}>총 {auditLogsQuery.data?.pagination?.total ?? auditLogs.length}건</Text>
    {auditLogsQuery.isPending ? <ActivityIndicator /> : null}
    {auditLogsQuery.isError ? <ActionButton label="다시 시도" icon="refresh-outline" onPress={() => void auditLogsQuery.refetch()} /> : null}
    {auditLogs.length ? <AdminTable minimumWidth={720} columns={[{ label: "작업", flex: 1 }, { label: "대상 / 변경 내용", flex: 2.4 }, { label: "관리자", flex: 1 }, { label: "일시", width: 160 }]} rows={auditLogs.map((item) => ({ key: item.id, cells: [<Text key="action" style={{ fontWeight: "600" }}>{auditActionLabel(item.action)}</Text>, <View key="target" style={{ gap: 7 }}><Text>{typeof item.details?.title === "string" ? item.details.title : `${item.target_type}${item.target_id ? ` #${item.target_id}` : ""}`}</Text>{auditSummary(item.details) ? <Text style={{ color: COLORS.muted, lineHeight: 20 }}>{auditSummary(item.details)}</Text> : null}</View>, <Text key="actor">{item.actor_nickname}</Text>, <Text key="time" style={{ color: COLORS.muted }}>{formatDate(item.created_at)}</Text>] }))} /> : !auditLogsQuery.isPending && !auditLogsQuery.isError ? <Text style={{ color: COLORS.muted }}>표시할 운영 기록이 없습니다.</Text> : null}
    {(auditLogsQuery.data?.pagination?.total_pages ?? 0) > 1 ? <View style={{ flexDirection: "row", gap: 12, alignItems: "center", justifyContent: "flex-end" }}>
      <ActionButton label="이전" icon="chevron-back-outline" disabled={auditLogsQuery.isFetching || auditPage <= 1} onPress={() => setAuditPage(auditPage - 1)} />
      <Text>{auditPage} / {auditLogsQuery.data?.pagination?.total_pages}</Text>
      <ActionButton label="다음" icon="chevron-forward-outline" disabled={auditLogsQuery.isFetching || auditPage >= (auditLogsQuery.data?.pagination?.total_pages ?? 1)} onPress={() => setAuditPage(auditPage + 1)} />
    </View> : null}
  </View>);
}
