export function useMemberWebFrame(platform: string, width: number, pathname: string, isAdmin: boolean) {
  return platform === "web" && width > 430 && !(isAdmin && /^\/admin(?:\/|$)/.test(pathname));
}

export function requestPresentation(item: { status: string; received_at: string; handled_at: string | null }) {
  const pending = item.status === "processing" || item.status === "received";
  const label = ({ processing: "처리중", received: "접수", completed: "완료", rejected: "반려", answered: "답변 완료" } as Record<string, string>)[item.status] ?? item.status;
  return { label, tone: pending ? "warning" : item.status === "rejected" ? "danger" : "success", dateLabel: pending ? "접수" : "처리", date: pending ? item.received_at : item.handled_at };
}

export function metricValue(value: number | null, unit: string, trafficStatus: string) {
  return value === null ? trafficStatus === "not_started" ? "수집 시작 전" : "집계 불가" : `${value.toLocaleString("ko-KR")}${unit}`;
}

export function millisecondsToKoreaMidnight(now = new Date()) {
  const koreaTime = now.getTime() + 9 * 60 * 60 * 1000;
  return 86400000 - ((koreaTime % 86400000) + 86400000) % 86400000;
}

export function koreaDate(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function currentMainRequests<T extends { status: string; handled_at: string | null }>(items: T[], date: string) {
  return items.filter((item) => item.status === "processing" || item.status === "received" || (item.handled_at !== null && koreaDate(new Date(item.handled_at)) === date));
}

export function canInitializeRequestDraft(hasData: boolean, isFetching: boolean) {
  return hasData && !isFetching;
}

const ACTION_LABELS: Record<string, string> = {
  "poll.create": "투표 등록", "poll.update": "투표 설정 변경", "poll.close": "투표 종료", "poll.remove": "투표 삭제",
  "notice.create": "공지사항 작성", "notice.update": "공지사항 수정", "post.create": "게시글 작성", "post.update": "게시글 수정",
  "post.delete": "게시글 삭제", "post.pin": "게시글 고정 변경", "post.pin.update": "게시글 고정 변경", "post.representative_image.update": "대표 이미지 변경", "suggestion.update": "건의사항 답변", "mutual_aid.update": "상조회 처리",
  "comment.create": "댓글 작성", "comment.update": "댓글 수정", "comment.delete": "댓글 삭제", "board.create": "게시판 등록",
  "board.update": "게시판 설정 변경", "banner.create": "배너 등록", "banner.update": "배너 수정", "banner.delete": "배너 삭제", "banner.deactivate": "배너 노출 중지",
  "user.update": "계정 변경", "user.password_reset": "비밀번호 재설정", "faq.create": "FAQ 등록", "faq.update": "FAQ 수정", "event.create": "일정 등록", "event.update": "일정 수정",
  "faq.deactivate": "FAQ 노출 중지", "event.delete": "일정 삭제", "event.reminders.dispatch": "일정 알림 생성", "report.status.update": "신고 처리",
  "student_roster.import": "원우 명부 반영", "dues_payment.import": "회비 납부표 반영", "dues_payment.update": "회비 납부 상태 변경",
  "registration.major.create": "전공 옵션 등록", "registration.major.update": "전공 옵션 수정", "registration.privacy_policy.activate": "개인정보 정책 적용",
  "admin.bootstrap.initial": "최초 관리자 설정",
};
export function auditActionLabel(action: string) { return ACTION_LABELS[action] ?? action; }

export function auditSummary(details?: Record<string, unknown> | null) {
  if (!details) return "";
  const labels: Record<string, string> = { processing: "처리중", completed: "완료", rejected: "반려", received: "접수", answered: "답변 완료" };
  if (typeof details.previous_status === "string" && typeof details.status === "string") return `${labels[details.previous_status] ?? details.previous_status} → ${labels[details.status] ?? details.status}`;
  if (typeof details.status === "string") return labels[details.status] ?? details.status;
  if (Array.isArray(details.changed_fields)) return `변경 항목 ${details.changed_fields.length}개`;
  return typeof details.summary === "string" ? details.summary : "";
}
