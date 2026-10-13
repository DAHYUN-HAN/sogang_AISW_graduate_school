import assert from "node:assert/strict";
import test from "node:test";

import { myPageOriginRoute } from "../utils/myPageNavigation";

test("마이페이지 원본 탭은 Expo 경로 표기를 정규화하고 설정·임의 경로를 거부한다", () => {
  assert.equal(myPageOriginRoute("/home"), "/(tabs)/home");
  assert.equal(myPageOriginRoute("/(tabs)/participation/"), "/(tabs)/participation");
  assert.equal(myPageOriginRoute("/community"), "/(tabs)/community");
  assert.equal(myPageOriginRoute("/settings/profile"), null);
  assert.equal(myPageOriginRoute("/board/17"), null);
});
