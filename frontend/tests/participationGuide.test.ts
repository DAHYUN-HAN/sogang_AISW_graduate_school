import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { clubOperationStatus, participationApplicationUrl } from "../utils/participationGuide";

test("참여 신청 버튼은 metadata의 관리자 URL만 사용한다", () => {
  assert.equal(
    participationApplicationUrl({ application_url: " https://example.com/join " }),
    "https://example.com/join",
  );
  assert.equal(participationApplicationUrl({}), undefined);
  assert.equal(participationApplicationUrl(undefined), undefined);
});

test("운영상태가 없는 예전 동아리 안내 글은 운영중으로 본다", () => {
  assert.equal(clubOperationStatus({ club_operation_status: "ended" }), "ended");
  assert.equal(clubOperationStatus({ club_operation_status: "active" }), "active");
  assert.equal(clubOperationStatus({}), "active");
  assert.equal(clubOperationStatus(undefined), "active");
});

test("활동인증 동아리 목록은 운영 중인 동아리만 보여준다", () => {
  // 운영이 끝난 동아리도 안내 글은 남긴다. 과거 활동인증이 그 글을 참조한다.
  const createSource = readFileSync("app/(tabs)/board/post/create.tsx", "utf8");
  assert.match(createSource, /activitySourceBoard\?\.slug !== "club-promo"/);
  assert.match(createSource, /clubOperationStatus\(post\.metadata\) === "active"/);
});
