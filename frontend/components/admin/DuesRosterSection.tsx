import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View } from "react-native";

import { duesPayerApi } from "../../services/api";
import type { AdminRosterItem } from "../../types";
import { formatRosterImportSummary } from "../../utils/duesPayers";
import {
  DUES_ADMIN_COLORS as COLORS,
  DuesAdminButton,
  duesApiErrorMessage,
  pickDuesWorkbook,
} from "./DuesAdminPrimitives";


const COLUMN_WIDTHS = { name: 150, studentNumber: 170, major: 260 };

function Cell({ width, children, strong = false }: { width: number; children: string; strong?: boolean }) {
  return (
    <Text
      numberOfLines={1}
      style={{
        width,
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

export default function DuesRosterSection() {
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

  return (
    <View style={{ gap: 12 }}>
      <View style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 16, gap: 12 }}>
        <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "900" }}>원우 명부</Text>
        <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
          학교를 거쳐간 원우를 계속 누적합니다. 같은 학번은 이름과 전공을 덮어쓰고, 새 학번은 추가합니다.
        </Text>
        <View style={{ borderRadius: 6, backgroundColor: COLORS.primary50, padding: 12, gap: 4 }}>
          <Text style={{ color: COLORS.primary900, fontWeight: "900" }}>엑셀 형식</Text>
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
        <Text style={{ color: COLORS.text, fontWeight: "900" }}>명부 검색</Text>
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
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ minWidth: COLUMN_WIDTHS.name + COLUMN_WIDTHS.studentNumber + COLUMN_WIDTHS.major }}>
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
          <Text style={{ color: COLORS.text, fontWeight: "800" }}>{page} / {pagination?.total_pages}</Text>
          <DuesAdminButton label="다음" tone="outline" disabled={page >= (pagination?.total_pages ?? 1)} onPress={() => setPage((value) => value + 1)} />
        </View>
      ) : null}
    </View>
  );
}
