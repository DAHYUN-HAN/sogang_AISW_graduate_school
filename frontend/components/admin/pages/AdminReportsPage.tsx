import { ActivityIndicator, View } from "react-native";
import { AppText as Text } from "../../../components/AppTypography";
import { COLORS, Chip, Panel, REPORT_STATUS_LABELS, ReportCard , ActionButton } from "../AdminControls";
import { useAdminWorkspace } from "../AdminWorkspace";


import AdminColumns from "../AdminColumns";
export default function AdminReportsPage() {
  const { handleDeleteTarget, handleReportStatus, reportStatus, reports, reportsQuery, setReportStatus } = useAdminWorkspace();
  return (<View style={{ gap: 12 }}>
    <Panel>
      <View style={{ gap: 10 }}>
        <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>신고 관리</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["open", "reviewing", "resolved", "dismissed", "all"] as const).map((status) => (
            <Chip key={status} active={reportStatus === status} label={REPORT_STATUS_LABELS[status]} onPress={() => setReportStatus(status)} />
          ))}
        </View>
      </View>
    </Panel>
    {reportsQuery.isError ? <Panel><Text style={{ color: COLORS.error }}>목록을 불러오지 못했습니다.</Text><ActionButton label="다시 시도" onPress={() => void reportsQuery.refetch()} /></Panel> : null}
    {reportsQuery.isLoading ? <ActivityIndicator /> : null}
    {!reportsQuery.isLoading && reports.length === 0 ? (
      <Panel>
        <Text style={{ color: COLORS.muted }}>표시할 신고가 없습니다.</Text>
      </Panel>
    ) : null}
    <AdminColumns>{reports.map((report) => (
      <ReportCard key={report.id} report={report} onStatusChange={handleReportStatus} onDeleteTarget={handleDeleteTarget} />
    ))}</AdminColumns>
  </View>);
}
