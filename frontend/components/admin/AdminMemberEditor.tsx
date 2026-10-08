import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../AppTypography";
import { adminApi, registrationApi } from "../../services/api";
import { useUserStore } from "../../stores/userStore";
import { setWriteLeaveGuard } from "../../stores/writeLeaveGuard";
import type { AdminUserItem } from "../../types";
import { useAdminAlert } from "../../utils/adminAlert";
import { adminMemberPasswordError, memberDraft, memberUpdatePayload, type MemberDraft } from "../../utils/adminMemberEditing";
import { apiErrorStatus } from "../../utils/authValidation";
import { clearStoredPushToken } from "../../utils/pushTokenStorage";
import { formatBoardDateTime } from "../../utils/dateFormat";
import { appFontStyle } from "../../utils/fonts";
import { useAdminWorkspace } from "./AdminWorkspace";

export default function AdminMemberEditor({ item, onClose }: { item: AdminUserItem; onClose: () => void }) {
  const adminAlert = useAdminAlert();
  const client = useQueryClient();
  const router = useRouter();
  const { setMemberSavePending } = useAdminWorkspace();
  const currentUserId = useUserStore(state => state.userId);
  const [baseline, setBaseline] = useState(item);
  const [draft, setDraft] = useState(() => memberDraft(item));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [notice, setNotice] = useState("");
  const [passwordExpanded, setPasswordExpanded] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<{ success: boolean; text: string } | null>(null);
  const passwordConfirming = useRef(false);
  const [leaveConfirmed, setLeaveConfirmed] = useState(false);
  const navigation = useNavigation();
  const pendingLeave = useRef<(() => void) | null>(null);
  const majors = useQuery({ queryKey: ["admin-registration-majors"], queryFn: registrationApi.getAdminMajors });
  const activeMajors = majors.data?.data.filter(option => option.is_active) ?? [];
  const profileDirty = Object.keys(memberUpdatePayload(baseline, draft)).length > 0;
  const dirty = profileDirty || Boolean(newPassword || confirmation);
  const discard = useCallback((proceed: () => void) => {
    if (savingRef.current || passwordConfirming.current) return;
    adminAlert.alert("회원정보 수정", "저장하지 않은 변경사항을 닫을까요?", [
      { text: "계속 편집", style: "cancel" },
      { text: "변경사항 버리기", style: "destructive", onPress: () => {
        if (savingRef.current) return;
        setWriteLeaveGuard(null);
        pendingLeave.current = () => { onClose(); proceed(); };
        setLeaveConfirmed(true);
      } },
    ]);
  }, [onClose, adminAlert]);
  const close = useCallback(() => { if (savingRef.current) return; if (dirty) discard(onClose); else onClose(); }, [dirty, discard, onClose]);
  usePreventRemove(!leaveConfirmed && (dirty || saving), ({ data }) => {
    if (savingRef.current) return;
    discard(() => navigation.dispatch(data.action));
  });
  useEffect(() => {
    if (!leaveConfirmed || !pendingLeave.current) return;
    const proceed = pendingLeave.current;
    pendingLeave.current = null;
    proceed();
  }, [leaveConfirmed]);
  useEffect(() => {
    setMemberSavePending(saving);
    return () => setMemberSavePending(false);
  }, [saving, setMemberSavePending]);
  useEffect(() => {
    if (!dirty && !saving) return;
    setWriteLeaveGuard(discard);
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    if (Platform.OS === "web") window.addEventListener("beforeunload", beforeUnload);
    return () => { setWriteLeaveGuard(null); if (Platform.OS === "web") window.removeEventListener("beforeunload", beforeUnload); };
  }, [dirty, saving, discard]);

  const change = <K extends keyof MemberDraft>(key: K, value: MemberDraft[K]) => { setDraft(prev => ({ ...prev, [key]: value })); setNotice(""); };
  const save = async () => {
    if (savingRef.current || !profileDirty) return;
    const payload = memberUpdatePayload(baseline, draft);
    if (!draft.nickname.trim()) { setNotice("이름을 입력해 주세요."); return; }
    if ("major" in payload && !activeMajors.some(option => option.name === payload.major)) { setNotice("운영 중인 전공을 선택해 주세요."); return; }
    savingRef.current = true; setSaving(true); setNotice("");
    try {
      await adminApi.updateUser(item.id, payload);
      const updated = { ...baseline, ...payload };
      setBaseline(updated); setDraft(memberDraft(updated)); setNotice("저장했습니다.");
      const session = useUserStore.getState();
      if (session.user?.id === item.id && session.accessToken && session.refreshToken) {
        session.setSession({ access_token: session.accessToken, refresh_token: session.refreshToken, user: { ...session.user, nickname: updated.nickname, cohort: updated.cohort ?? undefined } }, { preserveSession: true });
      }
      await Promise.all(["admin-users", "admin-audit-logs", "admin-main", "admin-stats", "me"].map(key => client.invalidateQueries({ queryKey: [key] })));
    } catch { setNotice("저장하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요."); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const resetPassword = async (password: string) => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setPasswordSaving(true); setPasswordNotice(null);
    try {
      await adminApi.resetUserPassword(item.id, { new_password: password });
      setNewPassword(""); setConfirmation("");
      setPasswordNotice({ success: true, text: "비밀번호를 변경했습니다. 기존 로그인 갱신도 차단했습니다." });
      if (useUserStore.getState().userId === item.id) {
        await clearStoredPushToken().catch(() => undefined);
        setWriteLeaveGuard(null);
        pendingLeave.current = () => {
          onClose();
          if (useUserStore.getState().userId === item.id) {
            useUserStore.getState().clearSession();
            router.replace("/auth/login");
          }
        };
        setLeaveConfirmed(true);
      } else {
        await Promise.all(["admin-users", "admin-audit-logs", "admin-main"].map(key => client.invalidateQueries({ queryKey: [key] })));
      }
    } catch (error) {
      const text = apiErrorStatus(error) === 429 ? "변경 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." : "비밀번호를 변경하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.";
      setPasswordNotice({ success: false, text });
    } finally {
      passwordConfirming.current = false;
      savingRef.current = false; setSaving(false); setPasswordSaving(false);
    }
  };
  const confirmPasswordReset = () => {
    if (savingRef.current || passwordConfirming.current) return;
    const error = adminMemberPasswordError(newPassword, confirmation);
    if (error) { setPasswordNotice({ success: false, text: error }); return; }
    if (currentUserId === item.id && profileDirty) {
      setPasswordNotice({ success: false, text: "회원정보 변경을 먼저 저장한 후 비밀번호를 변경해 주세요." }); return;
    }
    passwordConfirming.current = true;
    adminAlert.alert("비밀번호 재설정", `${baseline.nickname} (${item.email})님의 비밀번호를 변경할까요? 기존 로그인 갱신과 이전 재설정 코드는 차단됩니다.${currentUserId === item.id ? " 본인 계정이므로 변경 후 다시 로그인해야 합니다." : ""}`, [
      { text: "취소", style: "cancel", onPress: () => { passwordConfirming.current = false; } },
      { text: "비밀번호 변경", onPress: () => { void resetPassword(newPassword); } },
    ]);
  };
  const field = (key: "nickname" | "cohort" | "phone", label: string, maxLength: number) => <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={draft[key]} onChangeText={value => change(key, value)} maxLength={maxLength} editable={!saving} style={styles.input} /></View>;

  return <Modal visible transparent animationType="none" onRequestClose={close}>
    <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end", backgroundColor: "rgba(21,23,28,0.18)" }}>
      <Pressable accessibilityLabel="회원정보 수정창 닫기" onPress={close} style={{ flex: 1 }} />
      <View accessibilityViewIsModal style={{ width: 520, maxWidth: "100%", backgroundColor: "#FFFFFF", borderLeftWidth: 1, borderColor: "#E1E4E9" }}>
        <View style={styles.header}><Text style={{ fontSize: 18, color: "#15171C", fontWeight: "600" }}>회원정보 수정</Text><Pressable accessibilityRole="button" accessibilityLabel="회원정보 수정창 닫기" disabled={saving} onPress={close} style={{ padding: 8 }}><Text style={{ color: "#6B7280", fontSize: 18 }}>✕</Text></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 24 }}>
          <View style={{ gap: 6 }}><Text style={{ color: "#15171C", fontSize: 20, fontWeight: "600" }}>{baseline.nickname}</Text><Text style={styles.muted}>가입 {formatBoardDateTime(item.created_at)}</Text></View>
          <View style={{ gap: 16 }}>
            <Text style={styles.sectionTitle}>기본 정보</Text>
            <View style={styles.field}><Text style={styles.label}>이메일</Text><TextInput accessibilityLabel="이메일 (읽기 전용)" editable={false} value={item.email} style={[styles.input, { backgroundColor: "#F7F8FA", color: "#6B7280" }]} /></View>
            <View style={styles.row}>{field("nickname", "이름", 50)}{field("cohort", "기수", 20)}</View>
            <View style={{ gap: 7 }}><Text style={styles.label}>전공</Text>{Platform.OS === "web" ? createElement("select", { "aria-label": "전공", value: draft.major, disabled: saving || majors.isLoading || majors.isError, onChange: (event: { target: { value: string } }) => change("major", event.target.value), style: { width: "100%", height: 42, border: "1px solid #E1E4E9", borderRadius: 6, padding: "0 10px", background: "#FFFFFF", color: "#15171C", fontSize: 13, ...appFontStyle() } }, [!activeMajors.some(option => option.name === draft.major) && createElement("option", { key: "current", value: draft.major }, draft.major || "전공 선택"), ...activeMajors.map(option => createElement("option", { key: option.id, value: option.name }, option.name))]) : <Text style={styles.text}>{draft.major || "—"}</Text>}
              {majors.isError && <Pressable accessibilityRole="button" onPress={() => void majors.refetch()}><Text style={{ ...styles.muted, color: "#D92D52" }}>전공 목록 다시 불러오기</Text></Pressable>}
              {majors.isSuccess && activeMajors.length === 0 && <Text style={styles.muted}>선택 가능한 전공이 없습니다. 가입 설정에서 전공을 등록해 주세요.</Text>}
            </View>
            {field("phone", "연락처", 20)}
          </View>
          <View style={styles.section}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Text style={styles.sectionTitle}>비밀번호 관리</Text>
              {!passwordExpanded && <Pressable accessibilityRole="button" disabled={saving} onPress={() => setPasswordExpanded(true)} style={styles.button}><Text style={styles.text}>비밀번호 재설정</Text></Pressable>}
            </View>
            {passwordExpanded ? <View style={{ gap: 14 }}>
              <Text style={styles.muted}>새 비밀번호를 지정하면 기존 로그인 갱신이 차단됩니다.{currentUserId === item.id ? " 본인 계정은 변경 후 다시 로그인합니다." : ""}</Text>
              <View style={styles.field}><Text style={styles.label}>새 비밀번호</Text><TextInput accessibilityLabel="새 비밀번호" value={newPassword} onChangeText={value => { setNewPassword(value); setPasswordNotice(null); }} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" maxLength={1024} editable={!saving} style={styles.input} /></View>
              <View style={styles.field}><Text style={styles.label}>새 비밀번호 확인</Text><TextInput accessibilityLabel="새 비밀번호 확인" value={confirmation} onChangeText={value => { setConfirmation(value); setPasswordNotice(null); }} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" maxLength={1024} editable={!saving} style={styles.input} /></View>
              <Text style={styles.muted}>영문 · 숫자 · 특수문자를 포함해 8자 이상 입력해 주세요.</Text>
              {passwordNotice && <Text accessibilityLiveRegion="polite" style={{ fontSize: 13, lineHeight: 20, color: passwordNotice.success ? "#168A72" : "#D92D52" }}>{passwordNotice.text}</Text>}
              <Pressable accessibilityRole="button" disabled={saving} accessibilityState={{ disabled: saving }} onPress={confirmPasswordReset} style={[styles.button, { alignSelf: "flex-start", borderColor: "#2761FF", opacity: saving ? 0.5 : 1 }]}>{passwordSaving ? <ActivityIndicator color="#2761FF" /> : <Text style={{ color: "#2761FF", fontSize: 13, fontWeight: "600" }}>비밀번호 변경</Text>}</Pressable>
            </View> : <Text style={styles.muted}>회원의 비밀번호를 새로 지정할 수 있습니다.</Text>}
          </View>
          <View style={styles.section}><Text style={styles.sectionTitle}>회원 상태</Text><Text style={styles.label}>재학 상태</Text><View style={styles.row}>{([["active", "재학"], ["leave", "휴학"], ["graduated", "졸업"]] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: draft.enrollment_status === value }} disabled={saving} onPress={() => change("enrollment_status", value)} style={[styles.choice, draft.enrollment_status === value && styles.selected]}><Text style={{ color: draft.enrollment_status === value ? "#2761FF" : "#6B7280", fontSize: 13 }}>{label}</Text></Pressable>)}</View><Text style={styles.label}>계정 상태</Text><View style={styles.row}>{([[true, "활성"], [false, "비활성"]] as const).map(([value, label]) => <Pressable key={label} accessibilityRole="button" disabled={saving || (!value && currentUserId === item.id)} accessibilityState={{ selected: draft.is_active === value, disabled: saving || (!value && currentUserId === item.id) }} onPress={() => change("is_active", value)} style={[styles.choice, draft.is_active === value && styles.selected, !value && currentUserId === item.id && { opacity: 0.4 }]}><Text style={{ color: draft.is_active === value ? "#2761FF" : "#6B7280", fontSize: 13 }}>{label}</Text></Pressable>)}</View></View>
          <View style={styles.section}><Text style={styles.sectionTitle}>개인정보 동의 기록</Text><Text style={styles.muted}>{item.privacy_policy_version && item.privacy_consented_at ? `v${item.privacy_policy_version} · ${formatBoardDateTime(item.privacy_consented_at)}` : "동의 기록 없음 (기존 계정)"}</Text><Text style={styles.muted}>최근 접속 {item.last_login_at ? formatBoardDateTime(item.last_login_at) : "기록 없음"}</Text></View>
        </ScrollView>
        <View style={{ padding: 24, gap: 12, borderTopWidth: 1, borderColor: "#E1E4E9" }}>
          {!!notice && <Text accessibilityLiveRegion="polite" style={{ fontSize: 13, color: notice === "저장했습니다." ? "#168A72" : "#D92D52" }}>{notice}</Text>}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}><Pressable accessibilityRole="button" disabled={saving} onPress={close} style={styles.button}><Text style={styles.text}>닫기</Text></Pressable><Pressable accessibilityRole="button" disabled={saving || !profileDirty} accessibilityState={{ disabled: saving || !profileDirty }} onPress={() => void save()} style={[styles.button, { backgroundColor: "#2761FF", borderColor: "#2761FF", opacity: saving || !profileDirty ? 0.5 : 1 }]}>{saving && !passwordSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "600" }}>변경사항 저장</Text>}</Pressable></View>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  text: { color: "#15171C", fontSize: 13 }, muted: { color: "#6B7280", fontSize: 12, lineHeight: 20 }, label: { color: "#6B7280", fontSize: 13 }, sectionTitle: { color: "#15171C", fontWeight: "600", fontSize: 15 },
  header: { padding: 24, borderBottomWidth: 1, borderColor: "#E1E4E9", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  field: { flex: 1, gap: 7 }, input: { minHeight: 42, borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 6, paddingHorizontal: 12, fontSize: 13, color: "#15171C" },
  row: { flexDirection: "row", gap: 10 }, section: { borderTopWidth: 1, borderColor: "#E1E4E9", paddingTop: 20, gap: 16 },
  button: { minHeight: 40, borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 6, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  choice: { minHeight: 36, borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 6, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" }, selected: { borderColor: "#2761FF", backgroundColor: "#EDF2FE" },
});
