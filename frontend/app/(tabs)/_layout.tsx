import { BottomTabBar, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { router, Tabs, usePathname } from "expo-router";
import { useRef } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CommunityTabIcon, CouncilTabIcon, HomeTabIcon, NoticeTabIcon, ParticipationTabIcon } from "../../components/icons";
import { MyPageDrawerProvider } from "../../components/MyPageDrawer";
import { useTabHighlightStore } from "../../stores/tabHighlightStore";
import {
  requestTabRootReset,
  tabRootPressAction,
  type VisibleTabRootName,
} from "../../stores/tabRootResetStore";
import { shouldHideTabBar } from "../../utils/tabBarVisibility";

// 탭 한 칸의 내용물은 아이콘 22 + 간격 3 + 라벨 13 = 38pt다. 아래 높이에서
// 위아래 여백을 뺀 값이 이보다 작으면 라벨이 잘린다.
//
// iOS 표준 탭바는 49pt라 74를 쓰면 다른 앱보다 25pt 두꺼워 보인다. 49에 맞추려면
// 여백을 8에서 줄여야 38이 들어간다(49 - 5 - 6 = 38).
// 안드로이드 74는 Material 하단 네비 범위(56~80) 안이라 그대로 둔다.
const TAB_BAR_METRICS = Platform.OS === "ios"
  ? { height: 49, paddingTop: 5, paddingBottom: 6 }
  : { height: 74, paddingTop: 8, paddingBottom: 8 };

const TAB_BAR_STYLE = {
  ...TAB_BAR_METRICS,
  borderTopColor: "#E1E4E9",
  backgroundColor: "#FFFFFF",
};

const VISIBLE_TAB_NAMES = new Set(["home", "notices", "community", "participation", "council"]);

function handleTabRootPress(
  tabName: VisibleTabRootName,
  event: { preventDefault: () => void },
) {
  const action = tabRootPressAction(tabName);
  event.preventDefault();
  if (action.resetTab) {
    requestTabRootReset(action.resetTab);
  }
  router.navigate(action.route as never);
}

// 숨김 탭(board/events 등)이 포커스되면 기본 탭바는 아무 탭도 하이라이트하지 않는다.
// 게시판 화면이 기록한 소속 카테고리(board), 그 외에는 마지막 방문 탭을 하이라이트한다.
function CategoryHighlightTabBar(props: BottomTabBarProps) {
  const highlightTab = useTabHighlightStore((state) => state.tab);
  const lastVisibleTabRef = useRef("home");
  const { state } = props;
  const focusedName = state.routes[state.index]?.name;

  if (focusedName && VISIBLE_TAB_NAMES.has(focusedName)) {
    lastVisibleTabRef.current = focusedName;
    return <BottomTabBar {...props} />;
  }

  const targetName = focusedName === "board" ? highlightTab : lastVisibleTabRef.current;
  const targetIndex = state.routes.findIndex((route) => route.name === targetName);
  if (targetIndex < 0) {
    return <BottomTabBar {...props} />;
  }
  return <BottomTabBar {...props} state={{ ...state, index: targetIndex }} />;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const hideTabBar = shouldHideTabBar(pathname);
  // Keep the tab content height while reserving the system navigation area once.
  const tabBarStyle = {
    ...TAB_BAR_STYLE,
    height: TAB_BAR_STYLE.height + insets.bottom,
    paddingBottom: TAB_BAR_STYLE.paddingBottom + insets.bottom,
  };

  return (
    <MyPageDrawerProvider>
      <Tabs
        initialRouteName="home"
        backBehavior="initialRoute"
        tabBar={(props) => <CategoryHighlightTabBar {...props} />}
        screenOptions={{
          tabBarActiveTintColor: "#2761FF",
          tabBarInactiveTintColor: "#8A919C",
          tabBarIconStyle: { marginTop: 0 },
          // Figma: 라벨 11/13 Regular (react-navigation 기본 fontWeight 500 오버라이드)
          tabBarLabelStyle: { fontSize: 11, fontFamily: "Pretendard_400Regular", fontWeight: "400", lineHeight: 13, marginTop: 3, marginBottom: 0 },
          tabBarItemStyle: { paddingVertical: 0 },
          tabBarStyle,
          tabBarHideOnKeyboard: true,
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="home"
          listeners={() => ({
            tabPress: (event) => handleTabRootPress("home", event),
          })}
          options={{
            title: "홈",
            tabBarIcon: ({ color }) => <HomeTabIcon color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="notices"
          listeners={() => ({
            tabPress: (event) => handleTabRootPress("notices", event),
          })}
          options={{
            title: "공지사항",
            tabBarIcon: ({ color }) => <NoticeTabIcon color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="community"
          listeners={() => ({
            tabPress: (event) => handleTabRootPress("community", event),
          })}
          options={{
            title: "커뮤니티",
            tabBarIcon: ({ color }) => <CommunityTabIcon color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="participation"
          listeners={() => ({
            tabPress: (event) => handleTabRootPress("participation", event),
          })}
          options={{
            title: "참여활동",
            tabBarIcon: ({ color }) => <ParticipationTabIcon color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="council"
          listeners={() => ({
            tabPress: (event) => handleTabRootPress("council", event),
          })}
          options={{
            title: "원우회",
            tabBarIcon: ({ color }) => <CouncilTabIcon color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "설정",
            href: null,
            tabBarStyle: hideTabBar ? { display: "none" } : tabBarStyle,
          }}
        />
        {/* 탭바를 유지한 채 여는 화면들 — 탭 버튼으로는 노출하지 않는다.
            board/events는 중첩 Stack이라 진입마다 새 화면이 push되어 params/상태가 늘 새것이다. */}
        {["search", "events", "faq", "notifications", "board", "council/mutual-aid-complete"].map((name) => (
          <Tabs.Screen key={name} name={name} options={{ href: null }} />
        ))}
      </Tabs>
    </MyPageDrawerProvider>
  );
}
