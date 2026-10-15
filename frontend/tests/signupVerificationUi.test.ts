import assert from "node:assert/strict";
import test from "node:test";

import {
  registrationVerificationFailure,
  resendAvailableAt,
  resendCountdownLabel,
  signupProgressDotIndex,
} from "../utils/signupVerificationUi";


// 2026-10-11 사용자 확인: 인증코드는 두 번째, 기본 정보는 세 번째 점이 켜진다.
test("회원가입 진행 점은 이메일·인증코드·기본 정보 순서로 켜진다", () => {
  assert.equal(signupProgressDotIndex(0), 0);
  assert.equal(signupProgressDotIndex(1), 1);
  assert.equal(signupProgressDotIndex(2), 2);
});


test("재전송 성공은 응답 수신 시각부터 5분을 다시 계산한다", () => {
  assert.equal(resendAvailableAt(10_000, 300), 310_000);
  assert.equal(resendCountdownLabel(299), "재전송 (04:59)");
  assert.equal(resendCountdownLabel(0), "재전송");
  // 발송 안내 메시지가 함께 뜨는 상태에서는 남은 시간만 보여준다.
  assert.equal(resendCountdownLabel(300, { timerOnly: true }), "05:00");
  assert.equal(resendCountdownLabel(0, { timerOnly: true }), "재전송");
});

// 2026-10-15 사용자 결정: 메일을 보내지 못한 실패는 칸 아래 문구 대신 오류 토스트(null).
test("메일을 보내지 못한 최초 요청은 칸 아래 문구 없이 오류 토스트로 넘긴다", () => {
  assert.equal(registrationVerificationFailure(undefined, false), null);
});

test("이미 가입된 이메일은 코드 화면으로 이동하지 않고 가입 오류를 표시한다", () => {
  assert.deepEqual(registrationVerificationFailure("CONFLICT", false), {
    placement: "email",
    message: "이미 가입된 이메일이에요.",
  });
});

test("메일을 보내지 못한 재전송도 오류 토스트로 넘긴다", () => {
  assert.equal(registrationVerificationFailure(undefined, true), null);
});

test("재전송 제한과 요청 과다 오류 문구를 유지한다", () => {
  assert.deepEqual(registrationVerificationFailure("VERIFICATION_RESEND_COOLDOWN", false), {
    placement: "email",
    message: "인증코드는 5분 후 다시 요청할 수 있어요.",
  });
  assert.deepEqual(registrationVerificationFailure("RATE_LIMITED", false), {
    placement: "email",
    message: "인증 요청이 너무 많아요. 잠시 후 다시 시도해주세요.",
  });
});
