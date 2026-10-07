import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { CommonActions, StackRouter } from "@react-navigation/routers";
import ts from "typescript";

const GROUP = "app/(tabs)/(home,notices,community,participation,council)";

// utils/tabNavigation은 expo-router를 불러 Node에서 그대로 열 수 없다. 실제 소스를
// 옮겨 돌리되 React Navigation 액션은 진짜 라우터 패키지 것을 쓴다.
function loadTabNavigation(rootRoute = "(tabs)") {
  const exports: Record<string, any> = {};
  const dispatched: unknown[] = [];
  const navigated: string[] = [];
  const replaced: string[] = [];
  const code = ts.transpileModule(readFileSync("utils/tabNavigation.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const modules: Record<string, unknown> = {
    "@react-navigation/native": { CommonActions },
    "expo-router": { router: {
      navigate: (route: string) => navigated.push(route),
      replace: (route: string) => replaced.push(route),
    } },
    "./appRoutes": {
      HOME_TAB_ROUTE: "/(tabs)/home",
      NOTICES_TAB_ROUTE: "/(tabs)/notices",
      COMMUNITY_TAB_ROUTE: "/(tabs)/community",
      PARTICIPATION_TAB_ROUTE: "/(tabs)/participation",
      COUNCIL_TAB_ROUTE: "/(tabs)/council",
    },
    "./adminNavigation": loadAdminNavigation(),
  };
  runInNewContext(code, { exports, require: (name: string) => modules[name] });
  exports.registerTabNavigationContainer({
    isReady: () => true,
    dispatch: (action: unknown) => dispatched.push(action),
    getRootState: () => ({ index: 0, routes: [{ name: rootRoute }] }),
  });
  return Object.assign(exports as unknown as typeof import("../utils/tabNavigation"), { dispatched, navigated, replaced });
}

function loadAdminNavigation() {
  const exports: Record<string, unknown> = {};
  const code = ts.transpileModule(readFileSync("utils/adminNavigation.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { exports });
  return exports;
}

// 중첩 navigate 액션에서 그 탭 스택이 받는 마지막 단계를 꺼낸다.
function innerStackAction(action: any) {
  const tabParams = action.payload.params;
  const stackParams = tabParams.params;
  return CommonActions.navigate({ name: stackParams.screen, params: stackParams.params, pop: stackParams.pop });
}

const stackRouter = StackRouter({});
const routeNames = ["community", "board/[boardId]", "board/post/[postId]", "search"];
function stackState(names: string[]) {
  return {
    stale: false as const,
    type: "stack" as const,
    key: "stack-community",
    index: names.length - 1,
    routeNames,
    preloadedRoutes: [],
    routes: names.map((name, index) => ({ key: `${name}-${index}`, name })),
  };
}

test("탭마다 스택을 갖도록 화면들이 공용 그룹 한 곳에 있고 숨김 탭을 두지 않는다", () => {
  for (const file of ["home", "notices", "community", "participation", "council", "search", "faq", "notifications", "board/[boardId]", "board/post/[postId]", "settings/activity"]) {
    assert.ok(existsSync(`${GROUP}/${file}.tsx`), `${file}가 공용 그룹에 있어야 한다`);
  }
  assert.equal(existsSync("app/(tabs)/board"), false, "공용 board 숨김 탭이 남아 있으면 글이 탭과 무관하게 쌓인다");
  const tabsLayout = readFileSync("app/(tabs)/_layout.tsx", "utf8");
  assert.doesNotMatch(tabsLayout, /href:\s*null/);
  const groupLayout = readFileSync(`${GROUP}/_layout.tsx`, "utf8");
  assert.match(groupLayout, /<Stack\b/);
  assert.doesNotMatch(groupLayout, /gestureEnabled: false/);
});

test("탭 첫 화면 이동은 (tabs) → 탭 → 첫 화면 순으로 pop을 켜 보낸다", () => {
  const nav = loadTabNavigation();
  nav.navigateToTabRoot("community");
  // vm 컨텍스트에서 만든 객체라 값만 비교한다.
  assert.deepEqual(JSON.parse(JSON.stringify(nav.dispatched)), [CommonActions.navigate({
    name: "(tabs)",
    params: { screen: "(community)", params: { screen: "community", pop: true }, pop: true },
    pop: true,
  })]);
});

test("쌓여 있던 글·게시판은 탭 첫 화면 이동 한 번에 모두 비워진다", () => {
  const nav = loadTabNavigation();
  const state = stackState(["community", "board/post/[postId]", "board/[boardId]", "board/post/[postId]"]);
  const next = stackRouter.getStateForAction(state, innerStackAction(nav.tabRootAction("community")), {
    routeNames, routeParamList: {}, routeGetIdList: {},
  });
  assert.deepEqual(next?.routes.map((route) => route.name), ["community"], "같은 이름 화면을 새로 push하면 안 된다");
});

test("pop 없이 navigate 하면 탭 첫 화면이 하나 더 쌓인다는 전제를 확인한다", () => {
  const state = stackState(["community", "board/post/[postId]"]);
  const next = stackRouter.getStateForAction(state, CommonActions.navigate({ name: "community" }), {
    routeNames, routeParamList: {}, routeGetIdList: {},
  });
  assert.deepEqual(next?.routes.map((route) => route.name), ["community", "board/post/[postId]", "community"]);
});

test("탭 스택을 통째로 열 때는 첫 화면을 앞에 붙인다", () => {
  const nav = loadTabNavigation();
  nav.openTabStack("home", [{ name: "notifications" }, { name: "board/post/[postId]", params: { postId: "9" } }]);
  const action = nav.dispatched[0] as any;
  assert.equal(action.payload.name, "(tabs)");
  assert.equal(action.payload.params.screen, "(home)");
  assert.deepEqual(JSON.parse(JSON.stringify(action.payload.params.params.state.routes.map((route: { name: string }) => route.name))), ["home", "notifications", "board/post/[postId]"]);
});

test("탭 첫 화면 경로만 탭 이름으로 바꾸고 나머지 경로는 그대로 이동한다", () => {
  const nav = loadTabNavigation();
  assert.equal(nav.tabNameFromRoute("/(tabs)/community"), "community");
  assert.equal(nav.tabNameFromRoute("/(tabs)/(notices)/notices"), "notices");
  assert.equal(nav.tabNameFromRoute("/home"), "home");
  assert.equal(nav.tabNameFromRoute("/(tabs)/search?scope=notices"), null);
  assert.equal(nav.tabNameFromRoute("/board/12"), null);
  assert.equal(nav.tabNameFromRoute(undefined), null);

  nav.navigateToRoute("/(tabs)/participation");
  nav.navigateToRoute("/(tabs)/settings/activity?type=posts");
  nav.replaceWithRoute("/(tabs)/notices");
  nav.replaceWithRoute("/board/7");
  assert.equal(nav.dispatched.length, 2);
  assert.deepEqual(nav.navigated, ["/(tabs)/settings/activity?type=posts"]);
  assert.deepEqual(nav.replaced, ["/board/7"]);
});

// 관리자 콘솔이 글 화면을 재사용할 때는 탭 스택 대신 관리자 경로로 옮긴다.
test("관리자 콘솔 안에서는 탭 이동 대신 관리자 화면 경로로 옮긴다", () => {
  const nav = loadTabNavigation("admin");
  nav.navigateToRoute("/(tabs)/community");
  nav.navigateToRoute("/board/post/5");
  nav.replaceWithRoute("/board/post/edit/5");
  nav.replaceWithRoute("/board/7");
  assert.equal(nav.dispatched.length, 0);
  assert.deepEqual(nav.navigated, ["/admin/boards", "/admin/boards/post/5"]);
  assert.deepEqual(nav.replaced, ["/admin/boards/post/5/edit", "/admin/boards"]);
});

// 화면 안에 열린 것을 닫는 iOS 스와이프 처리기.
function swipeHarness(platform = "ios") {
  const exports: Record<string, any> = {};
  const dispatched: unknown[] = [];
  let prevent: { enabled: boolean; callback: (event: { data: { action: { type: string } } }) => void } | undefined;
  let passThrough = false;
  const effects: (() => void)[] = [];
  const code = ts.transpileModule(readFileSync("hooks/useSwipeBackInScreen.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const modules: Record<string, unknown> = {
    "@react-navigation/native": {
      useNavigation: () => ({ dispatch: (action: unknown) => dispatched.push(action) }),
      usePreventRemove: (enabled: boolean, callback: typeof prevent extends infer T ? T extends { callback: infer C } ? C : never : never) => {
        prevent = { enabled, callback };
      },
    },
    react: {
      useState: () => [passThrough, (value: boolean) => { passThrough = value; }],
      useRef: (() => { const box = { current: null }; return () => box; })(),
      useEffect: (effect: () => void) => effects.push(effect),
    },
    "react-native": { Platform: { OS: platform } },
  };
  runInNewContext(code, { exports, require: (name: string) => modules[name] });
  return {
    dispatched,
    render(active: boolean, onBack: () => void) {
      effects.length = 0;
      exports.useSwipeBackInScreen(active, onBack);
      effects.forEach((effect) => effect());
      return prevent!;
    },
  };
}

test("화면 안에 열린 것이 있으면 iOS 스와이프는 그것만 닫는다", () => {
  const h = swipeHarness();
  const closed: string[] = [];
  const prevent = h.render(true, () => closed.push("overlay"));
  assert.equal(prevent.enabled, true);
  prevent.callback({ data: { action: { type: "POP" } } });
  assert.deepEqual(closed, ["overlay"]);
  assert.deepEqual(h.dispatched, [], "스와이프로는 화면을 떠나지 않는다");
});

test("스와이프가 아닌 이동(삭제 후 pop, 저장 후 교체)은 잠금을 풀고 그대로 보낸다", () => {
  const h = swipeHarness();
  let closedCount = 0;
  const close = () => { closedCount += 1; };
  const prevent = h.render(true, close);
  const action = { type: "GO_BACK" };
  prevent.callback({ data: { action } });
  assert.equal(closedCount, 0);
  const reopened = h.render(true, close);
  assert.equal(reopened.enabled, false, "잠금을 푼 렌더에서 보낸다");
  assert.deepEqual(h.dispatched, [action]);
});

test("열린 것이 없거나 iOS가 아니면 스와이프를 막지 않는다", () => {
  assert.equal(swipeHarness().render(false, () => {}).enabled, false);
  for (const platform of ["android", "web"]) {
    assert.equal(swipeHarness(platform).render(true, () => {}).enabled, false);
  }
});

// <Stack.Screen>으로 화면을 나열하면 expo-router가 그 화면들을 목록 맨 앞에 두어 탭 스택의
// 첫 화면이 마이페이지로 바뀐다(로그인 직후·앱 시작 시 마이페이지가 먼저 뜨던 버그).
test("탭 스택 레이아웃은 화면을 직접 나열하지 않고, 마이페이지 화면만 전환 애니메이션을 끈다", () => {
  const source = readFileSync(`${GROUP}/_layout.tsx`, "utf8");
  assert.doesNotMatch(source, /<Stack\.Screen\s+name=/);
  // 첫 화면을 명시하지 않으면 실제 앱에서 정렬상 맨 앞 화면(faq)이 홈 탭 첫 화면이 됐다.
  for (const tab of ["home", "notices", "community", "participation", "council"]) {
    assert.match(source, new RegExp(`${tab}: \\{ initialRouteName: "${tab}" \\}`), `${tab} 탭 첫 화면을 명시해야 한다`);
  }

  const file = ts.createSourceFile("_layout.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const layout = file.statements.find(
    (node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "TabStackLayout",
  )!;
  const constants = file.statements
    .filter(ts.isVariableStatement)
    .map((node) => node.getText(file).replace(/^export /, ""))
    .join("\n");
  const code = ts.transpileModule(`${constants}\n(${layout.getText(file).replace("export default ", "")})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: "element" },
  }).outputText;
  const element = runInNewContext(code, { Stack: "Stack", element: (_type: unknown, props: unknown) => props })() as {
    screenOptions: (input: { route: { name: string } }) => { animation?: string; headerShown?: boolean };
  };
  for (const name of ["settings/profile", "settings/notifications", "settings/account", "settings/activity"]) {
    assert.equal(element.screenOptions({ route: { name } }).animation, "none", name);
  }
  for (const name of ["home", "board/post/[postId]", "search", "settings/password"]) {
    assert.equal(element.screenOptions({ route: { name } }).animation, undefined, name);
    assert.equal(element.screenOptions({ route: { name } }).headerShown, false);
  }
});
