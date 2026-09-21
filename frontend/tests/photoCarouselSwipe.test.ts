import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PHOTO_SWIPE_CLAIM_DX,
  PHOTO_SWIPE_MIN_DX,
  createPhotoSwipeConfig,
  photoIndexAfterSwipe,
  shouldClaimPhotoSwipe,
} from "../utils/photoCarouselSwipe";

test("세로로 더 많이 움직이면 제스처를 가져가지 않는다", () => {
  // 페이지 세로 스크롤을 빼앗으면 안 된다.
  assert.equal(shouldClaimPhotoSwipe(30, 40), false);
  assert.equal(shouldClaimPhotoSwipe(-30, 40), false);
  // 가로가 세로의 두 배를 넘어야 가져간다.
  assert.equal(shouldClaimPhotoSwipe(30, 10), true);
  assert.equal(shouldClaimPhotoSwipe(-30, 10), true);
});

test("거의 움직이지 않은 탭은 제스처를 가져가지 않아 누름이 살아 있다", () => {
  assert.equal(shouldClaimPhotoSwipe(0, 0), false);
  assert.equal(shouldClaimPhotoSwipe(PHOTO_SWIPE_CLAIM_DX, 0), false);
  assert.equal(shouldClaimPhotoSwipe(PHOTO_SWIPE_CLAIM_DX + 1, 0), true);
});

test("왼쪽으로 밀면 다음, 오른쪽으로 밀면 이전 사진", () => {
  assert.equal(photoIndexAfterSwipe(0, 3, -PHOTO_SWIPE_MIN_DX), 1);
  assert.equal(photoIndexAfterSwipe(1, 3, PHOTO_SWIPE_MIN_DX), 0);
});

test("양 끝에서는 화살표와 같게 순환한다", () => {
  assert.equal(photoIndexAfterSwipe(2, 3, -PHOTO_SWIPE_MIN_DX), 0);
  assert.equal(photoIndexAfterSwipe(0, 3, PHOTO_SWIPE_MIN_DX), 2);
});

test("살짝 떨린 정도로는 사진이 바뀌지 않는다", () => {
  assert.equal(photoIndexAfterSwipe(1, 3, -(PHOTO_SWIPE_MIN_DX - 1)), 1);
  assert.equal(photoIndexAfterSwipe(1, 3, PHOTO_SWIPE_MIN_DX - 1), 1);
});

test("사진이 한 장 이하면 넘기지 않는다", () => {
  assert.equal(photoIndexAfterSwipe(0, 1, -200), 0);
  assert.equal(photoIndexAfterSwipe(0, 0, -200), 0);
});

test("범위를 벗어난 인덱스를 받아도 결과가 범위 안에 있다", () => {
  // 사진 수가 줄어든 직후에도 화면이 깨지지 않아야 한다.
  assert.equal(photoIndexAfterSwipe(9, 3, -PHOTO_SWIPE_MIN_DX), 0);
  assert.equal(photoIndexAfterSwipe(-4, 3, PHOTO_SWIPE_MIN_DX), 2);
});

// PanResponder는 제스처를 가져오는 순간 dx를 0으로 되돌린다
// (react-native/Libraries/Interaction/PanResponder.js `onResponderGrant`).
// 실제 손가락 움직임을 그대로 흉내 내, 그 되돌림까지 포함해 판정이 맞는지 본다.
function swipeOnce(count: number, startIndex: number, path: { dx: number; dy: number }[]) {
  let index = startIndex;
  const config = createPhotoSwipeConfig(
    () => count,
    (update) => {
      index = update(index);
    }
  );
  let granted = false;
  let grantedAtDx = 0;
  for (const point of path) {
    if (granted) continue;
    if (config.onMoveShouldSetPanResponder(null, point)) {
      granted = true;
      grantedAtDx = point.dx;
    }
  }
  if (!granted) return { index, granted };
  // grant 이후 dx는 0부터 다시 쌓인다.
  const last = path[path.length - 1];
  config.onPanResponderRelease(null, { dx: last.dx - grantedAtDx, dy: last.dy - 0 });
  return { index, granted };
}

test("한 번에 쓸어도 총 이동이 기준을 넘으면 다음 사진으로 넘어간다", () => {
  // 손가락을 왼쪽으로 총 50px 밀었다. grant가 -10px에서 일어나 release의 dx는
  // -40px뿐이라, 되돌림을 보정하지 않으면 여기서 사진이 안 넘어가 두 번 쓸어야
  // 하는 것처럼 느껴진다.
  const path = [
    { dx: -4, dy: 1 },
    { dx: -10, dy: 2 },
    { dx: -30, dy: 3 },
    { dx: -50, dy: 4 },
  ];
  const result = swipeOnce(3, 0, path);
  assert.equal(result.granted, true, "가로로 분명히 움직였으니 제스처를 가져와야 한다");
  assert.equal(result.index, 1, "총 이동이 기준을 넘었으니 한 번에 넘어가야 한다");
});

test("반대로 쓸면 이전 사진으로 한 번에 넘어간다", () => {
  const path = [
    { dx: 4, dy: 1 },
    { dx: 10, dy: 2 },
    { dx: 50, dy: 3 },
  ];
  const result = swipeOnce(3, 1, path);
  assert.equal(result.granted, true);
  assert.equal(result.index, 0);
});

test("기준에 못 미치게 짧게 쓸면 사진이 그대로다", () => {
  const path = [
    { dx: -4, dy: 1 },
    { dx: -10, dy: 2 },
    { dx: -20, dy: 2 },
  ];
  const result = swipeOnce(3, 1, path);
  assert.equal(result.granted, true, "가져오기는 한다");
  assert.equal(result.index, 1, "총 이동이 기준에 못 미치면 넘기지 않는다");
});

test("사진이 한 장이면 제스처를 아예 가져오지 않는다", () => {
  const result = swipeOnce(1, 0, [{ dx: 60, dy: 2 }]);
  assert.equal(result.granted, false);
  assert.equal(result.index, 0);
});

test("두 캐러셀 화면이 같은 판정을 쓴다", () => {
  // 각자 따로 구현해 감도가 갈라지는 걸 막는다.
  for (const file of ["app/(tabs)/board/[boardId].tsx", "app/(tabs)/board/post/[postId].tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /createPhotoSwipeConfig/, `${file}이 공용 설정을 써야 한다`);
    // 탭을 가로채면 확대 보기가 열리지 않으므로 onStartShouldSet 계열은 쓰지 않는다.
    assert.doesNotMatch(source, /onStartShouldSetPanResponder/, `${file}은 탭을 가로채면 안 된다`);
  }
});
