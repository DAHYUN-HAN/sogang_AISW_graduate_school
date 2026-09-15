import assert from "node:assert/strict";
import test from "node:test";

import { mediaAccessQueryOptions } from "../hooks/useMediaAccessUrl";
import type { NoticeFilter } from "../utils/noticeFeed";
import {
  enabledRefetch,
  noticeRefreshControlRefreshing,
  refreshQueries,
  selectNoticeFilterAndRefresh,
} from "../utils/pullToRefresh";

test("보호 이미지 접근 URL 옵션은 캐시를 유지하고 주기 갱신을 예약하지 않는다", () => {
  const options = mediaAccessQueryOptions({ id: 71, url: "/uploads/profile.png" });

  assert.equal(options.staleTime, Infinity);
  assert.equal("refetchInterval" in options, false);
});

test("새로고침은 사용 가능한 모든 쿼리를 실행하고 개별 실패를 격리한다", async () => {
  const calls: string[] = [];

  await refreshQueries([
    async () => {
      calls.push("boards");
    },
    undefined,
    async () => {
      calls.push("notices");
      throw new Error("offline");
    },
    async () => {
      calls.push("events");
    },
  ]);

  assert.deepEqual(calls, ["boards", "notices", "events"]);
});

test("비활성 쿼리는 새로고침 대상에 포함하지 않는다", () => {
  const refetch = async () => undefined;

  assert.equal(enabledRefetch(false, refetch), undefined);
  assert.equal(enabledRefetch(true, refetch), refetch);
});

test("공지 초기 로딩 중에는 pull indicator를 LoadingRows와 함께 표시하지 않는다", () => {
  assert.equal(noticeRefreshControlRefreshing({
    boardsLoading: true,
    pullRefreshing: true,
  }), false);
  assert.equal(noticeRefreshControlRefreshing({
    boardsLoading: false,
    postsLoading: true,
    pullRefreshing: true,
  }), false);
  assert.equal(noticeRefreshControlRefreshing({
    boardsLoading: false,
    pullRefreshing: true,
  }), true);
  // 탭 진입 시 자동 refetch만으로는 indicator를 켜지 않는다.
  assert.equal(noticeRefreshControlRefreshing({
    boardsLoading: false,
    pullRefreshing: false,
  }), false);
});

test("현재 공지 필터 재선택은 게시판과 현재 첫 페이지를 함께 새로고침한다", async () => {
  let selected: NoticeFilter = "academic";
  const calls: string[] = [];

  await selectNoticeFilterAndRefresh(
    "academic",
    selected,
    (nextFilter) => {
      selected = nextFilter;
    },
    async () => {
      calls.push("boards");
    },
    async () => {
      calls.push("current-feed");
    },
  );

  assert.equal(selected, "academic");
  assert.deepEqual(calls, ["boards", "current-feed"]);
});

test("다른 공지 필터 선택은 새 키로 전환하고 이전 피드는 새로고침하지 않는다", async () => {
  let selected: NoticeFilter = "academic";
  const calls: string[] = [];

  await selectNoticeFilterAndRefresh(
    "event",
    selected,
    (nextFilter) => {
      selected = nextFilter;
    },
    async () => {
      calls.push("boards");
    },
    async () => {
      calls.push("old-feed");
    },
  );

  assert.equal(selected, "event");
  assert.deepEqual(calls, ["boards"]);
});
