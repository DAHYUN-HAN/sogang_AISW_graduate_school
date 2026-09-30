export type OperationStatus = "active" | "ended";

const OPERATION_STATUS_KEY = "operation_status";

// 운영이 끝난 대상은 새 활동인증의 선택 목록에서 빠진다. 정확히 "ended"일 때만
// 종료로 보므로, 키가 없는 옛 글은 운영 중이 된다.
export function operationStatus(metadata?: Record<string, unknown> | null): OperationStatus {
  const stored = metadata?.[OPERATION_STATUS_KEY];
  return stored === "ended" ? "ended" : "active";
}

export function participationApplicationUrl(metadata?: Record<string, unknown> | null) {
  const value = metadata?.application_url;
  if (typeof value !== "string") return undefined;
  return value.trim() || undefined;
}
