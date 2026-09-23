import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sectionSource = readFileSync("components/admin/DuesPayerSection.tsx", "utf8");
const editorSource = readFileSync("components/admin/DuesPayerEditor.tsx", "utf8");
const rosterSource = readFileSync("components/admin/DuesRosterSection.tsx", "utf8");

test("원우 명부는 신원 3열 대량 테이블만 제공한다", () => {
  assert.match(rosterSource, /전체 원우 명부 업로드/);
  assert.match(rosterSource, /이름/);
  assert.match(rosterSource, /학번/);
  assert.match(rosterSource, /전공/);
  assert.match(rosterSource, /size: 100/);
  assert.match(rosterSource, /horizontal/);
  assert.doesNotMatch(rosterSource, /ALL|ONCE|UNPAID|전체 납부|특정 행사|미납|수정/);
});

test("원우회비 관리 화면은 명부와 전체 납부 업로드를 분리한다", () => {
  assert.match(sectionSource, /전체 원우 명부 업로드/);
  assert.match(sectionSource, /전체 납부자 업로드/);
  assert.match(sectionSource, /개별 등록/);
  assert.match(sectionSource, /formatDuesScope/);
  assert.match(sectionSource, /원우회비 납부자 초기화/);
  assert.doesNotMatch(sectionSource, /명부 전체 삭제/);
});

test("원우회비 개별 편집기는 세 가지 납부 범위를 제공한다", () => {
  assert.match(editorSource, /전체 납부/);
  assert.match(editorSource, /특정 행사 1회 납부/);
  assert.match(editorSource, /미납/);
  assert.match(editorSource, /activityBoards/);
});
