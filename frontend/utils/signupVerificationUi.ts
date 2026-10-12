import { formatCountdown } from "./authValidation";

type RegistrationVerificationFailurePlacement = "email" | "verification";

type RegistrationVerificationFailure = {
  placement: RegistrationVerificationFailurePlacement;
  message: string;
};


export function registrationVerificationFailure(
  errorCode: string | undefined,
  resend: boolean,
): RegistrationVerificationFailure {
  const message =
    errorCode === "CONFLICT"
      ? "이미 가입된 이메일이에요."
      : errorCode === "VERIFICATION_RESEND_COOLDOWN"
        ? "인증코드는 5분 후 다시 요청할 수 있어요."
        : errorCode === "RATE_LIMITED"
          ? "인증 요청이 너무 많아요. 잠시 후 다시 시도해주세요."
          : "인증 메일을 발송하지 못했어요. 잠시 후 다시 시도해주세요.";

  return {
    placement: resend ? "verification" : "email",
    message,
  };
}


// 이메일(0)·인증코드(1)·기본 정보(2) 단계가 진행 점 세 개에 차례로 대응한다.
export function signupProgressDotIndex(step: number): number {
  return Math.min(Math.max(0, step), 2);
}


export function resendAvailableAt(responseReceivedAt: number, resendInSeconds: number): number {
  return responseReceivedAt + resendInSeconds * 1000;
}


// 평상시에는 "재전송 (04:59)"로 붙여 보여준다. 옆에 상태 메시지("새 인증코드가
// 발송되었어요.")가 이미 떠 있을 때는 라벨이 중복이라 남은 시간만 보여준다.
export function resendCountdownLabel(seconds: number, options?: { timerOnly?: boolean }): string {
  if (seconds <= 0) return "재전송";
  return options?.timerOnly ? formatCountdown(seconds) : `재전송 (${formatCountdown(seconds)})`;
}
