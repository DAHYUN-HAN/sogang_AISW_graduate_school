import { create } from "zustand";

// 게시판/상세 화면은 들어온 탭 스택 위에 쌓이지만(홈에서 연 커뮤니티 글은 홈 스택),
// 하단바는 그 글이 속한 카테고리 탭을 하이라이트한다. 화면이 자신의 소속 탭을 자기
// 라우트 키로 기록하면 커스텀 탭바가 지금 맨 위 화면의 값만 읽는다. 다른 화면이
// 남긴 값을 빌려 쓰지 않으므로, 글을 불러오는 동안처럼 아직 기록이 없으면 지금 탭을
// 그대로 하이라이트한다.
type TabHighlightState = {
  tabs: Record<string, string>;
  setTab: (routeKey: string, tab: string) => void;
  clearTab: (routeKey: string) => void;
};

export const useTabHighlightStore = create<TabHighlightState>((set) => ({
  tabs: {},
  setTab: (routeKey, tab) => set((state) => (
    state.tabs[routeKey] === tab ? state : { tabs: { ...state.tabs, [routeKey]: tab } }
  )),
  clearTab: (routeKey) => set((state) => {
    if (!(routeKey in state.tabs)) return state;
    const tabs = { ...state.tabs };
    delete tabs[routeKey];
    return { tabs };
  }),
}));

// boardParentRoute()가 주는 "/(tabs)/notices" 형태를 탭 이름으로 바꾼다.
export function tabNameFromRoute(route: string): string {
  return route.split("/").pop() || "home";
}
