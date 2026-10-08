import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Element = { type: string; props: Record<string, any>; children: Element[] };
const source = readFileSync("components/CalendarMonth.tsx", "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;

function render(props: Record<string, unknown>) {
  const exported: Record<string, any> = {};
  runInNewContext(code, {
    exports: exported,
    React: { createElement: (type: string, attributes: Record<string, any>, ...children: Element[]) => ({ type, props: attributes ?? {}, children: children.flat(Infinity) }) },
    require: (name: string) => {
      if (name === "react") return { useMemo: (fn: () => unknown) => fn(), useState: (value: unknown) => [value, () => {}] };
      if (name === "react-native") return { View: "View", Pressable: "Pressable", StyleSheet: { create: (styles: unknown) => styles } };
      if (name === "./AppTypography") return { AppText: "Text" };
      if (name === "./icons") return { BackIcon: "BackIcon", ForwardIcon: "ForwardIcon" };
      if (name === "../utils/eventCalendar") return { koreaCalendarDate: () => ({ year: 2026, month: 10, day: 6 }) };
      throw new Error(name);
    },
  });
  const root = exported.default(props) as Element;
  const elements: Element[] = [];
  function visit(node: Element) {
    if (!node || typeof node !== "object") return;
    elements.push(node);
    node.children?.forEach(visit);
  }
  visit(root);
  return { elements };
}

test("공통 달력은 6주짜리 월과 윤년 날짜를 선택하고 오늘과 선택일을 구분한다", () => {
  const selected: Date[] = [];
  for (const [month, count] of [[new Date(2026, 7, 1), 31], [new Date(2028, 1, 1), 29]] as const) {
    const { elements } = render({ month, onSelect: (date: Date) => selected.push(date), onChangeMonth: () => {} });
    const dates = elements.filter((node) => node.type === "Pressable" && node.props.accessibilityLabel.endsWith("일"));
    assert.equal(dates.length, count);
    dates.at(-1)!.props.onPress();
    assert.equal(selected.at(-1)!.getDate(), count);
  }
  const { elements } = render({ month: new Date(2026, 9, 1), selectedDay: 7, onSelect: () => {}, onChangeMonth: () => {} });
  const today = elements.find((node) => node.props.accessibilityLabel === "2026년 10월 6일")!;
  const selection = elements.find((node) => node.props.accessibilityLabel === "2026년 10월 7일")!;
  assert.equal(today.props.accessibilityState.selected, false);
  assert.equal(today.children[0].props.style[1].backgroundColor, "#E6F1FB");
  assert.equal(selection.props.accessibilityState.selected, true);
  assert.equal(selection.children[0].props.style[1].backgroundColor, "#2761FF");
});

test("공통 달력은 기존 날짜 제한과 다음 달 버튼 제한을 유지한다", () => {
  const deltas: number[] = [];
  const { elements } = render({ month: new Date(2026, 9, 1), nextDisabled: true,
    onChangeMonth: (delta: number) => deltas.push(delta), onSelect: () => {}, isDateDisabled: (date: Date) => date.getDate() > 6 });
  assert.equal(elements.find((node) => node.props.accessibilityLabel === "2026년 10월 7일")!.props.disabled, true);
  assert.equal(elements.find((node) => node.props.accessibilityLabel === "2026년 10월 6일")!.props.disabled, false);
  assert.equal(elements.find((node) => node.props.accessibilityLabel === "다음 달")!.props.disabled, true);
  elements.find((node) => node.props.accessibilityLabel === "이전 달")!.props.onPress();
  assert.deepEqual(deltas, [-1]);
});
