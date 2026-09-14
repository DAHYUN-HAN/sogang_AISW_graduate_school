// 상태바 뒤 배경 막. 디자인(Screen/Home background #FFFFFF)과 같은 색으로 채워
// 스크롤 콘텐츠가 시계·배터리 아이콘 뒤로 비치지 않게 한다. 컴포넌트와 분리해 테스트 가능하게 둔다.
export const STATUS_BAR_SCRIM_COLOR = "#FFFFFF";

export function statusBarScrimHeight(
  insetTop: number,
  platform: string,
  androidStatusBarHeight: number | undefined,
): number {
  if (platform === "web") return 0;
  // 루트 레이아웃에서는 safe-area 값이 0으로 보고될 수 있어 Android는 네이티브 상태바 높이를 우선 사용한다.
  if (platform === "android" && androidStatusBarHeight && androidStatusBarHeight > 0) return androidStatusBarHeight;
  return Math.max(insetTop, 0);
}
