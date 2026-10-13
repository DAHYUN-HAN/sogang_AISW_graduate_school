import { AxiosHeaders, isAxiosError } from "axios";

export function composeSchoolEmail(emailId: string) {
  return `${emailId.trim().toLowerCase()}@sogang.ac.kr`;
}

// "…로 발송되었어요" 안내에는 사용자가 입력한 대소문자 그대로 보인다. 서버에 보내고 메일이
// 가는 주소는 composeSchoolEmail의 소문자 주소이고, 학교 메일은 대소문자를 구분하지 않는다.
export function displaySchoolEmail(emailId: string) {
  return `${emailId.trim()}@sogang.ac.kr`;
}

export function isEmailDeliveryConfirmed(emailSent: unknown): emailSent is true {
  return emailSent === true;
}

export function emailIdError(emailId: string) {
  const value = emailId.trim();
  if (!value) return "이메일 ID를 입력해주세요.";
  if (!/^[a-zA-Z0-9._%+-]+$/.test(value)) return "올바른 이메일 ID 형식이 아니에요.";
  return null;
}

export function passwordError(password: string) {
  if (!password || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return "영문, 숫자, 특수문자 포함 8자 이상 입력해주세요.";
  }
  return null;
}

export function passwordConfirmationError(password: string, passwordConfirmation: string) {
  if (!passwordConfirmation || password !== passwordConfirmation) {
    return "비밀번호가 일치하지 않아요.";
  }
  return null;
}

export function phoneError(phone: string) {
  if (!/^01[016789]\d{7,8}$/.test(phone)) return "올바른 연락처 형식이 아니에요.";
  return null;
}

export function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function apiErrorCode(error: unknown) {
  if (!isAxiosError(error)) return undefined;
  return error.response?.data?.code as string | undefined;
}

export function isApiResponseUncertain(error: unknown) {
  if (!isAxiosError(error)) return false;
  return error.response === undefined;
}

export function apiRetryAfterSeconds(error: unknown) {
  if (!isAxiosError(error)) return undefined;
  const headers = error.response?.headers;
  const rawValue =
    headers instanceof AxiosHeaders
      ? headers.get("retry-after")
      : (headers as Record<string, unknown> | undefined)?.["retry-after"];
  const normalized = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (typeof normalized !== "string" && typeof normalized !== "number") return undefined;
  const parsed = typeof normalized === "string" ? Number(normalized.trim()) : normalized;
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 3600) return undefined;
  return parsed;
}

export function apiErrorData(error: unknown) {
  if (!isAxiosError(error)) return undefined;
  return error.response?.data?.data as Record<string, unknown> | undefined;
}

export function apiErrorStatus(error: unknown) {
  if (!isAxiosError(error)) return undefined;
  return error.response?.status;
}
