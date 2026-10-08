import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../AppTypography";

import { duesPayerApi } from "../../services/api";
import type { AdminRosterItem } from "../../types";
import { formatRosterImportSummary } from "../../utils/duesPayers";
import {
  DUES_ADMIN_COLORS as COLORS,
  DuesAdminButton,
  duesApiErrorMessage,
  pickDuesWorkbook,
} from "./DuesAdminPrimitives";

import { useAdminAlert } from "../../utils/adminAlert";
import AdminTable from "./AdminTable";


const COLUMN_WIDTHS = { name: 150, studentNumber: 170, major: 260 };

function Cell({ width, children, strong = false }: { width: number; children: string; strong?: boolean }) {
  return (
    <Text
      numberOfLines={1}
      style={{
        minWidth: width,
        flex: width,
        color: COLORS.text,
        fontSize: 13,
        fontWeight: strong ? "900" : "600",
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      {children}
    </Text>
  );
}

function RosterRow({ item }: { item: AdminRosterItem }) {
  return (
    <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: COLORS.border }}>
      <Cell width={COLUMN_WIDTHS.name}>{item.name}</Cell>
      <Cell width={COLUMN_WIDTHS.studentNumber}>{item.student_number}</Cell>
      <Cell width={COLUMN_WIDTHS.major}>{item.major}</Cell>
    </View>
  );
}

function RosterWebButton({ label, onPress, disabled = false, primary = false, icon }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean; icon?: keyof typeof Ionicons.glyphMap }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[webStyles.button, primary && webStyles.primaryButton, disabled && { opacity: 0.45 }]}>
    {icon && <Ionicons name={icon} size={16} color={primary ? "#FFFFFF" : "#6B7280"} />}
    <Text style={[webStyles.text, primary && { color: "#FFFFFF", fontWeight: "600" }]}>{label}</Text>
  </Pressable>;
}

export default function DuesRosterSection() {
  const Alert = useAdminAlert();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const rosterQuery = useQuery({
    queryKey: ["admin-dues-roster", appliedSearch, page],
    queryFn: () => duesPayerApi.getAdminRoster({ q: appliedSearch || undefined, page, size: 100 }),
  });
  const members = rosterQuery.data?.data ?? [];
  const pagination = rosterQuery.data?.pagination;

  const applySearch = () => {
    setAppliedSearch(search.trim());
    setPage(1);
  };

  const importRoster = async () => {
    const file = await pickDuesWorkbook();
    if (!file) return;
    setUploading(true);
    try {
      const response = await duesPayerApi.importRosterWorkbook(file);
      setPage(1);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-dues-roster"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-dues-payments"] }),
      ]);
      Alert.alert("명부 업로드 완료", formatRosterImportSummary(response.data));
    } catch (error) {
      Alert.alert(
        "명부 업로드 실패",
        duesApiErrorMessage(error, "엑셀 형식과 내용을 확인해 주세요. 기존 명부는 변경되지 않았습니다."),
      );
    } finally {
      setUploading(false);
    }
  };

  if (Platform.OS === "web") {
    const emptyContent = rosterQuery.isLoading ? <ActivityIndicator accessibilityLabel="명부 불러오는 중" color="#2761FF" /> : rosterQuery.isError ? <>
      <Text style={webStyles.muted}>명부를 불러오지 못했습니다.</Text>
      <RosterWebButton label="다시 시도" onPress={() => void rosterQuery.refetch()} />
    </> : <Text style={webStyles.muted}>{appliedSearch ? "검색 결과가 없습니다." : "등록된 원우가 없습니다. 엑셀 파일로 명부를 등록해 주세요."}</Text>;

    return <View style={{ gap: 24 }}>
      <View style={webStyles.toolbar}>
        <View style={webStyles.searchRow}>
          <TextInput accessibilityLabel="명부 검색" value={search} onChangeText={setSearch} onSubmitEditing={applySearch} returnKeyType="search" placeholder="이름, 학번, 전공 검색" placeholderTextColor="#6B7280" style={webStyles.search} />
          <RosterWebButton label="검색" primary onPress={applySearch} />
          {(search || appliedSearch) ? <RosterWebButton label="초기화" onPress={() => { setSearch(""); setAppliedSearch(""); setPage(1); }} /> : null}
        </View>
        <RosterWebButton icon="cloud-upload-outline" label={uploading ? "명부 업로드 중..." : "전체 원우 명부 업로드"} disabled={uploading} onPress={() => void importRoster()} />
      </View>

      <View style={webStyles.importGuide}>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 }}><Text style={webStyles.guideTitle}>엑셀 업로드 안내</Text><Text style={webStyles.muted}>XLSX · 헤더 없이 이름 / 전공 / 학번 순서의 3열</Text></View>
        <Text style={webStyles.muted}>같은 학번의 이름·전공은 갱신하고, 새 학번은 추가합니다. 파일에 없는 기존 원우는 유지됩니다.</Text>
      </View>

      <View style={webStyles.summary}><Text style={webStyles.sectionTitle}>원우 목록 <Text style={webStyles.muted}>{pagination ? `${pagination.total.toLocaleString()}명` : ""}</Text></Text><Text style={webStyles.muted}>100명씩 표시</Text></View>
      <AdminTable minimumWidth={580} columns={[{ label: "이름", flex: 1 }, { label: "학번", flex: 1.1 }, { label: "전공", flex: 1.8 }]} rows={(rosterQuery.isError ? [] : members).map(member => ({ key: member.id, cells: [
        <Text key="name" style={[webStyles.text, { fontWeight: "600" }]}>{member.name}</Text>,
        <Text key="studentNumber" style={webStyles.text}>{member.student_number}</Text>,
        <Text key="major" style={webStyles.text}>{member.major}</Text>,
      ] }))} emptyContent={emptyContent} />

      {(pagination?.total_pages ?? 0) > 1 && <View style={webStyles.pagination}>
        <RosterWebButton label="이전" disabled={page <= 1} onPress={() => setPage(value => Math.max(1, value - 1))} />
        <Text style={webStyles.muted}>{page} / {pagination?.total_pages}</Text>
        <RosterWebButton label="다음" disabled={page >= (pagination?.total_pages ?? 1)} onPress={() => setPage(value => value + 1)} />
      </View>}
    </View>;
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 16, gap: 12 }}>
        <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>원우 명부</Text>
        <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
          학교를 거쳐간 원우를 계속 누적합니다. 같은 학번은 이름과 전공을 덮어쓰고, 새 학번은 추가합니다.
        </Text>
        <View style={{ borderRadius: 6, backgroundColor: COLORS.primary50, padding: 12, gap: 4 }}>
          <Text style={{ color: COLORS.primary900, fontWeight: "600" }}>엑셀 형식</Text>
          <Text style={{ color: COLORS.primary900, fontSize: 13, lineHeight: 19 }}>
            헤더 없이 이름, 전공, 학번 순서의 3열 파일을 사용합니다. 파일에 없는 기존 원우는 삭제되지 않습니다.
          </Text>
        </View>
        <DuesAdminButton
          icon="cloud-upload-outline"
          label={uploading ? "명부 업로드 중..." : "전체 원우 명부 업로드"}
          disabled={uploading}
          onPress={() => void importRoster()}
        />
      </View>

      <View style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 16, gap: 10 }}>
        <Text style={{ color: COLORS.text, fontWeight: "600" }}>명부 검색</Text>
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

      {rosterQuery.isLoading ? <ActivityIndicator color={COLORS.primary} /> : null}
      {rosterQuery.isError ? <Text style={{ color: COLORS.error }}>명부를 불러오지 못했습니다.</Text> : null}
      {!rosterQuery.isLoading && !rosterQuery.isError && members.length === 0 ? (
        <View style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 16 }}>
          <Text style={{ color: COLORS.muted }}>검색 결과가 없습니다.</Text>
        </View>
      ) : null}
      {members.length > 0 ? (
        <View style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, overflow: "hidden" }}>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
            <View style={{ minWidth: COLUMN_WIDTHS.name + COLUMN_WIDTHS.studentNumber + COLUMN_WIDTHS.major, flexGrow: 1 }}>
              <View style={{ flexDirection: "row", backgroundColor: COLORS.surfaceAlt }}>
                <Cell width={COLUMN_WIDTHS.name} strong>이름</Cell>
                <Cell width={COLUMN_WIDTHS.studentNumber} strong>학번</Cell>
                <Cell width={COLUMN_WIDTHS.major} strong>전공</Cell>
              </View>
              {members.map((member) => <RosterRow key={member.id} item={member} />)}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {(pagination?.total_pages ?? 0) > 1 ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <DuesAdminButton label="이전" tone="outline" disabled={page <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))} />
          <Text style={{ color: COLORS.text, fontWeight: "600" }}>{page} / {pagination?.total_pages}</Text>
          <DuesAdminButton label="다음" tone="outline" disabled={page >= (pagination?.total_pages ?? 1)} onPress={() => setPage((value) => value + 1)} />
        </View>
      ) : null}
    </View>
  );
}

const webStyles = StyleSheet.create({
  text: { color: "#15171C", fontSize: 13, lineHeight: 20 },
  muted: { color: "#6B7280", fontSize: 12, lineHeight: 20 },
  sectionTitle: { color: "#15171C", fontSize: 15, fontWeight: "600" },
  toolbar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 },
  searchRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, maxWidth: "100%" },
  search: { width: 360, maxWidth: "100%", minHeight: 42, borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 6, paddingHorizontal: 14, color: "#15171C", fontSize: 13 },
  button: { minHeight: 42, paddingHorizontal: 14, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 6, backgroundColor: "#FFFFFF" },
  primaryButton: { backgroundColor: "#2761FF", borderColor: "#2761FF" },
  importGuide: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E1E4E9", paddingVertical: 16, gap: 6 },
  guideTitle: { color: "#15171C", fontSize: 12, fontWeight: "600" },
  summary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  pagination: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 14 },
});
