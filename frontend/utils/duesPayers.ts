import type {
  AdminDuesPaymentItem,
  AdminRosterItem,
  DuesPaymentImportResult,
  DuesRosterImportResult,
} from "../types";

export function formatDuesPayer(
  item: Pick<AdminRosterItem, "id" | "name" | "major" | "student_number">,
) {
  return `${item.name} ${item.major} ${item.student_number}`;
}

export function formatDuesScope(
  item: Pick<AdminDuesPaymentItem, "payment_scope" | "once_board_name">,
) {
  if (item.payment_scope === "ALL") return "전체 납부";
  if (item.payment_scope === "ONCE") {
    return `1회 납부 · ${item.once_board_name ?? "게시판 미지정"}`;
  }
  return "미납";
}

export type DuesPaymentEditorMode = "EDIT" | "REGISTER_ONCE";

export function createDuesPaymentEditorDraft(
  item: Pick<AdminDuesPaymentItem, "payment_scope" | "once_board_id">,
  mode: DuesPaymentEditorMode,
) {
  if (mode === "REGISTER_ONCE") {
    return { scope: "ONCE" as const, selectedBoardId: null };
  }
  return { scope: item.payment_scope, selectedBoardId: item.once_board_id };
}

export function formatRosterImportSummary(result: DuesRosterImportResult) {
  return `총 ${result.total_rows}명 · 신규 ${result.created}명 · 수정 ${result.updated}명 · 유지 ${result.unchanged}명`;
}

export function formatPaymentImportSummary(result: DuesPaymentImportResult) {
  return `기존 납부 ${result.cleared}명 초기화 · 현재 학기 전체 납부 ${result.registered}명 등록`;
}
