import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../../../components/AppTypography";
import { FIELD_ERROR_COLOR, FieldInput } from "../../../../components/FieldBorder";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import NoticeModal from "../../../../components/NoticeModal";
import Toast from "../../../../components/Toast";
import { useToast } from "../../../../hooks/useToast";
import { userApi } from "../../../../services/api";
import { useUserStore } from "../../../../stores/userStore";
import { apiErrorCode, apiErrorStatus, passwordError } from "../../../../utils/authValidation";
import { clearStoredPushToken } from "../../../../utils/pushTokenStorage";
import { TOAST_ERROR_MESSAGES } from "../../../../utils/toast";

import { BackIcon } from "../../../../components/icons";
import { BUTTON_TEXT } from "../../../../utils/buttonText";
const COLORS = {
  primary: "#2761FF",
  text: "#15171C",
  label: "#6B7280",
  placeholder: "#A6ACB7",
  bg: "#FFFFFF",
  danger: FIELD_ERROR_COLOR,
  disabled: "#D1D5DB",
};

function ErrorRow({ message }: { message: string }) {
  return (
    <View style={styles.errorRow}>
      <Ionicons name="alert-circle-outline" size={14} color={COLORS.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export default function PasswordChangeScreen() {
  const insets = useSafeAreaInsets();
  const { toast, showToast, hideToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [newError, setNewError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const clearSession = useUserStore((state) => state.clearSession);

  // 서버가 저장된 로그인 세션을 이미 끝냈다. 안내를 닫으면 이 기기에서도 로그아웃하고 로그인 화면으로 간다.
  const goToLogin = async () => {
    setPasswordChanged(false);
    await clearStoredPushToken().catch(() => undefined);
    clearSession();
    router.replace("/auth/login");
  };

  // Figma PasswordChange-Error: 오류가 떠 있으면 버튼을 끈다. 오류 칸은 고쳐 입력하는 순간
  // 풀리므로, 빨간 칸이 모두 사라지고 세 칸이 다 차 있으면 다시 켜진다.
  const hasFieldError = Boolean(currentError || newError || confirmError);
  const canSubmit = Boolean(currentPassword && newPassword && confirmPassword) && !hasFieldError && !isSubmitting;

  const changePassword = async () => {
    setCurrentError(null);
    setNewError(null);
    setConfirmError(null);

    // 클라이언트 검증(새 비밀번호 형식/확인 일치)과 현재 비밀번호 서버 검증을 함께 수행해
    // 각 항목의 에러가 동시에 표시되도록 한다.
    let newMessage: string | null = null;
    if (passwordError(newPassword)) {
      newMessage = passwordError(newPassword);
    } else if (currentPassword === newPassword) {
      newMessage = "현재 비밀번호와 다른 비밀번호를 입력해주세요.";
    }
    const confirmMessage = newPassword !== confirmPassword ? "새 비밀번호가 일치하지 않아요." : null;

    setIsSubmitting(true);
    try {
      const { data: verify } = await userApi.verifyPassword({ current_password: currentPassword });
      const currentMessage = verify.valid ? null : "현재 비밀번호가 일치하지 않아요.";

      setCurrentError(currentMessage);
      setNewError(newMessage);
      setConfirmError(confirmMessage);
      if (currentMessage || newMessage || confirmMessage) return;

      await userApi.updatePassword({ current_password: currentPassword, new_password: newPassword });
      setPasswordChanged(true);
    } catch (error) {
      if (apiErrorCode(error) === "FORBIDDEN" || apiErrorStatus(error) === 403) {
        setCurrentError("현재 비밀번호가 일치하지 않아요.");
      } else {
        showToast(TOAST_ERROR_MESSAGES.passwordChange);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable
          accessibilityLabel="뒤로"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/settings/account");
          }}
          style={styles.iconButton}
        >
          <BackIcon size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.appBarTitle}>비밀번호 변경</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView style={styles.scroller} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>현재 비밀번호</Text>
          <FieldInput
            hasError={Boolean(currentError)}
            onChangeText={(value) => {
              setCurrentPassword(value);
              if (currentError) setCurrentError(null);
            }}
            placeholder="현재 비밀번호를 입력하세요"
            placeholderTextColor={COLORS.placeholder}
            secureTextEntry
            style={styles.input}
            value={currentPassword}
          />
          {currentError ? <ErrorRow message={currentError} /> : null}
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>새 비밀번호</Text>
          <FieldInput
            hasError={Boolean(newError)}
            onChangeText={(value) => {
              setNewPassword(value);
              if (newError) setNewError(null);
            }}
            placeholder="영문, 숫자, 특수문자 포함 8자 이상"
            placeholderTextColor={COLORS.placeholder}
            secureTextEntry
            style={styles.input}
            value={newPassword}
          />
          {newError ? <ErrorRow message={newError} /> : null}
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>새 비밀번호 확인</Text>
          <FieldInput
            hasError={Boolean(confirmError)}
            onChangeText={(value) => {
              setConfirmPassword(value);
              if (confirmError) setConfirmError(null);
            }}
            placeholder="새 비밀번호를 다시 입력하세요"
            placeholderTextColor={COLORS.placeholder}
            secureTextEntry
            style={styles.input}
            value={confirmPassword}
          />
          {confirmError ? <ErrorRow message={confirmError} /> : null}
        </View>

        <Pressable disabled={!canSubmit} onPress={changePassword} style={[styles.primaryButton, canSubmit ? null : styles.primaryButtonDisabled]}>
          <Text style={styles.primaryButtonText}>{isSubmitting ? "변경 중" : "변경 완료"}</Text>
        </Pressable>
      </ScrollView>
      <Toast toast={toast} onHide={hideToast} />
      {/* Figma Screen/MyPage/PasswordChanged-ReloginModal */}
      <NoticeModal
        notice={passwordChanged ? { title: "비밀번호를 변경했어요", body: "보안을 위해 다시 로그인해주세요." } : null}
        onClose={() => void goToLogin()}
        primary
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  appBar: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  appBarTitle: { color: COLORS.text, fontSize: 17, fontWeight: "500" },
  scroller: { flex: 1 },
  content: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 24, gap: 20 },
  fieldGroup: { gap: 8 },
  label: { color: COLORS.text, fontSize: 13, fontWeight: "400", lineHeight: 16 }, // Figma: 13/16 #15171C
  input: {
    minHeight: 41,
    // 테두리는 FieldBorder 공통 원칙을 따른다.
    borderRadius: 8,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  // 다른 오류 칸과 같이 배경 없이 빨간 테두리만 둔다. (피그마 PasswordChange-Error는 아직 분홍 배경)
  errorRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  errorText: { color: COLORS.danger, fontSize: 12, fontWeight: "400", lineHeight: 15 },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
  },
  primaryButtonDisabled: { backgroundColor: COLORS.disabled },
  primaryButtonText: { ...BUTTON_TEXT, color: "#FFFFFF", fontWeight: "500" },
});
