import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Figma Screen/Council/MutualAid-V2: 글마다 아래에 0.5 구분선이 하나씩 있다.
test("게시판 목록 글 칸은 흰 배경으로 앞 칸의 구분선을 덮지 않는다", () => {
  const source = readFileSync("components/PostCard.tsx", "utf8");
  const row = source.match(/\n  row: \{([\s\S]*?)\n  \},/)?.[1] ?? "";
  assert.match(row, /borderBottomWidth: 0\.5,/);
  assert.match(row, /borderBottomColor: "#E1E4E9",/);
  assert.doesNotMatch(row, /backgroundColor/);
});
