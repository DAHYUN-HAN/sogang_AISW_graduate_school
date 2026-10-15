import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { COMMUNITY_TAB_ROUTE, PARTICIPATION_TAB_ROUTE, postCompletionStack } from "../utils/appRoutes";

// 완료 화면을 글쓰기 화면 자리에 쌓아, 확인·안드로이드 뒤로가기·iOS 스와이프가 모두
// 완료 화면만 빼서 "확인"의 도착지로 돌아가게 한다.
const GROUP = "app/(tabs)/(home,notices,community,participation,council)";
const COMPLETE = (boardType: string, boardId: number, postId: number) => ({
  name: "board/post/complete",
  params: { boardType, boardId: String(boardId), postId: String(postId) },
});

// 2026-10-15: 피그마 Screen/Community/WriteComplete가 생겨 모든 게시판이 완료 화면을 거친다.
test("자료공유·스터디 등 그 밖의 게시판은 새 글 상세를 깔고 그 위에 완료 화면을 쌓는다", () => {
  const routes = [
    { key: "c", name: "community" },
    { key: "w", name: "board/post/create", params: { boardId: "8" } },
  ];
  for (const type of ["resource", "post", undefined]) {
    assert.deepEqual(postCompletionStack(routes, type, 42, 8, COMMUNITY_TAB_ROUTE), [
      routes[0],
      { name: "board/post/[postId]", params: { postId: "42", fromBoardId: "8", returnTo: COMMUNITY_TAB_ROUTE } },
      { name: "board/post/complete", params: { boardType: type ?? "", boardId: "8", postId: "42", returnTo: COMMUNITY_TAB_ROUTE } },
    ]);
  }
});

test("완료 문구는 게시판 종류별 표를 쓰고, 표에 없으면 게시글 등록 문구를 쓴다", () => {
  const source = readFileSync(`${GROUP}/board/post/complete.tsx`, "utf8");
  assert.match(source, /COMPLETION_TITLES\[boardType \?\? ""\] \?\? "게시글이 등록되었어요!"/);
  const create = readFileSync(`${GROUP}/board/post/create.tsx`, "utf8");
  assert.doesNotMatch(create, /usesPostCompletionScreen/);
});

test("건의사항·상조회는 아래의 같은 게시판 목록까지 비우고 그 위에 완료 화면을 쌓는다", () => {
  const routes = [
    { key: "c", name: "council" },
    { key: "l", name: "board/[boardId]", params: { boardId: "9" } },
    { key: "w", name: "board/post/create", params: { boardId: "9" } },
  ];
  for (const type of ["suggestion", "mutual_aid"]) {
    assert.deepEqual(postCompletionStack(routes, type, 42, 9), [routes[0], routes[1], COMPLETE(type, 9, 42)]);
  }
});

test("목록이 글쓰기 바로 아래가 아니어도 그 목록까지 비워 같은 목록이 두 번 쌓이지 않는다", () => {
  const routes = [
    { key: "c", name: "council" },
    { key: "l", name: "board/[boardId]", params: { boardId: "9" } },
    { key: "p", name: "board/post/[postId]", params: { postId: "3" } },
    { key: "w", name: "board/post/create", params: { boardId: "9" } },
  ];
  assert.deepEqual(postCompletionStack(routes, "suggestion", 42, 9), [routes[0], routes[1], COMPLETE("suggestion", 9, 42)]);
});

test("아래에 그 게시판 목록이 없으면 목록을 깔고 완료 화면을 쌓는다", () => {
  const routes = [
    { key: "h", name: "home" },
    { key: "l", name: "board/[boardId]", params: { boardId: "5" } },
    { key: "w", name: "board/post/create", params: { boardId: "9" } },
  ];
  assert.deepEqual(postCompletionStack(routes, "mutual_aid", 42, 9), [
    routes[0],
    routes[1],
    { name: "board/[boardId]", params: { boardId: "9" } },
    COMPLETE("mutual_aid", 9, 42),
  ]);
});

test("활동 인증은 글쓰기 자리에 새 글 상세를 깔고 그 위에 완료 화면을 쌓는다", () => {
  const routes = [
    { key: "p", name: "participation" },
    { key: "w", name: "board/post/create", params: { boardId: "4" } },
  ];
  assert.deepEqual(postCompletionStack(routes, "activity_certification", 42, 4), [
    routes[0],
    { name: "board/post/[postId]", params: { postId: "42", fromBoardId: "4", returnTo: PARTICIPATION_TAB_ROUTE } },
    { ...COMPLETE("activity_certification", 4, 42), params: { ...COMPLETE("activity_certification", 4, 42).params, returnTo: PARTICIPATION_TAB_ROUTE } },
  ]);
});

test("완료 화면의 확인은 아래 화면으로 pop 하고, 아래가 없을 때만 도착지를 연다", () => {
  const source = readFileSync(`${GROUP}/board/post/complete.tsx`, "utf8");
  assert.match(source, /if \(router\.canGoBack\(\)\) \{\s+router\.back\(\);/);
  assert.match(source, /replaceWithRoute\(postCreateCompletionRoute\(/);
  assert.match(source, /<CompletionState title=\{completionTitle\(params\.boardType\)\} onConfirm=\{confirm\} \/>/);
});

test("글쓰기 화면은 완료 화면을 직접 그리지 않고, 쓰지 않던 상조회 완료 화면은 없다", () => {
  const create = readFileSync(`${GROUP}/board/post/create.tsx`, "utf8");
  assert.doesNotMatch(create, /CompletionState|createdPostId\)/);
  assert.match(create, /postCompletionStack\(state\.routes, boardType, createdPostId, boardId, params\.returnTo\)/);
  assert.equal(existsSync(`${GROUP}/council/mutual-aid-complete.tsx`), false);
});
