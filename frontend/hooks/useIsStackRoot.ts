import { useNavigationState, useRoute } from "@react-navigation/native";

// 탭 첫 화면(공지사항·커뮤니티 등)은 하단 탭으로 열면 그 탭 스택의 맨 아래지만,
// 홈 "더보기"로 열면 홈 스택 위에 쌓인다. 맨 아래일 때만 뒤로가기를 숨긴다.
export function useIsStackRoot() {
  const routeKey = useRoute().key;
  return useNavigationState((state) => state.routes[0]?.key === routeKey);
}
