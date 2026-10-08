import type { AdminUserItem } from "../types";
import { passwordConfirmationError, passwordError } from "./authValidation";

export function adminMemberPasswordError(newPassword: string, confirmation: string): string | null {
  if (newPassword.length > 1024) return "비밀번호는 1024자 이내로 입력해 주세요.";
  return passwordError(newPassword) ?? passwordConfirmationError(newPassword, confirmation);
}

export const MEMBER_TEXT_FIELDS = ["nickname", "cohort", "major", "phone", "company", "job_title", "position"] as const;
export type MemberDraft = Record<(typeof MEMBER_TEXT_FIELDS)[number], string> & Pick<AdminUserItem, "enrollment_status" | "is_active">;
export type MemberUpdate = Partial<Pick<AdminUserItem, (typeof MEMBER_TEXT_FIELDS)[number] | "enrollment_status" | "is_active">>;

export function memberPageAfterRefresh(page: number, totalPages?: number): number {
  return totalPages === undefined ? page : Math.min(page, Math.max(1, totalPages));
}

export function memberDraft(item: AdminUserItem): MemberDraft {
  return {
    nickname: item.nickname, cohort: item.cohort ?? "", major: item.major ?? "",
    phone: item.phone ?? "", company: item.company ?? "", job_title: item.job_title ?? "",
    position: item.position ?? "", enrollment_status: item.enrollment_status, is_active: item.is_active,
  };
}

export function memberUpdatePayload(item: AdminUserItem, draft: MemberDraft): MemberUpdate {
  const payload: MemberUpdate = {};
  const name = draft.nickname.trim().replace(/\s+/g, " ");
  if (name !== item.nickname) payload.nickname = name;
  for (const key of MEMBER_TEXT_FIELDS) {
    if (key === "nickname") continue;
    const value = draft[key].trim() || null;
    if (value !== (item[key] ?? null)) payload[key] = value;
  }
  if (draft.enrollment_status !== item.enrollment_status) payload.enrollment_status = draft.enrollment_status;
  if (draft.is_active !== item.is_active) payload.is_active = draft.is_active;
  return payload;
}
