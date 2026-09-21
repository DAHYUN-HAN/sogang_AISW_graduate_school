import { resendCountdownLabel } from "./signupVerificationUi";

type PasswordResetResendControlOptions = {
  verificationExpired: boolean;
  verificationAttemptsLocked: boolean;
  isSubmitting: boolean;
  resendCooldown: number;
};

export function passwordResetResendControl(options: PasswordResetResendControlOptions) {
  return {
    visible: !options.verificationExpired && !options.verificationAttemptsLocked,
    disabled: options.isSubmitting || options.resendCooldown > 0,
    label: options.isSubmitting ? "발송 중" : resendCountdownLabel(options.resendCooldown),
  };
}

// 비밀번호 찾기 진행 점(Figma Body 상단 3개): 이메일 → 인증코드 → 새 비밀번호.
export function passwordResetProgressDotIndex(mode: string): number {
  if (mode === "code") return 1;
  if (mode === "reset" || mode === "complete") return 2;
  return 0;
}
