import { Slot } from "expo-router";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { AppText as Text } from "../../components/AppTypography";
import BackButton from "../../components/BackButton";
import AdminWebShell from "../../components/admin/AdminWebShell";
import AdminPostDeleteConfirm from "../../components/admin/AdminPostDeleteConfirm";
import AdminSaveSuccessModal from "../../components/admin/AdminSaveSuccessModal";
import { AdminWorkspaceProvider, useAdminWorkspace } from "../../components/admin/AdminWorkspace";
import { ADMIN_PAGES } from "../../utils/adminNavigation";
import AdminAlertHost from "../../components/admin/AdminAlertHost";
import AdminMemberEditor from "../../components/admin/AdminMemberEditor";
import { requestWriteLeave } from "../../stores/writeLeaveGuard";

function AdminLayoutBody() {
  const state = useAdminWorkspace();
  if (!state.isAdmin) return <View style={{ padding: 24 }}><Text>관리자 권한이 필요합니다.</Text></View>;
  const navigate = (key: typeof state.section) => { const proceed = () => state.openAdminSection(key); if (!requestWriteLeave(proceed)) proceed(); };
  return <AdminWebShell active={state.section} items={[...ADMIN_PAGES]} nickname={state.user?.nickname} locked={state.managedNavigationLocked} onExitMember={state.openMemberScreen} onNavigate={(key) => navigate(key as typeof state.section)}>
    {Platform.OS !== "web" && <View style={{ padding: 16, gap: 12 }}><BackButton fallback="/(tabs)/settings" /><Text style={{ fontSize: 24, fontWeight: "700" }}>관리자 페이지</Text><ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{ADMIN_PAGES.filter((page) => page.key !== "main").map((page) => <Pressable key={page.key} accessibilityRole="button" disabled={state.managedNavigationLocked} onPress={() => state.openAdminSection(page.key)} style={{ padding: 12, borderRadius: 8, backgroundColor: state.section === page.key ? "#EDF2FE" : "#FFFFFF" }}><Text>{page.label}</Text></Pressable>)}</ScrollView></View>}
    <Slot />
    {Platform.OS === "web" && state.memberEditing && <AdminMemberEditor key={state.memberEditing.id} item={state.memberEditing} onClose={() => state.setMemberEditing(null)} />}
    <AdminAlertHost />
    <AdminPostDeleteConfirm visible={state.pendingAdminPostDelete !== null} deleting={state.adminPostDeleting} error={state.adminPostDeleteError} onCancel={state.closeAdminPostDeleteConfirm} onConfirm={() => void state.confirmAdminPostDelete()} />
    <AdminSaveSuccessModal visible={state.saveSuccessFeedback !== null} title={state.saveSuccessFeedback?.title ?? ""} message={state.saveSuccessFeedback?.message ?? ""} onConfirm={() => state.setSaveSuccessFeedback(null)} />
  </AdminWebShell>;
}

export default function AdminLayout() {
  return <AdminWorkspaceProvider><AdminLayoutBody /></AdminWorkspaceProvider>;
}
