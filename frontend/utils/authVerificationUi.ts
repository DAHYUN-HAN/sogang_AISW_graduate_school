export type AuthVerificationFailureState = "expired" | "attempts" | null;

export const VERIFICATION_ATTEMPTS_EXCEEDED_MESSAGE =
  "인증 시도 횟수를 초과했어요.\n잠시 후 다시 시도해주세요.";

export function verificationFailureStateFromErrorCode(
  errorCode: string | undefined,
): AuthVerificationFailureState {
  if (errorCode === "VERIFICATION_EXPIRED") return "expired";
  if (errorCode === "VERIFICATION_ATTEMPTS_EXCEEDED") return "attempts";
  return null;
}

export function verificationHasExpired(
  countdown: number,
  failureState: AuthVerificationFailureState,
) {
  return failureState === "expired" || countdown <= 0;
}
