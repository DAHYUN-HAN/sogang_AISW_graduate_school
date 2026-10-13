export const ACCOUNT_DELETION_CONFIRMATION = "계정 삭제";

export const ACCOUNT_DELETION_ITEMS = [
  "계정과 이름, 학교 이메일, 기수, 전공, 연락처 등 계정 개인정보가 삭제됩니다.",
  "좋아요, 북마크, 검색 기록, 알림, 로그인 세션과 게시글에 연결되지 않은 업로드 파일은 삭제됩니다.",
  "작성한 게시글과 댓글은 공개 여부와 상태에 관계없이 작성 당시의 이름과 기수로 유지됩니다.",
  "상조회 신청과 연결된 증빙자료도 유지되며, 증빙자료는 관리자만 열람할 수 있습니다.",
] as const;

export const ACCOUNT_RETENTION_NOTICE =
  "탈퇴 후에는 유지된 게시글, 댓글, 상조회 신청과 첨부자료를 수정하거나 삭제할 수 없습니다. 상조회 증빙자료의 정기 파기 등 별도 보존 정책은 그대로 적용됩니다.";

export type MemberAccountDeletionSuccessPresentation = {
  title: "탈퇴가 완료되었어요!";
  buttonLabel: "확인";
  confirmRoute: "/auth/login";
};

export function getMemberAccountDeletionSuccessPresentation(
  completed?: string,
): MemberAccountDeletionSuccessPresentation | null {
  if (completed !== "1") return null;
  return {
    title: "탈퇴가 완료되었어요!",
    buttonLabel: "확인",
    confirmRoute: "/auth/login",
  };
}

export function isDeletionConfirmationValid(value: string) {
  return value.trim() === ACCOUNT_DELETION_CONFIRMATION;
}

export function isAccountDeletionCodeValid(value: string) {
  return /^\d{6}$/.test(value.trim());
}

export function publicAccountDeletionErrorMessage(status?: number, code?: string) {
  if (code === "ADMIN_ACCOUNT_DELETION_FORBIDDEN") {
    return "관리자 계정은 운영 권한과 책임을 이전하고 일반 회원으로 변경한 뒤 삭제할 수 있습니다.";
  }
  if (status === 429 || code === "RATE_LIMITED") {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  }
  if (code === "ACCOUNT_DELETION_INVALID" || status === 400) {
    return "요청 정보를 확인할 수 없거나 인증 코드가 만료되었습니다. 이메일, 인증 코드와 비밀번호를 확인해주세요.";
  }
  if (status === 0) {
    return "서버에 연결하지 못했습니다. 네트워크를 확인하고 다시 시도해주세요.";
  }
  return "계정 삭제 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
}
