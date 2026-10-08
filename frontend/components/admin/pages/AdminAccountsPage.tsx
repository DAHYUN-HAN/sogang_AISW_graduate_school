import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../../AppTypography";
import { adminApi } from "../../../services/api";
import { formatBoardDateTime } from "../../../utils/dateFormat";
import { formatCohortName } from "../../../utils/userLabel";
import AdminTable from "../AdminTable";
import { memberPageAfterRefresh } from "../../../utils/adminMemberEditing";
import AdminColumns from "../AdminColumns";
import { ActionButton, COLORS, Field, Panel, UserCard } from "../AdminControls";
import { useAdminWorkspace } from "../AdminWorkspace";

const ENROLLMENT = { active: "재학", leave: "휴학", graduated: "졸업" };
const FILTERS = [["all", "전체"], ["active", "활성"], ["inactive", "비활성"]] as const;

export default function AdminAccountsPage() {
  return Platform.OS === "web" ? <AccountsWebPage /> : <AccountsNativePage />;
}

function AccountsWebPage() {
  const { setMemberEditing } = useAdminWorkspace();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin-users", "members", appliedSearch, filter, page],
    queryFn: () => adminApi.getUsers({ q: appliedSearch || undefined, is_active: filter === "all" ? undefined : filter === "active", page, size: 20 }),
  });
  const members = query.data?.data ?? [];
  const pagination = query.data?.pagination;
  useEffect(() => {
    if (query.isSuccess) setPage(previous => memberPageAfterRefresh(previous, pagination?.total_pages));
  }, [query.isSuccess, pagination?.total_pages]);
  const apply = () => { setAppliedSearch(search.trim()); setPage(1); };

  return <View style={{ gap: 24 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <TextInput accessibilityLabel="회원 검색" placeholder="이름, 이메일, 기수 검색" value={search} onChangeText={setSearch} onSubmitEditing={apply} returnKeyType="search" style={styles.search} />
      <Pressable accessibilityRole="button" onPress={apply} style={[styles.button, styles.primary]}><Text style={styles.primaryText}>검색</Text></Pressable>
      {(search || appliedSearch) ? <Pressable accessibilityRole="button" onPress={() => { setSearch(""); setAppliedSearch(""); setPage(1); }} style={styles.button}><Text style={styles.text}>초기화</Text></Pressable> : null}
    </View>
    <View style={styles.tabs}>{FILTERS.map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => { setFilter(value); setPage(1); }} style={[styles.tab, filter === value && styles.selectedTab]}><Text style={{ color: filter === value ? "#2761FF" : "#6B7280", fontSize: 13, fontWeight: filter === value ? "600" : "400" }}>{label}</Text></Pressable>)}</View>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={styles.sectionTitle}>회원 목록 <Text style={styles.muted}>{pagination ? `${pagination.total}명` : ""}</Text></Text><Text style={styles.muted}>20명씩 표시</Text></View>
    {query.isLoading ? <ActivityIndicator color="#2761FF" /> : query.isError ? <View style={styles.empty}><Text style={styles.muted}>회원 목록을 불러오지 못했습니다.</Text><Pressable accessibilityRole="button" onPress={() => void query.refetch()} style={styles.button}><Text style={styles.text}>다시 시도</Text></Pressable></View> : members.length === 0 ? <View style={styles.empty}><Text style={styles.muted}>{appliedSearch ? "검색 결과가 없습니다." : "표시할 회원이 없습니다."}</Text></View> : <AdminTable minimumWidth={850} columns={[
      { label: "회원", flex: 2.1 }, { label: "기수 · 전공", flex: 1.4 }, { label: "재학 상태", width: 70 }, { label: "계정 상태", width: 72 }, { label: "가입 · 최근 접속", flex: 1.2 }, { label: "관리", width: 96 },
    ]} rows={members.map((item) => ({ key: item.id, cells: [
      <View key="member" style={{ gap: 6 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Text style={{ ...styles.text, fontWeight: "600" }}>{item.nickname}</Text>{item.role === "admin" && <Text style={styles.adminBadge}>관리자</Text>}</View><Text style={styles.muted}>{item.email}</Text></View>,
      <View key="cohort" style={{ gap: 6 }}><Text style={styles.text}>{formatCohortName(item.cohort) || "—"}</Text><Text style={styles.muted}>{item.major || "—"}</Text></View>,
      <Text key="enrollment" style={styles.text}>{ENROLLMENT[item.enrollment_status]}</Text>,
      <Text key="state" style={[styles.badge, { color: item.is_active ? "#168A72" : "#6B7280", backgroundColor: item.is_active ? "#EDF8F4" : "#F3F4F6" }]}>{item.is_active ? "활성" : "비활성"}</Text>,
      <View key="dates" style={{ gap: 6 }}><Text style={styles.muted}>{formatBoardDateTime(item.created_at)}</Text><Text style={styles.muted}>{item.last_login_at ? formatBoardDateTime(item.last_login_at) : "접속 기록 없음"}</Text></View>,
      <Pressable key="edit" accessibilityRole="button" accessibilityLabel={`${item.nickname} 회원정보 수정`} onPress={() => setMemberEditing(item)} style={styles.button}><Text style={styles.text}>정보 수정</Text></Pressable>,
    ] }))} />}
    {pagination && pagination.total_pages > 1 && <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 14 }}><Pressable accessibilityRole="button" disabled={page <= 1} onPress={() => setPage(page - 1)} style={[styles.button, page <= 1 && { opacity: 0.4 }]}><Text style={styles.text}>이전</Text></Pressable><Text style={styles.muted}>{page} / {pagination.total_pages}</Text><Pressable accessibilityRole="button" disabled={page >= pagination.total_pages} onPress={() => setPage(page + 1)} style={[styles.button, page >= pagination.total_pages && { opacity: 0.4 }]}><Text style={styles.text}>다음</Text></Pressable></View>}
  </View>;
}

function AccountsNativePage() {
  const { handleUserActiveToggle, handleUserEligibilityChange, handleUserRoleToggle, setAppliedUserSearch, setUserSearch, userSearch, users, usersQuery } = useAdminWorkspace();
  return <View style={{ gap: 12 }}>
    <Panel><View style={{ gap: 10 }}><Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>계정 컨트롤</Text><Text style={{ color: COLORS.muted, lineHeight: 20 }}>`sogang.ac.kr` 메일 인증을 완료한 계정의 권한과 활성 상태를 관리합니다.</Text><Field value={userSearch} onChangeText={setUserSearch} placeholder="이메일, 닉네임, 기수 검색" /><ActionButton icon="search-outline" label="검색" onPress={() => setAppliedUserSearch(userSearch)} /></View></Panel>
    {usersQuery.isError && <Panel><Text style={{ color: COLORS.error }}>목록을 불러오지 못했습니다.</Text><ActionButton label="다시 시도" onPress={() => void usersQuery.refetch()} /></Panel>}
    {usersQuery.isLoading && <ActivityIndicator />}
    {!usersQuery.isLoading && users.length === 0 && <Panel><Text style={{ color: COLORS.muted }}>표시할 회원이 없습니다.</Text></Panel>}
    <AdminColumns>{users.map(member => <UserCard key={member.id} item={member} onRoleToggle={handleUserRoleToggle} onActiveToggle={handleUserActiveToggle} onEligibilityChange={handleUserEligibilityChange} />)}</AdminColumns>
  </View>;
}

const styles = StyleSheet.create({
  text: { color: "#15171C", fontSize: 13, lineHeight: 20 }, muted: { color: "#6B7280", fontSize: 12, lineHeight: 18 },
  sectionTitle: { color: "#15171C", fontSize: 15, fontWeight: "600" },
  search: { width: 400, maxWidth: "100%", minHeight: 42, borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 6, paddingHorizontal: 14, color: "#15171C", fontSize: 13 },
  button: { minHeight: 36, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 6, alignSelf: "flex-start", backgroundColor: "#FFFFFF" },
  primary: { backgroundColor: "#2761FF", borderColor: "#2761FF", minHeight: 42 }, primaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#E1E4E9", gap: 4 }, tab: { paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: "transparent" }, selectedTab: { borderBottomColor: "#2761FF" },
  badge: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: "flex-start" },
  adminBadge: { color: "#6B7280", fontSize: 10, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, backgroundColor: "#F3F4F6" },
  empty: { paddingVertical: 60, alignItems: "center", gap: 16 },
});
