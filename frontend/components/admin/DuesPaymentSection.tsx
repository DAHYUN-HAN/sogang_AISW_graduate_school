import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Alert, Text, TextInput, View } from "react-native";

import { useBoardsQuery } from "../../hooks/useApi";
import { duesPayerApi } from "../../services/api";
import type { AdminDuesPaymentItem, DuesPaymentWritePayload } from "../../types";
import { formatDuesPayer, formatDuesScope, formatPaymentImportSummary } from "../../utils/duesPayers";
import {
  DUES_ADMIN_COLORS as COLORS,
  DuesAdminButton,
  duesApiErrorMessage,
  pickDuesWorkbook,
} from "./DuesAdminPrimitives";
import DuesPaymentEditor from "./DuesPaymentEditor";
import DuesPaymentImportConfirm from "./DuesPaymentImportConfirm";


export default function DuesPaymentSection() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importConfirmVisible, setImportConfirmVisible] = useState(false);
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
      Alert.alert("저장 완료", "현재 학기 납부 범위를 저장했습니다.");
    } catch (error) {
      Alert.alert("저장 실패", duesApiErrorMessage(error, "납부 범위를 저장하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 16, gap: 12 }}>
        <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>현재 학기 원우회비</Text>
        <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
          현재 학기의 전체 납부자와 특정 활동인증 납부자를 관리합니다. 신원 정보는 원우 명부 탭에서 관리합니다.
        </Text>
        <View style={{ borderRadius: 6, backgroundColor: "#FDECEC", padding: 12, gap: 4 }}>
          <Text style={{ color: COLORS.error, fontWeight: "900" }}>업로드 전 확인</Text>
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
      </View>

      <View style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 16, gap: 10 }}>
        <Text style={{ color: COLORS.text, fontWeight: "900" }}>원우 검색</Text>
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
              <Text style={{ color: COLORS.text, fontWeight: "900" }}>{formatDuesPayer(item)}</Text>
              <Text style={{ color: item.payment_scope === "UNPAID" ? COLORS.muted : COLORS.primary, fontSize: 13, fontWeight: "800" }}>
                {formatDuesScope(item)}
              </Text>
            </View>
            <DuesAdminButton label="납부 설정" tone="outline" disabled={uploading || saving} onPress={() => setEditorItem(item)} />
          </View>
        </View>
      ))}

      {(pagination?.total_pages ?? 0) > 1 ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <DuesAdminButton label="이전" tone="outline" disabled={page <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))} />
          <Text style={{ color: COLORS.text, fontWeight: "800" }}>{page} / {pagination?.total_pages}</Text>
          <DuesAdminButton label="다음" tone="outline" disabled={page >= (pagination?.total_pages ?? 1)} onPress={() => setPage((value) => value + 1)} />
        </View>
      ) : null}

      <DuesPaymentEditor
        visible={editorItem !== null}
        item={editorItem}
        activityBoards={activityBoards}
        saving={saving}
        onClose={() => {
          if (!saving) setEditorItem(null);
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
    </View>
  );
}
