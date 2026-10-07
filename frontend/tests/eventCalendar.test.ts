import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { readAdminImplementation } from "./helpers/adminImplementation";

import * as appRoutes from "../utils/appRoutes";
import type { EventItem } from "../types";
import { MAX_DAY_DOTS, dayDotCategories } from "../utils/eventCategoryPresentation";
import {
  calendarMonthRange,
  eventDaysForMonth,
  eventsByDayForMonth,
  eventIsCurrentOrUpcoming,
  eventOccursOnCalendarDate,
  shiftCalendarMonth,
} from "../utils/eventCalendar";

function event(start_at: string, end_at?: string): EventItem {
  return {
    id: 1,
    title: "일정",
    category: "event",
    start_at,
    end_at,
    created_at: start_at,
    updated_at: start_at,
  };
}

test("홈 달력 월 이동은 표시 월과 API 조회 범위만 변경한다", () => {
  const july = new Date(2026, 6, 1);
  const august = shiftCalendarMonth(july, 1);
  assert.equal(august.getFullYear(), 2026);
  assert.equal(august.getMonth(), 7);
  assert.deepEqual(calendarMonthRange(august), { start: "2026-08-01", end: "2026-08-31" });
});

test("다일 일정은 KST 기준 시작일부터 종료일까지 모든 날짜에 표시한다", () => {
  const multiDay = event("2026-07-30T15:00:00Z", "2026-08-02T14:59:59Z");
  assert.deepEqual([...eventDaysForMonth([multiDay], new Date(2026, 6, 1))], [31]);
  assert.deepEqual([...eventDaysForMonth([multiDay], new Date(2026, 7, 1))], [1, 2]);
});

test("종료일은 포함하고 종료일이 없는 일정은 시작일에만 표시한다", () => {
  const multiDay = event("2026-08-01T00:00:00Z", "2026-08-03T00:00:00Z");
  const singleDay = event("2026-08-04T00:00:00Z");
  assert.equal(eventOccursOnCalendarDate(multiDay, { year: 2026, month: 8, day: 3 }), true);
  assert.equal(eventOccursOnCalendarDate(multiDay, { year: 2026, month: 8, day: 4 }), false);
  assert.deepEqual([...eventDaysForMonth([singleDay], new Date(2026, 7, 1))], [4]);
});

test("오늘 진행 중인 다일 일정도 예정 일정 후보에 포함한다", () => {
  const now = new Date("2026-08-02T00:00:00Z");
  assert.equal(eventIsCurrentOrUpcoming(event("2026-08-01T00:00:00Z", "2026-08-02T14:59:59Z"), now), true);
  assert.equal(eventIsCurrentOrUpcoming(event("2026-07-30T00:00:00Z", "2026-08-01T14:59:59Z"), now), false);
});

test("홈 화살표와 빈 일정 영역은 다른 일정 페이지로 이동하지 않는다", () => {
  const homeSource = readFileSync("app/(tabs)/(home,notices,community,participation,council)/home.tsx", "utf8");
  assert.doesNotMatch(homeSource, /router\.push\("\/events\/calendar"/);
  assert.match(homeSource, /onPress=\{\(\) => onChangeMonth\(-1\)\}/);
  assert.match(homeSource, /onPress=\{\(\) => onChangeMonth\(1\)\}/);
  assert.match(homeSource, /from_date: monthRange\.start, to_date: monthRange\.end/);
  // 일정이 없는 날은 누를 것이 없어야 한다. Pressable이 아니라 안내 문구만 둔다.
  assert.match(homeSource, /<Text style=\{cal\.scheduleEmpty\}>등록된 일정이 없어요<\/Text>/);
});

test("날짜별 일정은 시작 시각 순으로 담기고 걸친 날마다 들어간다", () => {
  const late = { ...event("2026-08-04T11:00:00Z"), id: 1, title: "늦은 일정" };
  const early = { ...event("2026-08-04T01:00:00Z"), id: 2, title: "이른 일정" };
  const spanning = { ...event("2026-08-03T01:00:00Z", "2026-08-05T01:00:00Z"), id: 3, title: "걸친 일정" };

  const byDay = eventsByDayForMonth([late, early, spanning], new Date(2026, 7, 1));

  // 같은 날 목록은 시작 시각 순이라 화면이 다시 정렬하지 않아도 된다.
  assert.deepEqual(byDay.get(4)?.map((item) => item.id), [3, 2, 1]);
  // 여러 날에 걸친 일정은 걸친 날마다 나타난다.
  assert.deepEqual([...byDay.keys()].sort((a, b) => a - b), [3, 4, 5]);
  assert.equal(byDay.get(5)?.length, 1);
});

test("날짜 점과 선택한 날 목록은 같은 결과를 본다", () => {
  const single = event("2026-08-04T01:00:00Z");
  const byDay = eventsByDayForMonth([single], new Date(2026, 7, 1));
  // eventDaysForMonth가 같은 계산에서 나와야 점과 목록이 어긋나지 않는다.
  assert.deepEqual([...eventDaysForMonth([single], new Date(2026, 7, 1))], [...byDay.keys()]);
});

test("홈 달력은 날짜를 눌러도 화면을 옮기지 않고 카드 안에서 펼친다", () => {
  const homeSource = readFileSync("app/(tabs)/(home,notices,community,participation,council)/home.tsx", "utf8");
  // 날짜 탭은 선택만 바꾼다. 예전처럼 그날 일정 화면으로 보내면 안 된다.
  assert.match(homeSource, /setPicked\(\{ monthKey, day: cell\.day \}\)/);
  assert.doesNotMatch(homeSource, /eventDayRoute/);
  // 일정 전용 화면은 없앴다. 짝이 되는 공지가 있을 때만 그 공지로 간다.
  assert.match(homeSource, /const noticePostId = event\.notice_post_id \?\? null;/);
  assert.match(homeSource, /disabled=\{!noticePostId\}/);
  assert.match(homeSource, /\{noticePostId \? <Text style=\{cal\.chevron\}>›<\/Text> : null\}/);
  assert.doesNotMatch(homeSource, /\/events\//);
});

test("날짜 점은 일정 하나당 하나이고 같은 분류끼리 붙는다", () => {
  const dots = dayDotCategories([
    { category: "event" },
    { category: "academic" },
    { category: "event" },
    { category: "other" },
  ]);
  assert.deepEqual(dots, ["academic", "event", "event", "other"]);
  // 같은 분류가 여러 개면 그만큼 찍힌다.
  assert.deepEqual(dayDotCategories([{ category: "academic" }, { category: "academic" }]), ["academic", "academic"]);
});

test("점은 가장 좁은 화면에서도 칸을 넘지 않게 잘린다", () => {
  const many = Array.from({ length: 9 }, () => ({ category: "academic" }));
  assert.equal(dayDotCategories(many).length, MAX_DAY_DOTS);

  // 홈이 상정하는 가장 좁은 콘텐츠 폭은 280(getHomeContentWidth의 하한)이고, 카드가
  // 좌우 14씩 먹으므로 칸은 (280 - 28) / 7 = 36px이다. 점 n개는 7n-3을 차지한다.
  // 이 관계가 깨지면 점이 옆 칸을 침범한다.
  const cellWidth = (280 - 14 * 2) / 7;
  const dotsWidth = (count: number) => 4 * count + 3 * (count - 1);
  assert.ok(dotsWidth(MAX_DAY_DOTS) <= cellWidth, `${dotsWidth(MAX_DAY_DOTS)} > ${cellWidth}`);
  assert.ok(dotsWidth(MAX_DAY_DOTS + 1) > cellWidth, "한 개 더 들어가면 상한을 올릴 수 있다");
});

test("일정 알림은 연계 공지가 있을 때만 이동한다", () => {
  const route = Reflect.get(appRoutes, "notificationContentRoute") as
    | ((n: { post_id?: number | null; event_notice_post_id?: number | null }) => string | null)
    | undefined;
  assert.equal(typeof route, "function");
  // 글 알림은 그대로 그 글로 간다.
  assert.equal(route?.({ post_id: 7 }), "/board/post/7?returnTo=%2F(tabs)%2Fnotifications");
  // 일정 알림은 짝지은 공지로 간다.
  assert.equal(route?.({ event_notice_post_id: 9 }), "/board/post/9?returnTo=%2F(tabs)%2Fnotifications");
  // 연계가 없으면 열 것이 없다. 부르는 쪽이 읽음 처리만 하고 머문다.
  assert.equal(route?.({}), null);
});

test("일정 전용 화면은 코드에 남아 있지 않다", () => {
  // 홈 달력이 유일한 일정 화면이다. 라우트 헬퍼가 되살아나면 갈 곳 없는 링크가 생긴다.
  assert.equal(existsSync("app/(tabs)/events"), false);
  const routes = readFileSync("utils/appRoutes.ts", "utf8");
  for (const name of ["eventDayRoute", "eventDetailRoute", "eventRootRoute"]) {
    assert.doesNotMatch(routes, new RegExp(name));
  }
  assert.doesNotMatch(readAdminImplementation(), /\/events\/\$\{event\.id\}/);
});
