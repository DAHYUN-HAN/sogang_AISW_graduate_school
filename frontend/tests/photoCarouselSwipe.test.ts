import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PHOTO_SWIPE_CLAIM_DX,
  PHOTO_SWIPE_MIN_DX,
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

test("두 캐러셀 화면이 같은 판정을 쓴다", () => {
  // 각자 따로 구현해 감도가 갈라지는 걸 막는다.
  for (const file of ["app/(tabs)/board/[boardId].tsx", "app/(tabs)/board/post/[postId].tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /photoIndexAfterSwipe/, `${file}이 공용 판정을 써야 한다`);
    assert.match(source, /shouldClaimPhotoSwipe/, `${file}이 공용 판정을 써야 한다`);
    assert.match(source, /onMoveShouldSetPanResponder/, `${file}은 움직일 때만 제스처를 가져와야 한다`);
    // 탭을 가로채면 확대 보기가 열리지 않으므로 onStartShouldSet 계열은 쓰지 않는다.
    assert.doesNotMatch(source, /onStartShouldSetPanResponder/, `${file}은 탭을 가로채면 안 된다`);
  }
});
