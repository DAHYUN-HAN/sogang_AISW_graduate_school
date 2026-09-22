import assert from "node:assert/strict";
import test from "node:test";

import { fitImage, constrainTransform, zoomAroundPoint, imagePageAfterSwipe } from "../utils/imageViewer";

test("landscape and tall images fit entirely inside the viewport", () => {
  assert.deepEqual(fitImage(1200, 600, 400, 600), { width: 400, height: 200 });
  assert.deepEqual(fitImage(600, 1800, 400, 600), { width: 200, height: 600 });
  assert.deepEqual(fitImage(0, 0, 400, 600), { width: 400, height: 600 });
});

test("zoom and pan stay within the actual image edges, including letterboxing", () => {
  assert.deepEqual(constrainTransform(2, 999, -999, 400, 200, 400, 600), { scale: 2, x: 200, y: 0 });
  assert.deepEqual(constrainTransform(0.3, 999, 999, 200, 600, 400, 600), { scale: 1, x: 0, y: 0 });
  assert.deepEqual(constrainTransform(8, -999, 9999, 200, 600, 400, 600), { scale: 4, x: -200, y: 900 });
});

test("pinch keeps the content under the fingers anchored and supports focal movement", () => {
  assert.deepEqual(zoomAroundPoint(1, 0, 0, 2, 50, -20, 50, -20), { scale: 2, x: -50, y: 20 });
  assert.deepEqual(zoomAroundPoint(2, -50, 20, 2, 50, -20, 70, 10), { scale: 2, x: -30, y: 50 });
});

test("only a horizontal swipe at fitted scale changes photos, without wrapping at the ends", () => {
  assert.equal(imagePageAfterSwipe(1, 3, 1, -90, 5), 2);
  assert.equal(imagePageAfterSwipe(1, 3, 1, 90, 5), 0);
  assert.equal(imagePageAfterSwipe(1, 3, 2, -90, 5), 1);
  assert.equal(imagePageAfterSwipe(1, 3, 1, -15, 5), 1);
  assert.equal(imagePageAfterSwipe(1, 3, 1, -90, 150), 1);
  assert.equal(imagePageAfterSwipe(2, 3, 1, -90, 0), 2);
  assert.equal(imagePageAfterSwipe(0, 1, 1, 90, 0), 0);
});
