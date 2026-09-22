import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { passwordResetProgressDotIndex } from "../utils/passwordResetUi";

const passwordResetSource = readFileSync("app/auth/password-reset.tsx", "utf8");

test("비밀번호 찾기 인증 화면은 재전송 카운트다운 상태를 실제 화면에 연결한다", () => {
  assert.match(passwordResetSource, /import \{ passwordResetProgressDotIndex, passwordResetResendControl \} from "\.\.\/\.\.\/utils\/passwordResetUi"/);
  assert.match(passwordResetSource, /const resendControl = passwordResetResendControl\(\{/);
  assert.match(passwordResetSource, /<View style=\{styles\.statusRow\}>[\s\S]*<Text style=\{\[styles\.resendLink, resendControl\.disabled \? styles\.resendLinkDisabled : null\]\}>\{resendControl\.label\}<\/Text>/);
  assert.match(passwordResetSource, /\{resendControl\.visible \? \(/);
  assert.match(passwordResetSource, /accessibilityState=\{\{ disabled: resendControl\.disabled \}\}/);
});

test("비밀번호 찾기 인증코드는 회원가입과 같은 재전송 카운트다운 상태를 만든다", async () => {
  const passwordResetUi = await import("../utils/passwordResetUi").catch(() => null);
  assert.ok(passwordResetUi, "비밀번호 찾기 카운트다운 UI 모델이 필요합니다.");

  assert.deepEqual(
    passwordResetUi.passwordResetResendControl({
      verificationExpired: false,
      verificationAttemptsLocked: false,
      isSubmitting: false,
      resendCooldown: 300,
    }),
    { visible: true, disabled: true, label: "재전송 (05:00)" }
  );
  assert.equal(
    passwordResetUi.passwordResetResendControl({
      verificationExpired: false,
      verificationAttemptsLocked: false,
      isSubmitting: false,
      resendCooldown: 299,
    }).label,
    "재전송 (04:59)"
  );
  assert.deepEqual(
    passwordResetUi.passwordResetResendControl({
      verificationExpired: false,
      verificationAttemptsLocked: false,
      isSubmitting: false,
      resendCooldown: 0,
    }),
    { visible: true, disabled: false, label: "재전송" }
  );
});

test("비밀번호 찾기 재전송 상태는 발송 중과 만료·잠금을 구분한다", async () => {
  const passwordResetUi = await import("../utils/passwordResetUi").catch(() => null);
  assert.ok(passwordResetUi, "비밀번호 찾기 카운트다운 UI 모델이 필요합니다.");

  assert.deepEqual(
    passwordResetUi.passwordResetResendControl({
      verificationExpired: false,
      verificationAttemptsLocked: false,
      isSubmitting: true,
      resendCooldown: 120,
    }),
    { visible: true, disabled: true, label: "발송 중" }
  );
  assert.equal(
    passwordResetUi.passwordResetResendControl({
      verificationExpired: true,
      verificationAttemptsLocked: false,
      isSubmitting: false,
      resendCooldown: 0,
    }).visible,
    false
  );
  assert.equal(
    passwordResetUi.passwordResetResendControl({
      verificationExpired: false,
      verificationAttemptsLocked: true,
      isSubmitting: false,
      resendCooldown: 120,
    }).visible,
    false
  );
});

test("비밀번호 찾기 화면은 3단계 진행 점을 현재 단계에 맞춰 표시한다", () => {
  assert.equal(passwordResetProgressDotIndex("request"), 0);
  assert.equal(passwordResetProgressDotIndex("code"), 1);
  assert.equal(passwordResetProgressDotIndex("reset"), 2);
  assert.equal(passwordResetProgressDotIndex("complete"), 2);
  assert.match(passwordResetSource, /<StepDots mode=\{mode\} \/>/);
  assert.match(passwordResetSource, /stepDot: \{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#E0E3E8" \}/);
  assert.match(passwordResetSource, /stepDotActive: \{ backgroundColor: "#2661FF" \}/);
});
