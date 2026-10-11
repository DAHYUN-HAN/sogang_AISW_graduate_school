import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const board = readFileSync("app/(tabs)/(home,notices,community,participation,council)/board/[boardId].tsx", "utf8");
const create = readFileSync("app/(tabs)/(home,notices,community,participation,council)/board/post/create.tsx", "utf8");

// 2026-10-12 사용자 요청: 피그마 Activity/List-*VerifyEmpty 문구를 동아리·스터디·네트워킹 활동 인증에 같이 쓴다.
test("활동 인증 목록이 비면 피그마 문구를 보인다", () => {
  assert.match(board, /isActivityCards \? "등록된 활동인증이 없어요"/);
  assert.match(board, /isActivityCards \? "첫 활동을 인증해보세요"/);
});

// 2026-10-12 사용자 요청: 피그마 Activity/Verify-Network 선택 칸 문구.
test("네트워킹 활동 인증 선택 칸은 네트워킹명을 묻는다", () => {
  assert.match(create, /return "네트워킹명을 선택하세요";/);
});
