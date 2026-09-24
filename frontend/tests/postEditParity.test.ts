import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RESOURCE_RATING_FIELDS,
  resourcePostFields,
  withResourcePostMetadata,
} from "../utils/resourcePostFields";

const editSource = readFileSync("app/(tabs)/board/post/edit/[postId].tsx", "utf8");
const createSource = readFileSync("app/(tabs)/board/post/create.tsx", "utf8");

test("등급 입력 정의는 작성·수정이 같은 것을 쓴다", () => {
  // 각자 선언하면 라벨이나 순서가 조용히 갈라진다.
  assert.deepEqual(RESOURCE_RATING_FIELDS.map((field) => field.name), ["difficulty", "satisfaction"]);
  for (const source of [createSource, editSource]) {
    assert.match(source, /RESOURCE_RATING_FIELDS/);
    assert.doesNotMatch(source, /const RESOURCE_RATING_FIELDS = \[/);
  }
});

test("수정 화면도 강의후기 과목정보를 보여주고 되돌려놓는다", () => {
  assert.match(editSource, /name="professor"/);
  assert.match(editSource, /RESOURCE_RATING_FIELDS\.filter\(\(rating\) => resourceFields\?\.\[rating\.name\]\)/);
  // 저장 전에 기존 값을 폼에 채워놓지 않으면 수정할 때 유실된다.
  assert.match(editSource, /\.\.\.resourcePostFieldValues\(resourcePostFields\(board\?\.slug\), post\.metadata\)/);
  // 옮겨갈 게시판 기준으로 받을 항목을 정한다.
  assert.match(editSource, /const resourceFields = resourcePostFields\(selectedBoard\?\.slug\)/);
});

test("수정 저장은 과목정보를 metadata에 담는다", () => {
  assert.match(editSource, /withResourcePostMetadata\(post\.metadata, resourceFields, values\)/);
});

test("게시판을 옮기면 새 게시판이 쓰지 않는 과목정보는 남지 않는다", () => {
  const lecture = { professor_name: "김서강", lecture_difficulty: "상", lecture_satisfaction: "중", contact: "010" };
  // 강의후기 -> 시험족보: 교수명만 유지되고 난이도·만족도는 사라진다.
  const moved = withResourcePostMetadata(lecture, resourcePostFields("exam-archive"), {
    professor: "김서강", difficulty: "상", satisfaction: "중",
  });
  assert.deepEqual(moved, { professor_name: "김서강", contact: "010" });
});

test("과목정보와 무관한 metadata는 건드리지 않는다", () => {
  const kept = withResourcePostMetadata({ application_url: "https://a.b", contact: "010" }, null, {});
  assert.deepEqual(kept, { application_url: "https://a.b", contact: "010" });
});

test("수정 화면도 비어 있는 필수 칸을 한 번에 모아 테두리와 토스트로 알린다", () => {
  assert.match(editSource, /const missing: \(keyof FormValues\)\[\] = \[\]/);
  assert.match(editSource, /for \(const name of missing\) setError\(name, \{ message: "" \}\)/);
  assert.match(editSource, /TOAST_MESSAGES\.requiredFieldError/);
  // 칸 아래 빨간 문구는 더 이상 쓰지 않는다.
  assert.doesNotMatch(editSource, /styles\.errorText\}>\{fieldState\.error\.message\}/);
  // 값을 고치면 바로 풀린다.
  assert.match(editSource, /const clearOnChange = \(name: keyof FormValues/);
  for (const name of ["title", "content", "professor", "contact", "applicationUrl"]) {
    assert.ok(editSource.includes(`clearOnChange("${name}"`), `${name} 해제 누락`);
  }
});

test("수정 화면 오류 테두리는 작성 화면과 같은 규칙이다", () => {
  // 1px #D64545, 분홍 배경 없음. 기본 0.5px에서 0.5만 굵어져 여백 보정이 없다.
  assert.match(editSource, /inputError: \{\s*borderWidth: 1,\s*borderColor: "#D64545",\s*\}/);
  assert.doesNotMatch(editSource, /backgroundColor: COLORS\.danger50/);
});

test("수정 중 나가면 확인창을 띄우고, 저장 후에는 묻지 않는다", () => {
  assert.match(editSource, /<DiscardWriteModal/);
  assert.match(editSource, /mode="edit"/);
  assert.match(editSource, /if \(hasUnsavedChanges\) \{\s*setDiscardPromptOpen\(true\);/);
  // 저장 성공은 확인창을 거치지 않는다. 저장해도 폼은 기준선과 달라
  // hasUnsavedChanges가 참으로 남으므로, submitted로 잠금을 먼저 푼 뒤
  // 다음 렌더에서 옮긴다. 같은 틱에 옮기면 usePreventRemove가 이전 값을 들고 있다.
  assert.match(editSource, /usePreventRemove\(hasUnsavedChanges && !submitted && !removeConfirmed/);
  assert.match(editSource, /onSuccess: \(\) => \{[\s\S]*?setSubmitted\(true\);/);
  assert.match(editSource, /pendingSubmitNavigation\.current = leaveScreen;/);
  assert.match(editSource, /if \(!submitted\) return;[\s\S]*?go\?\.\(\);/);
  // 첨부와 게시판 이동도 변경으로 센다.
  assert.match(editSource, /unsavedBaseline\.current\.attachmentIds/);
  assert.match(editSource, /unsavedBaseline\.current\.boardId/);
});
