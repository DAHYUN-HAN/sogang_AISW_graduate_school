import { CommonActions, type NavigationContainerRef } from "@react-navigation/native";
import { router } from "expo-router";

import { adminDestination } from "./adminNavigation";
import {
  COMMUNITY_TAB_ROUTE,
  COUNCIL_TAB_ROUTE,
  HOME_TAB_ROUTE,
  NOTICES_TAB_ROUTE,
  PARTICIPATION_TAB_ROUTE,
} from "./appRoutes";

export type TabName = "home" | "notices" | "community" | "participation" | "council";

const TAB_ROUTES: Record<TabName, string> = {
  home: HOME_TAB_ROUTE,
  notices: NOTICES_TAB_ROUTE,
  community: COMMUNITY_TAB_ROUTE,
  participation: PARTICIPATION_TAB_ROUTE,
  council: COUNCIL_TAB_ROUTE,
};

// "/(tabs)/community"나 "/community"처럼 탭 첫 화면을 가리키는 경로면 그 탭 이름을 준다.
export function tabNameFromRoute(route: unknown): TabName | null {
  if (typeof route !== "string") return null;
  const path = route.split("?")[0].replace(/\/\([^/]+\)/g, "").replace(/\/+$/, "");
  const name = (Object.keys(TAB_ROUTES) as TabName[]).find((tab) => `/${tab}` === path);
  return name ?? null;
}

type ContainerRef = Pick<NavigationContainerRef<ReactNavigation.RootParamList>, "dispatch" | "isReady" | "getRootState">;

let containerRef: ContainerRef | null = null;

export function registerTabNavigationContainer(ref: ContainerRef) {
  containerRef = ref;
}

// 탭마다 스택이 따로라서 "/(tabs)/community"로 navigate 하면 지금 탭 스택 위에
// 커뮤니티 화면이 하나 더 쌓인다(React Navigation 7은 같은 이름이어도 새로 push).
// 대신 (tabs) → 그 탭 → 첫 화면 순으로 중첩 navigate를 보내고, 단계마다 pop을 켜
// 이미 있는 화면까지 되돌아가게 한다. 관리자 화면처럼 (tabs) 위에 열린 화면에서
// 불러도 같은 경로로 처리된다.
export function tabRootAction(tab: TabName) {
  return CommonActions.navigate({
    name: "(tabs)",
    params: { screen: `(${tab})`, params: { screen: tab, pop: true }, pop: true },
    pop: true,
  });
}

// 그 탭의 스택을 통째로 이 화면들로 바꿔 연다. 첫 화면은 넣지 않아도 앞에 붙인다.
export function tabStackAction(tab: TabName, routes: { name: string; params?: Record<string, string> }[]) {
  return CommonActions.navigate({
    name: "(tabs)",
    params: { screen: `(${tab})`, params: { state: { routes: [{ name: tab }, ...routes] } }, pop: true },
    pop: true,
  });
}

export function navigateToTabRoot(tab: TabName) {
  if (!containerRef?.isReady()) return;
  containerRef.dispatch(tabRootAction(tab));
}

// 관리자 콘솔은 글 상세·작성·수정 화면을 그대로 가져다 쓴다. 그 안에서 부르면
// 탭 스택이 아니라 관리자 화면 경로로 바꿔서 옮긴다(adminPostRouter와 같은 규칙).
function inAdminWorkspace() {
  if (!containerRef?.isReady()) return false;
  const state = containerRef.getRootState();
  return state?.routes[state.index ?? 0]?.name === "admin";
}

// 탭 첫 화면이면 그 탭으로 옮기고, 아니면 지금 탭 스택에서 그 화면으로 간다.
export function navigateToRoute(route: string) {
  if (inAdminWorkspace()) return router.navigate(adminDestination(route) as never);
  const tab = tabNameFromRoute(route);
  if (tab) navigateToTabRoot(tab);
  else router.navigate(route as never);
}

// replace도 탭 첫 화면이면 다른 탭 스택에 끼워 넣지 않고 그 탭으로 옮긴다.
export function replaceWithRoute(route: string) {
  if (inAdminWorkspace()) return router.replace(adminDestination(route) as never);
  const tab = tabNameFromRoute(route);
  if (tab) navigateToTabRoot(tab);
  else router.replace(route as never);
}

export function openTabStack(tab: TabName, routes: { name: string; params?: Record<string, string> }[]) {
  if (!containerRef?.isReady()) return;
  containerRef.dispatch(tabStackAction(tab, routes));
}
