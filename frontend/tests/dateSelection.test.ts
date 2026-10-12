import assert from "node:assert/strict";
import test from "node:test";

import {
  calendarMonthFromDotDate,
  formatDotDate,
  isCalendarDateWithinBounds,
  isCalendarMonthAfterMaximum,
  isMutualAidEventDateAllowed,
  maximumActivityCertificationDate,
  minimumMutualAidEventDate,
} from "../utils/dateSelection";

test("달력에서 선택한 활동일을 점 구분 날짜로 저장한다", () => {
  assert.equal(formatDotDate(new Date(2026, 6, 30, 12)), "2026.07.30");
});

test("선택한 활동일의 월을 열고 잘못된 날짜는 현재 월로 대체한다", () => {
  const fallback = new Date(2026, 7, 2, 12);

  assert.deepEqual(calendarMonthFromDotDate("2026.07.30", fallback), { year: 2026, monthIndex: 6 });
  assert.deepEqual(calendarMonthFromDotDate("2026.02.30", fallback), { year: 2026, monthIndex: 7 });
  assert.deepEqual(calendarMonthFromDotDate(undefined, fallback), { year: 2026, monthIndex: 7 });
});

test("상조회 최소 신청일은 한국시간 기준 오늘이다", () => {
  assert.equal(minimumMutualAidEventDate(new Date("2026-08-01T14:59:59Z")), "2026.08.01");
  assert.equal(minimumMutualAidEventDate(new Date("2026-08-01T15:00:00Z")), "2026.08.02");
});

test("상조회 신청일은 어제를 거부하고 오늘부터 허용한다", () => {
  const now = new Date("2026-08-01T15:00:00Z");

  assert.equal(isMutualAidEventDateAllowed("2026.08.01", now), false);
  assert.equal(isMutualAidEventDateAllowed("2026.08.02", now), true);
  assert.equal(isMutualAidEventDateAllowed("2026.08.03", now), true);
});

test("상조회 최소 신청일 계산은 월말·연말·윤년을 넘겨도 정확하다", () => {
  assert.equal(minimumMutualAidEventDate(new Date("2026-08-30T15:00:00Z")), "2026.08.31");
  assert.equal(minimumMutualAidEventDate(new Date("2026-12-30T15:00:00Z")), "2026.12.31");
  assert.equal(minimumMutualAidEventDate(new Date("2028-02-27T15:00:00Z")), "2028.02.28");
});

test("상조회 신청일의 잘못된 형식과 존재하지 않는 날짜를 거부한다", () => {
  const now = new Date("2026-08-01T15:00:00Z");

  assert.equal(isMutualAidEventDateAllowed("2026-08-04", now), false);
  assert.equal(isMutualAidEventDateAllowed("2026.02.30", now), false);
  assert.equal(isMutualAidEventDateAllowed(undefined, now), false);
});

test("활동인증 날짜 상한은 한국시간 기준 오늘이다", () => {
  assert.equal(maximumActivityCertificationDate(new Date("2026-08-01T14:59:59Z")), "2026.08.01");
  assert.equal(maximumActivityCertificationDate(new Date("2026-08-01T15:00:00Z")), "2026.08.02");
});

test("활동인증 달력은 오늘과 과거만 선택할 수 있다", () => {
  const maximumDate = "2026.08.11";

  assert.equal(isCalendarDateWithinBounds("2026.08.10", { maximumDate }), true);
  assert.equal(isCalendarDateWithinBounds("2026.08.11", { maximumDate }), true);
  assert.equal(isCalendarDateWithinBounds("2026.08.12", { maximumDate }), false);
});

test("활동인증 달력은 오늘이 속한 달 다음으로 이동하지 않는다", () => {
  assert.equal(isCalendarMonthAfterMaximum(2026, 6, "2026.08.11"), false);
  assert.equal(isCalendarMonthAfterMaximum(2026, 7, "2026.08.11"), false);
  assert.equal(isCalendarMonthAfterMaximum(2026, 8, "2026.08.11"), true);
  assert.equal(isCalendarMonthAfterMaximum(2027, 0, "2026.08.11"), true);
  assert.equal(isCalendarMonthAfterMaximum(2026, 8, undefined), false);
});
