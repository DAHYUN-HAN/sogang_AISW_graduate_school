import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Text, TextInput, View } from "react-native";

import { useBoardsQuery } from "../../hooks/useApi";
import { duesPayerApi } from "../../services/api";
import type { AdminDuesPayerItem, DuesPayerWritePayload } from "../../types";
import {
  DUES_RESET_CONFIRMATION,
  formatDuesScope,
  formatPaymentImportSummary,
  formatDuesPayer,
  formatRosterImportSummary,
  isExactDuesResetConfirmation,
} from "../../utils/duesPayers";
import DuesPayerEditor from "./DuesPayerEditor";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const COLORS = {
  primary: "#2761FF",
  primary50: "#EDF2FE",
  primary900: "#0B1F56",
  error: "#D94343",
  error50: "#FDECEC",
  border: "#E1E4E9",
  borderStrong: "#C7CDD4",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  text: "#111827",
  muted: "#6B7280",
};

type WorkbookFile = File | { uri: string; name: string; type: string };

function apiErrorMessage(error: unknown, fallback: string) {
  if (!isAxiosError(error)) return fallback;
  const data = error.response?.data as { message?: unknown } | undefined;
  return typeof data?.message === "string" ? data.message : fallback;
}

function pickWebWorkbook() {
  return new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    let settled = false;
    const cleanup = () => {
      input.removeEventListener("change", handleChange);
      input.removeEventListener("cancel", handleCancel);
      window.removeEventListener("focus", handleWindowFocus);
      input.remove();
    };
    const settle = (file: File | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(file);
    };
    const handleChange = () => settle(input.files?.[0] ?? null);
    const handleCancel = () => settle(null);
    const handleWindowFocus = () => {
      window.setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) settle(null);
      }, 600);
    };
    input.type = "file";
    input.accept = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    input.style.display = "none";
    input.addEventListener("change", handleChange);
    input.addEventListener("cancel", handleCancel);
    window.addEventListener("focus", handleWindowFocus);
    document.body.appendChild(input);
    input.click();
  });
}

async function pickWorkbook(): Promise<WorkbookFile | null> {
  if (Platform.OS === "web") return pickWebWorkbook();
  const result = await DocumentPicker.getDocumentAsync({
    type: XLSX_MIME,
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name || "원우회비.xlsx",
    type: asset.mimeType || XLSX_MIME,
  };
}

function Button({
  label,
  onPress,
  tone = "primary",
  disabled = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "outline" | "danger";
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const filled = tone !== "outline";
  const backgroundColor = disabled
    ? COLORS.borderStrong
    : tone === "danger"
      ? COLORS.error
      : filled
        ? COLORS.primary
        : COLORS.surface;
  const foreground = tone === "outline" ? COLORS.primary : COLORS.surface;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 42,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 7,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: disabled ? COLORS.borderStrong : tone === "danger" ? COLORS.error : COLORS.primary,
        backgroundColor,
        paddingHorizontal: 14,
      }}
    >
      {icon ? <Ionicons name={icon} size={17} color={foreground} /> : null}
      <Text style={{ color: foreground, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

export default function DuesPayerSection() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [uploadingRoster, setUploadingRoster] = useState(false);
  const [uploadingPayments, setUploadingPayments] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorItem, setEditorItem] = useState<AdminDuesPayerItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetting, setResetting] = useState(false);

  const payersQuery = useQuery({
    queryKey: ["admin-dues-payers", appliedSearch, page],
    queryFn: () => duesPayerApi.getAdminPayers({ q: appliedSearch || undefined, page, size: 100 }),
  });
  const payers = payersQuery.data?.data ?? [];
  const pagination = payersQuery.data?.pagination;
  const { data: boardsResponse } = useBoardsQuery();
  const activityBoards = (boardsResponse?.data ?? [])
    .flatMap((group) => group.boards)
    .filter((board) => board.is_active && board.board_type === "activity_certification");
  const busy = uploadingRoster || uploadingPayments || saving || resetting;

  const importRosterWorkbook = async () => {
    const file = await pickWorkbook();
    if (!file) return;
    setUploadingRoster(true);
    try {
      const response = await duesPayerApi.importRosterWorkbook(file);
      await queryClient.invalidateQueries({ queryKey: ["admin-dues-payers"] });
      Alert.alert("명부 업로드 완료", formatRosterImportSummary(response.data));
    } catch (error) {
      Alert.alert(
        "명부 업로드 실패",
        apiErrorMessage(error, "엑셀 형식을 확인해 주세요. 명단은 변경되지 않았습니다."),
      );
    } finally {
      setUploadingRoster(false);
    }
  };

  const importPaymentWorkbook = async () => {
    const file = await pickWorkbook();
    if (!file) return;
    setUploadingPayments(true);
    try {
      const response = await duesPayerApi.importPaymentWorkbook(file);
      await queryClient.invalidateQueries({ queryKey: ["admin-dues-payers"] });
      Alert.alert("전체 납부자 업로드 완료", formatPaymentImportSummary(response.data));
    } catch (error) {
      Alert.alert(
        "전체 납부자 업로드 실패",
        apiErrorMessage(error, "학번과 이름이 전체 원우 명부와 일치하는지 확인해 주세요. 납부 상태는 변경되지 않았습니다."),
      );
    } finally {
      setUploadingPayments(false);
    }
  };

  const savePayer = async (payload: DuesPayerWritePayload) => {
    setSaving(true);
    try {
      if (editorItem) {
        await duesPayerApi.updatePayer(editorItem.id, payload);
      } else {
        await duesPayerApi.createPayer(payload);
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-dues-payers"] });
      setEditorVisible(false);
      setEditorItem(null);
      Alert.alert("저장 완료", "원우의 납부 범위를 저장했습니다.");
    } catch (error) {
      Alert.alert("저장 실패", apiErrorMessage(error, "원우 납부 범위를 저장하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  const resetPayments = async () => {
    if (!isExactDuesResetConfirmation(resetConfirmation)) return;
    setResetting(true);
    try {
      const response = await duesPayerApi.resetPayments(resetConfirmation);
      await queryClient.invalidateQueries({ queryKey: ["admin-dues-payers"] });
      Alert.alert(
        "초기화 완료",
        `${response.data.reset}명의 전체 납부 상태를 미납으로 초기화했습니다. 원우 명부와 특정 행사 1회 납부는 유지됩니다.`,
      );
      setResetStep(0);
      setResetConfirmation("");
      setPage(1);
    } catch (error) {
      Alert.alert("초기화 실패", apiErrorMessage(error, "원우회비 납부 상태를 초기화하지 못했습니다."));
    } finally {
      setResetting(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 16, gap: 12 }}>
        <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>원우회비 납부자 명부</Text>
        <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
          회원 계정과 분리된 전체 원우 명부를 먼저 등록한 뒤, 전체 납부자 엑셀이나 개별 등록으로 납부 범위를 관리합니다.
        </Text>
        <View style={{ borderRadius: 6, backgroundColor: COLORS.primary50, padding: 12, gap: 4 }}>
          <Text style={{ color: COLORS.primary900, fontWeight: "900" }}>업로드 규칙</Text>
          <Text style={{ color: COLORS.primary900, fontSize: 13, lineHeight: 19 }}>
            두 파일 모두 헤더 없이 이름 전공 학번 3열을 사용합니다. 원우 명부는 기존 명부를 유지하면서 새 학번만 추가하고, 기존 학번의 이름·전공이 다르면 업로드를 중단합니다. 전체 납부자 업로드는 매번 ALL 상태를 새 목록으로 교체하며, 특정 행사 1회 납부자는 목록에서 빠져도 유지됩니다.
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Button
              icon="people-outline"
              label={uploadingRoster ? "명부 업로드 중..." : "전체 원우 명부 업로드"}
              onPress={() => void importRosterWorkbook()}
              disabled={busy}
            />
          </View>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Button
              icon="cloud-upload-outline"
              label={uploadingPayments ? "납부자 업로드 중..." : "전체 납부자 업로드"}
              onPress={() => void importPaymentWorkbook()}
              disabled={busy}
            />
          </View>
        </View>
        <Button
          icon="person-add-outline"
          label="개별 등록"
          tone="outline"
          disabled={busy}
          onPress={() => {
            setEditorItem(null);
            setEditorVisible(true);
          }}
        />
      </View>

      <View style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 16, gap: 10 }}>
        <Text style={{ color: COLORS.text, fontWeight: "900" }}>납부자 검색</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => {
            setAppliedSearch(search.trim());
            setPage(1);
          }}
          placeholder="이름 또는 학번 검색"
          placeholderTextColor={COLORS.muted}
          style={{ minHeight: 44, borderRadius: 6, borderWidth: 1, borderColor: COLORS.borderStrong, paddingHorizontal: 12, color: COLORS.text }}
        />
        <Button
          icon="search-outline"
          label="검색"
          onPress={() => {
            setAppliedSearch(search.trim());
            setPage(1);
          }}
        />
        <Text style={{ color: COLORS.muted, fontSize: 13 }}>총 {pagination?.total ?? 0}명</Text>
      </View>

      {payersQuery.isLoading ? <ActivityIndicator color={COLORS.primary} /> : null}
      {payersQuery.isError ? <Text style={{ color: COLORS.error }}>명부를 불러오지 못했습니다.</Text> : null}
      {!payersQuery.isLoading && !payersQuery.isError && payers.length === 0 ? (
        <View style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 16 }}>
          <Text style={{ color: COLORS.muted }}>검색되는 원우회비 납부자가 없습니다.</Text>
        </View>
      ) : null}
      {payers.map((payer) => (
        <View key={payer.id} style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 14, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: COLORS.text, fontWeight: "900" }}>{formatDuesPayer(payer)}</Text>
              <Text style={{ color: payer.payment_scope === "UNPAID" ? COLORS.muted : COLORS.primary, fontSize: 13, fontWeight: "800" }}>
                {formatDuesScope(payer)}
              </Text>
            </View>
            <Button
              label="수정"
              tone="outline"
              disabled={busy}
              onPress={() => {
                setEditorItem(payer);
                setEditorVisible(true);
              }}
            />
          </View>
        </View>
      ))}

      {(pagination?.total_pages ?? 0) > 1 ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Button label="이전" tone="outline" disabled={page <= 1} onPress={() => setPage((current) => Math.max(1, current - 1))} />
          <Text style={{ color: COLORS.text, fontWeight: "800" }}>{page} / {pagination?.total_pages}</Text>
          <Button label="다음" tone="outline" disabled={page >= (pagination?.total_pages ?? 1)} onPress={() => setPage((current) => current + 1)} />
        </View>
      ) : null}

      <View style={{ borderRadius: 8, borderWidth: 1, borderColor: "#F7B8B8", backgroundColor: COLORS.error50, padding: 16, gap: 10 }}>
        <Text style={{ color: COLORS.error, fontSize: 17, fontWeight: "900" }}>원우회비 납부자 초기화</Text>
        {resetStep === 0 ? (
          <Button label="납부자 초기화 시작" tone="danger" onPress={() => setResetStep(1)} disabled={busy} />
        ) : null}
        {resetStep === 1 ? (
          <>
            <Text style={{ color: COLORS.error, lineHeight: 20 }}>
              전체 납부(ALL) 상태를 모두 미납으로 초기화합니다. 원우 명부와 특정 행사 1회 납부(ONCE)는 그대로 유지됩니다.
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><Button label="취소" tone="outline" onPress={() => setResetStep(0)} /></View>
              <View style={{ flex: 1 }}><Button label="초기화 확인 계속" tone="danger" onPress={() => setResetStep(2)} /></View>
            </View>
          </>
        ) : null}
        {resetStep === 2 ? (
          <>
            <Text style={{ color: COLORS.error, lineHeight: 20 }}>
              마지막 확인입니다. 아래 입력란에 {DUES_RESET_CONFIRMATION}를 정확히 입력하세요.
            </Text>
            <TextInput
              value={resetConfirmation}
              onChangeText={setResetConfirmation}
              placeholder={DUES_RESET_CONFIRMATION}
              placeholderTextColor={COLORS.muted}
              style={{ minHeight: 44, borderRadius: 6, borderWidth: 1, borderColor: COLORS.error, backgroundColor: COLORS.surface, paddingHorizontal: 12, color: COLORS.text }}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><Button label="취소" tone="outline" onPress={() => { setResetStep(0); setResetConfirmation(""); }} /></View>
              <View style={{ flex: 1 }}>
                <Button
                  label={resetting ? "초기화 중..." : "납부자 초기화"}
                  tone="danger"
                  disabled={resetting || !isExactDuesResetConfirmation(resetConfirmation)}
                  onPress={() => void resetPayments()}
                />
              </View>
            </View>
          </>
        ) : null}
      </View>

      <DuesPayerEditor
        visible={editorVisible}
        item={editorItem}
        activityBoards={activityBoards}
        saving={saving}
        onClose={() => {
          if (saving) return;
          setEditorVisible(false);
          setEditorItem(null);
        }}
        onSave={(payload) => void savePayer(payload)}
      />
    </View>
  );
}
