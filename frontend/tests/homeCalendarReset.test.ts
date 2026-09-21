import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import {
  calendarMonthRange,
  calendarMonthWindowRange,
  currentKoreaMonth,
  eventDaysForMonth,
  shiftCalendarMonth,
} from "../utils/eventCalendar";

const homeSource = readFileSync("app/(tabs)/home.tsx", "utf8");
const source = ts.createSourceFile("home.tsx", homeSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const screen = source.statements.find(
  (node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "HomeScreen",
)!;

// 화면이 실제로 등록하는 포커스 콜백을 그대로 돌린다.
const focusStatement = screen.body!.statements.find(
  (node) =>
    ts.isExpressionStatement(node)
    && ts.isCallExpression(node.expression)
    && node.expression.expression.getText(source) === "useFocusEffect"
    && node.getText(source).includes("setMonth"),
)!;
assert.ok(focusStatement, "홈은 포커스될 때 달을 되돌려야 한다");

function runFocus(startMonth: Date) {
  let month = startMonth;
  let updates = 0;
  const code = ts.transpileModule(focusStatement.getText(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    currentKoreaMonth,
    useCallback: (fn: unknown) => fn,
    useFocusEffect: (fn: () => void) => fn(),
    setMonth: (update: (current: Date) => Date) => {
      const next = update(month);
      if (next !== month) updates += 1;
      month = next;
    },
  });
  return { month, updates };
}

test("다른 달을 보다가 홈으로 돌아오면 이번 달로 되돌아간다", () => {
  const browsed = shiftCalendarMonth(currentKoreaMonth(), 3);
  const result = runFocus(browsed);
  assert.equal(result.month.getTime(), currentKoreaMonth().getTime());
  assert.equal(result.updates, 1);
});

test("이미 이번 달이면 상태를 건드리지 않아 다시 불러오지 않는다", () => {
  const result = runFocus(currentKoreaMonth());
  assert.equal(result.updates, 0, "같은 달인데 새 Date를 넣으면 쿼리 키가 바뀌어 재요청된다");
});

test("달을 넘겨도 달력이 불러오는 중 화면으로 바뀌지 않는다", () => {
  // placeholderData로 이전 달 데이터를 들고 있어 isLoading이 다시 켜지지 않는다.
  assert.match(homeSource, /placeholderData: keepPreviousData/);
  assert.match(homeSource, /import \{ keepPreviousData, useQuery \}/);
  // "불러오는 중" 표시는 첫 로딩에만 쓰는 isLoading에 걸려 있어야 한다.
  assert.match(homeSource, /\{eventsQuery\.isLoading \? \(/);
});

test("이전 달 데이터가 남아 있어도 보고 있는 달에 점이 잘못 찍히지 않는다", () => {
  const month = new Date(2026, 8, 1); // 2026-09
  const previousMonthEvents = [
    { id: 1, title: "8월 행사", start_at: "2026-08-10T00:00:00+09:00", end_at: "2026-08-10T01:00:00+09:00" },
  ] as never;
  assert.equal(eventDaysForMonth(previousMonthEvents, month).size, 0);
});

test("한 달치가 아니라 앞뒤 한 달까지 받아온다", () => {
  assert.deepEqual(calendarMonthWindowRange(new Date(2026, 8, 1)), {
    start: "2026-08-01",
    end: "2026-10-31",
  });
  // 연말·연초를 넘어가도 달이 밀리지 않는다.
  assert.deepEqual(calendarMonthWindowRange(new Date(2026, 0, 1)), {
    start: "2025-12-01",
    end: "2026-02-28",
  });
  assert.match(homeSource, /calendarMonthWindowRange\(month\)/);
});

test("옆 달로 넘어가도 들고 있던 응답이 그 달을 통째로 덮는다", () => {
  // 이게 성립해야 새 응답을 기다리는 동안에도 날짜 점이 끊기지 않는다.
  const september = new Date(2026, 8, 1);
  const held = calendarMonthWindowRange(september);
  for (const delta of [-1, 1]) {
    const neighbour = calendarMonthRange(shiftCalendarMonth(september, delta));
    assert.ok(
      held.start <= neighbour.start && neighbour.end <= held.end,
      `${delta}달 이동한 ${neighbour.start}~${neighbour.end}이 들고 있는 ${held.start}~${held.end} 밖이다`,
    );
  }
});
