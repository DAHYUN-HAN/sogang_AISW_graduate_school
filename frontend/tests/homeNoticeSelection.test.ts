import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { ApiSuccess, PostListItem } from "../types";
import * as noticeFeed from "../utils/noticeFeed";

const homeSource = readFileSync("app/(tabs)/(home,notices,community,participation,council)/home.tsx", "utf8");

type HomeNoticePreviewLoader = (params: {
  scope: "notices";
  page: 1;
  size: 2;
  sort: "latest";
  pin_priority: false;
}) => Promise<ApiSuccess<PostListItem[]>>;

async function loadHomeNoticePreview(loadFeed: HomeNoticePreviewLoader) {
  const loader = (noticeFeed as typeof noticeFeed & {
    loadHomeNoticePreview?: (load: HomeNoticePreviewLoader) => Promise<ApiSuccess<PostListItem[]>>;
  }).loadHomeNoticePreview;
  if (!loader) assert.fail("loadHomeNoticePreview must be exported");
  return loader(loadFeed);
}

test("홈 공지 미리보기는 최신 두 개를 한 번의 집계 요청으로 불러온다", async () => {
  const response: ApiSuccess<PostListItem[]> = { status: "success", data: [] };
  const calls: Parameters<HomeNoticePreviewLoader>[0][] = [];

  const result = await loadHomeNoticePreview(async (params) => {
    calls.push(params);
    return response;
  });

  assert.deepEqual(calls, [{
    scope: "notices",
    page: 1,
    size: 2,
    sort: "latest",
    pin_priority: false,
  }]);
  assert.strictEqual(result, response);
});

test("#186 홈 공지사항 더보기는 이전 필터와 무관하게 전체 공지 루트를 연다", () => {
  assert.match(
    homeSource,
    /<SectionHeader\s+title="공지사항"[\s\S]*?requestTabRootReset\("notices"\)[\s\S]*?navigateToTabRoot\("notices"\)[\s\S]*?\/>/,
  );
});
