// 사진 캐러셀을 좌우로 쓸어 넘기는 판정. 홈 달력의 달 넘기기와 같은 기준을 써서
// 앱 전체의 스와이프 감도를 맞춘다.
//
// 기준을 둘로 나눈 이유:
// - CLAIM_DX: 제스처를 가져오는 기준. 낮게 두어 쓸기를 빨리 알아채되, 세로 이동이
//   더 크면 가져오지 않아 페이지 세로 스크롤을 빼앗지 않는다.
// - MIN_DX: 실제로 사진을 넘기는 기준. 손을 살짝 떨어도 사진이 바뀌지 않게 한다.
//
// 제스처를 '움직였을 때만' 가져오므로 누르고 떼기만 하는 탭은 자식 Pressable로
// 그대로 간다. 반대로 쓸기 시작하면 Pressable의 누름이 취소되어, 사진을 넘기려다
// 확대 보기가 열리는 일이 없다.
export const PHOTO_SWIPE_CLAIM_DX = 8;
export const PHOTO_SWIPE_MIN_DX = 48;

export function shouldClaimPhotoSwipe(dx: number, dy: number) {
  return Math.abs(dx) > PHOTO_SWIPE_CLAIM_DX && Math.abs(dx) > Math.abs(dy) * 2;
}

// 화살표 버튼과 같게 양 끝에서 순환한다. 넘길 수 없으면 현재 값을 그대로 돌려준다.
export function photoIndexAfterSwipe(index: number, count: number, dx: number) {
  if (count < 2 || Math.abs(dx) < PHOTO_SWIPE_MIN_DX) return index;
  const bounded = Math.min(Math.max(index, 0), count - 1);
  return (bounded + (dx < 0 ? 1 : -1) + count) % count;
}

type SwipeGesture = { dx: number; dy: number };

export type PhotoSwipeConfig = {
  onMoveShouldSetPanResponder: (event: unknown, gesture: SwipeGesture) => boolean;
  onPanResponderRelease: (event: unknown, gesture: SwipeGesture) => void;
};

/**
 * PanResponder 설정을 만든다. 화면에서 직접 짜지 않고 여기 모아 둔 이유는 아래
 * 되돌림 처리 때문이다.
 *
 * PanResponder는 제스처를 가져오는 순간 `gestureState.dx`를 0으로 되돌린다
 * (react-native/Libraries/Interaction/PanResponder.js `onResponderGrant`).
 * 그래서 release에서 받는 dx는 '가져온 뒤부터' 움직인 거리다. 그대로 쓰면
 * CLAIM_DX를 넘기는 데 쓴 거리가 빠져 실제로는 8 + 48 = 56px을 넘겨야 사진이
 * 넘어가고, 한 번에 안 넘어가서 두 번 쓸어야 하는 것처럼 느껴진다.
 *
 * 가져오기 직전까지의 dx를 기억해 두었다가 release에서 더해, MIN_DX가 손가락이
 * 처음 닿은 지점부터의 총 이동 거리를 뜻하도록 맞춘다.
 */
export function createPhotoSwipeConfig(
  getCount: () => number,
  setIndex: (update: (prev: number) => number) => void
): PhotoSwipeConfig {
  let claimedDx = 0;
  return {
    onMoveShouldSetPanResponder: (_event, gesture) => {
      if (getCount() < 2 || !shouldClaimPhotoSwipe(gesture.dx, gesture.dy)) return false;
      claimedDx = gesture.dx;
      return true;
    },
    onPanResponderRelease: (_event, gesture) => {
      setIndex((prev) => photoIndexAfterSwipe(prev, getCount(), claimedDx + gesture.dx));
    },
  };
}
