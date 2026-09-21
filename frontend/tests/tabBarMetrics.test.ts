import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const layoutSource = readFileSync("app/(tabs)/_layout.tsx", "utf8");
const source = ts.createSourceFile("_layout.tsx", layoutSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

// 탭 한 칸에 실제로 들어가는 것: 아이콘 22 + marginTop 3 + 라벨 lineHeight 13.
const ICON_SIZE = 22;
const LABEL_MARGIN_TOP = 3;
const LABEL_LINE_HEIGHT = 13;
const CONTENT_HEIGHT = ICON_SIZE + LABEL_MARGIN_TOP + LABEL_LINE_HEIGHT;

function metricsFor(platform: string) {
  const declaration = source.statements.find(
    (node) =>
      ts.isVariableStatement(node)
      && node.declarationList.declarations.some((d) => d.name.getText(source) === "TAB_BAR_METRICS"),
  )!;
  assert.ok(declaration, "TAB_BAR_METRICS 선언이 있어야 한다");
  const code = ts.transpileModule(`${declaration.getText(source)}\nresult = TAB_BAR_METRICS;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context: { Platform: { OS: string }; result?: { height: number; paddingTop: number; paddingBottom: number } } = {
    Platform: { OS: platform },
  };
  runInNewContext(code, context);
  // VM realm의 객체라 프로토타입이 달라 deepEqual이 걸린다. 값만 옮긴다.
  const { height, paddingTop, paddingBottom } = context.result!;
  return { height, paddingTop, paddingBottom };
}

test("iOS 탭바는 플랫폼 표준 49pt를 쓴다", () => {
  // 74를 쓰면 다른 앱보다 25pt 두꺼워 메뉴바가 위로 올라와 보인다.
  assert.equal(metricsFor("ios").height, 49);
});

test("안드로이드는 기존 74를 유지한다", () => {
  assert.deepEqual(metricsFor("android"), { height: 74, paddingTop: 8, paddingBottom: 8 });
});

test("두 플랫폼 모두 아이콘과 라벨이 잘리지 않는다", () => {
  for (const platform of ["ios", "android"]) {
    const metrics = metricsFor(platform);
    const usable = metrics.height - metrics.paddingTop - metrics.paddingBottom;
    assert.ok(
      usable >= CONTENT_HEIGHT,
      `${platform}: 쓸 수 있는 ${usable}pt가 내용물 ${CONTENT_HEIGHT}pt보다 작다`,
    );
  }
});

test("안전영역은 높이와 아래 여백에 한 번씩만 더한다", () => {
  // 두 번 더하면 홈 인디케이터 기종에서 탭바가 34pt 더 두꺼워진다.
  assert.match(layoutSource, /height: TAB_BAR_STYLE\.height \+ insets\.bottom/);
  assert.match(layoutSource, /paddingBottom: TAB_BAR_STYLE\.paddingBottom \+ insets\.bottom/);
  assert.equal(layoutSource.match(/insets\.bottom/g)?.length, 2);
});
