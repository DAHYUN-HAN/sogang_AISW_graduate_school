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
