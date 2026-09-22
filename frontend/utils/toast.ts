// 토스트 문구는 디자인(Component/Toast-*)에 정해진 문장을 그대로 쓴다.
// 화면마다 다시 적지 않도록 여기에 모아둔다.

/** 뜬 순간부터 사라질 때까지의 전체 시간. 페이드 아웃을 포함한다. */
export const TOAST_DURATION_MS = 3000;
/** 오류 알림이라 등장은 즉시다. 사라질 때만 서서히 흐려진다. */
export const TOAST_FADE_OUT_MS = 320;

/** 완전히 보이는 상태로 머무는 시간. 전체 시간이 짧아도 음수가 되지 않는다. */
export function toastHoldMs(durationMs = TOAST_DURATION_MS): number {
  return Math.max(0, durationMs - TOAST_FADE_OUT_MS);
}

export const TOAST_MESSAGES = {
  /** Component/Toast-LinkFormatError */
  linkFormatError: "올바른 링크 주소가 아니에요. 다시 확인해주세요",
  /** Component/Toast-RequiredFieldError */
  requiredFieldError: "필수 항목을 모두 입력해주세요",
  /** Component/Toast-Error */
  error: "오류가 발생했어요. 다시 시도해주세요",
} as const;

export type ToastMessage = (typeof TOAST_MESSAGES)[keyof typeof TOAST_MESSAGES];

export type ToastState = { message: string; id: number } | null;

/**
 * 같은 문구가 다시 뜰 때도 표시 시간이 처음부터 흐르도록 id를 올린다.
 * id가 바뀌지 않으면 표시 중인 토스트의 타이머가 이어져 곧바로 사라진다.
 */
export function nextToastState(current: ToastState, message: string): NonNullable<ToastState> {
  return { message, id: (current?.id ?? 0) + 1 };
}
