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

// 사진은 달력처럼 끌어서 넘기기보다 툭 튕겨서(flick) 넘기는 동작이 자연스럽다.
// 거리만 보면 짧고 빠른 플릭이 무시되어 "잘 안 넘어간다"가 된다. 그래서 거리와
// 속도 중 하나만 넘어도 넘긴다.
// - MIN_VX: px/ms. 0.3이면 1초에 300px 정도로, 의도한 플릭에서는 쉽게 넘는다.
// - FLICK_MIN_DX: 속도로 넘길 때도 최소한 이만큼은 움직여야 한다. 손가락을 떼는
//   순간의 미세한 튐으로 사진이 바뀌는 걸 막는다.
export const PHOTO_SWIPE_MIN_VX = 0.3;
export const PHOTO_SWIPE_FLICK_MIN_DX = 16;

export function shouldClaimPhotoSwipe(dx: number, dy: number) {
  return Math.abs(dx) > PHOTO_SWIPE_CLAIM_DX && Math.abs(dx) > Math.abs(dy) * 2;
}

// 화살표 버튼과 같게 양 끝에서 순환한다. 넘길 수 없으면 현재 값을 그대로 돌려준다.
export function photoIndexAfterSwipe(index: number, count: number, dx: number, vx = 0) {
  if (count < 2) return index;
  const farEnough = Math.abs(dx) >= PHOTO_SWIPE_MIN_DX;
  const fastEnough = Math.abs(vx) >= PHOTO_SWIPE_MIN_VX && Math.abs(dx) >= PHOTO_SWIPE_FLICK_MIN_DX;
  if (!farEnough && !fastEnough) return index;
  // 방향은 움직인 거리로 정한다. 거리가 0이면 속도 부호를 쓴다.
  const direction = (dx !== 0 ? dx : vx) < 0 ? 1 : -1;
  const bounded = Math.min(Math.max(index, 0), count - 1);
  return (bounded + direction + count) % count;
}

type SwipeGesture = { dx: number; dy: number; vx?: number };

export type PhotoSwipeConfig = {
  onMoveShouldSetPanResponder: (event: unknown, gesture: SwipeGesture) => boolean;
  onPanResponderTerminationRequest: () => boolean;
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
    // 기본값은 true라, 가로 스와이프를 가져간 뒤에도 바깥 세로 ScrollView가 도로
    // 가져갈 수 있다. 그러면 release가 불리지 않아 그 스와이프가 통째로 사라진다
    // (PanResponder.js `onResponderTerminationRequest`). 한 번 가져왔으면 놓지 않는다.
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_event, gesture) => {
      // vx는 grant에서 되돌리지 않으므로 그대로 쓴다.
      setIndex((prev) => photoIndexAfterSwipe(prev, getCount(), claimedDx + gesture.dx, gesture.vx ?? 0));
    },
  };
}
