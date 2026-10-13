import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";


const registerSource = readFileSync("app/auth/register.tsx", "utf8");
const privacyScreenSource = readFileSync("app/legal/privacy.tsx", "utf8");
const termsScreenSource = readFileSync("app/legal/terms.tsx", "utf8");


test("회원가입 인증 단계는 최초 발송과 재전송 상태를 구분한다", () => {
  assert.match(registerSource, /setVerificationMessage\(resend \?/);
  assert.match(registerSource, /signupProgressDotIndex\(step\)/);
  assert.match(registerSource, /resendAvailableAt\(responseReceivedAt, resendIn\)/);
  // 2026-10-11: 만료도 같은 기준이어야 만료 순간 재전송이 바로 파랗게 열린다.
  assert.match(registerSource, /verificationExpiresAtRef\.current = responseReceivedAt \+ response\.data\.expires_in \* 1000;/);
  // 2026-10-11 사용자 요청: 처음 발송은 파란색, 재전송 뒤에는 회색 "재전송 (04:59)"를 오른쪽에 둔다.
  assert.match(registerSource, /\{displaySchoolEmail\(emailId\)\}로 \{codeResent \? "재발송" : "발송"\}되었어요/);
  assert.match(registerSource, /style=\{styles\.resendControlTrailing\}/);
  assert.match(registerSource, /codeResent && resendCooldown > 0 \? styles\.resendLinkDisabled : null/);
  assert.match(registerSource, /resendCountdownLabel\(resendCooldown\)\}/);
  assert.match(registerSource, /disabled=\{isSubmitting \|\| resendCooldown > 0\}/);
  assert.match(registerSource, /verificationExpired \? \(/);
  assert.match(registerSource, /resendCooldown > 0 \? resendCountdownLabel\(resendCooldown\) : "재전송"/);
});


test("회원가입 이름은 동명이인을 오류로 처리하지 않는다", () => {
  assert.doesNotMatch(registerSource, /NICKNAME_CONFLICT/);
  assert.doesNotMatch(registerSource, /이미 사용 중인 이름이에요/);
});


test("개인정보 동의 체크와 전문 열기는 독립적으로 동작한다", () => {
  // 2026-10-11 사용자 요청: 계정 설정과 같은 동의 시트(Figma PrivacyConsentSheet)를 같은 내용으로 연다.
  assert.match(registerSource, /<PrivacyConsentSheet visible=\{privacyModalVisible\} onClose=\{\(\) => setPrivacyModalVisible\(false\)\} \/>/);
  assert.match(registerSource, /onPress=\{togglePrivacyConsent\}/);
  assert.match(registerSource, /accessibilityLabel="이용약관 및 개인정보 처리방침 전문 보기"/);
  assert.match(registerSource, /onPress=\{openPrivacyPolicy\}/);
  assert.match(registerSource, /이용약관 및 개인정보 처리방침 동의 \(필수\)/);
  assert.doesNotMatch(registerSource, /privacyReviewed|privacyReadToEnd|hasReachedPrivacyPolicyEnd/);
  assert.doesNotMatch(registerSource, />전문보기<\/Text>/);
  assert.match(privacyScreenSource, /createPrivacyConsentScreenDocument\(/);
  assert.match(termsScreenSource, /sections=\{TERMS_OF_SERVICE_SECTIONS\}/);
});

// 2026-10-11: 회원가입 약관 보기는 계정 설정과 같은 시트라 버전·시행일을 따로 보이지 않는다.
test("이용약관 화면만 활성 정책 메타데이터를 표시한다", () => {
  assert.match(registerSource, /useRegistrationOptionsQuery\(\)/);
  assert.doesNotMatch(registerSource, /resolvePrivacyPolicyMetadata/);
  assert.match(termsScreenSource, /useRegistrationOptionsQuery\(\)/);
  assert.match(termsScreenSource, /resolvePrivacyPolicyMetadata\(/);
  assert.doesNotMatch(privacyScreenSource, /useRegistrationOptionsQuery|resolvePrivacyPolicyMetadata/);
  assert.doesNotMatch(privacyScreenSource, /effectiveDate=|version=/);
});
