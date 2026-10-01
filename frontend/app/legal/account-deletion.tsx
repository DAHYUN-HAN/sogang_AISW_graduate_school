import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../../components/AppTypography";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CompletionState from "../../components/CompletionState";
import SchoolEmailInput from "../../components/SchoolEmailInput";
import { userApi } from "../../services/api";
import { useUserStore } from "../../stores/userStore";
import {
  ACCOUNT_DELETION_CONFIRMATION,
  ACCOUNT_DELETION_ITEMS,
  ACCOUNT_RETENTION_NOTICE,
  getMemberAccountDeletionSuccessPresentation,
  isAccountDeletionCodeValid,
  isDeletionConfirmationValid,
  publicAccountDeletionErrorMessage,
} from "../../utils/accountDeletion";
import {
  apiErrorCode,
  apiErrorStatus,
  composeSchoolEmail,
  emailIdError,
  formatCountdown,
} from "../../utils/authValidation";
import { clearStoredPushToken } from "../../utils/pushTokenStorage";

import { BackIcon } from "../../components/icons";
const COLORS = {
  primary: "#2761FF",
  text: "#15171C",
  muted: "#6B7280",
  subtle: "#A6ACB7",
  border: "#DCE1E8",
  bg: "#FFFFFF",
  panel: "#F8FAFC",
  danger: "#C73939",
  dangerBg: "#FFF4F4",
  success: "#20844A",
  successBg: "#EFFAF3",
  disabled: "#D1D5DB",
};

type Step = "request" | "verify" | "success";

type FieldErrors = {
  email?: string;
  code?: string;
  password?: string;
  confirmation?: string;
  request?: string;
};

export default function PublicAccountDeletionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ completed?: string }>();
  const clearSession = useUserStore((state) => state.clearSession);
  const currentUserEmail = useUserStore((state) => state.user?.email);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const [step, setStep] = useState<Step>(params.completed === "1" ? "success" : "request");
  const [emailId, setEmailId] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [expiresSeconds, setExpiresSeconds] = useState(0);
  const memberSuccessPresentation = getMemberAccountDeletionSuccessPresentation(params.completed);

  useEffect(() => {
    if (step !== "verify") return;
    const timer = setInterval(() => {
      setResendSeconds((value) => Math.max(0, value - 1));
      setExpiresSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  const normalizedEmail = composeSchoolEmail(emailId);
  const canRequest = Boolean(emailId.trim()) && !isSubmitting;
  const canVerify =
    isAccountDeletionCodeValid(code) &&
    Boolean(password) &&
    isDeletionConfirmationValid(confirmation) &&
    !isSubmitting;

  const requestCode = async () => {
    const nextEmailError = emailIdError(emailId);
    if (nextEmailError) {
      setErrors({ email: nextEmailError });
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    try {
      const response = await userApi.requestAccountDeletion({ email: normalizedEmail });
      if (!response.data.accepted) {
        throw new Error("Account deletion request was not accepted.");
      }
      setCode("");
      setPassword("");
      setConfirmation("");
      setResendSeconds(response.data.resend_in);
      setExpiresSeconds(response.data.expires_in);
      setStep("verify");
    } catch (error) {
      const status = apiErrorStatus(error);
      const errorCode = apiErrorCode(error);
      setErrors({
        request: publicAccountDeletionErrorMessage(status ?? (errorCode ? undefined : 0), errorCode),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyDeletion = async () => {
    const nextErrors: FieldErrors = {};
    if (!isAccountDeletionCodeValid(code)) nextErrors.code = "6자리 숫자 인증 코드를 입력해주세요.";
    if (!password) nextErrors.password = "현재 비밀번호를 입력해주세요.";
    if (!isDeletionConfirmationValid(confirmation)) {
      nextErrors.confirmation = `확인을 위해 '${ACCOUNT_DELETION_CONFIRMATION}'를 정확히 입력해주세요.`;
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    try {
      const response = await userApi.verifyAccountDeletion({
        email: normalizedEmail,
        code: code.trim(),
        current_password: password,
      });
      if (!response.data.deleted) {
        throw new Error("Account deletion was not confirmed by the server.");
      }

      if (currentUserEmail?.toLowerCase() === normalizedEmail.toLowerCase()) {
        await clearStoredPushToken().catch(() => undefined);
        clearSession();
      }
      setPassword("");
      setCode("");
      setConfirmation("");
      setStep("success");
    } catch (error) {
      const status = apiErrorStatus(error);
      const errorCode = apiErrorCode(error);
      setErrors({
        request: publicAccountDeletionErrorMessage(status ?? (errorCode ? undefined : 0), errorCode),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetRequest = () => {
    setStep("request");
    setCode("");
    setPassword("");
    setConfirmation("");
    setErrors({});
    setResendSeconds(0);
    setExpiresSeconds(0);
  };

  if (memberSuccessPresentation) {
    return (
      <CompletionState
        buttonLabel={memberSuccessPresentation.buttonLabel}
        onConfirm={() => router.replace(memberSuccessPresentation.confirmRoute)}
        title={memberSuccessPresentation.title}
      />
    );
  }

  if (step === "success") {
    return (
      <View style={styles.screen}>
        <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
          <View style={styles.iconButton} />
          <Text accessibilityRole="header" style={styles.appBarTitle}>
            계정 삭제 확인
          </Text>
          <View style={styles.iconButton} />
        </View>
        <View accessibilityLiveRegion="polite" style={styles.successContent}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={34} color={COLORS.success} />
          </View>
          <Text accessibilityRole="header" style={styles.successTitle}>
            계정 삭제가 완료되었습니다
          </Text>
          <Text style={styles.successBody}>
            계정 개인정보가 삭제되었습니다. 작성한 게시글·댓글·상조회 신청과 연결 첨부는 작성 당시의
            이름과 기수로 유지되며, 상조회 증빙자료는 관리자만 열람할 수 있습니다.
          </Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.replace("/auth/login")}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>로그인 화면으로</Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.replace("/legal/privacy")}
            style={styles.textLinkButton}
          >
            <Text style={styles.textLink}>개인정보 처리방침 보기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable
          accessibilityLabel={step === "verify" ? "이메일 입력으로 돌아가기" : "뒤로"}
          accessibilityRole="button"
          onPress={() => {
            if (step === "verify") resetRequest();
            else if (router.canGoBack()) router.back();
            else router.replace("/legal/privacy");
          }}
          style={styles.iconButton}
        >
          <BackIcon size={24} color={COLORS.text} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.appBarTitle}>
          계정 삭제 요청
        </Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        style={styles.scroller}
      >
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={styles.introTitle}>
            AI·SW CAMPUS 계정과 데이터 삭제
          </Text>
          <Text style={styles.introBody}>
            앱에 로그인하지 않아도 학교 이메일 인증으로 계정 삭제를 요청할 수 있습니다.
          </Text>
        </View>

        {isAuthenticated ? (
          <Pressable
            accessibilityHint="현재 로그인한 계정의 삭제 화면을 엽니다."
            accessibilityRole="link"
            onPress={() => router.push("/settings/account-deletion")}
            style={styles.signedInCard}
          >
            <Text style={styles.signedInTitle}>현재 로그인한 계정 삭제</Text>
            <Text style={styles.signedInBody}>앱 설정에서는 이메일 코드 없이 비밀번호로 진행할 수 있습니다.</Text>
          </Pressable>
        ) : null}

        <View style={styles.noticeCard}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            삭제 및 익명화되는 항목
          </Text>
          {ACCOUNT_DELETION_ITEMS.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <View style={styles.bullet} />
              <Text style={styles.bodyText}>{item}</Text>
            </View>
          ))}
          <Text style={styles.retentionText}>{ACCOUNT_RETENTION_NOTICE}</Text>
        </View>

        {step === "request" ? (
          <>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>학교 이메일</Text>
              <SchoolEmailInput
                hasError={Boolean(errors.email || errors.request)}
                onChangeText={(value) => {
                  setEmailId(value);
                  setErrors((current) => ({ ...current, email: undefined, request: undefined }));
                }}
                value={emailId}
              />
              {errors.email ? (
                <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.errorText}>
                  {errors.email}
                </Text>
              ) : null}
            </View>

            <Text style={styles.nonEnumerationNote}>
              계정 존재 여부와 관계없이 동일한 안내가 표시됩니다. 입력한 이메일에 삭제 가능한 계정이
              있다면 6자리 인증 코드가 발송됩니다.
            </Text>

            {errors.request ? (
              <ErrorBox
                message={errors.request}
                retryDisabled={!canRequest}
                retryLabel="인증 코드 요청 다시 시도"
                onRetry={requestCode}
              />
            ) : null}

            <Pressable
              accessibilityHint="계정 존재 여부를 노출하지 않고 인증 코드를 요청합니다."
              accessibilityLabel="계정 삭제 인증 코드 요청"
              accessibilityRole="button"
              accessibilityState={{ busy: isSubmitting, disabled: !canRequest }}
              disabled={!canRequest}
              onPress={() => void requestCode()}
              style={[styles.primaryButton, !canRequest ? styles.buttonDisabled : null]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>인증 코드 요청</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <View accessibilityLiveRegion="polite" style={styles.requestAcceptedCard}>
              <Ionicons name="mail-outline" size={20} color={COLORS.primary} />
              <View style={styles.requestAcceptedText}>
                <Text style={styles.requestAcceptedTitle}>인증 코드를 확인해주세요</Text>
                <Text style={styles.requestAcceptedBody}>
                  입력한 주소에 삭제 가능한 계정이 있다면 {normalizedEmail}로 코드를 발송했습니다.
                </Text>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>6자리 인증 코드</Text>
                <Text style={styles.timerText}>
                  {expiresSeconds > 0 ? formatCountdown(expiresSeconds) : "만료됨"}
                </Text>
              </View>
              <TextInput
                accessibilityLabel="6자리 계정 삭제 인증 코드"
                autoComplete="one-time-code"
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={(value) => {
                  setCode(value.replace(/\D/g, "").slice(0, 6));
                  setErrors((current) => ({ ...current, code: undefined, request: undefined }));
                }}
                placeholder="000000"
                placeholderTextColor={COLORS.subtle}
                style={[styles.input, errors.code ? styles.inputError : null]}
                value={code}
              />
              {errors.code ? (
                <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.errorText}>
                  {errors.code}
                </Text>
              ) : null}
              <Pressable
                accessibilityLabel={
                  resendSeconds > 0
                    ? `${resendSeconds}초 후 인증 코드 재요청 가능`
                    : "인증 코드 재요청"
                }
                accessibilityRole="button"
                disabled={resendSeconds > 0 || isSubmitting}
                onPress={() => void requestCode()}
              >
                <Text style={[styles.resendText, resendSeconds > 0 ? styles.resendDisabled : null]}>
                  {resendSeconds > 0
                    ? `${formatCountdown(resendSeconds)} 후 재요청`
                    : "인증 코드 재요청"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>현재 비밀번호</Text>
              <TextInput
                accessibilityLabel="현재 비밀번호"
                autoCapitalize="none"
                autoComplete="current-password"
                onChangeText={(value) => {
                  setPassword(value);
                  setErrors((current) => ({ ...current, password: undefined, request: undefined }));
                }}
                placeholder="현재 비밀번호"
                placeholderTextColor={COLORS.subtle}
                secureTextEntry
                style={[styles.input, errors.password ? styles.inputError : null]}
                value={password}
              />
              {errors.password ? (
                <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.errorText}>
                  {errors.password}
                </Text>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>삭제 확인</Text>
              <Text style={styles.helper}>
                계속하려면 아래에 ‘{ACCOUNT_DELETION_CONFIRMATION}’를 입력해주세요.
              </Text>
              <TextInput
                accessibilityLabel="계정 삭제 확인 문구"
                autoCorrect={false}
                onChangeText={(value) => {
                  setConfirmation(value);
                  setErrors((current) => ({
                    ...current,
                    confirmation: undefined,
                    request: undefined,
                  }));
                }}
                placeholder={ACCOUNT_DELETION_CONFIRMATION}
                placeholderTextColor={COLORS.subtle}
                style={[styles.input, errors.confirmation ? styles.inputError : null]}
                value={confirmation}
              />
              {errors.confirmation ? (
                <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.errorText}>
                  {errors.confirmation}
                </Text>
              ) : null}
            </View>

            {errors.request ? (
              <ErrorBox
                message={errors.request}
                retryDisabled={!canVerify}
                retryLabel="계정 삭제 확인 다시 시도"
                onRetry={verifyDeletion}
              />
            ) : null}

            <Pressable
              accessibilityHint="인증 코드와 비밀번호를 확인한 뒤 계정과 개인정보를 삭제합니다."
              accessibilityLabel="계정 삭제 확인 및 제출"
              accessibilityRole="button"
              accessibilityState={{ busy: isSubmitting, disabled: !canVerify }}
              disabled={!canVerify}
              onPress={() => void verifyDeletion()}
              style={[styles.deleteButton, !canVerify ? styles.buttonDisabled : null]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>계정 삭제</Text>
              )}
            </Pressable>

            <Text style={styles.securityNote}>
              인증 코드·비밀번호·계정 존재 여부 중 어떤 항목이 일치하지 않는지 구분해 표시하지
              않습니다. 입력값은 이 기기에 저장하지 않습니다.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ErrorBox({
  message,
  retryDisabled,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryDisabled: boolean;
  retryLabel: string;
  onRetry: () => Promise<void>;
}) {
  return (
    <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.errorBox}>
      <Text style={styles.errorBoxText}>{message}</Text>
      <Pressable
        accessibilityLabel={retryLabel}
        accessibilityRole="button"
        disabled={retryDisabled}
        onPress={() => void onRetry()}
      >
        <Text style={[styles.retryText, retryDisabled ? styles.retryDisabled : null]}>다시 시도</Text>
      </Pressable>
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
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  appBarTitle: { color: COLORS.text, fontSize: 17, fontWeight: "600" },
  scroller: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 44, gap: 20 },
  intro: { gap: 7 },
  introTitle: { color: COLORS.text, fontSize: 21, fontWeight: "800", lineHeight: 29 },
  introBody: { color: COLORS.muted, fontSize: 13, lineHeight: 20 },
  signedInCard: {
    borderWidth: 1,
    borderColor: "#BFD0FF",
    borderRadius: 10,
    backgroundColor: "#F2F6FF",
    padding: 14,
    gap: 4,
  },
  signedInTitle: { color: COLORS.primary, fontSize: 14, fontWeight: "700" },
  signedInBody: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  noticeCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.panel,
    padding: 14,
    gap: 9,
  },
  sectionTitle: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.muted,
    marginTop: 8,
  },
  bodyText: { flex: 1, color: COLORS.muted, fontSize: 13, lineHeight: 20 },
  retentionText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  fieldGroup: { gap: 7 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
  timerText: { color: COLORS.danger, fontSize: 12, fontWeight: "600" },
  helper: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  input: {
    minHeight: 48,
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
  nonEnumerationNote: {
    borderRadius: 8,
    backgroundColor: COLORS.panel,
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    padding: 12,
  },
  requestAcceptedCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 9,
    backgroundColor: "#F2F6FF",
    padding: 13,
  },
  requestAcceptedText: { flex: 1, gap: 3 },
  requestAcceptedTitle: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  requestAcceptedBody: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  resendText: { color: COLORS.primary, fontSize: 12, fontWeight: "600", alignSelf: "flex-end" },
  resendDisabled: { color: COLORS.subtle },
  errorBox: { borderRadius: 8, backgroundColor: COLORS.dangerBg, padding: 12, gap: 7 },
  errorBoxText: { color: COLORS.danger, fontSize: 13, lineHeight: 19 },
  retryText: { color: COLORS.danger, fontSize: 13, fontWeight: "700" },
  retryDisabled: { color: COLORS.subtle },
  primaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
  },
  deleteButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 16,
  },
  buttonDisabled: { backgroundColor: COLORS.disabled },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  securityNote: { color: COLORS.muted, fontSize: 11, lineHeight: 17, textAlign: "center" },
  successContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 14,
  },
  successIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.successBg,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { color: COLORS.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
  successBody: { color: COLORS.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  textLinkButton: { padding: 8 },
  textLink: { color: COLORS.primary, fontSize: 13, fontWeight: "600" },
});
