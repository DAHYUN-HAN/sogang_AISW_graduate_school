import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// 입력 칸 테두리 원칙(피그마)은 components/FieldBorder.tsx 한 곳에만 있다.
const fieldBorder = readFileSync("components/FieldBorder.tsx", "utf8");

test("입력 칸 테두리 원칙: 평소 0.5 #E1E4E9, 입력 중 1 #21262E, 오류 1 #D64545", () => {
  assert.match(fieldBorder, /normal: \{ borderWidth: 0\.5, borderColor: "#E1E4E9" \}/);
  assert.match(fieldBorder, /focused: \{ borderWidth: 1, borderColor: "#21262E" \}/);
  assert.match(fieldBorder, /export const FIELD_ERROR_COLOR = "#D64545";/);
  assert.match(fieldBorder, /error: \{ borderWidth: 1, borderColor: FIELD_ERROR_COLOR \}/);
});

test("오류 테두리가 입력 중 테두리보다 우선한다", () => {
  assert.match(fieldBorder, /if \(error\) return FIELD_BORDER\.error;\s*\n\s*return focused \? FIELD_BORDER\.focused : FIELD_BORDER\.normal;/);
});

test("앱 화면은 입력 칸 테두리 값을 따로 들고 있지 않는다", () => {
  const screens = [
    "app/auth/login.tsx",
    "app/auth/register.tsx",
    "app/auth/password-reset.tsx",
    "app/(tabs)/(home,notices,community,participation,council)/settings/password.tsx",
    "app/(tabs)/(home,notices,community,participation,council)/settings/account-deletion.tsx",
    "components/CommentItem.tsx",
    "components/SchoolEmailInput.tsx",
  ];
  for (const screen of screens) {
    const source = readFileSync(screen, "utf8");
    assert.match(source, /FieldBorder/, screen);
    assert.doesNotMatch(source, /#2761FF"?,?\s*\/\/?.*focus|borderColor: "#2761FF"/, screen);
  }
});
