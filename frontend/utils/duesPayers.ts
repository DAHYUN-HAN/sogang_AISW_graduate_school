import type {
  AdminDuesPayerItem,
  DuesPaymentImportResult,
  DuesRosterImportResult,
} from "../types";

export const DUES_DELETE_CONFIRMATION = "진짜 삭제";

export function formatDuesPayer(
  item: Pick<AdminDuesPayerItem, "id" | "name" | "major" | "student_number">,
) {
  return `${item.name} ${item.major} ${item.student_number}`;
}

export function formatDuesScope(
  item: Pick<AdminDuesPayerItem, "payment_scope" | "once_board_name">,
) {
  if (item.payment_scope === "ALL") return "전체 납부";
  if (item.payment_scope === "ONCE") {
    return `1회 납부 · ${item.once_board_name ?? "게시판 미지정"}`;
  }
  return "미납";
}

export function formatRosterImportSummary(result: DuesRosterImportResult) {
  return `총 ${result.total_rows}명 · 신규 ${result.created}명 · 수정 ${result.updated}명 · 유지 ${result.unchanged}명`;
}

export function formatPaymentImportSummary(result: DuesPaymentImportResult) {
  return `총 ${result.total_rows}명 · 전체 납부 전환 ${result.activated}명 · 미납 초기화 ${result.reset}명 · 유지 ${result.unchanged}명`;
}

export function isExactDuesDeleteConfirmation(value: string) {
  return value === DUES_DELETE_CONFIRMATION;
}
