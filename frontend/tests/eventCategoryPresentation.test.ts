import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  EVENT_CATEGORY_OPTIONS,
  eventCategoryAccent,
  eventCategoryLabel,
  eventCategoryTone,
  eventCategoryValueForSubmit,
  eventDisplayCategory,
} from "../utils/eventCategoryPresentation";

test("일정은 PR 원본의 3종 카테고리만 사용한다", () => {
  assert.equal(eventDisplayCategory("academic"), "academic");
  assert.equal(eventDisplayCategory("event"), "event");
  assert.equal(eventDisplayCategory("other"), "other");
  assert.equal(eventDisplayCategory("exam"), "other");
  assert.equal(eventDisplayCategory("council"), "other");
  assert.equal(eventDisplayCategory("external"), "other");
  assert.equal(eventDisplayCategory("legacy-unknown"), "other");
  assert.equal(eventDisplayCategory(undefined), "other");
  assert.deepEqual(EVENT_CATEGORY_OPTIONS, [
    { value: "academic", label: "학사일정" },
    { value: "event", label: "행사일정" },
    { value: "other", label: "기타일정" },
  ]);
  assert.equal(eventCategoryLabel("academic"), "학사일정");
  assert.equal(eventCategoryLabel("event"), "행사일정");
  assert.equal(eventCategoryLabel("legacy-unknown"), "기타일정");
});

test("날짜별과 상세 화면은 PR 3종 tone만 사용한다", () => {
  assert.deepEqual(eventCategoryTone("academic", "day"), {
    backgroundColor: "#E6F1FB",
    color: "#0C447C",
  });
  assert.deepEqual(eventCategoryTone("event", "day"), {
    backgroundColor: "#FBEAF0",
    color: "#993556",
  });
  assert.deepEqual(eventCategoryTone("event", "detail"), {
    backgroundColor: "#FBEAF0",
    color: "#993556",
  });
  assert.deepEqual(eventCategoryTone("anything", "detail"), {
    backgroundColor: "#F0EEF9",
    color: "#6543A2",
  });
  assert.deepEqual(eventCategoryTone("exam", "day"), {
    backgroundColor: "#F0EEF9",
    color: "#6543A2",
  });
});

test("일정 저장은 선택된 PR 3종 값을 그대로 사용한다", () => {
  assert.equal(eventCategoryValueForSubmit("academic"), "academic");
  assert.equal(eventCategoryValueForSubmit("event"), "event");
  assert.equal(eventCategoryValueForSubmit("other"), "other");
});

test("기타 분류 보라색은 앱 전체가 한 값을 쓴다", () => {
  // 예전에는 #5A4C8B(게시글·공지 태그), #4A2B7A(일정 화면), #6543A2(홈 공지 점)가
  // 섞여 있었다. 같은 "기타"가 화면마다 다른 보라로 보이지 않게 한 값으로 묶는다.
  const sources = [
    "components/PostCard.tsx",
    "components/NoticeRow.tsx",
    "app/(tabs)/settings/activity.tsx",
    "app/(tabs)/board/post/[postId].tsx",
    "app/(tabs)/home.tsx",
    "utils/eventCategoryPresentation.ts",
  ].map((path) => readFileSync(path, "utf8"));

  for (const source of sources) {
    assert.doesNotMatch(source, /#5A4C8B/i);
    assert.doesNotMatch(source, /#4A2B7A/i);
  }
  assert.equal(eventCategoryAccent("other"), "#6543A2");
  assert.equal(eventCategoryTone("other", "day").color, "#6543A2");
  assert.equal(eventCategoryTone("other", "detail").color, "#6543A2");
});
