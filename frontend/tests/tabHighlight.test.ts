import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// 탭바가 실제로 쓰는 CategoryHighlightTabBar를 꺼내 돌린다.
const layoutSource = readFileSync("app/(tabs)/_layout.tsx", "utf8");
const source = ts.createSourceFile("_layout.tsx", layoutSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const tabBar = source.statements.find(
  (node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "CategoryHighlightTabBar",
)!;
const code = ts.transpileModule(`(${tabBar.getText(source)})`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: "element" },
}).outputText;

const TABS = ["(home)", "(notices)", "(community)", "(participation)", "(council)"];

type Screen = { key: string; name: string };

// 지금 탭(focused)의 스택 화면들과, 화면이 기록한 소속 탭으로 탭바를 그려 강조된 탭 이름을 돌려준다.
function highlighted(focused: string, stack: Screen[], recorded: Record<string, string>) {
  const state = {
    index: TABS.indexOf(focused),
    routes: TABS.map((name) => ({
      key: name,
      name,
      state: name === focused ? { index: stack.length - 1, routes: stack } : undefined,
    })),
  };
  const render = runInNewContext(code, {
    BottomTabBar: "BottomTabBar",
    useTabHighlightStore: (select: (store: { tabs: Record<string, string> }) => unknown) => select({ tabs: recorded }),
    element: (_type: unknown, props: { state: typeof state }) => props,
  });
  const props = render({ state });
  return props.state.routes[props.state.index].name;
}

test("홈에서 연 커뮤니티 글은 커뮤니티를 강조한다", () => {
  const stack = [{ key: "home-1", name: "home" }, { key: "post-1", name: "board/post/[postId]" }];
  assert.equal(highlighted("(home)", stack, { "post-1": "community" }), "(community)");
});

test("글을 불러오는 중이라 아직 기록이 없으면 다른 화면이 남긴 값을 빌리지 않고 지금 탭을 강조한다", () => {
  const stack = [{ key: "home-1", name: "home" }, { key: "post-2", name: "board/post/[postId]" }];
  // post-1은 이미 닫힌 커뮤니티 글이 남긴 값이다.
  assert.equal(highlighted("(home)", stack, { "post-1": "community" }), "(home)");
});

test("글에서 뒤로 돌아온 아래 화면은 그 화면의 기록을 쓴다", () => {
  const stack = [
    { key: "council-1", name: "council" },
    { key: "board-1", name: "board/[boardId]" },
  ];
  // 위에 있던 다른 탭 소속 글(post-9)의 기록이 남아 있어도 아래 게시판 기록만 본다.
  assert.equal(highlighted("(council)", stack, { "board-1": "council", "post-9": "community" }), "(council)");
});

test("탭 첫 화면·검색·알림·마이페이지는 기록이 있어도 지금 탭을 강조한다", () => {
  for (const name of ["home", "search", "notifications", "settings/activity"]) {
    const stack = [{ key: "home-1", name: "home" }, { key: "top", name }];
    assert.equal(highlighted("(home)", stack, { top: "community", "home-1": "notices" }), "(home)");
  }
});

test("지금 탭 스택이 아직 만들어지지 않았으면 지금 탭을 강조한다", () => {
  assert.equal(highlighted("(participation)", [], {}), "(participation)");
});
