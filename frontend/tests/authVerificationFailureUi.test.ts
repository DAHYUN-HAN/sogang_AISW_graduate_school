import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  VERIFICATION_ATTEMPTS_EXCEEDED_MESSAGE,
  verificationFailureStateFromErrorCode,
  verificationHasExpired,
} from "../utils/authVerificationUi";

const frontendRoot = path.resolve(import.meta.dirname, "..");

test("서버 인증 실패 코드는 만료와 횟수 초과 상태로 구분된다", () => {
  assert.equal(verificationFailureStateFromErrorCode("VERIFICATION_EXPIRED"), "expired");
  assert.equal(verificationFailureStateFromErrorCode("VERIFICATION_ATTEMPTS_EXCEEDED"), "attempts");
  assert.equal(verificationFailureStateFromErrorCode("VERIFICATION_CODE_INVALID"), null);
});

test("서버 만료 응답은 로컬 카운트다운이 남아 있어도 만료 화면을 선택한다", () => {
  assert.equal(verificationHasExpired(240, "expired"), true);
  assert.equal(verificationHasExpired(0, null), true);
  assert.equal(verificationHasExpired(240, null), false);
});

test("회원가입과 비밀번호 찾기는 피그마의 인증 횟수 초과 문구를 공유한다", () => {
  assert.equal(
    VERIFICATION_ATTEMPTS_EXCEEDED_MESSAGE,
    "인증 시도 횟수를 초과했어요.\n잠시 후 다시 시도해주세요.",
  );
});

test("두 인증 화면은 종료 오류에서 코드를 비우고 서버 만료 시 재전송을 연다", () => {
  for (const relativePath of ["app/auth/register.tsx", "app/auth/password-reset.tsx"]) {
    const source = fs.readFileSync(path.join(frontendRoot, relativePath), "utf8");

    assert.match(source, /verificationFailureStateFromErrorCode\(errorCode\)/, relativePath);
    assert.match(source, /if \(failureState\) setCode\(""\)/, relativePath);
    assert.match(source, /if \(failureState === "expired"\)/, relativePath);
    assert.match(source, /verificationHasExpired\(countdown, verificationFailureState\)/, relativePath);
  }
});
