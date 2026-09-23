import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDuesScope,
  formatPaymentImportSummary,
  formatDuesPayer,
  formatRosterImportSummary,
} from "../utils/duesPayers";
import * as duesUtils from "../utils/duesPayers";

test("원우회비 납부자는 이름 전공 학번을 띄어쓰기로 표시한다", () => {
  assert.equal(
    formatDuesPayer({ id: 1, name: "홍길동", major: "AI", student_number: "A74001" }),
    "홍길동 AI A74001",
  );
});

test("전체 원우 명부 업로드 결과를 신규 수정 유지 건수로 안내한다", () => {
  assert.equal(
    formatRosterImportSummary({ created: 2, updated: 3, unchanged: 4, total_rows: 9 }),
    "총 9명 · 신규 2명 · 수정 3명 · 유지 4명",
  );
});

test("관리자 원우 상태는 전체·게시판 전용·미납으로 표시한다", () => {
  assert.equal(formatDuesScope({ payment_scope: "ALL", once_board_name: null }), "전체 납부");
  assert.equal(
    formatDuesScope({ payment_scope: "ONCE", once_board_name: "스터디 활동 인증" }),
    "1회 납부 · 스터디 활동 인증",
  );
  assert.equal(formatDuesScope({ payment_scope: "UNPAID", once_board_name: null }), "미납");
});

test("개별 행사 등록은 기존 납부 상태와 무관하게 게시판을 새로 고르는 ONCE 편집으로 시작한다", () => {
  const createDraft = (duesUtils as typeof duesUtils & {
    createDuesPaymentEditorDraft?: (item: {
      payment_scope: "ALL" | "ONCE" | "UNPAID";
      once_board_id: number | null;
    }, mode: "EDIT" | "REGISTER_ONCE") => unknown;
  }).createDuesPaymentEditorDraft;

  assert.equal(typeof createDraft, "function");
  assert.deepEqual(
    createDraft?.({ payment_scope: "ALL", once_board_id: null }, "REGISTER_ONCE"),
    { scope: "ONCE", selectedBoardId: null },
  );
  assert.deepEqual(
    createDraft?.({ payment_scope: "ONCE", once_board_id: 17 }, "REGISTER_ONCE"),
    { scope: "ONCE", selectedBoardId: null },
  );
});

test("전체 납부 업로드 결과는 기존 삭제와 신규 등록 건수를 안내한다", () => {
  assert.equal(
    formatPaymentImportSummary({ cleared: 4, registered: 3, total_rows: 3 }),
    "기존 납부 4명 초기화 · 현재 학기 전체 납부 3명 등록",
  );
});

test("수동 초기화 확인 유틸은 더 이상 노출하지 않는다", () => {
  assert.equal("DUES_RESET_CONFIRMATION" in duesUtils, false);
  assert.equal("isExactDuesResetConfirmation" in duesUtils, false);
});
