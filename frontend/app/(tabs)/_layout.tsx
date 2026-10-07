import { BottomTabBar, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
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
import { requestWriteLeave } from "../../stores/writeLeaveGuard";
import { navigateToTabRoot } from "../../utils/tabNavigation";

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

function handleTabRootPress(
  tabName: VisibleTabRootName,
  event: { preventDefault: () => void },
) {
  const action = tabRootPressAction(tabName);
  event.preventDefault();
  const go = () => {
    if (action.resetTab) {
      requestTabRootReset(action.resetTab);
    }
    // 그 탭 스택에 쌓여 있던 글·게시판은 비우고 첫 화면을 연다.
    navigateToTabRoot(tabName);
  };
  // 글쓰기·수정 중이면 폼 화면이 확인창을 띄우고, 사용자가 취소를 고른 뒤에
  // 누른 탭으로 옮긴다.
  if (requestWriteLeave(go)) return;
  go();
}

// 게시판·글 화면은 들어온 탭 스택 위에 있어도(홈에서 연 커뮤니티 글은 홈 스택)
// 그 글이 속한 카테고리 탭을 하이라이트한다. 화면이 기록한 소속 탭을 쓰고, 그 밖의
// 화면(탭 첫 화면, 검색, 알림, 마이페이지)은 지금 탭을 그대로 하이라이트한다.
function CategoryHighlightTabBar(props: BottomTabBarProps) {
  const highlightTabs = useTabHighlightStore((state) => state.tabs);
  const { state } = props;
  const stack = state.routes[state.index]?.state;
  const topScreen = stack?.routes[stack.index ?? stack.routes.length - 1];
  // 맨 위 화면이 직접 기록한 값만 쓴다. 아직 기록 전(글을 불러오는 중)이면 지금 탭.
  const highlightTab = topScreen?.key ? highlightTabs[topScreen.key] : undefined;
  if (!topScreen?.name.startsWith("board/") || !highlightTab) return <BottomTabBar {...props} />;

  const targetIndex = state.routes.findIndex((route) => route.name === `(${highlightTab})`);
  if (targetIndex < 0) return <BottomTabBar {...props} />;
  return <BottomTabBar {...props} state={{ ...state, index: targetIndex }} />;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Keep the tab content height while reserving the system navigation area once.
  const tabBarStyle = {
    ...TAB_BAR_STYLE,
    height: TAB_BAR_STYLE.height + insets.bottom,
    paddingBottom: TAB_BAR_STYLE.paddingBottom + insets.bottom,
  };

  return (
    <MyPageDrawerProvider>
      <Tabs
        initialRouteName="(home)"
        backBehavior="initialRoute"
        tabBar={(props) => <CategoryHighlightTabBar {...props} />}
        screenOptions={{
          tabBarActiveTintColor: "#2761FF",
          tabBarInactiveTintColor: "#8A919C",
          tabBarIconStyle: { marginTop: 0 },
          // Figma: 라벨 11/13 Regular (react-navigation 기본 fontWeight 500 오버라이드)
          tabBarLabelStyle: { fontSize: 11, fontFamily: "Pretendard_400Regular", fontWeight: "normal", lineHeight: 13, marginTop: 3, marginBottom: 0 },
          tabBarItemStyle: { paddingVertical: 0 },
          // 회원 탈퇴 화면도 다른 화면처럼 탭바를 유지한다(2026-10-07 결정, PLAN.md).
          tabBarStyle,
          tabBarHideOnKeyboard: true,
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="(home)"
          listeners={() => ({
            tabPress: (event) => handleTabRootPress("home", event),
          })}
          options={{
            title: "홈",
            tabBarIcon: ({ color }) => <HomeTabIcon color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="(notices)"
          listeners={() => ({
            tabPress: (event) => handleTabRootPress("notices", event),
          })}
          options={{
            title: "공지사항",
            tabBarIcon: ({ color }) => <NoticeTabIcon color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="(community)"
          listeners={() => ({
            tabPress: (event) => handleTabRootPress("community", event),
          })}
          options={{
            title: "커뮤니티",
            tabBarIcon: ({ color }) => <CommunityTabIcon color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="(participation)"
          listeners={() => ({
            tabPress: (event) => handleTabRootPress("participation", event),
          })}
          options={{
            title: "참여활동",
            tabBarIcon: ({ color }) => <ParticipationTabIcon color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="(council)"
          listeners={() => ({
            tabPress: (event) => handleTabRootPress("council", event),
          })}
          options={{
            title: "원우회",
            tabBarIcon: ({ color }) => <CouncilTabIcon color={color} size={22} />,
          }}
        />
      </Tabs>
    </MyPageDrawerProvider>
  );
}
