import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../../../components/AppTypography";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import KeyboardViewport from "../../../components/KeyboardViewport";

import { userApi } from "../../../services/api";
import { useUserStore } from "../../../stores/userStore";
import { accountDeletionErrorMessage } from "../../../utils/accountDeletion";
import { apiErrorCode, apiErrorStatus } from "../../../utils/authValidation";
import { clearStoredPushToken } from "../../../utils/pushTokenStorage";

import { AlertCircleIcon, BackIcon, NoticeAlertIcon } from "../../../components/icons";
const COLORS = {
  primary: "#2761FF",
  text: "#15171C",
  muted: "#6B7280",
  subtle: "#A6ACB7",
  border: "#E1E4E9",
  bg: "#FFFFFF",
  panel: "#F8FAFC",
  danger: "#D64545", // Figma: 탈퇴하기 활성 버튼/오류
  dangerBg: "#FFF4F4",
  disabled: "#D1D5DB",
};

export default function AccountDeletionScreen() {
  const insets = useSafeAreaInsets();
  const clearSession = useUserStore((state) => state.clearSession);
  const [currentPassword, setCurrentPassword] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);

  // 탈퇴 버튼은 안내 확인만으로 활성화되고, 비밀번호는 모달에서 확인한다.
  const canSubmit = acknowledged && !isSubmitting;

  const deleteAccount = async () => {
    setPasswordError(null);
    setRequestError(null);

    if (!currentPassword) {
      setPasswordError("현재 비밀번호를 입력해주세요.");
      return;
    }
    if (!acknowledged) {
      setRequestError("삭제 대상과 보존 내용을 확인해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await userApi.deleteMe({
        current_password: currentPassword,
      });
      if (!response.data.deleted) {
        throw new Error("Account deletion was not confirmed by the server.");
      }

      await clearStoredPushToken().catch(() => undefined);
      clearSession();
      setPasswordModalVisible(false);
      router.replace("/legal/account-deletion?completed=1");
    } catch (error) {
      const status = apiErrorStatus(error);
      const code = apiErrorCode(error);
      if (status === 403 || code === "FORBIDDEN") {
        setPasswordError("현재 비밀번호가 일치하지 않습니다.");
      } else {
        setRequestError(accountDeletionErrorMessage(status ?? (code ? undefined : 0), code));
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
          accessibilityRole="button"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/settings/account");
          }}
          style={styles.iconButton}
        >
          <BackIcon size={24} color={COLORS.text} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.appBarTitle}>
          회원 탈퇴
        </Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        style={styles.scroller}
      >
        <View style={styles.header}>
          <AlertCircleIcon size={32} color={COLORS.muted} />
          <Text accessibilityRole="header" style={styles.headerTitle}>탈퇴 전 꼭 확인해주세요</Text>
        </View>

        <View style={[styles.noticeBanner, styles.noticeBannerBlue]}>
          <View style={styles.noticeBannerIcon}>
            <NoticeAlertIcon size={14} color="#0C447C" />
          </View>
          <Text style={[styles.noticeBannerText, styles.noticeBannerTextBlue]}>
            작성한 게시물과 댓글은 삭제되지 않고, 이름·기수를 포함해 계속 표시돼요.
          </Text>
        </View>

        <View style={[styles.noticeBanner, styles.noticeBannerAmber]}>
          <View style={styles.noticeBannerIcon}>
            <NoticeAlertIcon size={14} color="#854F0B" />
          </View>
          <Text style={[styles.noticeBannerText, styles.noticeBannerTextAmber]}>
            가입정보는 탈퇴 즉시 삭제되며, 재가입 시 신규 계정으로 처리돼요. 이전에 작성한 게시물에 대한 관리 권한은 복구되지 않아요.
          </Text>
        </View>

        <Pressable
          accessibilityHint="선택해야 계정 삭제 버튼이 활성화됩니다."
          accessibilityLabel="계정 삭제 및 데이터 보존 안내를 확인했습니다"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acknowledged }}
          onPress={() => {
            setAcknowledged((value) => !value);
            setRequestError(null);
          }}
          style={[styles.confirmRow, { outlineStyle: "none" } as never]}
        >
          <View style={[styles.checkbox, acknowledged ? styles.checkboxChecked : null]}>
            {acknowledged ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
          </View>
          <Text style={styles.confirmText}>안내사항을 모두 확인했어요</Text>
        </Pressable>

        {requestError ? (
          <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{requestError}</Text>
            <Pressable
              accessibilityLabel="계정 삭제 다시 시도"
              accessibilityRole="button"
              disabled={!canSubmit}
              onPress={() => void deleteAccount()}
            >
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          accessibilityHint="비밀번호를 확인한 뒤 계정과 개인정보를 삭제합니다."
          accessibilityLabel="계정 삭제"
          accessibilityRole="button"
          accessibilityState={{ busy: isSubmitting, disabled: !canSubmit }}
          disabled={!canSubmit}
          onPress={() => {
            setCurrentPassword("");
            setPasswordError(null);
            setPasswordModalVisible(true);
          }}
          style={[styles.deleteButton, !canSubmit ? styles.deleteButtonDisabled : null]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.deleteButtonText, !canSubmit ? styles.deleteButtonTextDisabled : null]}>탈퇴하기</Text>
          )}
        </Pressable>

      </ScrollView>

      <Modal transparent animationType="fade" visible={passwordModalVisible} onRequestClose={() => setPasswordModalVisible(false)}>
        <KeyboardViewport>
          <Pressable onPress={() => setPasswordModalVisible(false)} style={styles.modalBackdrop}>
            <Pressable onPress={(event) => event.stopPropagation()} style={styles.modalCard}>
              <Text style={styles.modalTitle}>현재 비밀번호 확인</Text>
              <TextInput
                accessibilityLabel="현재 비밀번호"
                autoCapitalize="none"
                autoComplete="current-password"
                autoFocus
                onChangeText={(value) => {
                  setCurrentPassword(value);
                  setPasswordError(null);
                }}
                onSubmitEditing={() => {
                  if (currentPassword && !isSubmitting) void deleteAccount();
                }}
                placeholder="현재 비밀번호를 입력하세요"
                placeholderTextColor={COLORS.subtle}
                secureTextEntry
                style={[styles.input, passwordError ? styles.inputError : null]}
                value={currentPassword}
              />
              {passwordError ? (
                <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.errorText}>
                  {passwordError}
                </Text>
              ) : null}
              <View style={styles.modalActions}>
                <Pressable onPress={() => setPasswordModalVisible(false)} style={styles.modalCancelButton}>
                  <Text style={styles.modalCancelText}>취소</Text>
                </Pressable>
                <Pressable
                  disabled={!currentPassword || isSubmitting}
                  onPress={() => void deleteAccount()}
                  style={[styles.modalDeleteButton, !currentPassword || isSubmitting ? styles.deleteButtonDisabled : null]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.deleteButtonText, !currentPassword ? styles.deleteButtonTextDisabled : null]}>탈퇴하기</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardViewport>
      </Modal>
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
  appBarTitle: { color: COLORS.text, fontSize: 18, fontWeight: "500", lineHeight: 22 }, // Figma: 18/22 Medium
  scroller: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 24, gap: 20 }, // Figma: 본문 40/20/24, gap 20
  header: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 16,
  },
  headerTitle: { color: COLORS.text, fontSize: 16, fontWeight: "500", lineHeight: 19 },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeBannerIcon: { marginTop: 1 },
  noticeBannerBlue: { backgroundColor: "#E6F1FB" },
  noticeBannerAmber: { backgroundColor: "#FAEEDA" },
  noticeBannerText: { flex: 1, fontSize: 12, fontWeight: "400", lineHeight: 15 },
  noticeBannerTextBlue: { color: "#0C447C" },
  noticeBannerTextAmber: { color: "#854F0B" },
  fieldGroup: { gap: 8 },
  label: { color: COLORS.text, fontSize: 13, fontWeight: "500", lineHeight: 16 },
  input: {
    minHeight: 41,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    color: COLORS.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputError: { borderColor: COLORS.danger, backgroundColor: COLORS.dangerBg },
  errorText: { color: COLORS.danger, fontSize: 12, lineHeight: 18 },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 4,
    backgroundColor: COLORS.bg,
  },
  checkboxChecked: {
    // Figma: 체크 시 #15171C 채움 + 흰 체크
    borderColor: COLORS.text,
    backgroundColor: COLORS.text,
  },
  confirmText: { flex: 1, color: COLORS.text, fontSize: 13, fontWeight: "400", lineHeight: 16 },
  errorBox: {
    borderRadius: 8,
    backgroundColor: COLORS.dangerBg,
    padding: 12,
    gap: 7,
  },
  errorBoxText: { color: COLORS.danger, fontSize: 13, lineHeight: 19 },
  retryText: { color: COLORS.danger, fontSize: 13, fontWeight: "700" },
  deleteButton: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 16,
  },
  deleteButtonDisabled: { backgroundColor: COLORS.border }, // Figma: 비활성 #E1E4E9
  deleteButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "500", lineHeight: 24 },
  deleteButtonTextDisabled: { color: "#8A919C" },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17, 24, 39, 0.38)",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    gap: 12,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    padding: 20,
  },
  modalTitle: { color: COLORS.text, fontSize: 16, fontWeight: "500", lineHeight: 19 },
  modalActions: { flexDirection: "row", gap: 8 },
  modalCancelButton: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  modalCancelText: { color: COLORS.text, fontSize: 14, fontWeight: "500", lineHeight: 17 },
  modalDeleteButton: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.danger,
  },
});
