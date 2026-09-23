import assert from "node:assert/strict";
import test from "node:test";

import {
  DUES_RESET_CONFIRMATION,
  formatDuesScope,
  formatPaymentImportSummary,
  formatDuesPayer,
  formatRosterImportSummary,
  isExactDuesResetConfirmation,
} from "../utils/duesPayers";

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

test("전체 납부 업로드 결과는 기존 삭제와 신규 등록 건수를 안내한다", () => {
  assert.equal(
    formatPaymentImportSummary({ cleared: 4, registered: 3, total_rows: 3 }),
    "기존 납부 4명 초기화 · 현재 학기 전체 납부 3명 등록",
  );
});

test("납부자 초기화는 정확한 확인 문구를 입력해야 확정된다", () => {
  assert.equal(DUES_RESET_CONFIRMATION, "납부자 초기화");
  assert.equal(isExactDuesResetConfirmation("납부자 초기화"), true);
  assert.equal(isExactDuesResetConfirmation(" 납부자 초기화 "), false);
  assert.equal(isExactDuesResetConfirmation("초기화"), false);
});
