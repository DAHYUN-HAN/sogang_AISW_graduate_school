import assert from "node:assert/strict";
import test from "node:test";

import {
  noticeAttachmentFrameAspectRatio,
  postDetailImagePresentation,
  shouldOpenPostAttachment,
} from "../utils/postDetailImagePresentation";

test("공지 첨부 이미지는 원본 방향에 따라 가로 4:3 또는 세로 4:5 프레임을 사용한다", () => {
  assert.equal(noticeAttachmentFrameAspectRatio(16 / 9), 4 / 3);
  assert.equal(noticeAttachmentFrameAspectRatio(1), 4 / 3);
  assert.equal(noticeAttachmentFrameAspectRatio(3 / 4), 4 / 5);
  assert.equal(noticeAttachmentFrameAspectRatio(null), 4 / 3);
});

test("이미지는 외부로 열지 않고 문서 첨부만 외부로 연다", () => {
  assert.equal(shouldOpenPostAttachment({ isNotice: true, contentType: "image/png" }), false);
  assert.equal(shouldOpenPostAttachment({ isNotice: true, contentType: "application/pdf" }), true);
  assert.equal(shouldOpenPostAttachment({ isNotice: false, contentType: "image/jpeg" }), false);
  assert.equal(shouldOpenPostAttachment({ isNotice: false, contentType: "application/pdf" }), true);
});

test("공지 첨부는 고정 contain 프레임을 사용하고 일반 첨부는 원본 비율을 유지한다", () => {
  assert.equal(postDetailImagePresentation({ placement: "attachment", boardType: "notice" }), "fixed-contain");
  assert.equal(postDetailImagePresentation({ placement: "attachment", boardType: "post" }), "natural");
});

test("모든 활동 인증 대표 이미지는 원본 비율에 따른 자연 높이를 사용한다", () => {
  assert.equal(
    postDetailImagePresentation({ placement: "hero", boardType: "activity_certification", boardSlug: "club-activity" }),
    "natural",
  );
  assert.equal(
    postDetailImagePresentation({ placement: "hero", boardType: "activity_certification", boardSlug: "study-activity" }),
    "natural",
  );
  assert.equal(
    postDetailImagePresentation({ placement: "hero", boardType: "activity_certification", boardSlug: "networking-activity" }),
    "natural",
  );
  assert.equal(postDetailImagePresentation({ placement: "hero", boardType: "activity_certification" }), "natural");
});

test("동아리와 네트워킹 모집 대표 이미지는 원본 비율을 유지한다", () => {
  assert.equal(
    postDetailImagePresentation({ placement: "hero", boardType: "post", boardSlug: "club-promo" }),
    "natural",
  );
  assert.equal(
    postDetailImagePresentation({ placement: "hero", boardType: "post", boardSlug: "networking-programs" }),
    "natural",
  );
});

test("원우회 활동내역 대표 이미지는 기존 자연 비율을 유지한다", () => {
  assert.equal(
    postDetailImagePresentation({ placement: "hero", boardType: "notice", isCouncilActivityEntry: true }),
    "natural",
  );
});

test("사진첩의 승인된 고정 contain 프레임은 유지한다", () => {
  assert.equal(postDetailImagePresentation({ placement: "hero", boardType: "album" }), "fixed-contain");
});
