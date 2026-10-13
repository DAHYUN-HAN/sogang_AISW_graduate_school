import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMENT_DELETE_COPY,
  commentEditSubmissionValue,
  getCommentActionState,
} from "../utils/commentPresentation";

test("내 최상위 댓글은 답글·수정·삭제만 제공하고 신고는 숨긴다", () => {
  assert.deepEqual(
    getCommentActionState({ depth: 0, isMine: true, isEditing: false }),
    {
      showReply: true,
      showEdit: true,
      showDelete: true,
      showSave: false,
      showCancel: false,
      showReport: false,
      reportAction: "none",
    },
  );
});

test("댓글 수정 중에는 저장과 취소만 표시한다", () => {
  assert.deepEqual(
    getCommentActionState({ depth: 0, isMine: true, isEditing: true }),
    {
      showReply: false,
      showEdit: false,
      showDelete: false,
      showSave: true,
      showCancel: true,
      showReport: false,
      reportAction: "none",
    },
  );
});

test("다른 작성자의 대댓글은 추가 답글 없이 신고할 수 있다", () => {
  assert.deepEqual(
    getCommentActionState({ depth: 1, isMine: false, isEditing: false }),
    {
      showReply: false,
      showEdit: false,
      showDelete: false,
      showSave: false,
      showCancel: false,
      showReport: true,
      reportAction: "open",
    },
  );
});

test("이미 신고한 댓글도 신고 버튼을 열어 두고 화면이 중복 안내를 맡는다", () => {
  const state = getCommentActionState({ depth: 0, isMine: false, isEditing: false });

  assert.equal(state.reportAction, "open");
});

test("수정 내용은 공백을 제거하고 빈 값과 저장 중 제출을 막는다", () => {
  assert.equal(commentEditSubmissionValue("  수정한 댓글  ", false), "수정한 댓글");
  assert.equal(commentEditSubmissionValue(" \n\t ", false), null);
  assert.equal(commentEditSubmissionValue("수정한 댓글", true), null);
});

test("댓글 삭제 확인 문구는 승인된 두 줄 문구를 사용한다", () => {
  assert.deepEqual(COMMENT_DELETE_COPY, {
    title: "댓글 삭제",
    body: "댓글을 삭제하시겠어요?\n삭제한 댓글은 복구할 수 없어요.",
  });
});
