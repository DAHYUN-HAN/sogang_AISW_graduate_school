import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { postCreateRoute } from "../utils/appRoutes";

const createSource = readFileSync("app/(tabs)/board/post/create.tsx", "utf8");

test("게시판 선택은 드롭다운이 아니라 아래에서 올라오는 시트를 쓴다", () => {
  // 동아리·경조사 선택과 같은 SelectionSheet 한 가지로 맞춘다.
  assert.match(createSource, /visible=\{selectionSheet === "board"\}/);
  assert.match(createSource, /title=\{BOARD_SELECT_PLACEHOLDER\}/);
  // 목록을 칸 바로 아래에 펼치던 옛 구조는 남기지 않는다.
  assert.doesNotMatch(createSource, /boardDropdown/);
});

test("게시판을 고르기 전에는 안내 문구를 보여준다", () => {
  assert.match(createSource, /const BOARD_SELECT_PLACEHOLDER = "게시판을 선택하세요"/);
  assert.match(createSource, /\{board\?\.name \?\? BOARD_SELECT_PLACEHOLDER\}/);
});

test("게시판을 고르지 않으면 등록을 막고 다른 필수 칸과 같이 알린다", () => {
  assert.match(createSource, /const boardUnselected = canPickBoard && !board/);
  assert.match(createSource, /setMissingBoard\(boardUnselected\)/);
  assert.match(createSource, /if \(boardUnselected \|\| missing\.length > 0/);
  // 테두리도 다른 필수 칸과 같은 빨간색을 쓴다.
  assert.match(createSource, /missingBoard \? styles\.inputError : null/);
});

test("게시판을 정하지 않은 글쓰기 주소는 boardId 없이 그룹만 담는다", () => {
  const route = postCreateRoute(null, "", "/(tabs)/community", "resources");
  assert.doesNotMatch(route, /boardId=/);
  assert.match(route, /boardGroup=resources/);
  assert.match(route, /returnTo=/);
});

test("게시판이 정해진 글쓰기 주소는 그대로 boardId를 담는다", () => {
  const route = postCreateRoute(8, "시험족보");
  assert.match(route, /boardId=8/);
  assert.doesNotMatch(route, /boardGroup=/);
});
