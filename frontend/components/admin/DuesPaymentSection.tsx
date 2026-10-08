import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../AppTypography";

import { useBoardsQuery } from "../../hooks/useApi";
import { duesPayerApi } from "../../services/api";
import type { AdminDuesPaymentItem, DuesPaymentWritePayload } from "../../types";
import {
  formatDuesPayer,
  formatDuesScope,
  formatPaymentImportSummary,
  type DuesPaymentEditorMode,
} from "../../utils/duesPayers";
import {
  DUES_ADMIN_COLORS as COLORS,
  DuesAdminButton,
  duesApiErrorMessage,
  pickDuesWorkbook,
} from "./DuesAdminPrimitives";
import DuesPaymentEditor from "./DuesPaymentEditor";
import DuesPaymentImportConfirm from "./DuesPaymentImportConfirm";
import AdminTable from "./AdminTable";

import { useAdminAlert } from "../../utils/adminAlert";


export default function DuesPaymentSection() {
  const Alert = useAdminAlert();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importConfirmVisible, setImportConfirmVisible] = useState(false);
  const [onceRegistrationMode, setOnceRegistrationMode] = useState(false);
  const [editorMode, setEditorMode] = useState<DuesPaymentEditorMode>("EDIT");
  const [editorItem, setEditorItem] = useState<AdminDuesPaymentItem | null>(null);
  const paymentsQuery = useQuery({
    queryKey: ["admin-dues-payments", appliedSearch, page],
    queryFn: () => duesPayerApi.getAdminPayments({ q: appliedSearch || undefined, page, size: 100 }),
  });
  const payments = paymentsQuery.data?.data ?? [];
  const pagination = paymentsQuery.data?.pagination;
  const { data: boardsResponse } = useBoardsQuery();
  const activityBoards = (boardsResponse?.data ?? [])
    .flatMap((group) => group.boards)
    .filter((board) => board.is_active && board.board_type === "activity_certification");

  const applySearch = () => {
    setAppliedSearch(search.trim());
    setPage(1);
  };

  const importPaymentWorkbook = async () => {
    const file = await pickDuesWorkbook();
    if (!file) return;
    setUploading(true);
    try {
      const response = await duesPayerApi.importPaymentWorkbook(file);
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: ["admin-dues-payments"] });
      Alert.alert("현재 학기 납부자 업로드 완료", formatPaymentImportSummary(response.data));
    } catch (error) {
      Alert.alert(
        "납부자 업로드 실패",
        duesApiErrorMessage(error, "학번과 이름이 원우 명부와 일치하는지 확인해 주세요. 기존 납부 상태는 유지됩니다."),
      );
    } finally {
      setUploading(false);
    }
  };

  const savePayment = async (payload: DuesPaymentWritePayload) => {
    if (!editorItem) return;
    setSaving(true);
    try {
      await duesPayerApi.updatePayment(editorItem.id, payload);
      await queryClient.invalidateQueries({ queryKey: ["admin-dues-payments"] });
      setEditorItem(null);
      setEditorMode("EDIT");
      Alert.alert(
        editorMode === "REGISTER_ONCE" ? "1회 납부 등록 완료" : "저장 완료",
        editorMode === "REGISTER_ONCE"
          ? "선택한 활동인증 게시판의 1회 납부자로 등록했습니다."
          : "현재 학기 납부 범위를 저장했습니다.",
      );
    } catch (error) {
      Alert.alert("저장 실패", duesApiErrorMessage(error, "납부 범위를 저장하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  const dialogs = <>
    <DuesPaymentEditor
      visible={editorItem !== null}
      item={editorItem}
      mode={editorMode}
      activityBoards={activityBoards}
      saving={saving}
      onClose={() => {
        if (!saving) {
          setEditorItem(null);
          setEditorMode("EDIT");
        }
      }}
      onSave={(payload) => void savePayment(payload)}
    />
    <DuesPaymentImportConfirm
      visible={importConfirmVisible}
      disabled={uploading || saving}
      onCancel={() => {
        if (!uploading && !saving) setImportConfirmVisible(false);
      }}
      onConfirm={() => {
        setImportConfirmVisible(false);
        void importPaymentWorkbook();
      }}
    />
  </>;

  if (Platform.OS === "web") {
    const busy = uploading || saving;
    const emptyContent = paymentsQuery.isLoading ? <ActivityIndicator accessibilityLabel="납부 목록 불러오는 중" color="#2761FF" /> : paymentsQuery.isError ? <>
      <Text style={webStyles.muted}>납부 목록을 불러오지 못했습니다.</Text><DuesAdminButton label="다시 시도" tone="outline" onPress={() => void paymentsQuery.refetch()} />
    </> : <Text style={webStyles.muted}>{appliedSearch ? "검색 결과가 없습니다." : "등록된 원우가 없습니다. 원우 명부에서 명부를 먼저 등록해 주세요."}</Text>;

    return <View style={{ gap: 24 }}>
      <View style={webStyles.toolbar}>
        <View style={webStyles.searchRow}>
          <TextInput accessibilityLabel="원우회비 검색" value={search} onChangeText={setSearch} onSubmitEditing={applySearch} returnKeyType="search" placeholder="이름, 학번, 전공 검색" placeholderTextColor="#6B7280" style={webStyles.search} />
          <DuesAdminButton label="검색" onPress={applySearch} />
          {(search || appliedSearch) ? <DuesAdminButton label="초기화" tone="outline" onPress={() => { setSearch(""); setAppliedSearch(""); setPage(1); }} /> : null}
        </View>
        <DuesAdminButton icon="cloud-upload-outline" label={uploading ? "납부자 업로드 중..." : "현재 학기 전체 납부자 업로드"} tone="outline" disabled={busy} onPress={() => setImportConfirmVisible(true)} />
      </View>

      <View style={webStyles.uploadGuide}>
        <Text style={{ color: "#D92D52", fontSize: 12, fontWeight: "600" }}>업로드 전 확인</Text>
        <Text style={webStyles.muted}>업로드하면 기존 전체 납부와 특정 행사 1회 납부가 모두 초기화되고, 파일의 원우만 전체 납부로 등록됩니다.</Text>
      </View>

      <View style={webStyles.tabs}>{([[false, "납부 관리"], [true, "개별 행사 1회 납부 등록"]] as const).map(([value, label]) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: onceRegistrationMode === value, disabled: busy }} disabled={busy} onPress={() => setOnceRegistrationMode(value)} style={[webStyles.tab, onceRegistrationMode === value && webStyles.selectedTab, busy && { opacity: 0.45 }]}><Text style={{ fontSize: 13, color: onceRegistrationMode === value ? "#2761FF" : "#6B7280", fontWeight: onceRegistrationMode === value ? "600" : "400" }}>{label}</Text></Pressable>)}</View>
      {onceRegistrationMode && <Text style={webStyles.muted}>원우를 검색한 뒤 1회 납부 등록을 누르고 활동인증 게시판을 선택하세요.</Text>}
      <View style={webStyles.summary}><Text style={webStyles.sectionTitle}>현재 학기 납부 현황 <Text style={webStyles.muted}>{pagination ? `${pagination.total.toLocaleString()}명` : ""}</Text></Text><Text style={webStyles.muted}>100명씩 표시</Text></View>
      <AdminTable minimumWidth={850} columns={[
        { label: "이름", flex: 1 }, { label: "학번", width: 110 }, { label: "전공", flex: 1.1 }, { label: "납부 범위", width: 90 }, { label: "활동인증 게시판", flex: 1.4 }, { label: "관리", width: 115 },
      ]} rows={(paymentsQuery.isError ? [] : payments).map(item => ({ key: item.id, cells: [
        <Text key="name" style={[webStyles.text, { fontWeight: "600" }]}>{item.name}</Text>,
        <Text key="studentNumber" style={webStyles.text}>{item.student_number}</Text>,
        <Text key="major" style={webStyles.text}>{item.major}</Text>,
        <Text key="scope" style={[webStyles.badge, item.payment_scope === "ALL" ? webStyles.paidBadge : item.payment_scope === "ONCE" ? webStyles.onceBadge : webStyles.unpaidBadge]}>{item.payment_scope === "ALL" ? "전체 납부" : item.payment_scope === "ONCE" ? "1회 납부" : "미납"}</Text>,
        <Text key="board" style={webStyles.muted}>{item.payment_scope === "ONCE" ? item.once_board_name ?? "게시판 미지정" : "—"}</Text>,
        <View key="edit" style={{ alignItems: "flex-start" }}><DuesAdminButton label={onceRegistrationMode ? "1회 납부 등록" : "납부 설정"} tone="outline" disabled={busy} onPress={() => { setEditorMode(onceRegistrationMode ? "REGISTER_ONCE" : "EDIT"); setEditorItem(item); }} /></View>,
      ] }))} emptyContent={emptyContent} />
      {(pagination?.total_pages ?? 0) > 1 && <View style={webStyles.pagination}>
        <DuesAdminButton label="이전" tone="outline" disabled={page <= 1} onPress={() => setPage(value => Math.max(1, value - 1))} /><Text style={webStyles.muted}>{page} / {pagination?.total_pages}</Text><DuesAdminButton label="다음" tone="outline" disabled={page >= (pagination?.total_pages ?? 1)} onPress={() => setPage(value => value + 1)} />
      </View>}
      {dialogs}
    </View>;
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 16, gap: 12 }}>
        <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>현재 학기 원우회비</Text>
        <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
          현재 학기의 전체 납부자와 특정 활동인증 납부자를 관리합니다. 신원 정보는 원우 명부 탭에서 관리합니다.
        </Text>
        <View style={{ borderRadius: 6, backgroundColor: "#FDECEC", padding: 12, gap: 4 }}>
          <Text style={{ color: COLORS.error, fontWeight: "600" }}>업로드 전 확인</Text>
          <Text style={{ color: COLORS.error, fontSize: 13, lineHeight: 19 }}>
            업로드하면 기존 전체 납부와 특정 행사 1회 납부가 모두 초기화되고, 파일의 원우만 전체 납부로 등록됩니다.
          </Text>
        </View>
        <DuesAdminButton
          icon="cloud-upload-outline"
          label={uploading ? "납부자 업로드 중..." : "현재 학기 전체 납부자 업로드"}
          disabled={uploading || saving}
          onPress={() => setImportConfirmVisible(true)}
        />
        <DuesAdminButton
          label="개별 행사 1회 납부 등록"
          tone="outline"
          disabled={uploading || saving}
          onPress={() => setOnceRegistrationMode(true)}
        />
      </View>

      <View style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 16, gap: 10 }}>
        {onceRegistrationMode ? (
          <View style={{ borderRadius: 8, backgroundColor: COLORS.primary50, padding: 12, gap: 8 }}>
            <Text style={{ color: COLORS.primary900, fontWeight: "600" }}>개별 행사 1회 납부 등록 중</Text>
            <Text style={{ color: COLORS.primary900, fontSize: 13, lineHeight: 19 }}>
              원우를 검색한 뒤 1회 납부 등록을 누르고 활동인증 게시판을 선택하세요.
            </Text>
            <DuesAdminButton
              label="일반 납부 관리로 돌아가기"
              tone="outline"
              disabled={uploading || saving}
              onPress={() => setOnceRegistrationMode(false)}
            />
          </View>
        ) : null}
        <Text style={{ color: COLORS.text, fontWeight: "600" }}>
          {onceRegistrationMode ? "등록할 원우 검색" : "원우 검색"}
        </Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={applySearch}
          placeholder="이름, 학번, 전공 검색"
          placeholderTextColor={COLORS.muted}
          style={{ minHeight: 44, borderRadius: 6, borderWidth: 1, borderColor: COLORS.borderStrong, paddingHorizontal: 12, color: COLORS.text }}
        />
        <DuesAdminButton icon="search-outline" label="검색" onPress={applySearch} />
        <Text style={{ color: COLORS.muted, fontSize: 13 }}>총 {pagination?.total ?? 0}명</Text>
      </View>

      {paymentsQuery.isLoading ? <ActivityIndicator color={COLORS.primary} /> : null}
      {paymentsQuery.isError ? <Text style={{ color: COLORS.error }}>납부 목록을 불러오지 못했습니다.</Text> : null}
      {!paymentsQuery.isLoading && !paymentsQuery.isError && payments.length === 0 ? (
        <View style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 16 }}>
          <Text style={{ color: COLORS.muted }}>검색 결과가 없습니다.</Text>
        </View>
      ) : null}
      {payments.map((item) => (
        <View key={item.id} style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: COLORS.text, fontWeight: "600" }}>{formatDuesPayer(item)}</Text>
              <Text style={{ color: item.payment_scope === "UNPAID" ? COLORS.muted : COLORS.primary, fontSize: 13, fontWeight: "600" }}>
                {formatDuesScope(item)}
              </Text>
            </View>
            <DuesAdminButton
              label={onceRegistrationMode ? "1회 납부 등록" : "납부 설정"}
              tone="outline"
              disabled={uploading || saving}
              onPress={() => {
                setEditorMode(onceRegistrationMode ? "REGISTER_ONCE" : "EDIT");
                setEditorItem(item);
              }}
            />
          </View>
        </View>
      ))}

      {(pagination?.total_pages ?? 0) > 1 ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <DuesAdminButton label="이전" tone="outline" disabled={page <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))} />
          <Text style={{ color: COLORS.text, fontWeight: "600" }}>{page} / {pagination?.total_pages}</Text>
          <DuesAdminButton label="다음" tone="outline" disabled={page >= (pagination?.total_pages ?? 1)} onPress={() => setPage((value) => value + 1)} />
        </View>
      ) : null}

      {dialogs}
    </View>
  );
}

const webStyles = StyleSheet.create({
  text: { color: "#15171C", fontSize: 13, lineHeight: 20 }, muted: { color: "#6B7280", fontSize: 12, lineHeight: 20 },
  sectionTitle: { color: "#15171C", fontSize: 15, fontWeight: "600" },
  toolbar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 },
  searchRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, maxWidth: "100%" },
  search: { width: 360, maxWidth: "100%", minHeight: 42, borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 6, paddingHorizontal: 14, color: "#15171C", fontSize: 13 },
  uploadGuide: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E1E4E9", paddingVertical: 16, gap: 6 },
  tabs: { flexDirection: "row", flexWrap: "wrap", borderBottomWidth: 1, borderColor: "#E1E4E9", gap: 4 },
  tab: { paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: "transparent" }, selectedTab: { borderBottomColor: "#2761FF" },
  summary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  badge: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: "flex-start" },
  paidBadge: { color: "#168A72", backgroundColor: "#EDF8F4" }, onceBadge: { color: "#2761FF", backgroundColor: "#EDF2FE" }, unpaidBadge: { color: "#6B7280", backgroundColor: "#F3F4F6" },
  pagination: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 14 },
});
