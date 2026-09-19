import assert from "node:assert/strict";
import test from "node:test";

import {
  RESOURCE_RATING_LEVELS,
  resourcePostFieldValues,
  resourcePostFields,
  resourcePostMetadata,
} from "../utils/resourcePostFields";

test("강의후기는 교수명·난이도·만족도를, 시험족보는 교수명만 받는다", () => {
  assert.deepEqual(resourcePostFields("lecture-reviews"), {
    titlePlaceholder: "강의명을 입력하세요",
    professor: true,
    difficulty: true,
    satisfaction: true,
  });
  assert.deepEqual(resourcePostFields("exam-archive"), {
    titlePlaceholder: "강의명을 입력하세요",
    professor: true,
    difficulty: false,
    satisfaction: false,
  });
});

test("추가 입력이 없는 게시판은 null을 반환해 기존 글쓰기 화면을 유지한다", () => {
  assert.equal(resourcePostFields("comprehensive-exam"), null);
  assert.equal(resourcePostFields("graduation-thesis"), null);
  assert.equal(resourcePostFields("free-board"), null);
  assert.equal(resourcePostFields(undefined), null);
  assert.equal(resourcePostFields(null), null);
});

test("난이도는 상·중·하만 사용한다", () => {
  assert.deepEqual([...RESOURCE_RATING_LEVELS], ["상", "중", "하"]);
});

test("강의후기 metadata는 기존 snake_case 관례를 따른다", () => {
  assert.deepEqual(
    resourcePostMetadata(resourcePostFields("lecture-reviews"), {
      professor: "  이영섭  ",
      difficulty: "중",
      satisfaction: "상",
    }),
    { professor_name: "이영섭", lecture_difficulty: "중", lecture_satisfaction: "상" },
  );
});

test("게시판이 쓰지 않는 필드는 값이 있어도 저장하지 않는다", () => {
  assert.deepEqual(
    resourcePostMetadata(resourcePostFields("exam-archive"), {
      professor: "이영섭",
      difficulty: "중",
      satisfaction: "상",
    }),
    { professor_name: "이영섭" },
  );
});

test("빈 값과 허용되지 않은 등급은 metadata에서 제외한다", () => {
  assert.deepEqual(
    resourcePostMetadata(resourcePostFields("lecture-reviews"), {
      professor: "   ",
      difficulty: "최상",
      satisfaction: undefined,
    }),
    {},
  );
  assert.deepEqual(resourcePostMetadata(null, { professor: "이영섭" }), {});
});

test("수정 화면은 저장된 metadata를 폼 값으로 되돌린다", () => {
  assert.deepEqual(
    resourcePostFieldValues(resourcePostFields("lecture-reviews"), {
      professor_name: "이영섭",
      lecture_difficulty: "하",
      lecture_satisfaction: "중",
      application_url: "https://example.invalid",
    }),
    { professor: "이영섭", difficulty: "하", satisfaction: "중" },
  );
});

test("프리필은 게시판이 쓰지 않는 필드와 잘못된 값을 빈 값으로 만든다", () => {
  assert.deepEqual(
    resourcePostFieldValues(resourcePostFields("exam-archive"), {
      professor_name: "이영섭",
      lecture_difficulty: "중",
    }),
    { professor: "이영섭", difficulty: "", satisfaction: "" },
  );
  assert.deepEqual(
    resourcePostFieldValues(resourcePostFields("lecture-reviews"), { lecture_difficulty: 3 }),
    { professor: "", difficulty: "", satisfaction: "" },
  );
  assert.deepEqual(resourcePostFieldValues(resourcePostFields("lecture-reviews"), null), {});
  assert.deepEqual(resourcePostFieldValues(null, { professor_name: "이영섭" }), {});
});
