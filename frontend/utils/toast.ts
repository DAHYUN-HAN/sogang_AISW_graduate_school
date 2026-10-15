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

// 피그마 Spec/앱 알림 → 토스트 전환. 휴대폰 기본 알림창을 쓰던 곳을 토스트로 바꿨다.
/** 실패 · Toast-Error 재사용 */
// 2026-10-15 사용자 결정: 어떤 동작이 실패했는지 따로 알리지 않고 모두 피그마
// Component/Toast-Error 문구 하나로 보인다. 화면 코드는 키로 부르므로 키는 그대로 둔다.
const TOAST_ERROR_FAILED = "오류가 발생했어요. 다시 시도해주세요.";

export const TOAST_ERROR_MESSAGES = {
  postEdit: TOAST_ERROR_FAILED,
  report: TOAST_ERROR_FAILED,
  like: TOAST_ERROR_FAILED,
  bookmark: TOAST_ERROR_FAILED,
  postDelete: TOAST_ERROR_FAILED,
  commentCreate: TOAST_ERROR_FAILED,
  commentEdit: TOAST_ERROR_FAILED,
  commentDelete: TOAST_ERROR_FAILED,
  notificationSettings: TOAST_ERROR_FAILED,
  passwordChange: TOAST_ERROR_FAILED,
  photoUpload: TOAST_ERROR_FAILED,
  pollVote: TOAST_ERROR_FAILED,
  // 회원가입·비밀번호 찾기에서 인증 메일을 보내지 못했을 때. 입력 문제가 아니라 칸을 빨갛게 하지 않는다.
  verificationEmail: TOAST_ERROR_FAILED,
} as const;

/** 성공 · Toast-Success 재사용 */
export const TOAST_SUCCESS_MESSAGES = {
  reportSubmitted: "신고가 접수됐어요.",
  profileSaved: "프로필을 저장했어요.",
} as const;

/** 안내 · Toast-Info */
export const TOAST_INFO_MESSAGES = {
  alreadyReported: "이미 신고한 글이에요.",
  alreadyReportedComment: "이미 신고한 댓글이에요.",
  applicationLinkMissing: "아직 신청 링크가 등록되지 않았어요.",
  attachmentOpenFailed: "첨부파일을 열 수 없어요.",
  ledgerLinkMissing: "아직 회계장부 링크가 등록되지 않았어요.",
  alumniDirectoryOpenFailed: "주소록을 열 수 없어요.",
  albumPhotoLimit: "사진은 최대 20장까지 올릴 수 있어요.",
} as const;

export type ToastMessage = (typeof TOAST_MESSAGES)[keyof typeof TOAST_MESSAGES];

/** error는 빨간 !, success는 초록 체크, info는 아이콘 없이 문구만 보인다. */
export type ToastVariant = "error" | "success" | "info";

export type ToastState = { message: string; id: number; variant?: ToastVariant } | null;

/**
 * 같은 문구가 다시 뜰 때도 표시 시간이 처음부터 흐르도록 id를 올린다.
 * id가 바뀌지 않으면 표시 중인 토스트의 타이머가 이어져 곧바로 사라진다.
 */
let queuedToast: { message: string; variant: ToastVariant } | null = null;

/** 저장하고 바로 다른 화면으로 옮길 때, 옮겨 간 화면이 띄울 토스트를 맡겨 둔다. */
export function queueToastForNextScreen(message: string, variant: ToastVariant) {
  queuedToast = { message, variant };
}

/** 맡겨 둔 토스트를 한 번만 꺼낸다. */
export function takeQueuedToast() {
  const toast = queuedToast;
  queuedToast = null;
  return toast;
}

export function nextToastState(current: ToastState, message: string, variant: ToastVariant = "error"): NonNullable<ToastState> {
  return { message, id: (current?.id ?? 0) + 1, variant };
}
