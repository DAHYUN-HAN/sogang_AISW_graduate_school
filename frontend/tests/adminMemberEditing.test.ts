import assert from "node:assert/strict";
import test from "node:test";
import type { AdminUserItem } from "../types";
import { memberDraft, memberPageAfterRefresh, memberUpdatePayload } from "../utils/adminMemberEditing";

const member: AdminUserItem = { id: 1, email: "member@sogang.ac.kr", nickname: "Member", cohort: "72", major: "Legacy major", role: "user", is_active: true, enrollment_status: "active", created_at: "2026-10-01" };

test("unchanged member edit sends no fields, including a legacy major", () => {
  assert.deepEqual(memberUpdatePayload(member, memberDraft(member)), {});
});
test("member edits normalize names, clear optional fields, and exclude role/email", () => {
  const baseline = { ...member, phone: "010-1234-5678" };
  const draft = { ...memberDraft(baseline), nickname: " New   Name ", phone: " ", cohort: " 73 ", email: "other@sogang.ac.kr", role: "admin" };
  assert.deepEqual(memberUpdatePayload(baseline, draft), { nickname: "New Name", cohort: "73", phone: null });
});
test("status changes stay in the same pending save as profile changes", () => {
  assert.deepEqual(memberUpdatePayload(member, { ...memberDraft(member), is_active: false, enrollment_status: "leave" }), { enrollment_status: "leave", is_active: false });
});
test("removing the final match from page two returns to the remaining page", () => {
  assert.equal(memberPageAfterRefresh(2, 2), 2);
  assert.equal(memberPageAfterRefresh(2, 1), 1);
  assert.equal(memberPageAfterRefresh(2, 0), 1);
  assert.equal(memberPageAfterRefresh(2, undefined), 2);
});
