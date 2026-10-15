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
  // 수정 주소(글쓰기 화면 + postId)를 읽느라 URLSearchParams를 쓴다.
  runInNewContext(code, { exports, URLSearchParams });
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
  // iOS 기본 스와이프를 끄는 화면은 마이페이지 하나뿐이다(PLAN.md 2026-10-13).
  assert.equal(groupLayout.match(/gestureEnabled: false/g)?.length, 1);
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
  nav.replaceWithRoute("/board/post/create?postId=5");
  nav.replaceWithRoute("/board/7");
  assert.equal(nav.dispatched.length, 0);
  assert.deepEqual(nav.navigated, ["/admin/boards", "/admin/boards/post/5"]);
  assert.deepEqual(nav.replaced, ["/admin/boards/post/5/edit?postId=5", "/admin/boards"]);
});

// <Stack.Screen>으로 화면을 나열하면 expo-router가 그 화면들을 목록 맨 앞에 두어 탭 스택의
// 첫 화면이 마이페이지로 바뀐다(로그인 직후·앱 시작 시 마이페이지가 먼저 뜨던 버그).
test("탭 스택 레이아웃은 화면을 직접 나열하지 않고, 마이페이지만 왼쪽에서 들어온다", () => {
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
    screenOptions: (input: { route: { name: string } }) => { animation?: string; gestureEnabled?: boolean; headerShown?: boolean };
  };
  const myPage = element.screenOptions({ route: { name: "settings/index" } });
  assert.equal(myPage.animation, "slide_from_left");
  assert.equal(myPage.gestureEnabled, false);
  // 하위 화면은 기본 전환과 기본 스와이프로 마이페이지 위에 쌓였다 돌아간다.
  for (const name of ["home", "board/post/[postId]", "search", "settings/password", "settings/profile", "settings/notifications", "settings/account", "settings/activity"]) {
    assert.equal(element.screenOptions({ route: { name } }).animation, undefined, name);
    assert.equal(element.screenOptions({ route: { name } }).gestureEnabled, undefined, name);
    assert.equal(element.screenOptions({ route: { name } }).headerShown, false);
  }
});
