import assert from "node:assert/strict";
import test from "node:test";
import { adminMemberPasswordError } from "../utils/adminMemberEditing";
import { auditActionLabel } from "../utils/adminMain";

test("administrator password reset requires the existing policy and matching confirmation", () => {
  assert.ok(adminMemberPasswordError("", ""));
  assert.ok(adminMemberPasswordError("short", "short"));
  assert.ok(adminMemberPasswordError("Onlyletters!", "Onlyletters!"));
  assert.ok(adminMemberPasswordError("NoSpecial123", "NoSpecial123"));
  assert.ok(adminMemberPasswordError("ValidPassword1!", "DifferentPassword1!"));
  assert.equal(adminMemberPasswordError("ValidPassword1!", "ValidPassword1!"), null);
});
test("passwords keep intentional whitespace and reject overlong input", () => {
  assert.equal(adminMemberPasswordError(" ValidPassword1! ", " ValidPassword1! "), null);
  assert.ok(adminMemberPasswordError(" ValidPassword1! ", "ValidPassword1!"));
  const tooLong = "A1!" + "x".repeat(1022);
  assert.ok(adminMemberPasswordError(tooLong, tooLong));
});
test("operational history labels the password reset separately from profile editing", () => {
  assert.equal(auditActionLabel("user.password_reset"), "비밀번호 재설정");
});
