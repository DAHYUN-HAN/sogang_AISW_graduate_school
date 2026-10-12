import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detail = readFileSync("app/(tabs)/(home,notices,community,participation,council)/board/post/[postId].tsx", "utf8");
const hooks = readFileSync("hooks/usePosts.ts", "utf8");

// 2026-10-11 사용자 요청: 피그마 Screen/Notice/Detail-Deleted. 지워진 글은 다시 시도 대신 삭제 안내를 보여 준다.
test("서버가 지워진 글이라고 하면 다시 시도 없이 삭제된 게시물 화면을 보여 준다", () => {
  assert.match(detail, /const deletedBoardId = apiErrorCode\(error\) === "POST_DELETED" \? apiErrorData\(error\)\?\.board_id : undefined;/);
  assert.match(detail, /if \(isError && deletedBoardId !== undefined\) \{[\s\S]{0,300}<EmptyCalendarIcon size=\{32\} \/>\s*<Text style=\{styles\.deletedTitle\}>삭제된 게시물이에요<\/Text>/);
  assert.match(hooks, /retry: \(failureCount, error\) => apiErrorStatus\(error\) !== 404 && failureCount < 3,/);
});

// 공지는 '공지사항', 스터디 모집은 게시판 이름처럼 살아 있던 글과 같은 제목을 쓴다.
test("지워진 글의 제목은 살아 있던 글과 같은 규칙으로 정한다", () => {
  assert.match(detail, /\{deletedBoardId === undefined \? board\?\.name \?\? "게시글" : postDetailTitle\(deletedBoard\)\}/);
  assert.match(detail, /const appBarTitle = postDetailTitle\(board, \{ title: post\.title, isCouncilActivityEntry \}\);/);
  assert.match(detail, /board\?\.board_type === "notice"\s*\? "공지사항"\s*: board\?\.name \?\? "게시글";/);
});
