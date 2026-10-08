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

const homeSource = readFileSync("app/(tabs)/(home,notices,community,participation,council)/home.tsx", "utf8");
const source = ts.createSourceFile("home.tsx", homeSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const screen = source.statements.find(
  (node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "HomeScreen",
)!;

// 화면이 실제로 등록하는 달력 되돌리기 코드(상태 선언 뒤 navigation부터 useFocusEffect까지)를 그대로 돌린다.
const statements = screen.body!.statements;
const firstIndex = statements.findIndex((node) => node.getText(source).startsWith("const navigation = useNavigation()"));
const focusIndex = statements.findIndex(
  (node) =>
    ts.isExpressionStatement(node)
    && ts.isCallExpression(node.expression)
    && node.expression.expression.getText(source) === "useFocusEffect"
    && node.getText(source).includes("resetCalendar"),
);
assert.ok(firstIndex >= 0 && focusIndex > firstIndex, "홈은 탭을 오갈 때 달력을 되돌려야 한다");
const resetCode = ts.transpileModule(statements.slice(firstIndex, focusIndex + 1).map((node) => node.getText(source)).join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

type Listener = () => void;

function mountHome(startMonth: Date, startPicked: { monthKey: string; day: number } | null) {
  const state = { month: startMonth, picked: startPicked, monthUpdates: 0, focused: true };
  const listeners: Record<string, Listener[]> = {};
  let focusCallback: Listener = () => {};
  const tabStack = {
    addListener: (event: string, listener: Listener) => {
      (listeners[event] ??= []).push(listener);
      return () => {};
    },
  };
  runInNewContext(resetCode, {
    currentKoreaMonth,
    useNavigation: () => ({ getParent: () => tabStack, isFocused: () => state.focused }),
    useRef: (current: unknown) => ({ current }),
    useCallback: (fn: unknown) => fn,
    useEffect: (fn: () => void) => fn(),
    useFocusEffect: (fn: Listener) => {
      focusCallback = fn;
    },
    setMonth: (update: (current: Date) => Date) => {
      const next = update(state.month);
      if (next !== state.month) state.monthUpdates += 1;
      state.month = next;
    },
    setPickedDay: (value: { monthKey: string; day: number } | null) => {
      state.picked = value;
    },
  });
  const emit = (event: string) => listeners[event]?.forEach((listener) => listener());
  return {
    state,
    // 다른 탭으로 갔다가 돌아온다.
    leaveTabAndReturn() {
      state.focused = false;
      emit("blur");
      state.focused = true;
      focusCallback();
    },
    // 홈 스택에서 글을 열었다가 뒤로가기로 돌아온다. 탭 이벤트는 없다.
    openPostAndGoBack() {
      state.focused = false;
      state.focused = true;
      focusCallback();
    },
    // 홈 스택에서 글을 보다가 하단 홈 탭을 누른다.
    openPostAndPressHomeTab() {
      state.focused = false;
      emit("tabPress");
      state.focused = true;
      focusCallback();
    },
    // 홈 첫 화면을 보고 있는 채로 하단 홈 탭을 누른다. 포커스는 다시 오지 않는다.
    pressHomeTabOnHome() {
      emit("tabPress");
    },
  };
}

const browsed = shiftCalendarMonth(currentKoreaMonth(), 1);
const browsedPick = { monthKey: `${browsed.getFullYear()}-${browsed.getMonth()}`, day: 15 };

test("다른 탭에 갔다 오면 이번 달·오늘로 되돌아간다", () => {
  const home = mountHome(browsed, browsedPick);
  home.leaveTabAndReturn();
  assert.equal(home.state.month.getTime(), currentKoreaMonth().getTime());
  assert.equal(home.state.picked, null);
});

test("달력에서 연 글을 보고 뒤로가기로 돌아오면 보던 달과 고른 날짜가 남는다", () => {
  const home = mountHome(browsed, browsedPick);
  home.openPostAndGoBack();
  assert.equal(home.state.month.getTime(), browsed.getTime());
  assert.deepEqual(home.state.picked, browsedPick);
});

test("글을 보다가 하단 홈 탭을 누르면 이번 달·오늘로 되돌아간다", () => {
  const home = mountHome(browsed, browsedPick);
  home.openPostAndPressHomeTab();
  assert.equal(home.state.month.getTime(), currentKoreaMonth().getTime());
  assert.equal(home.state.picked, null);
});

test("홈을 보면서 홈 탭을 누르면 바로 되돌리고, 다음 뒤로가기에는 다시 되돌리지 않는다", () => {
  const home = mountHome(browsed, browsedPick);
  home.pressHomeTabOnHome();
  assert.equal(home.state.month.getTime(), currentKoreaMonth().getTime());
  assert.equal(home.state.picked, null);
  home.state.month = browsed;
  home.state.picked = browsedPick;
  home.openPostAndGoBack();
  assert.equal(home.state.month.getTime(), browsed.getTime());
  assert.deepEqual(home.state.picked, browsedPick);
});

test("이미 이번 달이면 달 상태를 건드리지 않아 다시 불러오지 않는다", () => {
  const home = mountHome(currentKoreaMonth(), null);
  home.leaveTabAndReturn();
  assert.equal(home.state.monthUpdates, 0, "같은 달인데 새 Date를 넣으면 쿼리 키가 바뀌어 재요청된다");
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
