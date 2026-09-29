import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const homeSource = readFileSync("app/(tabs)/home.tsx", "utf8");
const source = ts.createSourceFile("home.tsx", homeSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const card = source.statements.find(
  (node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "CalendarCard",
)!;
assert.ok(card, "CalendarCard가 있어야 한다");

// 화면이 실제로 만드는 제스처 설정을 그대로 꺼내 돌린다. 임계값도 모듈 상수를
// 그대로 쓰므로, 값을 바꾸면 이 테스트가 같이 따라간다.
const thresholds = source.statements
  .filter((node) => ts.isVariableStatement(node) && /const MONTH_SWIPE_/.test(node.getText(source)))
  .map((node) => node.getText(source));
assert.equal(thresholds.length, 2, "스와이프 임계값 상수 두 개");

const upto = card.body!.statements.findIndex((node) => /const monthSwipe\b/.test(node.getText(source)));
assert.ok(upto >= 0, "monthSwipe 선언이 있어야 한다");
const body = card.body!.statements.slice(0, upto + 1).map((node) => node.getText(source));

type Gesture = { dx: number; dy: number };
type Config = {
  onMoveShouldSetPanResponder: (event: unknown, gesture: Gesture) => boolean;
  onPanResponderRelease: (event: unknown, gesture: Gesture) => void;
};

function buildSwipe() {
  const deltas: number[] = [];
  let config: Config | undefined;
  const code = ts.transpileModule([...thresholds, ...body].join(`
`), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, {
    PanResponder: {
      create: (value: Config) => {
        config = value;
        return { panHandlers: {} };
      },
    },
    useMemo: (factory: () => unknown) => factory(),
    useRef: (initial: unknown) => ({ current: initial }),
    onChangeMonth: (delta: number) => deltas.push(delta),
  });
  assert.ok(config, "PanResponder 설정을 꺼내지 못했다");
  return { config: config!, deltas };
}

test("가로로 분명히 움직일 때만 제스처를 가져온다", () => {
  const { config } = buildSwipe();
  const claim = (dx: number, dy: number) => config.onMoveShouldSetPanResponder({}, { dx, dy });
  // 세로 스크롤을 빼앗으면 홈 화면을 내릴 수 없다.
  assert.equal(claim(4, 60), false, "세로 드래그");
  assert.equal(claim(20, 40), false, "비스듬한 드래그");
  // 눌렀다 떼기는 움직임이 없으니 날짜 셀 탭이 살아 있다.
  assert.equal(claim(0, 0), false, "탭");
  assert.equal(claim(20, 4), true, "가로 드래그");
});

test("왼쪽으로 밀면 다음 달, 오른쪽으로 밀면 이전 달", () => {
  const { config, deltas } = buildSwipe();
  config.onPanResponderRelease({}, { dx: -60, dy: 0 });
  config.onPanResponderRelease({}, { dx: 60, dy: 0 });
  assert.deepEqual(deltas, [1, -1]);
});

test("조금만 움직이면 달이 바뀌지 않는다", () => {
  const { config, deltas } = buildSwipe();
  config.onPanResponderRelease({}, { dx: -20, dy: 0 });
  config.onPanResponderRelease({}, { dx: 20, dy: 0 });
  assert.deepEqual(deltas, [], "손떨림으로 달이 넘어가면 안 된다");
});

test("제스처는 날짜 격자에 붙고 화살표 버튼은 그대로 남는다", () => {
  assert.ok(
    homeSource.includes("<View {...monthSwipe.panHandlers} style={cal.grid}>"),
    "격자에 panHandlers가 붙어야 한다",
  );
  assert.ok(homeSource.includes('accessibilityLabel="이전 달"'), "이전 달 버튼");
  assert.ok(homeSource.includes('accessibilityLabel="다음 달"'), "다음 달 버튼");
});

test("달력은 카드 폭에 맞춰 시안 비율 그대로 커진다", () => {
  // Figma 캘린더 카드는 360dp 화면·카드 폭 320 기준이다. 화면이 넓어지면 카드도
  // 넓어지는데 글자만 고정이면 시안보다 작아 보인다.
  assert.match(homeSource, /const DESIGN_CALENDAR_CARD_WIDTH = 320;/);
  assert.match(
    homeSource,
    /Math\.min\(getHomeContentWidth\(windowWidth\) \/ DESIGN_CALENDAR_CARD_WIDTH, MAX_CALENDAR_SCALE\)/,
  );
  // 크기 값은 전부 r()을 거쳐야 한 군데만 고정폭으로 남는 일이 없다.
  assert.match(homeSource, /const r = \(value: number\) => value \* scale;/);
  assert.match(homeSource, /fontSize: r\(13\)/);
  assert.match(homeSource, /width: r\(4\), height: r\(4\)/);
  // 테두리는 얇은 선이라 키우지 않는다.
  assert.match(homeSource, /borderWidth: 0\.5,\s*\n\s*borderColor: COLORS\.border,/);

  // 배율은 아주 좁은 화면에서도, 태블릿처럼 넓은 화면에서도 극단으로 가지 않는다.
  const scaleFor = (cardWidth: number) => Math.min(cardWidth / 320, 1.25);
  assert.ok(Math.abs(scaleFor(320) - 1) < 0.001, "디자인 기준 화면(360dp)에서는 1배");
  assert.ok(scaleFor(280) > 0.85, "가장 좁은 화면에서도 0.87배 수준");
  // 흔한 대화면 폰까지는 비율을 그대로 살린다.
  assert.ok(scaleFor(371) < 1.25, "411dp 폰은 상한에 걸리지 않는다");
  assert.ok(scaleFor(390) < 1.25, "430dp 폰도 상한에 걸리지 않는다");
  assert.equal(scaleFor(1000), 1.25, "태블릿 폭은 상한에서 멈춘다");
});
