import assert from "node:assert/strict";
import test from "node:test";

import { homeNoticeDeadlineSuffix, homeScheduleDdayLabel } from "../utils/homeNoticeDeadline";

const NOW = new Date(2026, 7, 31, 15, 30);

test("기한이 지난 공지는 마감 문구와 구분자를 표시하지 않는다", () => {
  assert.equal(homeNoticeDeadlineSuffix("2026-08-13T09:00:00+09:00", NOW), "");
});

test("오늘과 예정된 공지는 마감 D-day와 마감 D-N으로 표시한다", () => {
  assert.equal(homeNoticeDeadlineSuffix("2026-08-31T23:59:59+09:00", NOW), " · 마감 D-day");
  assert.equal(homeNoticeDeadlineSuffix("2026-09-02T09:00:00+09:00", NOW), " · 마감 D-2");
});

test("마감일이 없거나 잘못된 값이면 홈 공지에 마감 문구를 표시하지 않는다", () => {
  assert.equal(homeNoticeDeadlineSuffix(undefined, NOW), "");
  assert.equal(homeNoticeDeadlineSuffix("not-a-date", NOW), "");
});

test("홈 일정 카드는 공지 접두사 없이 기존 D-day 문구를 유지한다", () => {
  assert.equal(homeScheduleDdayLabel("2026-08-13T09:00:00+09:00", NOW), "마감");
  assert.equal(homeScheduleDdayLabel("2026-08-31T23:59:59+09:00", NOW), "D-day");
  assert.equal(homeScheduleDdayLabel("2026-09-02T09:00:00+09:00", NOW), "D-2");
  assert.equal(homeScheduleDdayLabel(undefined, NOW), "");
});
