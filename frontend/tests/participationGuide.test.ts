import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { operationStatus, participationApplicationUrl } from "../utils/participationGuide";

test("참여 신청 버튼은 metadata의 관리자 URL만 사용한다", () => {
  assert.equal(
    participationApplicationUrl({ application_url: " https://example.com/join " }),
    "https://example.com/join",
  );
  assert.equal(participationApplicationUrl({}), undefined);
  assert.equal(participationApplicationUrl(undefined), undefined);
});

test("운영상태가 없는 예전 안내 글은 운영중으로 본다", () => {
  assert.equal(operationStatus({ operation_status: "ended" }), "ended");
  assert.equal(operationStatus({ operation_status: "active" }), "active");
  assert.equal(operationStatus({}), "active");
  assert.equal(operationStatus(undefined), "active");
  // 정확히 "ended"가 아니면 전부 운영중이다.
  assert.equal(operationStatus({ operation_status: "Ended" }), "active");
});

test("동아리만 쓰던 옛 키도 계속 읽는다", () => {
  // DB에 club_operation_status가 남아 있는 글이 있다.
  assert.equal(operationStatus({ club_operation_status: "ended" }), "ended");
  // 새 키가 있으면 새 키가 이긴다.
  assert.equal(operationStatus({ operation_status: "active", club_operation_status: "ended" }), "active");
});

test("활동 대상 목록은 동아리·스터디·네트워킹 모두 운영 중인 것만 보여준다", () => {
  // 운영이 끝난 대상도 안내 글은 남긴다. 과거 활동인증이 그 글을 참조한다.
  const source = readFileSync("utils/activityCertification.ts", "utf8");
  assert.match(source, /operationStatus\(post\.metadata\) === "active"/);
  // 게시판별 분기가 다시 생기면 한쪽만 걸러지게 된다.
  assert.doesNotMatch(source, /boardSlug === "club-promo"/);
});
