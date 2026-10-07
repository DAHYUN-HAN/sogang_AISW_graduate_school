import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../../../../components/AppTypography";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { userApi } from "../../../../services/api";
import { useUserStore } from "../../../../stores/userStore";
import { apiErrorCode, apiErrorStatus, passwordError } from "../../../../utils/authValidation";
import { clearStoredPushToken } from "../../../../utils/pushTokenStorage";

import { BackIcon } from "../../../../components/icons";
const COLORS = {
  primary: "#2761FF",
  text: "#15171C",
  label: "#6B7280",
  placeholder: "#A6ACB7",
  border: "#E1E4E9",
  bg: "#FFFFFF",
  danger: "#D64545",
  dangerBg: "#FFF5F5",
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [newError, setNewError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const clearSession = useUserStore((state) => state.clearSession);

  const canSubmit = Boolean(currentPassword && newPassword && confirmPassword) && !isSubmitting;

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
      await clearStoredPushToken().catch(() => undefined);
      clearSession();
      Alert.alert("비밀번호 변경 완료", "보안을 위해 저장된 로그인 세션을 종료했습니다. 새 비밀번호로 다시 로그인해주세요.");
      router.replace("/auth/login");
    } catch (error) {
      if (apiErrorCode(error) === "FORBIDDEN" || apiErrorStatus(error) === 403) {
        setCurrentError("현재 비밀번호가 일치하지 않아요.");
      } else {
        Alert.alert("비밀번호 변경 실패", "비밀번호를 변경하지 못했어요. 잠시 후 다시 시도해주세요.");
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
          <TextInput
            onChangeText={(value) => {
              setCurrentPassword(value);
              if (currentError) setCurrentError(null);
            }}
            placeholder="현재 비밀번호를 입력하세요"
            placeholderTextColor={COLORS.placeholder}
            secureTextEntry
            style={[styles.input, currentError ? styles.inputError : null]}
            value={currentPassword}
          />
          {currentError ? <ErrorRow message={currentError} /> : null}
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>새 비밀번호</Text>
          <TextInput
            onChangeText={(value) => {
              setNewPassword(value);
              if (newError) setNewError(null);
            }}
            placeholder="영문, 숫자, 특수문자 포함 8자 이상"
            placeholderTextColor={COLORS.placeholder}
            secureTextEntry
            style={[styles.input, newError ? styles.inputError : null]}
            value={newPassword}
          />
          {newError ? <ErrorRow message={newError} /> : null}
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>새 비밀번호 확인</Text>
          <TextInput
            onChangeText={(value) => {
              setConfirmPassword(value);
              if (confirmError) setConfirmError(null);
            }}
            placeholder="새 비밀번호를 다시 입력하세요"
            placeholderTextColor={COLORS.placeholder}
            secureTextEntry
            style={[styles.input, confirmError ? styles.inputError : null]}
            value={confirmPassword}
          />
          {confirmError ? <ErrorRow message={confirmError} /> : null}
        </View>

        <Pressable disabled={!canSubmit} onPress={changePassword} style={[styles.primaryButton, canSubmit ? null : styles.primaryButtonDisabled]}>
          <Text style={styles.primaryButtonText}>{isSubmitting ? "변경 중" : "변경 완료"}</Text>
        </Pressable>
      </ScrollView>
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
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputError: { borderColor: COLORS.danger, backgroundColor: COLORS.dangerBg },
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
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "500" },
});
