import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNT_DELETION_CONFIRMATION,
  ACCOUNT_DELETION_ITEMS,
  ACCOUNT_RETENTION_NOTICE,
  getMemberAccountDeletionSuccessPresentation,
  isAccountDeletionCodeValid,
  isDeletionConfirmationValid,
  publicAccountDeletionErrorMessage,
} from "../utils/accountDeletion";

test("인앱 탈퇴 완료 신호만 간결한 완료 화면과 로그인 확인 동작을 선택한다", () => {
  assert.deepEqual(getMemberAccountDeletionSuccessPresentation("1"), {
    title: "탈퇴가 완료되었어요!",
    buttonLabel: "확인",
    confirmRoute: "/auth/login",
  });
  assert.equal(getMemberAccountDeletionSuccessPresentation(undefined), null);
  assert.equal(getMemberAccountDeletionSuccessPresentation("0"), null);
});

test("탈퇴 안내는 모든 작성 콘텐츠와 상조회 자료 보존을 명확히 알린다", () => {
  const notice = [...ACCOUNT_DELETION_ITEMS, ACCOUNT_RETENTION_NOTICE].join(" ");

  assert.match(notice, /공개 여부와 상태에 관계없이/);
  assert.match(notice, /작성 당시의 이름과 기수/);
  assert.match(notice, /상조회 신청/);
  assert.match(notice, /연결된 증빙자료/);
  assert.match(notice, /관리자만 열람/);
  assert.doesNotMatch(notice, /비공개 게시글.*삭제/);
  assert.doesNotMatch(notice, /작성자 연결을 제거/);
});

test("계정 삭제 확인 문구는 공백을 제외하고 정확히 일치해야 한다", () => {
  assert.equal(isDeletionConfirmationValid(ACCOUNT_DELETION_CONFIRMATION), true);
  assert.equal(isDeletionConfirmationValid(`  ${ACCOUNT_DELETION_CONFIRMATION}  `), true);
  assert.equal(isDeletionConfirmationValid("삭제"), false);
  assert.equal(isDeletionConfirmationValid("계정삭제"), false);
});

test("계정 삭제 인증 코드는 6자리 숫자만 허용한다", () => {
  assert.equal(isAccountDeletionCodeValid("123456"), true);
  assert.equal(isAccountDeletionCodeValid(" 123456 "), true);
  assert.equal(isAccountDeletionCodeValid("12345"), false);
  assert.equal(isAccountDeletionCodeValid("12345a"), false);
});

test("공개 삭제 확인 오류는 계정 존재 여부나 실패 항목을 구분해 노출하지 않는다", () => {
  const invalid = publicAccountDeletionErrorMessage(400, "ACCOUNT_DELETION_INVALID");
  assert.match(invalid, /요청 정보를 확인할 수 없거나/);
  assert.match(invalid, /이메일, 인증 코드와 비밀번호/);
  assert.doesNotMatch(invalid, /존재하지/);
  assert.match(publicAccountDeletionErrorMessage(429), /요청이 너무 많습니다/);
});
