import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const createSource = readFileSync("app/(tabs)/(home,notices,community,participation,council)/board/post/create.tsx", "utf8");

// 2026-10-15 사용자 요청: 참가자 칸을 누르면 완료 버튼까지 내리되, 참가자가 많아
// 검색 칸이 화면 위로 사라지게 되면 검색 칸이 보이는 데서 멈춘다.
test("참가자 검색 칸은 완료 버튼까지 내리되 검색 칸이 화면 밖으로 나가지 않게 멈춘다", () => {
  assert.match(createSource, /revealTarget\.current = "participants"; revealFocusedBlock\(\);/);
  assert.match(createSource, /const endY = formContentHeight\.current - formScrollHeight\.current;/);
  assert.match(createSource, /const inputY = participantGroupTop\.current \+ participantInputTop\.current - 16;/);
  assert.match(createSource, /scrollTo\(\{ y: Math\.max\(0, Math\.min\(endY, inputY\)\), animated: true \}\)/);
  assert.match(createSource, /onContentSizeChange=\{\(_width, height\) => \{ formContentHeight\.current = height; \}\}/);
});
