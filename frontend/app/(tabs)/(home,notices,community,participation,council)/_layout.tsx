import { Stack } from "expo-router";

// 서랍이 덮은 채로 열리는 마이페이지 화면이라 자리에서 바로 드러나게 한다.
const DRAWER_COVERED_SCREENS = new Set([
  "settings/profile",
  "settings/notifications",
  "settings/account",
  "settings/activity",
]);

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
        ...(DRAWER_COVERED_SCREENS.has(route.name) ? { animation: "none" as const } : null),
      })}
    />
  );
}
