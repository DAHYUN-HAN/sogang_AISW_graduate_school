import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");
const admin = source("app/admin/index.tsx");

// 일정 전용 화면(일정 상세·날짜별 일정)은 없앴다. 사용자에게 일정 분류가 보이는 곳은
// 홈 달력뿐이고, 거기 검사는 eventCalendar.test.ts가 한다.

test("관리자 일정은 PR 3개 옵션만 저장한다", () => {
  assert.match(admin, /EVENT_CATEGORY_OPTIONS\.map/);
  assert.doesNotMatch(admin, /eventOriginalCategoryRef/);
  assert.doesNotMatch(admin, /eventCategoryExplicitlySelectedRef/);
  assert.match(admin, /category:\s*eventDisplayCategory\(event\.category\)/);
  assert.match(admin, /category:\s*eventCategoryValueForSubmit\(/);
  assert.doesNotMatch(admin, /EVENT_CATEGORY_LABELS\[event\.category\]\s*\?\?\s*event\.category/);
});
