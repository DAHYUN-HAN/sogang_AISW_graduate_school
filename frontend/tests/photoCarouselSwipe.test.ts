import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DEFAULT_ACTIVITY_IMAGE_LAYOUT, resolveActivityImageRule } from "../utils/activityImageLayout";
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

test("짧고 빠르게 튕기면 거리가 모자라도 넘어간다", () => {
  // 사진은 끌기보다 툭 튕겨 넘기는 동작이 자연스럽다. 거리만 보면 이런 플릭이
  // 무시되어 "잘 안 넘어간다"가 된다.
  assert.equal(photoIndexAfterSwipe(0, 3, -20, -0.9), 1);
  assert.equal(photoIndexAfterSwipe(1, 3, 20, 0.9), 0);
});

test("느리게 조금 움직인 건 튕긴 것으로 보지 않는다", () => {
  assert.equal(photoIndexAfterSwipe(1, 3, -20, -0.1), 1);
});

test("빨라도 거의 안 움직였으면 넘기지 않는다", () => {
  // 손가락을 떼는 순간의 미세한 튐으로 사진이 바뀌면 안 된다.
  assert.equal(photoIndexAfterSwipe(1, 3, -4, -2), 1);
});

test("속도를 안 주면 예전처럼 거리로만 판정한다", () => {
  assert.equal(photoIndexAfterSwipe(0, 3, -PHOTO_SWIPE_MIN_DX), 1);
  assert.equal(photoIndexAfterSwipe(0, 3, -(PHOTO_SWIPE_MIN_DX - 1)), 0);
});

test("한 번 가져온 스와이프는 바깥 스크롤에 내주지 않는다", () => {
  // 기본값이 true라, 두면 바깥 세로 ScrollView가 도로 가져가 release가 불리지
  // 않고 스와이프가 통째로 사라진다.
  const config = createPhotoSwipeConfig(() => 3, () => undefined);
  assert.equal(config.onPanResponderTerminationRequest(), false);
});

test("높이가 고정인 캐러셀은 네이티브 페이징을 쓴다", () => {
  // 손가락을 따라 사진이 밀려야 매끄럽다. PanResponder로는 그게 안 된다.
  const slider = readFileSync("app/(tabs)/board/[boardId].tsx", "utf8");
  assert.match(slider, /PhotoPager/, "임원진·기장단·역대는 PhotoPager를 써야 한다");
  assert.doesNotMatch(slider, /createPhotoSwipeConfig/, "페이저로 옮겼으면 PanResponder 판정은 남기지 않는다");

  const detail = readFileSync("app/(tabs)/board/post/[postId].tsx", "utf8");
  assert.match(detail, /PhotoPager/, "사진첩·활동인증은 PhotoPager를 써야 한다");
  assert.match(detail, /isActivityCertification && imageAttachments\.length > 0/, "활동인증도 페이저를 타야 한다");
  // 원우회 활동은 사진 원래 비율로 보여 주는 디자인이라 아직 PanResponder를 쓴다.
  assert.match(detail, /createPhotoSwipeConfig/, "남은 갤러리는 공용 판정을 써야 한다");
});

test("활동인증 프레임 높이는 가장 큰 값으로 고정된다", () => {
  // 넘기는 동안 프레임 높이가 출렁이면 안 된다. 기본 레이아웃 기준으로
  // 가로 사진 240, 세로 사진 400이므로 섞이면 400이어야 한다.
  const landscape = resolveActivityImageRule(DEFAULT_ACTIVITY_IMAGE_LAYOUT, "landscape").height;
  const portrait = resolveActivityImageRule(DEFAULT_ACTIVITY_IMAGE_LAYOUT, "portrait").height;
  assert.equal(landscape, 240);
  assert.equal(portrait, 400);

  const heights = [landscape, portrait].filter((value): value is number => value !== null);
  assert.equal(Math.max(...heights), 400, "섞이면 큰 쪽에 맞춰 잘리지 않아야 한다");

  // 화면이 최댓값을 고르는 규칙을 그대로 쓰는지 확인한다.
  const detail = readFileSync("app/(tabs)/board/post/[postId].tsx", "utf8");
  assert.match(detail, /height > prev \? height : prev/, "보고된 프레임 높이의 최댓값을 써야 한다");
});

test("탭을 가로채지 않는다", () => {
  // 가로채면 눌러서 확대 보기를 여는 동작이 죽는다.
  for (const file of ["app/(tabs)/board/[boardId].tsx", "app/(tabs)/board/post/[postId].tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /onStartShouldSetPanResponder/, `${file}은 탭을 가로채면 안 된다`);
  }
});
