import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// iOS 기본 스와이프는 usePreventRemove로 막으면 화면이 다 빠진 뒤에 다시 붙어 "튕긴다".
// 화면 안에 열린 것이 있거나 입력 중이면 EdgeSwipeBack이 기본 스와이프를 끄고
// 안드로이드 뒤로가기와 같은 onBack을 실행한다.
const GROUP = "app/(tabs)/(home,notices,community,participation,council)";

type PanEnd = (event: { translationX: number; velocityX: number }, success: boolean) => void;

function renderEdgeSwipeBack(platform: string) {
  const exports: Record<string, any> = {};
  const options: Record<string, unknown>[] = [];
  let cleanup: (() => void) | undefined;
  let enabled: boolean | undefined;
  let onEnd: PanEnd | undefined;
  const code = ts.transpileModule(readFileSync("components/EdgeSwipeBack.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const pan: Record<string, (...args: any[]) => unknown> = {};
  for (const name of ["hitSlop", "activeOffsetX", "failOffsetY", "runOnJS"]) pan[name] = () => pan;
  pan.enabled = (value: boolean) => { enabled = value; return pan; };
  pan.onEnd = (callback: PanEnd) => { onEnd = callback; return pan; };
  const modules: Record<string, unknown> = {
    "@react-navigation/native": { useNavigation: () => ({ setOptions: (value: Record<string, unknown>) => options.push({ ...value }) }) },
    react: { useLayoutEffect: (effect: () => (() => void) | undefined) => { cleanup?.(); cleanup = effect(); } },
    "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
    "react-native": { Platform: { OS: platform }, StyleSheet: { create: (styles: unknown) => styles }, View: "View" },
    "react-native-gesture-handler": { Gesture: { Pan: () => pan }, GestureDetector: "GestureDetector", GestureHandlerRootView: "Root" },
  };
  runInNewContext(code, { exports, require: (name: string) => modules[name] });
  return {
    options,
    render(active: boolean, onBack: () => void) {
      exports.default({ children: null, onBack, active });
      return { enabled, onEnd: onEnd! };
    },
    unmount: () => cleanup?.(),
  };
}

test("열린 것이 있는 동안만 iOS 기본 스와이프를 끄고, 닫히면 다시 켠다", () => {
  const screen = renderEdgeSwipeBack("ios");
  assert.equal(screen.render(false, () => {}).enabled, false);
  assert.deepEqual(screen.options, [], "평소에는 기본 스와이프를 그대로 둔다");
  assert.equal(screen.render(true, () => {}).enabled, true);
  assert.deepEqual(screen.options, [{ gestureEnabled: false }]);
  screen.render(false, () => {});
  assert.deepEqual(screen.options, [{ gestureEnabled: false }, { gestureEnabled: true }]);
});

test("가장자리에서 충분히 밀었을 때만 안드로이드 뒤로가기와 같은 onBack을 한 번 실행한다", () => {
  const screen = renderEdgeSwipeBack("ios");
  let backs = 0;
  const { onEnd } = screen.render(true, () => { backs += 1; });
  onEnd({ translationX: 30, velocityX: 100 }, true);
  assert.equal(backs, 0, "조금만 밀면 아무 일도 없다");
  onEnd({ translationX: 80, velocityX: 0 }, false);
  assert.equal(backs, 0, "취소된 제스처는 무시한다");
  onEnd({ translationX: 80, velocityX: 0 }, true);
  onEnd({ translationX: 20, velocityX: 900 }, true);
  assert.equal(backs, 2);
});

test("안드로이드·웹은 기본 스와이프와 자체 제스처 모두 건드리지 않는다", () => {
  for (const platform of ["android", "web"]) {
    const screen = renderEdgeSwipeBack(platform);
    assert.equal(screen.render(true, () => {}).enabled, false, platform);
    assert.deepEqual(screen.options, [], platform);
  }
});

test("화면 안에 열린 것을 닫는 화면들은 안드로이드 뒤로가기와 같은 처리기를 스와이프에 건다", () => {
  const read = (path: string) => readFileSync(`${GROUP}/${path}`, "utf8");
  const cases: [string, RegExp][] = [
    // 검색: 검색어를 지우고 원래 목록을 보여 주며 검색창을 닫는다(closeSearch).
    ["board/[boardId].tsx", /<EdgeSwipeBack active=\{sortMenuOpen \|\| showSearch\} onBack=\{closeBoardOverlay\} style=\{styles\.screen\}>/],
    ["board/post/[postId].tsx", /<EdgeSwipeBack active=\{hasOpenOverlay\} onBack=\{handlePostBack\} style=\{styles\.screen\}>/],
    // 글 수정도 글쓰기 화면(create.tsx)의 수정 모드라 같은 처리기를 쓴다.
    ["board/post/create.tsx", /<EdgeSwipeBack active=\{swipeHandledInScreen\} onBack=\{handleCreateBack\} style=\{styles\.screen\}>/],
  ];
  for (const [path, pattern] of cases) assert.match(read(path), pattern, path);

  const board = read("board/[boardId].tsx");
  assert.match(board, /if \(sortMenuOpen\) setSortMenuOpen\(false\);\s+else closeSearch\(\);/);
  assert.match(board, /setShowSearch\(false\);\s+setQuery\(""\);\s+setQueryInput\(""\);/);
  assert.match(read("board/post/[postId].tsx"), /const hasOpenOverlay = pendingDeleteCommentId !== null \|\| showDeleteConfirm \|\| Boolean\(reportTarget\) \|\| showPostMenu;/);
  assert.match(read("board/post/create.tsx"), /const swipeHandledInScreen = datePickerOpen \|\| blocksLeaving;/);
});

test("튕김을 만들던 스와이프 가로채기 훅은 없다", () => {
  assert.equal(existsSync("hooks/useSwipeBackInScreen.ts"), false);
});
