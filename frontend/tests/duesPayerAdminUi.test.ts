import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rosterSource = readFileSync("components/admin/DuesRosterSection.tsx", "utf8");
const paymentSource = readFileSync("components/admin/DuesPaymentSection.tsx", "utf8");
const editorSource = readFileSync("components/admin/DuesPaymentEditor.tsx", "utf8");

test("원우 명부는 신원 3열 대량 테이블만 제공한다", () => {
  assert.match(rosterSource, /전체 원우 명부 업로드/);
  assert.match(rosterSource, /이름/);
  assert.match(rosterSource, /학번/);
  assert.match(rosterSource, /전공/);
  assert.match(rosterSource, /size: 100/);
  assert.match(rosterSource, /horizontal/);
  assert.doesNotMatch(rosterSource, /ALL|ONCE|UNPAID|전체 납부|특정 행사|미납|수정/);
});

test("원우회비 화면은 업로드 전체 교체와 개별 납부 수정만 제공한다", () => {
  assert.match(paymentSource, /현재 학기 전체 납부자 업로드/);
  assert.match(paymentSource, /기존 전체 납부와 특정 행사 1회 납부가 모두 초기화/);
  assert.match(paymentSource, /updatePayment/);
  assert.doesNotMatch(paymentSource, /납부자 초기화 시작|resetPayments|개별 등록/);
});

test("납부 편집기는 세 가지 납부 범위와 읽기 전용 신원을 제공한다", () => {
  assert.match(editorSource, /전체 납부/);
  assert.match(editorSource, /특정 행사 1회 납부/);
  assert.match(editorSource, /미납/);
  assert.match(editorSource, /activityBoards/);
  assert.match(editorSource, /item\.name/);
  assert.match(editorSource, /item\.student_number/);
  assert.match(editorSource, /item\.major/);
  assert.doesNotMatch(editorSource, /setName|setMajor|setStudentNumber/);
});
