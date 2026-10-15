import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText as Text } from "../../components/AppTypography";
import { FIELD_ERROR_COLOR, FieldInput, fieldBorder } from "../../components/FieldBorder";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import SchoolEmailInput from "../../components/SchoolEmailInput";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { TOAST_ERROR_MESSAGES } from "../../utils/toast";
import { CheckboxCheckIcon, ConsentChevronIcon, SheetCheckIcon } from "../../components/icons";
import { useRegistrationOptionsQuery } from "../../hooks/useApi";
import { authApi } from "../../services/api";
import { useUserStore } from "../../stores/userStore";
import type { AuthSession } from "../../types";
import {
  apiErrorCode,
  apiRetryAfterSeconds,
  composeSchoolEmail,
  displaySchoolEmail,
  emailIdError,
  isEmailDeliveryConfirmed,
  passwordConfirmationError,
  passwordError,
  phoneError,
} from "../../utils/authValidation";
import {
  VERIFICATION_ATTEMPTS_EXCEEDED_MESSAGE,
  verificationFailureStateFromErrorCode,
  verificationHasExpired,
} from "../../utils/authVerificationUi";
import {
  registrationVerificationFailure,
  resendAvailableAt,
  resendCountdownLabel,
  signupProgressDotIndex,
} from "../../utils/signupVerificationUi";

import { BackIcon } from "../../components/icons";
import PrivacyConsentSheet from "../../components/PrivacyConsentSheet";
import { useLoadErrorOverlay } from "../../components/NetworkErrorState";
import { BUTTON_TEXT } from "../../utils/buttonText";
const COLORS = {
  primary: "#2761FF", // primary/500
  primary50: "#EDF2FE",
  text: "#15171C", // gray/900 (Figma)
  muted: "#6B7280", // gray/600
  subtle: "#A6ACB7", // placeholder
  tertiary: "#8A919C", // gray/500, text/tertiary
  border: "#E1E4E9", // border/default
  danger: FIELD_ERROR_COLOR,
  bg: "#FFFFFF",
};

type FieldErrors = Partial<Record<"email" | "code" | "nickname" | "cohort" | "major" | "phone" | "password" | "passwordConfirm" | "consent" | "form", string>>;
type VerificationMessage = { type: "success" | "error"; text: string } | null;
type VerificationFailureState = "expired" | "attempts" | null;

const DEFAULT_RESEND_COOLDOWN_SECONDS = 5 * 60;

function StepDots({ step }: { step: number }) {
  const activeStep = signupProgressDotIndex(step);
  return (
    <View style={styles.stepDots}>
      {[0, 1, 2].map((item) => <View key={item} style={[styles.stepDot, activeStep === item ? styles.stepDotActive : null]} />)}
    </View>
  );
}

// 피그마 오류 문구: 한 줄은 12/14, 줄을 직접 나눈 두 줄 문구는 줄 높이 145%(17.4)다.
// 아이콘은 어느 쪽이든 첫 줄 옆에 둔다(errorRow가 위쪽 정렬).
function errorTextStyle(text: string) {
  return [styles.errorText, text.includes("\n") ? styles.errorTextMultiline : null];
}

function FieldError({ message, style }: { message?: string; style?: StyleProp<ViewStyle> }) {
  return message ? (
    <View style={[styles.errorRow, style]}>
      <Ionicons name="alert-circle-outline" size={14} color={COLORS.danger} />
      <Text style={errorTextStyle(message)}>{message}</Text>
    </View>
  ) : null;
}

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { toast, showToast, hideToast } = useToast();
  const setSession = useUserStore((state) => state.setSession);
  const [step, setStep] = useState(0);
  const [emailId, setEmailId] = useState("");
  const [code, setCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const verificationExpiresAtRef = useRef(0);
  const resendAvailableAtRef = useRef(0);
  const [verificationMessage, setVerificationMessage] = useState<VerificationMessage>(null);
  // Figma SignUp-Step2-Resent: 재전송 뒤에는 안내문이 "재발송되었어요"로 바뀌고 남은 시간이 회색이 된다.
  const [codeResent, setCodeResent] = useState(false);
  const [verificationFailureState, setVerificationFailureState] = useState<VerificationFailureState>(null);
  const [nickname, setNickname] = useState("");
  const [cohort, setCohort] = useState("");
  const [major, setMajor] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [consented, setConsented] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [majorModalVisible, setMajorModalVisible] = useState(false);
  const [profileValidationAttempted, setProfileValidationAttempted] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [createdSession, setCreatedSession] = useState<AuthSession | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const registrationOptionsQuery = useRegistrationOptionsQuery();
  // 전공 목록·개인정보 처리방침을 받지 못하면(4xx 포함) 앱 전체 LoadError로 덮는다.
  useLoadErrorOverlay(registrationOptionsQuery.error, () => void registrationOptionsQuery.refetch());
  const majorOptions = registrationOptionsQuery.data?.data.majors ?? [];
  const privacyPolicy = registrationOptionsQuery.data?.data.privacy_policy;

  const email = composeSchoolEmail(emailId);

  useEffect(() => {
    if (step !== 1) return;
    const updateTimers = () => {
      const now = Date.now();
      setCountdown(Math.max(0, Math.ceil((verificationExpiresAtRef.current - now) / 1000)));
      setResendCooldown(Math.max(0, Math.ceil((resendAvailableAtRef.current - now) / 1000)));
    };
    updateTimers();
    const timer = setInterval(updateTimers, 1000);
    return () => clearInterval(timer);
  }, [step]);

  const goBack = () => {
    if (step === 1 || step === 2) {
      setErrors({});
      setVerificationMessage(null);
      setStep((value) => value - 1);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/auth/login");
  };

  const requestCode = async (resend = false) => {
    const emailError = emailIdError(emailId);
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }
    try {
      setIsSubmitting(true);
      setErrors({});
      setVerificationMessage(null);
      const response = await authApi.requestRegisterVerification({ email });
      if (!isEmailDeliveryConfirmed(response.data.email_sent)) {
        // 메일을 보내지 못했다. 입력 문제가 아니라 칸을 빨갛게 하지 않고 오류 토스트만 띄운다.
        showToast(TOAST_ERROR_MESSAGES.verificationEmail);
        return;
      }
      setCode("");
      setVerificationToken("");
      const resendIn = response.data.resend_in ?? response.data.expires_in;
      // 만료와 재전송 가능 시각을 같은 기준(응답 받은 때)으로 잰다. 요청 시작을 기준으로 하면
      // 메일 발송에 걸린 몇 초만큼 만료가 먼저 와서 회색 "재전송 (00:05)"가 잠깐 보였다.
      const responseReceivedAt = Date.now();
      verificationExpiresAtRef.current = responseReceivedAt + response.data.expires_in * 1000;
      resendAvailableAtRef.current = resendAvailableAt(responseReceivedAt, resendIn);
      setCountdown(
        Math.max(0, Math.ceil((verificationExpiresAtRef.current - responseReceivedAt) / 1000)),
      );
      setResendCooldown(
        Math.max(0, Math.ceil((resendAvailableAtRef.current - responseReceivedAt) / 1000)),
      );
      setStep(1);
      setVerificationFailureState(null);
      setVerificationMessage(resend ? { type: "success", text: "새 인증코드가 발송되었어요." } : null);
      setCodeResent(resend);
    } catch (error) {
      const errorCode = apiErrorCode(error);
      if (errorCode === "VERIFICATION_RESEND_COOLDOWN") {
        const retryAfter = apiRetryAfterSeconds(error) ?? DEFAULT_RESEND_COOLDOWN_SECONDS;
        resendAvailableAtRef.current = Date.now() + retryAfter * 1000;
        setResendCooldown(retryAfter);
      }
      const failure = registrationVerificationFailure(errorCode, resend);
      if (!failure) {
        showToast(TOAST_ERROR_MESSAGES.verificationEmail);
      } else if (failure.placement === "verification") {
        setVerificationMessage({ type: "error", text: failure.message });
      } else {
        setErrors({ email: failure.message });
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
      const response = await authApi.verifyRegisterEmail({ email, code });
      setVerificationToken(response.data.verification_token);
      setVerificationMessage(null);
      setStep(2);
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
      setVerificationMessage(null);
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

  const validateProfile = () => {
    setProfileValidationAttempted(true);
    const nextErrors: FieldErrors = {};
    if (!nickname.trim()) nextErrors.nickname = "이름을 입력해주세요.";
    if (!/^\d{1,3}$/.test(cohort)) nextErrors.cohort = "숫자만 입력해주세요.";
    if (!major) nextErrors.major = "전공을 선택해주세요.";
    const nextPhoneError = phoneError(phone);
    if (nextPhoneError) nextErrors.phone = nextPhoneError;
    const nextPasswordError = passwordError(password);
    if (nextPasswordError) nextErrors.password = nextPasswordError;
    const nextPasswordConfirmationError = passwordConfirmationError(password, passwordConfirm);
    if (nextPasswordConfirmationError) nextErrors.passwordConfirm = nextPasswordConfirmationError;
    if (!consented) nextErrors.consent = "약관에 동의해주세요.";
    if (!privacyPolicy) nextErrors.consent = "개인정보 처리방침 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const openPrivacyPolicy = () => {
    if (!privacyPolicy) {
      setErrors((current) => ({
        ...current,
        consent: "개인정보 처리방침 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
      }));
      return;
    }
    setPrivacyModalVisible(true);
  };

  const togglePrivacyConsent = () => {
    setConsented((value) => !value);
    setErrors((current) => ({ ...current, consent: undefined }));
  };

  const register = async () => {
    if (!verificationToken) {
      setErrors({ form: "학교 이메일 인증을 다시 진행해주세요." });
      setStep(0);
      return;
    }
    if (!validateProfile()) return;
    try {
      setIsSubmitting(true);
      const response = await authApi.register({
        verification_token: verificationToken,
        password,
        nickname: nickname.trim(),
        cohort,
        major,
        phone,
        privacy_policy_version: privacyPolicy?.version ?? "",
        privacy_consent: consented,
      });
      setCreatedSession(response.data);
      setErrors({});
      setStep(3);
    } catch (error) {
      const errorCode = apiErrorCode(error);
      if (errorCode === "PRIVACY_POLICY_VERSION_MISMATCH") {
        setConsented(false);
        await registrationOptionsQuery.refetch();
        setErrors({ consent: "개인정보 처리방침이 변경되었어요. 내용을 확인하고 다시 동의해주세요." });
        return;
      }
      if (errorCode === "VALIDATION_ERROR") {
        setMajor("");
        await registrationOptionsQuery.refetch();
        setErrors({ major: "현재 선택할 수 있는 전공을 다시 선택해주세요." });
        return;
      }
      setErrors({ form: "회원가입을 완료하지 못했어요. 입력 정보와 인증 상태를 확인해주세요." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const complete = () => {
    if (createdSession) setSession(createdSession);
    router.replace("/(tabs)/home");
  };

  const isProfileFormValid =
    Boolean(nickname.trim()) &&
    /^\d{1,3}$/.test(cohort) &&
    Boolean(major) &&
    majorOptions.some((item) => item.name === major) &&
    !phoneError(phone) &&
    !passwordError(password) &&
    Boolean(passwordConfirm) &&
    password === passwordConfirm &&
    consented &&
    Boolean(privacyPolicy);
  // 처음엔 파란 활성 버튼. 한 번 눌러 미입력·오류가 확인되면 회색으로 전환.
  // 회색이어도 탭은 가능해 부족한 항목의 오류 문구를 다시 볼 수 있다(제출 중에만 비활성).
  const registerBlocked =
    isSubmitting ||
    (profileValidationAttempted && (!isProfileFormValid || Boolean(errors.form) || Boolean(errors.nickname)));
  const verificationExpired =
    step === 1 && verificationExpiresAtRef.current > 0 && verificationHasExpired(countdown, verificationFailureState);
  const verificationAttemptsLocked = verificationFailureState === "attempts" && !verificationExpired;
  const codeError = verificationExpired
    ? "인증 시간이 만료되었어요. 재전송을 눌러주세요."
    : errors.code;

  return (
    <View style={styles.screen}>
      {step !== 3 ? (
        <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 18) }]}>
          <Pressable accessibilityLabel="뒤로" onPress={goBack} style={styles.iconButton}>
            <BackIcon size={22} color={COLORS.text} />
          </Pressable>
          <Text style={styles.appBarTitle}>회원가입</Text>
          <View style={styles.iconButton} />
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.completeContent}>
          <Ionicons name="checkmark-circle-outline" size={64} color="#2E9E5B" />
          <Text style={styles.completeTitle}>가입이 완료되었어요!</Text>
          <Pressable onPress={complete} style={[styles.primaryButton, styles.completeButton]}>
            <Text style={styles.primaryButtonText}>홈으로 가기</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={styles.scroller} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <StepDots step={step} />

          {step === 0 ? (
            <>
              <Text style={styles.heading}>학교 이메일을 인증해주세요</Text>
              <View style={styles.field}>
                <Text style={styles.label}>학교 이메일</Text>
                <SchoolEmailInput
                  value={emailId}
                  onChangeText={(value) => { setEmailId(value); setErrors({}); }}
                  hasError={Boolean(errors.email)}
                />
                <FieldError message={errors.email} style={styles.emailErrorRow} />
              </View>
              <Pressable disabled={isSubmitting} onPress={() => void requestCode(false)} style={[styles.primaryButton, isSubmitting ? styles.disabledButton : null]}>
                <Text style={styles.primaryButtonText}>{isSubmitting ? "발송 중" : "인증코드 받기"}</Text>
              </Pressable>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text style={styles.heading}>인증코드를 입력해주세요</Text>
              <Text style={styles.helper}>{displaySchoolEmail(emailId)}로 {codeResent ? "재발송" : "발송"}되었어요</Text>
              <View style={styles.field}>
                <FieldInput
                  hasError={Boolean(codeError)}
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={(value) => {
                    setCode(value.replace(/\D/g, ""));
                    if (!verificationAttemptsLocked) {
                      setErrors({});
                      setVerificationFailureState(null);
                    }
                  }}
                  placeholder="인증코드 6자리"
                  placeholderTextColor={COLORS.subtle}
                  style={styles.codeInput}
                  value={code}
                />
              </View>
              <View style={styles.statusRow}>
                <View style={styles.statusLeft}>
                  {codeError ? (
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle-outline" size={14} color={COLORS.danger} />
                      <Text style={errorTextStyle(codeError)}>{codeError}</Text>
                    </View>
                  ) : verificationMessage ? (
                    <View style={verificationMessage.type === "error" ? styles.errorRow : styles.successRow}>
                      <Ionicons
                        name={verificationMessage.type === "success" ? "checkmark-circle-outline" : "alert-circle-outline"}
                        size={14}
                        color={verificationMessage.type === "success" ? "#3B6D11" : COLORS.danger}
                      />
                      <Text style={verificationMessage.type === "success" ? styles.successText : errorTextStyle(verificationMessage.text)}>
                        {verificationMessage.text}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {verificationExpired || verificationAttemptsLocked ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isSubmitting || resendCooldown > 0 }}
                    disabled={isSubmitting || resendCooldown > 0}
                    hitSlop={8}
                    onPress={() => void requestCode(true)}
                    style={styles.resendControlTrailing}
                  >
                    {/* Figma SignUp-Step2: 처음 발송은 파란 "재전송 (04:59)"를 오른쪽에, 재전송 뒤에는 같은 자리에 회색으로 둔다. */}
                    <Text style={[styles.resendLink, codeResent && resendCooldown > 0 ? styles.resendLinkDisabled : null]}>
                      {isSubmitting ? "발송 중" : resendCountdownLabel(resendCooldown)}
                    </Text>
                  </Pressable>
                )}
              </View>
              {verificationExpired ? (
                <Pressable
                  disabled={isSubmitting || resendCooldown > 0}
                  onPress={() => void requestCode(true)}
                  style={[styles.primaryButton, isSubmitting ? styles.disabledButton : null, resendCooldown > 0 ? styles.validationDisabledButton : null]}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting ? "발송 중" : resendCooldown > 0 ? resendCountdownLabel(resendCooldown) : "재전송"}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  disabled={isSubmitting || verificationAttemptsLocked}
                  onPress={verifyCode}
                  style={[styles.primaryButton, isSubmitting ? styles.disabledButton : null, verificationAttemptsLocked ? styles.validationDisabledButton : null]}
                >
                  <Text style={styles.primaryButtonText}>{isSubmitting ? "확인 중" : "다음"}</Text>
                </Pressable>
              )}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.heading}>기본 정보를 입력해주세요</Text>
              <View style={styles.field}>
                <Text style={styles.label}>이름</Text>
                <FieldInput hasError={Boolean(errors.nickname)} value={nickname} onChangeText={(value) => { setNickname(value); setErrors((current) => ({ ...current, nickname: undefined, form: undefined })); }} placeholder="이름" placeholderTextColor={COLORS.tertiary} style={styles.input} />
                <FieldError message={errors.nickname} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>기수</Text>
                <FieldInput hasError={Boolean(errors.cohort)} value={cohort} onChangeText={(value) => { setCohort(value.replace(/\D/g, "").slice(0, 3)); setErrors((current) => ({ ...current, cohort: undefined })); }} keyboardType="number-pad" placeholder="숫자만 입력 (예: 72)" placeholderTextColor={COLORS.tertiary} style={styles.input} />
                <FieldError message={errors.cohort} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>전공</Text>
                <Pressable onPress={() => setMajorModalVisible(true)} style={[styles.selectField, fieldBorder(false, Boolean(errors.major))]}>
                  <Text style={[styles.selectText, !major ? styles.selectPlaceholder : null]}>{major || "전공 선택"}</Text>
                  <Ionicons name="chevron-down" size={18} color={COLORS.subtle} />
                </Pressable>
                <FieldError message={errors.major} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>연락처</Text>
                <FieldInput hasError={Boolean(errors.phone)} value={phone} onChangeText={(value) => { setPhone(value.replace(/\D/g, "").slice(0, 11)); setErrors((current) => ({ ...current, phone: undefined })); }} keyboardType="phone-pad" placeholder="숫자만 입력 (예: 01012345678)" placeholderTextColor={COLORS.tertiary} style={styles.input} />
                <FieldError message={errors.phone} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>비밀번호</Text>
                <FieldInput hasError={Boolean(errors.password)} value={password} onChangeText={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: undefined })); }} secureTextEntry placeholder="비밀번호" placeholderTextColor={COLORS.tertiary} style={styles.input} />
                {errors.password ? <FieldError message={errors.password} /> : <Text style={styles.passwordHelper}>영문, 숫자, 특수문자 포함 8자 이상</Text>}
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>비밀번호 확인</Text>
                <FieldInput hasError={Boolean(errors.passwordConfirm)} value={passwordConfirm} onChangeText={(value) => { setPasswordConfirm(value); setErrors((current) => ({ ...current, passwordConfirm: undefined })); }} secureTextEntry placeholder="비밀번호 확인" placeholderTextColor={COLORS.tertiary} style={styles.input} />
                <FieldError message={errors.passwordConfirm} />
              </View>
              {/* Figma SignUp-Step3-Error 약관동의블록: 동의 줄 아래 6에 오류 문구를 붙인다. */}
              <View style={styles.consentBlock}>
                <View style={styles.consentRow}>
                  <Pressable
                    accessibilityHint="이용약관 및 개인정보 처리방침 동의를 변경합니다."
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: consented, disabled: !privacyPolicy }}
                    disabled={!privacyPolicy}
                    onPress={togglePrivacyConsent}
                    style={styles.consentToggle}
                  >
                    <View style={[styles.checkBox, consented ? styles.checkBoxActive : null]}><CheckboxCheckIcon /></View>
                    <Text style={styles.consentText}>이용약관 및 개인정보 처리방침 동의 (필수)</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="이용약관 및 개인정보 처리방침 전문 보기"
                    accessibilityRole="link"
                    disabled={!privacyPolicy}
                    hitSlop={14}
                    onPress={openPrivacyPolicy}
                    style={styles.privacyDetailsLink}
                  >
                    <ConsentChevronIcon color={COLORS.subtle} />
                  </Pressable>
                </View>
                <FieldError message={errors.consent} />
              </View>
              <FieldError message={errors.form} />
              <Pressable disabled={isSubmitting} onPress={register} style={[styles.primaryButton, registerBlocked ? styles.validationDisabledButton : null]}>
                <Text style={styles.primaryButtonText}>{isSubmitting ? "가입 중" : "가입하기"}</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      )}

      <Modal animationType="slide" transparent visible={majorModalVisible} onRequestClose={() => setMajorModalVisible(false)}>
        <Pressable onPress={() => setMajorModalVisible(false)} style={styles.modalBackdrop}>
          <Pressable onPress={() => undefined} style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>전공 선택</Text>
            {majorOptions.map((option) => (
              <Pressable key={option.id} onPress={() => { setMajor(option.name); setErrors((current) => ({ ...current, major: undefined })); setMajorModalVisible(false); }} style={styles.modalOption}>
                <Text style={[styles.modalOptionText, major === option.name ? styles.modalOptionTextSelected : null]}>{option.name}</Text>
                {major === option.name ? <SheetCheckIcon color={COLORS.primary} /> : null}
              </Pressable>
            ))}
            {registrationOptionsQuery.isLoading ? <Text style={styles.modalStateText}>전공 목록을 불러오는 중이에요.</Text> : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* 계정 설정과 같은 동의 시트(Figma PrivacyConsentSheet)를 쓴다. */}
      <PrivacyConsentSheet visible={privacyModalVisible} onClose={() => setPrivacyModalVisible(false)} />
      <Toast toast={toast} onHide={hideToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  appBar: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.bg, paddingHorizontal: 16, paddingBottom: 12 },
  iconButton: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  appBarTitle: { color: COLORS.text, fontSize: 18, fontWeight: "500", lineHeight: 26 }, // Figma: Inter Medium 18/26
  scroller: { flex: 1 },
  content: { gap: 20, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24 }, // Figma body: px20, py24, gap20
  stepDots: { flexDirection: "row", gap: 6 }, // Figma dots group: 36w = 8x3 + 6x2
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#DDE2EA" },
  stepDotActive: { backgroundColor: COLORS.primary },
  heading: { color: COLORS.text, fontSize: 20, fontWeight: "500", lineHeight: 28 }, // Figma: Inter Medium 20/28
  helper: { color: COLORS.tertiary, fontSize: 13, fontWeight: "400", lineHeight: 18 }, // Figma: Inter Regular 13/18
  field: { gap: 6 }, // Figma label→input gap
  label: { color: COLORS.text, fontSize: 14, fontWeight: "500", lineHeight: 22 }, // Figma: Inter Medium 14/22
  // 입력 칸 테두리는 FieldBorder 공통 원칙(평소 0.5 · 입력 중 1 #21262E · 오류 1 #D64545)을 따른다.
  input: { minHeight: 48, borderRadius: 8, backgroundColor: COLORS.bg, color: COLORS.text, fontSize: 14, fontWeight: "400", paddingHorizontal: 16 }, // Figma SignUp-Step3: 48h, px16, Regular 14
  codeInput: { height: 48, borderRadius: 8, backgroundColor: COLORS.bg, color: COLORS.text, fontSize: 14, fontWeight: "400", lineHeight: 22, paddingHorizontal: 16 }, // Figma verification code input: 48h, px16
  // 피그마 SignUp 오류 화면: 오류 칸은 배경 없이 빨간 테두리만 둔다.
  // Figma SignUp-Step3-Error: 칸 아래 7에 오류 문구(12/14), 그 아래 20에 다음 라벨
  errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  // Figma SignUp-Step1-Duplicate: 칸 아래 14에 오류 문구, 그 아래 28에 버튼 (field gap 6, 본문 gap 20 기준)
  emailErrorRow: { marginTop: 8, marginBottom: 8 },
  // Figma SignUp-Step2: 인증코드 칸 아래 6에 재전송·안내 줄을 둔다(본문 gap 20 - 14).
  statusRow: { flexDirection: "row", alignItems: "center", width: "100%", gap: 8, marginTop: -14 },
  statusLeft: { flexShrink: 1, minWidth: 0 },
  resendControlTrailing: { marginLeft: "auto" },
  resendLink: { color: COLORS.primary, fontSize: 13, fontWeight: "400", lineHeight: 16 }, // Figma "재전송 (04:59)": Regular 13/16
  resendLinkDisabled: { color: "#999EA8" }, // Figma SignUp-Step2-Resent: 재전송 뒤 카운트다운은 회색
  errorText: { flexShrink: 1, color: COLORS.danger, fontSize: 12, fontWeight: "400", lineHeight: 14 }, // Figma: error/500 Regular 12/14
  errorTextMultiline: { lineHeight: 17.4 }, // Figma SignUp-Step2-Failed: 두 줄 문구 줄 높이 145%
  successText: { color: "#3B6D11", fontSize: 12, fontWeight: "400", lineHeight: 15 }, // Figma: success green Regular 12/15
  successRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  passwordHelper: { color: COLORS.subtle, fontSize: 12, fontWeight: "400", lineHeight: 18 }, // Figma: Regular 12
  selectField: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 }, // Figma: px14 py12 (테두리는 FieldBorder)
  selectText: { color: COLORS.text, fontSize: 14, fontWeight: "400" },
  selectPlaceholder: { color: COLORS.tertiary },
  primaryButton: { height: 48, outlineStyle: "none" as never, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: COLORS.primary }, // Figma: 48h
  disabledButton: { opacity: 0.55 },
  validationDisabledButton: { backgroundColor: "#D1D5DB" },
  primaryButtonText: { ...BUTTON_TEXT, color: "#FFFFFF", fontWeight: "500" }, // Figma: Medium 16 (줄 높이는 버튼 공통 19)
  resendButton: { alignSelf: "center", paddingVertical: 4, paddingHorizontal: 8 },
  resendText: { color: COLORS.primary, fontSize: 13, fontWeight: "400" }, // Figma: Regular 13, primary/500
  resendTextDisabled: { color: COLORS.subtle },
  consentBlock: { gap: 6 }, // Figma 약관동의블록: 동의 줄 → 오류 문구 6
  consentRow: { minHeight: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, // Figma 약관동의: 20h, gap 8
  consentToggle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  checkBox: { width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 5, backgroundColor: "#C7CCD4" }, // Figma: 20, radius 5, gray/300 unchecked
  checkBoxActive: { backgroundColor: COLORS.primary }, // Figma: primary/500 checked
  consentText: { color: COLORS.text, fontSize: 14, fontWeight: "400" }, // Figma: Regular 14
  privacyDetailsLink: { alignItems: "center", justifyContent: "center" }, // Figma 화살표 16x16, 누르는 영역은 hitSlop
  completeContent: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 16 }, // Figma: gap 16
  completeTitle: { color: COLORS.text, fontSize: 24, fontWeight: "500" }, // Figma: Inter Medium 24
  completeButton: { width: 280, alignSelf: "center" }, // Figma: w-280
  modalBackdrop: { flex: 1, justifyContent: "flex-end", alignItems: "center", backgroundColor: "rgba(17,24,39,0.42)" },
  modalCard: { width: "100%", maxWidth: 405, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: COLORS.bg, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  modalHandle: { width: 36, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: "#C7CCD4", marginBottom: 16 }, // Figma handle
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: "600", marginBottom: 8 }, // Figma: SemiBold 18
  modalOption: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#EAECEF" }, // Figma divider
  modalOptionText: { color: COLORS.text, fontSize: 15, fontWeight: "400" }, // Figma: Regular 15
  modalOptionTextSelected: { color: COLORS.primary, fontWeight: "500" }, // Figma: selected = primary Medium
  modalStateText: { color: COLORS.muted, fontSize: 13, fontWeight: "700", paddingVertical: 14 },
});
