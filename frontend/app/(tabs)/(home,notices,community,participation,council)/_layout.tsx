import { Stack } from "expo-router";

// 마이페이지는 왼쪽에서 들어와 왼쪽으로 나간다. iOS 기본 스와이프는 화면을 오른쪽으로
// 밀어 내므로 끄고, 화면 안의 EdgeSwipeBack이 안드로이드 뒤로가기와 같은 pop을 태운다
// (PLAN.md 2026-10-13). 하위 화면은 기본 스와이프로 마이페이지에 돌아온다.
const MY_PAGE_SCREEN_OPTIONS = { animation: "slide_from_left", gestureEnabled: false } as const;

// 탭 스택마다 첫 화면을 명시한다. 그룹 이름과 같은 파일이 첫 화면이 되기를 기대할 수
// 있지만 실제 앱에서는 지정되지 않아 정렬상 맨 앞 화면(faq 등)이 첫 화면으로 떴다.
export const unstable_settings = {
  home: { initialRouteName: "home" },
  notices: { initialRouteName: "notices" },
  community: { initialRouteName: "community" },
  participation: { initialRouteName: "participation" },
  council: { initialRouteName: "council" },
};

// 하단 탭마다 이 폴더의 화면들을 복제한 자기 스택을 갖는다. 그룹 이름과 같은 파일
// (예: (community)의 community.tsx)이 그 탭의 첫 화면이 되고, 게시판·글·검색·알림·
// 마이페이지는 지금 탭 위에 쌓인다. 그래서 쌓인 순서가 곧 본 순서이고, iOS 가장자리
// 스와이프·안드로이드 뒤로가기·헤더 뒤로가 모두 같은 직전 화면으로 돌아간다.
//
// <Stack.Screen>으로 화면을 직접 나열하면 expo-router가 그 화면들을 목록 맨 앞에 두어
// 탭 스택의 첫 화면이 바뀐다(로그인 직후 마이페이지가 먼저 뜨던 원인). 화면별 옵션은
// screenOptions 함수로만 준다.
export default function TabStackLayout() {
  return (
    <Stack
      screenOptions={({ route }) => ({
        headerShown: false,
        contentStyle: { backgroundColor: "#FFFFFF" },
        ...(route.name === "settings/index" ? MY_PAGE_SCREEN_OPTIONS : null),
      })}
    />
  );
}
