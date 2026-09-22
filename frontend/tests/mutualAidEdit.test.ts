import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canDeleteMutualAidRequest,
  canEditMutualAidRequest,
  isUnchangedMutualAidEventDate,
  isValidEvidenceLink,
  mutualAidEventTypeLabel,
  mutualAidRelationLabel,
  normalizeMutualAidEventDate,
} from "../utils/mutualAid";
import { postEditRouteForPostDetail } from "../utils/appRoutes";

const detailSource = readFileSync("app/(tabs)/board/post/[postId].tsx", "utf8");
const editFormSource = readFileSync("app/(tabs)/board/post/create.tsx", "utf8");

test("상조회 작성자 작업 권한은 처리중·완료·반려 상태별 정책을 따른다", () => {
  assert.equal(canEditMutualAidRequest("processing"), true);
  assert.equal(canEditMutualAidRequest("completed"), false);
  assert.equal(canEditMutualAidRequest("rejected"), false);

  assert.equal(canDeleteMutualAidRequest("processing"), true);
  assert.equal(canDeleteMutualAidRequest("completed"), false);
  assert.equal(canDeleteMutualAidRequest("rejected"), true);
});

test("상조회 수정 값은 API 형식을 신청 양식 표기로 복원한다", () => {
  assert.equal(normalizeMutualAidEventDate("2026-08-04"), "2026.08.04");
  assert.equal(isUnchangedMutualAidEventDate("2026.08.04", "2026-08-04"), true);
  assert.equal(mutualAidEventTypeLabel("wedding"), "결혼");
  assert.equal(mutualAidRelationLabel("self"), "본인");
});

test("상조회 수정은 전용 신청 양식으로 이동하고 상태별 메뉴를 분리한다", () => {
  assert.equal(
    postEditRouteForPostDetail(
      { board_type: "mutual_aid", write_permission: "user" },
      18,
      301,
      "18",
      "/(tabs)/council",
    ),
    "/board/post/create?boardId=18&postId=301&editOrigin=post-detail&fromBoardId=18&returnTo=%2F(tabs)%2Fcouncil",
  );
  assert.match(detailSource, /canEditMutualAidRequest\(post\.mutual_aid\?\.status\)/);
  assert.match(detailSource, /canDeleteMutualAidRequest\(post\.mutual_aid\?\.status\)/);
});

test("상조회 링크 입력은 프로젝트 체인 아이콘을 사용한다", () => {
  assert.match(
    editFormSource,
    /<AttachLinkIcon size=\{16\} color=\{COLORS\.muted\} \/>/,
  );
  assert.doesNotMatch(editFormSource, /name="link-2"/);
});

test("증빙 링크는 도메인을 덜 입력한 주소를 거부한다", () => {
  // QA: http://www. 로도 상조회 신청이 등록되던 문제
  assert.equal(isValidEvidenceLink("http://www."), false);
  assert.equal(isValidEvidenceLink("http://www"), false);
  assert.equal(isValidEvidenceLink("https://"), false);
  assert.equal(isValidEvidenceLink("https://example."), false);
  assert.equal(isValidEvidenceLink("https://.com"), false);
  assert.equal(isValidEvidenceLink("https://example.c"), false);
});

test("증빙 링크는 http(s) 정상 주소만 허용한다", () => {
  assert.equal(isValidEvidenceLink("https://example.com"), true);
  assert.equal(isValidEvidenceLink("http://www.example.com/invite?id=3"), true);
  assert.equal(isValidEvidenceLink("  https://example.co.kr/a  "), true);
  assert.equal(isValidEvidenceLink("ftp://example.com"), false);
  assert.equal(isValidEvidenceLink("javascript:alert(1)"), false);
  assert.equal(isValidEvidenceLink("example.com"), false);
  assert.equal(isValidEvidenceLink(""), false);
  assert.equal(isValidEvidenceLink(null), false);
});

test("증빙 링크 길이 제한은 500자다", () => {
  const base = "https://example.com/";
  assert.equal(isValidEvidenceLink(base + "a".repeat(500 - base.length)), true);
  assert.equal(isValidEvidenceLink(base + "a".repeat(501 - base.length)), false);
});
