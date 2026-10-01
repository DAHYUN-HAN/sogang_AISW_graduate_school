import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../../components/AppTypography";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import SchoolEmailInput from "../../components/SchoolEmailInput";
import { useRegistrationOptionsQuery } from "../../hooks/useApi";
import { authApi } from "../../services/api";
import { useUserStore } from "../../stores/userStore";
import type { AuthSession } from "../../types";
import {
  apiErrorCode,
  apiRetryAfterSeconds,
  composeSchoolEmail,
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
  CONSENT_DOCUMENT_SECTIONS,
  PRIVACY_POLICY_SUPPORT_EMAIL,
  resolvePrivacyPolicyMetadata,
} from "../../utils/privacyPolicy";
import {
  registrationVerificationFailure,
  resendAvailableAt,
  resendCountdownLabel,
  signupProgressDotIndex,
} from "../../utils/signupVerificationUi";

import { BackIcon } from "../../components/icons";
const COLORS = {
  primary: "#2761FF", // primary/500
  primary50: "#EDF2FE",
  text: "#15171C", // gray/900 (Figma)
  muted: "#6B7280", // gray/600
  subtle: "#A6ACB7", // placeholder
  tertiary: "#8A919C", // gray/500, text/tertiary
  border: "#E1E4E9", // border/default
  danger: "#D64545", // error/500 (Figma)
  success: "#22A163",
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

function FieldError({ message }: { message?: string }) {
  return message ? (
    <View style={styles.errorRow}>
      <Ionicons name="alert-circle-outline" size={14} color={COLORS.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  ) : null;
}

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
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
  const majorOptions = registrationOptionsQuery.data?.data.majors ?? [];
  const privacyPolicy = registrationOptionsQuery.data?.data.privacy_policy;
  const privacyPolicyDisplay = resolvePrivacyPolicyMetadata(privacyPolicy);

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
    const requestStartedAt = Date.now();
    try {
      setIsSubmitting(true);
      setErrors({});
      setVerificationMessage(null);
      const response = await authApi.requestRegisterVerification({ email });
      if (!isEmailDeliveryConfirmed(response.data.email_sent)) {
        const failure = registrationVerificationFailure(undefined, resend);
        if (failure.placement === "verification") {
          setVerificationMessage({ type: "error", text: failure.message });
        } else {
          setErrors({ email: failure.message });
        }
        return;
      }
      setCode("");
      setVerificationToken("");
      verificationExpiresAtRef.current = requestStartedAt + response.data.expires_in * 1000;
      const resendIn = response.data.resend_in ?? response.data.expires_in;
      const responseReceivedAt = Date.now();
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
    } catch (error) {
      const errorCode = apiErrorCode(error);
      if (errorCode === "VERIFICATION_RESEND_COOLDOWN") {
        const retryAfter = apiRetryAfterSeconds(error) ?? DEFAULT_RESEND_COOLDOWN_SECONDS;
        resendAvailableAtRef.current = Date.now() + retryAfter * 1000;
        setResendCooldown(retryAfter);
      }
      const failure = registrationVerificationFailure(errorCode, resend);
      if (failure.placement === "verification") {
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
    if (!consented) nextErrors.consent = "개인정보 수집 및 이용 동의가 필요해요.";
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
  // 상태 문구가 이미 떠 있으면 재전송 라벨을 생략하고 남은 시간만 강조한다.
  const showResendTimerOnly = Boolean(codeError || verificationMessage);

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
                <FieldError message={errors.email} />
              </View>
              <Pressable disabled={isSubmitting} onPress={() => void requestCode(false)} style={[styles.primaryButton, isSubmitting ? styles.disabledButton : null]}>
                <Text style={styles.primaryButtonText}>{isSubmitting ? "발송 중" : "인증코드 받기"}</Text>
              </Pressable>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text style={styles.heading}>인증코드를 입력해주세요</Text>
              <Text style={styles.helper}>{email}로 발송되었어요</Text>
              <View style={styles.field}>
                <TextInput
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
                  placeholderTextColor={COLORS.tertiary}
                  style={[styles.codeInput, codeError ? styles.inputError : null, verificationAttemptsLocked ? styles.verificationLockedInput : null]}
                  value={code}
                />
              </View>
              <View style={[styles.statusRow, codeError || verificationMessage ? styles.statusRowTight : null]}>
                <View style={styles.statusLeft}>
                  {codeError ? (
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle-outline" size={14} color={COLORS.danger} />
                      <Text style={styles.errorText}>{codeError}</Text>
                    </View>
                  ) : verificationMessage ? (
                    <View style={verificationMessage.type === "error" ? styles.errorRow : styles.successRow}>
                      <Ionicons
                        name={verificationMessage.type === "success" ? "checkmark-circle-outline" : "alert-circle-outline"}
                        size={14}
                        color={verificationMessage.type === "success" ? "#3B6D11" : COLORS.danger}
                      />
                      <Text style={verificationMessage.type === "success" ? styles.successText : styles.errorText}>
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
                    style={!codeError && !verificationMessage ? styles.resendControlLeading : styles.resendControlTrailing}
                  >
                    <Text style={[styles.resendLink, showResendTimerOnly ? styles.resendTimer : null]}>
                      {isSubmitting ? "발송 중" : resendCountdownLabel(resendCooldown, { timerOnly: showResendTimerOnly })}
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
                    {isSubmitting ? "발송 중" : resendCooldown > 0 ? resendCountdownLabel(resendCooldown) : "인증코드 재전송"}
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
                <TextInput value={nickname} onChangeText={(value) => { setNickname(value); setErrors((current) => ({ ...current, nickname: undefined, form: undefined })); }} placeholder="이름" placeholderTextColor={COLORS.tertiary} style={[styles.input, errors.nickname ? styles.profileInputError : null]} />
                <FieldError message={errors.nickname} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>기수</Text>
                <TextInput value={cohort} onChangeText={(value) => { setCohort(value.replace(/\D/g, "").slice(0, 3)); setErrors((current) => ({ ...current, cohort: undefined })); }} keyboardType="number-pad" placeholder="숫자만 입력 (예: 72)" placeholderTextColor={COLORS.tertiary} style={[styles.input, errors.cohort ? styles.profileInputError : null]} />
                <FieldError message={errors.cohort} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>전공</Text>
                <Pressable onPress={() => setMajorModalVisible(true)} style={[styles.selectField, errors.major ? styles.profileInputError : null]}>
                  <Text style={[styles.selectText, !major ? styles.selectPlaceholder : null]}>{major || "전공 선택"}</Text>
                  <Ionicons name="chevron-down" size={18} color={COLORS.subtle} />
                </Pressable>
                <FieldError message={errors.major} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>연락처</Text>
                <TextInput value={phone} onChangeText={(value) => { setPhone(value.replace(/\D/g, "").slice(0, 11)); setErrors((current) => ({ ...current, phone: undefined })); }} keyboardType="phone-pad" placeholder="숫자만 입력 (예: 01012345678)" placeholderTextColor={COLORS.tertiary} style={[styles.input, errors.phone ? styles.profileInputError : null]} />
                <FieldError message={errors.phone} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>비밀번호</Text>
                <TextInput value={password} onChangeText={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: undefined })); }} secureTextEntry placeholder="비밀번호" placeholderTextColor={COLORS.tertiary} style={[styles.input, errors.password ? styles.profileInputError : null]} />
                {errors.password ? <FieldError message={errors.password} /> : <Text style={styles.passwordHelper}>영문, 숫자, 특수문자 포함 8자 이상</Text>}
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>비밀번호 확인</Text>
                <TextInput value={passwordConfirm} onChangeText={(value) => { setPasswordConfirm(value); setErrors((current) => ({ ...current, passwordConfirm: undefined })); }} secureTextEntry placeholder="비밀번호 확인" placeholderTextColor={COLORS.tertiary} style={[styles.input, errors.passwordConfirm ? styles.profileInputError : null]} />
                <FieldError message={errors.passwordConfirm} />
              </View>
              <View style={styles.consentRow}>
                <Pressable
                  accessibilityHint="이용약관 및 개인정보 처리방침 동의를 변경합니다."
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: consented, disabled: !privacyPolicy }}
                  disabled={!privacyPolicy}
                  onPress={togglePrivacyConsent}
                  style={styles.consentToggle}
                >
                  <View style={[styles.checkBox, consented ? styles.checkBoxActive : null]}><Ionicons name="checkmark" size={13} color="#FFFFFF" /></View>
                  <Text style={styles.consentText}>이용약관 및 개인정보 처리방침 동의 (필수)</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="이용약관 및 개인정보 처리방침 전문 보기"
                  accessibilityRole="link"
                  disabled={!privacyPolicy}
                  hitSlop={6}
                  onPress={openPrivacyPolicy}
                  style={styles.privacyDetailsLink}
                >
                  <Ionicons name="chevron-forward" size={18} color={COLORS.subtle} />
                </Pressable>
              </View>
              <FieldError message={errors.consent} />
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
                {major === option.name ? <Ionicons name="checkmark" size={16} color={COLORS.primary} /> : null}
              </Pressable>
            ))}
            {registrationOptionsQuery.isLoading ? <Text style={styles.modalStateText}>전공 목록을 불러오는 중이에요.</Text> : null}
            {registrationOptionsQuery.isError ? (
              <View style={styles.modalRetry}>
                <Text style={styles.errorText}>전공 목록을 불러오지 못했어요.</Text>
                <Pressable accessibilityRole="button" onPress={() => void registrationOptionsQuery.refetch()} style={styles.modalRetryButton}>
                  <Text style={styles.modalRetryText}>다시 시도</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setPrivacyModalVisible(false)}
        transparent
        visible={privacyModalVisible}
      >
        <View style={styles.privacyModalBackdrop}>
          <View style={styles.privacyModalCard}>
            <View style={styles.privacyModalHandle} />
            <View style={styles.privacyModalHeader}>
              <View style={styles.privacyModalTitleRow}>
                <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
                <Text style={styles.privacyModalTitle}>이용약관 및 개인정보 처리방침</Text>
              </View>
              <Text style={styles.privacyModalInstruction}>내용을 확인하고 언제든 닫을 수 있어요.</Text>
            </View>
            <ScrollView contentContainerStyle={styles.privacyModalContent} style={styles.privacyModalScroll}>
              <View style={styles.privacyPolicyMeta}>
                <Text style={styles.privacyPolicyMetaText}>버전: {privacyPolicyDisplay.version}</Text>
                <Text style={styles.privacyPolicyMetaText}>시행일: {privacyPolicyDisplay.effectiveDate}</Text>
              </View>
              {CONSENT_DOCUMENT_SECTIONS.map((section, index) => (
                <View key={`${section.title}-${index}`} style={styles.privacyPolicySection}>
                  <Text style={styles.privacyPolicySectionTitle}>{section.title}</Text>
                  <Text style={styles.privacyPolicyBody}>{section.body}</Text>
                </View>
              ))}
              <View style={styles.privacyPolicySection}>
                <Text style={styles.privacyPolicySectionTitle}>개인정보 문의</Text>
                <Text style={styles.privacyPolicyBody}>{PRIVACY_POLICY_SUPPORT_EMAIL}</Text>
              </View>
            </ScrollView>
            <View style={styles.privacyModalFooter}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPrivacyModalVisible(false)}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>닫기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  input: { minHeight: 48, outlineStyle: "none" as never, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.bg, color: COLORS.text, fontSize: 14, fontWeight: "400", paddingHorizontal: 16 }, // Figma SignUp-Step3: 48h, border 1, px16, Regular 14
  codeInput: { height: 48, outlineStyle: "none" as never, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.bg, color: COLORS.text, fontSize: 14, fontWeight: "400", lineHeight: 22, paddingHorizontal: 16 }, // Figma verification code input: 48h, border 1, px16
  inputError: { borderColor: COLORS.danger },
  profileInputError: { borderColor: COLORS.danger, backgroundColor: "#FFF5F5" },
  verificationLockedInput: { backgroundColor: "#FFF5F5" },
  errorRow: { minHeight: 30, flexDirection: "row", alignItems: "center", gap: 4 }, // Figma status/error row: 30h, gap4
  statusRow: { flexDirection: "row", alignItems: "center", width: "100%", gap: 8 }, // 재전송만 있을 때는 본문 gap 20을 그대로 쓴다
  // 에러/안내 문구는 코드영역 안에 들어가므로 입력창과 8px만 띄운다(본문 gap 20 - 12).
  statusRowTight: { marginTop: -12 },
  statusLeft: { flexShrink: 1, minWidth: 0 },
  resendControlLeading: { alignSelf: "flex-start" },
  resendControlTrailing: { marginLeft: "auto" },
  resendLink: { color: COLORS.primary, fontSize: 13, fontWeight: "400", lineHeight: 18 }, // Figma "재전송 (04:59)": Regular 13/18
  resendTimer: { fontWeight: "500", lineHeight: 16 }, // Figma "05:00": Medium 13/16
  errorText: { flexShrink: 1, color: COLORS.danger, fontSize: 12, fontWeight: "400", lineHeight: 15 }, // Figma: error/500 Regular 12/15
  successText: { color: "#3B6D11", fontSize: 12, fontWeight: "400", lineHeight: 15 }, // Figma: success green Regular 12/15
  successRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  passwordHelper: { color: COLORS.subtle, fontSize: 12, fontWeight: "400", lineHeight: 18 }, // Figma: Regular 12
  selectField: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 }, // Figma: border 0.5, px14 py12
  selectText: { color: COLORS.text, fontSize: 14, fontWeight: "400" },
  selectPlaceholder: { color: COLORS.tertiary },
  primaryButton: { height: 48, outlineStyle: "none" as never, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: COLORS.primary }, // Figma: 48h
  disabledButton: { opacity: 0.55 },
  validationDisabledButton: { backgroundColor: "#D1D5DB" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "500", lineHeight: 24 }, // Figma button: Inter Medium 16/24
  resendButton: { alignSelf: "center", paddingVertical: 4, paddingHorizontal: 8 },
  resendText: { color: COLORS.primary, fontSize: 13, fontWeight: "400" }, // Figma: Regular 13, primary/500
  resendTextDisabled: { color: COLORS.subtle },
  consentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 2 },
  consentToggle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  checkBox: { width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 5, backgroundColor: "#C7CCD4" }, // Figma: 20, radius 5, gray/300 unchecked
  checkBoxActive: { backgroundColor: COLORS.primary }, // Figma: primary/500 checked
  consentText: { color: COLORS.text, fontSize: 14, fontWeight: "400" }, // Figma: Regular 14
  privacyDetailsLink: { alignItems: "center", justifyContent: "center", paddingLeft: 8, paddingVertical: 4 },
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
  modalRetry: { alignItems: "flex-start", gap: 8, paddingVertical: 10 },
  modalRetryButton: { borderRadius: 7, backgroundColor: COLORS.primary50, paddingHorizontal: 12, paddingVertical: 8 },
  modalRetryText: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  privacyModalBackdrop: { flex: 1, alignItems: "center", justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.42)" },
  privacyModalCard: { width: "100%", maxWidth: 405, height: "88%", overflow: "hidden", borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: COLORS.bg, paddingTop: 12 },
  privacyModalHandle: { width: 36, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: "#C7CCD4", marginBottom: 14 },
  privacyModalHeader: { gap: 6, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#EAECEF" },
  privacyModalTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  privacyModalTitle: { flex: 1, color: COLORS.text, fontSize: 18, fontWeight: "600" },
  privacyModalInstruction: { color: COLORS.tertiary, fontSize: 12, fontWeight: "400", lineHeight: 18 },
  privacyModalScroll: { flex: 1 },
  privacyModalContent: { gap: 18, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  privacyPolicyMeta: { gap: 3, borderRadius: 8, backgroundColor: "#F7F8FA", padding: 12 },
  privacyPolicyMetaText: { color: COLORS.muted, fontSize: 12, fontWeight: "400", lineHeight: 18 },
  privacyPolicySection: { gap: 5 },
  privacyPolicySectionTitle: { color: COLORS.text, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  privacyPolicyBody: { color: COLORS.text, fontSize: 13, fontWeight: "400", lineHeight: 21 },
  privacyModalFooter: { gap: 8, borderTopWidth: 1, borderTopColor: "#EAECEF", backgroundColor: COLORS.bg, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
});
