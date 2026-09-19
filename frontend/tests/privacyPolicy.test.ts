import assert from "node:assert/strict";
import test from "node:test";

import {
  CONSENT_DOCUMENT_SECTIONS,
  createPrivacyConsentScreenDocument,
  hasReachedPrivacyPolicyEnd,
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_ONLY_SECTIONS,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_VERSION,
  resolvePrivacyPolicyMetadata,
  TERMS_OF_SERVICE_SECTIONS,
} from "../utils/privacyPolicy";

const TERMS_ARTICLE_TITLES = [
  "제1조 (목적)",
  "제2조 (정의)",
  "제3조 (약관의 효력 및 변경)",
  "제4조 (약관 외 준칙)",
  "제5조 (가입자격 및 이용신청)",
  "제6조 (이용신청의 승낙 및 제한)",
  "제7조 (회원정보의 변경)",
  "제8조 (회원 탈퇴 및 자격 상실)",
  "제9조 (원우회의 의무)",
  "제10조 (회원의 의무)",
  "제11조 (서비스의 내용)",
  "제12조 (서비스 이용시간)",
  "제13조 (게시물의 관리)",
  "제14조 (원우회 서비스의 특수성)",
  "제15조 (이용제한 등)",
  "제16조 (손해배상)",
  "제17조 (면책조항)",
  "제18조 (분쟁해결)",
  "제19조 (원우회 정보)",
] as const;

const PRIVACY_ARTICLE_TITLES = [
  "제1조 (개인정보의 처리 목적)",
  "제2조 (개인정보의 처리 및 보유 기간)",
  "제3조 (개인정보의 제3자 제공)",
  "제4조 (개인정보 처리업무의 위탁)",
  "제4조의2 (개인정보의 국외 이전)",
  "제4조의3 (공개 영역의 민감정보 및 제3자 정보 보호)",
  "제5조 (정보주체의 권리·의무 및 행사방법)",
  "제6조 (처리하는 개인정보의 항목)",
  "제7조 (개인정보의 파기절차 및 방법)",
  "제8조 (개인정보의 안전성 확보조치)",
  "제9조 (개인정보 자동 수집 장치의 설치·운영 및 거부)",
  "제10조 (개인정보 보호책임자)",
  "제11조 (개인정보 열람청구)",
  "제12조 (권익침해 구제방법)",
] as const;

const ARTICLE_TITLE_PATTERN = /^제\d+조(?:의\d+)? \(.+\)$/;
const EMBEDDED_ARTICLE_TITLE_PATTERN = /(?:^|\n)제\d+조(?:의\d+)? \(.+\)/m;


test("전문은 서비스 이용약관과 개인정보 처리방침의 필수 항목을 제공한다", () => {
  const titles = PRIVACY_POLICY_SECTIONS.map((section) => section.title);

  for (const requiredTitle of [
    "서비스 이용약관",
    "개인정보 처리방침",
    "제1조 (개인정보의 처리 목적)",
    "제2조 (개인정보의 처리 및 보유 기간)",
    "제6조 (처리하는 개인정보의 항목)",
    "제12조 (권익침해 구제방법)",
  ]) {
    assert.ok(titles.includes(requiredTitle), `필수 항목 누락: ${requiredTitle}`);
  }
});

test("회원가입 전문은 전용 약관·개인정보 화면과 같은 정본을 조합한다", () => {
  assert.deepEqual(CONSENT_DOCUMENT_SECTIONS, [
    ...TERMS_OF_SERVICE_SECTIONS,
    ...PRIVACY_POLICY_ONLY_SECTIONS,
  ]);
  assert.equal(PRIVACY_POLICY_SECTIONS, CONSENT_DOCUMENT_SECTIONS);
});

test("현재 정본 후보는 이용약관 19개 조항과 개인정보 처리방침 13개 번호 체계를 순서대로 제공한다", () => {
  const privacyStart = PRIVACY_POLICY_SECTIONS.findIndex((section) => section.title === "개인정보 처리방침");
  assert.ok(privacyStart > 0, "개인정보 처리방침 시작점을 찾을 수 없습니다.");

  const termsTitles = PRIVACY_POLICY_SECTIONS
    .slice(0, privacyStart)
    .map((section) => section.title)
    .filter((title) => ARTICLE_TITLE_PATTERN.test(title));
  const privacyTitles = PRIVACY_POLICY_SECTIONS
    .slice(privacyStart + 1)
    .map((section) => section.title)
    .filter((title) => ARTICLE_TITLE_PATTERN.test(title));

  assert.deepEqual(termsTitles, TERMS_ARTICLE_TITLES);
  assert.deepEqual(privacyTitles, PRIVACY_ARTICLE_TITLES);
});

test("현재 정본 후보의 모든 조항은 독립된 비어 있지 않은 본문을 가진다", () => {
  const articleSections = PRIVACY_POLICY_SECTIONS.filter((section) => ARTICLE_TITLE_PATTERN.test(section.title));

  for (const section of articleSections) {
    assert.notEqual(section.body.trim(), "", `본문이 비어 있는 조항: ${section.title}`);
    assert.doesNotMatch(section.body, EMBEDDED_ARTICLE_TITLE_PATTERN, `본문에 다른 조항 제목이 섞임: ${section.title}`);
  }
});

test("개인정보 동의 화면은 현재 정본 조항을 유지하고 시행일과 버전은 표시하지 않는다", () => {
  const consentDate = "2026-03-02T09:00:00+09:00";
  const document = createPrivacyConsentScreenDocument(consentDate);
  const intro = document.sections.find((section) => section.title === "개인정보 처리방침");
  const articleTitles = document.sections
    .map((section) => section.title)
    .filter((title) => ARTICLE_TITLE_PATTERN.test(title));

  assert.equal(document.title, "개인정보 수집 및 이용 동의");
  assert.equal(document.consentDate, consentDate);
  assert.ok(!("effectiveDate" in document));
  assert.ok(!("version" in document));
  assert.deepEqual(articleTitles, PRIVACY_ARTICLE_TITLES);
  assert.ok(intro, "개인정보 처리방침 안내문이 누락되었습니다.");
  assert.match(intro.body, /AI·SW 캠퍼스/);
  assert.doesNotMatch(intro.body, /개인정보 처리방침 버전:|시행일:/);
  assert.deepEqual(document.sections.slice(1), PRIVACY_POLICY_ONLY_SECTIONS.slice(1));
});

test("정책 제출 메타데이터는 현재 운영 버전과 시행일을 기본값으로 사용한다", () => {
  assert.equal(PRIVACY_POLICY_VERSION, "2026-09-01");
  assert.equal(PRIVACY_POLICY_EFFECTIVE_DATE, "2026-09-01");
});

test("서버의 활성 정책 메타데이터를 제출 및 이용약관 표시값으로 우선한다", () => {
  assert.deepEqual(
    resolvePrivacyPolicyMetadata({ version: "2026-08-31", effective_at: "2026-08-31T09:00:00+09:00" }),
    { version: "2026-08-31", effectiveDate: "2026-08-31" },
  );
  assert.deepEqual(resolvePrivacyPolicyMetadata(), {
    version: "2026-09-01",
    effectiveDate: "2026-09-01",
  });
});


test("개인정보 전문은 마지막 영역에 도달해야 확인 완료가 된다", () => {
  assert.equal(
    hasReachedPrivacyPolicyEnd({ contentHeight: 1000, viewportHeight: 600, offsetY: 383 }),
    false,
  );
  assert.equal(
    hasReachedPrivacyPolicyEnd({ contentHeight: 1000, viewportHeight: 600, offsetY: 384 }),
    true,
  );
  assert.equal(
    hasReachedPrivacyPolicyEnd({ contentHeight: 500, viewportHeight: 600, offsetY: 0 }),
    true,
  );
  assert.equal(
    hasReachedPrivacyPolicyEnd({ contentHeight: 0, viewportHeight: 600, offsetY: 0 }),
    false,
  );
});
