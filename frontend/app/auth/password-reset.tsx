import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import SchoolEmailInput from "../../components/SchoolEmailInput";
import { authApi } from "../../services/api";
import {
  apiErrorCode,
  composeSchoolEmail,
  emailIdError,
  passwordError,
} from "../../utils/authValidation";
import {
  VERIFICATION_ATTEMPTS_EXCEEDED_MESSAGE,
  verificationFailureStateFromErrorCode,
  verificationHasExpired,
} from "../../utils/authVerificationUi";
import { passwordResetProgressDotIndex, passwordResetResendControl } from "../../utils/passwordResetUi";

import { BackIcon } from "../../components/icons";
import { resendCountdownLabel } from "../../utils/signupVerificationUi";
const COLORS = {
  primary: "#2761FF", // primary/500
  text: "#15171C", // gray/900 (Figma)
  muted: "#6B7280", // gray/600
  subtle: "#A6ACB7", // placeholder
  tertiary: "#8A919C", // gray/500, text/tertiary
  border: "#E1E4E9", // border/default
  danger: "#D64545", // error/500 (Figma)
  successText: "#3B6D11", // Figma 재전송 완료 안내
  success: "#2E9E5B", // success/500 (complete icon)
  bg: "#FFFFFF",
  errorBg: "#FFF5F5",
  disabled: "#D1D5DB",
};

type Mode = "request" | "code" | "reset" | "complete";
type Errors = Partial<Record<"email" | "code" | "password" | "passwordConfirm" | "form", string>>;
type VerificationMessage = { type: "success" | "error"; text: string } | null;
type VerificationFailureState = "expired" | "attempts" | null;

// Figma Body 상단 진행 점: 8px 원 3개, gap 6, 현재 단계만 #2661FF.
function StepDots({ mode }: { mode: Mode }) {
  const activeStep = passwordResetProgressDotIndex(mode);
  return (
    <View style={styles.stepDots}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={[styles.stepDot, activeStep === item ? styles.stepDotActive : null]} />
      ))}
    </View>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <View style={styles.messageRow}>
      <Ionicons name="alert-circle-outline" size={14} color={COLORS.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  ) : null;
}

export default function PasswordResetScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("request");
  const [emailId, setEmailId] = useState("");
  const [code, setCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const verificationExpiresAtRef = useRef(0);
  const resendAvailableAtRef = useRef(0);
  const [verificationMessage, setVerificationMessage] = useState<VerificationMessage>(null);
  const [verificationFailureState, setVerificationFailureState] = useState<VerificationFailureState>(null);
  const [rateLimited, setRateLimited] = useState(false);
  // Figma: 재전송 뒤에는 안내문이 "재발송되었어요"로 바뀌고 초록 확인 메시지가 붙는다.
  const [codeResent, setCodeResent] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [resetValidationAttempted, setResetValidationAttempted] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const email = composeSchoolEmail(emailId);

  useEffect(() => {
    if (mode !== "code") return;
    const updateTimers = () => {
      const now = Date.now();
      setCountdown(Math.max(0, Math.ceil((verificationExpiresAtRef.current - now) / 1000)));
      setResendCooldown(Math.max(0, Math.ceil((resendAvailableAtRef.current - now) / 1000)));
    };
    updateTimers();
    const timer = setInterval(updateTimers, 1000);
    return () => clearInterval(timer);
  }, [mode]);

  const restartVerification = () => {
    setMode("request");
    setCode("");
    setVerificationToken("");
    setCountdown(0);
    setResendCooldown(0);
    verificationExpiresAtRef.current = 0;
    resendAvailableAtRef.current = 0;
    setVerificationMessage(null);
    setVerificationFailureState(null);
    setCodeResent(false);
    setErrors({});
  };

  const goBack = () => {
    if (mode === "code" || mode === "reset") {
      restartVerification();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/auth/login");
  };

  const requestCode = async (resend = false) => {
    const nextEmailError = emailIdError(emailId);
    if (nextEmailError) {
      setErrors({ email: nextEmailError });
      return;
    }

    try {
      setIsSubmitting(true);
      setErrors({});
      setVerificationMessage(null);
      setRateLimited(false);
      const response = await authApi.requestPasswordReset({ email });
      if (response.data.email_sent === false) {
        const message = "인증 메일을 발송하지 못했어요. 잠시 후 다시 시도해주세요.";
        if (resend) setVerificationMessage({ type: "error", text: message });
        else setErrors({ email: message });
        return;
      }

      const requestedAt = Date.now();
      const resendIn = response.data.resend_in ?? response.data.expires_in;
      verificationExpiresAtRef.current = requestedAt + response.data.expires_in * 1000;
      resendAvailableAtRef.current = requestedAt + resendIn * 1000;
      setCountdown(response.data.expires_in);
      setResendCooldown(resendIn);
      setCode("");
      setVerificationToken("");
      setVerificationFailureState(null);
      setCodeResent(resend);
      // Figma: 최초 발송에는 안내문을 띄우지 않고, 재전송에만 초록 확인 메시지를 보여 준다.
      setVerificationMessage(resend ? { type: "success", text: "새 인증코드가 발송되었어요." } : null);
      setMode("code");
    } catch (error) {
      const errorCode = apiErrorCode(error);
      const isRateLimited = errorCode === "RATE_LIMITED" || errorCode === "VERIFICATION_RESEND_COOLDOWN";
      const message = isRateLimited
        ? "인증 시도 횟수를 초과했어요.\n잠시 후 다시 시도해주세요."
        : "인증코드를 발송하지 못했어요. 이메일을 확인해주세요.";
      if (resend) setVerificationMessage({ type: "error", text: message });
      else {
        setErrors({ email: message });
        setRateLimited(isRateLimited);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyCode = async () => {
    if (Date.now() >= verificationExpiresAtRef.current) {
      setVerificationFailureState("expired");
      setErrors({ code: "인증 시간이 만료되었어요. 재전송을 눌러주세요." });
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setVerificationFailureState(null);
      setErrors({ code: "인증코드 6자리를 입력해주세요." });
      return;
    }

    try {
      setIsSubmitting(true);
      setErrors({});
      const response = await authApi.verifyPasswordResetCode({ email, code });
      setVerificationToken(response.data.verification_token);
      setVerificationMessage(null);
      setVerificationFailureState(null);
      setMode("reset");
    } catch (error) {
      const errorCode = apiErrorCode(error);
      const failureState = verificationFailureStateFromErrorCode(errorCode);
      const message =
        errorCode === "VERIFICATION_EXPIRED"
          ? "인증 시간이 만료되었어요. 재전송을 눌러주세요."
          : errorCode === "VERIFICATION_ATTEMPTS_EXCEEDED"
            ? VERIFICATION_ATTEMPTS_EXCEEDED_MESSAGE
            : "인증코드가 일치하지 않아요.";
      setErrors({ code: message });
      setVerificationFailureState(failureState);
      if (failureState) setCode("");
      if (failureState === "expired") {
        resendAvailableAtRef.current = 0;
        setResendCooldown(0);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmReset = async () => {
    setResetValidationAttempted(true);
    const nextErrors: Errors = {};
    const nextPasswordError = passwordError(newPassword);
    if (nextPasswordError) nextErrors.password = nextPasswordError;
    if (!newPasswordConfirm) nextErrors.passwordConfirm = "비밀번호를 다시 입력해주세요.";
    else if (newPassword !== newPasswordConfirm) nextErrors.passwordConfirm = "비밀번호가 일치하지 않아요.";
    if (!verificationToken) nextErrors.form = "이메일 인증을 다시 진행해주세요.";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrors({});
      await authApi.confirmPasswordReset({ token: verificationToken, new_password: newPassword });
      setMode("complete");
    } catch {
      setErrors({ form: "비밀번호를 변경하지 못했어요. 인증을 다시 진행해주세요." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const verificationExpired = mode === "code" && verificationHasExpired(countdown, verificationFailureState);
  const verificationAttemptsLocked = verificationFailureState === "attempts";
  const codeError = errors.code ?? (verificationExpired ? "인증 시간이 만료되었어요. 재전송을 눌러주세요." : undefined);
  const codeErrorHasBackground = Boolean(codeError) && verificationFailureState !== "expired" && !verificationExpired;
  const resendControl = passwordResetResendControl({
    verificationExpired,
    verificationAttemptsLocked,
    isSubmitting,
    resendCooldown,
  });
  const displayedPasswordError = errors.password ?? (resetValidationAttempted ? passwordError(newPassword) ?? undefined : undefined);
  const displayedPasswordConfirmError =
    errors.passwordConfirm ??
    (resetValidationAttempted
      ? !newPasswordConfirm
        ? "비밀번호를 다시 입력해주세요."
        : newPassword !== newPasswordConfirm
          ? "비밀번호가 일치하지 않아요."
          : undefined
      : undefined);
  const resetButtonDisabled =
    isSubmitting ||
    (resetValidationAttempted && Boolean(displayedPasswordError || displayedPasswordConfirmError || errors.form));
  const title = mode === "reset" ? "비밀번호 재설정" : "비밀번호 찾기";

  return (
    <View style={styles.screen}>
      {mode !== "complete" ? (
        <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 18) }]}>
          <Pressable accessibilityLabel="뒤로" onPress={goBack} style={styles.iconButton}>
            <BackIcon size={22} color={COLORS.text} />
          </Pressable>
          <Text style={styles.appBarTitle}>{title}</Text>
          <View style={styles.iconButton} />
        </View>
      ) : null}

      {mode === "complete" ? (
        <View style={styles.completeContent}>
          <Ionicons name="checkmark-circle-outline" size={64} color={COLORS.success} />
          <Text style={styles.completeTitle}>비밀번호가 변경되었어요!</Text>
          <Pressable onPress={() => router.replace("/auth/login")} style={[styles.primaryButton, styles.completeButton]}>
            <Text style={styles.primaryButtonText}>로그인하러 가기</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, mode === "code" ? styles.contentCode : null]} keyboardShouldPersistTaps="handled">
          <StepDots mode={mode} />
          {mode === "request" ? (
            <>
              <Text style={styles.heading}>가입한 학교 이메일을 입력해주세요</Text>
              <Text style={styles.helper}>입력하신 이메일로 인증코드를 보내드려요</Text>
              <View style={styles.field}>
                <Text style={styles.label}>학교 이메일</Text>
                <SchoolEmailInput
                  value={emailId}
                  onChangeText={(value) => {
                    setEmailId(value);
                    setErrors((current) => ({ ...current, email: undefined }));
                    setRateLimited(false);
                  }}
                  hasError={Boolean(errors.email)}
                />
                <FieldError message={errors.email} />
              </View>
              <Pressable
                disabled={isSubmitting || rateLimited}
                onPress={() => void requestCode(false)}
                style={[styles.primaryButton, rateLimited ? styles.disabledButton : isSubmitting ? styles.submittingButton : null]}
              >
                <Text style={styles.primaryButtonText}>{rateLimited ? "다음" : isSubmitting ? "발송 중" : "인증코드 받기"}</Text>
              </Pressable>
            </>
          ) : null}

          {mode === "code" ? (
            <>
              <Text style={[styles.heading, styles.headingCode]}>인증코드를 입력해주세요</Text>
              <Text style={[styles.helper, styles.helperCode]}>{email}로 {codeResent ? "재발송" : "발송"}되었어요</Text>
              {/* Figma 코드영역: 입력 44h + 타이머행, gap 8 */}
              <View style={styles.codeGroup}>
              <View style={styles.field}>
                <TextInput
                  editable={!verificationAttemptsLocked}
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={(value) => {
                    setCode(value.replace(/\D/g, ""));
                    if (!verificationAttemptsLocked) {
                      setErrors((current) => ({ ...current, code: undefined }));
                      setVerificationFailureState(null);
                    }
                  }}
                  placeholder="인증코드 6자리"
                  placeholderTextColor={COLORS.tertiary}
                  style={[
                    styles.input,
                    styles.codeInput,
                    codeError ? styles.inputError : null,
                    codeErrorHasBackground ? styles.inputErrorBackground : null,
                  ]}
                  value={code}
                />
              </View>

              <View style={styles.statusRow}>
                <View style={styles.statusLeft}>
                  {codeError ? (
                    <View style={styles.messageRow}>
                      <Ionicons name="alert-circle-outline" size={14} color={COLORS.danger} />
                      <Text style={styles.errorText}>{codeError}</Text>
                    </View>
                  ) : verificationMessage ? (
                    <View style={verificationMessage.type === "success" ? styles.successRow : styles.messageRow}>
                      <Ionicons
                        name={verificationMessage.type === "success" ? "checkmark-circle-outline" : "alert-circle-outline"}
                        size={14}
                        color={verificationMessage.type === "success" ? COLORS.successText : COLORS.danger}
                      />
                      <Text style={verificationMessage.type === "success" ? styles.successText : styles.errorText}>
                        {verificationMessage.text}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {resendControl.visible ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: resendControl.disabled }}
                    disabled={resendControl.disabled}
                    hitSlop={8}
                    onPress={() => void requestCode(true)}
                    style={styles.resendControlTrailing}
                  >
                    <Text style={[styles.resendLink, resendControl.disabled ? styles.resendLinkDisabled : null]}>{resendControl.label}</Text>
                  </Pressable>
                ) : null}
              </View>
              </View>

              {verificationExpired ? (
                <Pressable
                  disabled={isSubmitting || resendCooldown > 0}
                  onPress={() => void requestCode(true)}
                  style={[styles.primaryButton, isSubmitting || resendCooldown > 0 ? styles.submittingButton : null]}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting ? "발송 중" : resendCooldown > 0 ? resendCountdownLabel(resendCooldown) : "재전송"}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  disabled={isSubmitting || verificationAttemptsLocked}
                  onPress={() => void verifyCode()}
                  style={[
                    styles.primaryButton,
                    isSubmitting ? styles.submittingButton : null,
                    verificationAttemptsLocked ? styles.validationDisabledButton : null,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>{isSubmitting ? "확인 중" : "다음"}</Text>
                </Pressable>
              )}
            </>
          ) : null}

          {mode === "reset" ? (
            <>
              <Text style={styles.heading}>새 비밀번호를 설정해주세요</Text>
              <View style={styles.field}>
                <Text style={styles.label}>새 비밀번호</Text>
                <TextInput
                  onChangeText={(value) => {
                    setNewPassword(value);
                    setErrors((current) => ({ ...current, password: undefined, form: undefined }));
                  }}
                  placeholder="새 비밀번호"
                  placeholderTextColor={COLORS.subtle}
                  secureTextEntry
                  style={[styles.input, displayedPasswordError ? styles.inputErrorBackground : null]}
                  value={newPassword}
                />
                {displayedPasswordError ? (
                  <FieldError message={displayedPasswordError} />
                ) : (
                  <Text style={styles.passwordHelper}>영문, 숫자, 특수문자 포함 8자 이상</Text>
                )}
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>비밀번호 확인</Text>
                <TextInput
                  onChangeText={(value) => {
                    setNewPasswordConfirm(value);
                    setErrors((current) => ({ ...current, passwordConfirm: undefined, form: undefined }));
                  }}
                  placeholder="새 비밀번호 확인"
                  placeholderTextColor={COLORS.subtle}
                  secureTextEntry
                  style={[styles.input, displayedPasswordConfirmError ? styles.inputErrorBackground : null]}
                  value={newPasswordConfirm}
                />
                <FieldError message={displayedPasswordConfirmError} />
              </View>
              <FieldError message={errors.form} />
              <Pressable
                disabled={resetButtonDisabled}
                onPress={() => void confirmReset()}
                style={[
                  styles.primaryButton,
                  isSubmitting ? styles.submittingButton : null,
                  resetButtonDisabled && !isSubmitting ? styles.validationDisabledButton : null,
                ]}
              >
                <Text style={styles.primaryButtonText}>{isSubmitting ? "변경 중" : "변경 완료"}</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  appBar: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconButton: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  appBarTitle: { color: COLORS.text, fontSize: 18, fontWeight: "500", lineHeight: 26 }, // Figma: Inter Medium 18/26
  content: { gap: 20, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }, // Figma body
  contentCode: { paddingTop: 28 }, // Figma 인증코드 본문: padding 28/20/24
  heading: { color: COLORS.text, fontSize: 20, fontWeight: "500", lineHeight: 28 }, // Figma: Inter Medium 20/28
  headingCode: { lineHeight: 24 }, // Figma 인증코드 제목: 20/24
  helper: { color: COLORS.tertiary, fontSize: 13, fontWeight: "400", lineHeight: 18 }, // Figma: Regular 13, gray/500
  helperCode: { lineHeight: 16 }, // Figma 인증코드 안내: 13/16
  field: { gap: 6 }, // Figma label→input gap
  label: { color: COLORS.text, fontSize: 14, fontWeight: "500", lineHeight: 22 }, // Figma: Inter Medium 14/22
  input: {
    minHeight: 48,
    outlineStyle: "none" as never,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400", // Figma: Inter Regular
    paddingHorizontal: 16,
  },
  inputError: { borderWidth: 1, borderColor: COLORS.danger }, // Figma 만료 상태: 1px #D64545
  inputErrorBackground: { borderColor: COLORS.danger, backgroundColor: COLORS.errorBg },
  messageRow: { flexDirection: "row", alignItems: "center", gap: 6 }, // Figma 에러행: gap 6
  successRow: { flexDirection: "row", alignItems: "center", gap: 4 }, // Figma 재전송 안내: gap 4
  successText: { flexShrink: 1, color: COLORS.successText, fontSize: 12, fontWeight: "400", lineHeight: 14 }, // Figma: 12/14 #3B6D11
  errorText: { flexShrink: 1, color: COLORS.danger, fontSize: 12, fontWeight: "400", lineHeight: 14 }, // Figma 에러행: 12/14 error/500
  codeGroup: { width: "100%", gap: 8 }, // Figma 코드영역: 입력 + 타이머행 gap 8
  codeInput: { minHeight: 44, borderWidth: 0.5, paddingHorizontal: 14, paddingVertical: 12, lineHeight: 17 }, // Figma 코드입력: 44h, padding 12/14
  statusRow: { flexDirection: "row", alignItems: "center", width: "100%", gap: 8, minHeight: 16 },
  statusLeft: { flexShrink: 1, minWidth: 0 },
  resendControlTrailing: { marginLeft: "auto" },
  resendLink: { color: COLORS.primary, fontSize: 13, fontWeight: "400", lineHeight: 16 }, // Figma 타이머행: Regular 13/16
  resendLinkDisabled: { color: "#999EA8" }, // Figma: 카운트다운 중에는 회색
  passwordHelper: { color: COLORS.subtle, fontSize: 12, fontWeight: "400", lineHeight: 18 }, // Figma: Regular 12
  primaryButton: {
    height: 48,
    outlineStyle: "none" as never,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  submittingButton: { opacity: 0.55 },
  disabledButton: { backgroundColor: "#D1D5DB" },
  validationDisabledButton: { backgroundColor: COLORS.disabled },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "500", lineHeight: 24 }, // Figma: Inter Medium 14/24
  stepDots: { flexDirection: "row", gap: 6 }, // Figma: 36w = 8x3 + 6x2
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E0E3E8" },
  stepDotActive: { backgroundColor: "#2661FF" },
  completeContent: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 16 }, // Figma: gap 16
  completeTitle: { color: COLORS.text, fontSize: 24, fontWeight: "500" }, // Figma: Inter Medium 24
  completeButton: { width: 280, alignSelf: "center" }, // Figma: w-280
});
