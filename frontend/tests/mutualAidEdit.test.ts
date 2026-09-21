import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canDeleteMutualAidRequest,
  canEditMutualAidRequest,
  isUnchangedMutualAidEventDate,
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

test("상조회 수정 양식은 증빙을 노출하지 않고 기존 관리자 전용 증빙을 보존한다", () => {
  assert.match(editFormSource, /existingPost\.mutual_aid\?\.event_type/);
  assert.match(editFormSource, /existingPost\.mutual_aid\?\.event_date/);
  assert.match(editFormSource, /existingPost\.mutual_aid\?\.relation/);
  assert.match(editFormSource, /existingPost\?\.mutual_aid\?\.has_evidence/);
  assert.match(editFormSource, /isMutualAid && hasStoredMutualAidEvidence/);
  // Figma 비공개안내는 display:none — 증빙 비공개 안내 문구는 화면에 그리지 않는다.
  assert.doesNotMatch(editFormSource, /증빙자료는 원우회 관리자만 확인/);
  assert.match(editFormSource, /attachment_ids: attachmentIds/);
});

test("상조회 증빙 첨부는 피그마 문구로 대표 지원 확장자를 표시한다", () => {
  assert.match(
    editFormSource,
    /※ 청첩장, 부고장 이미지를 첨부할 수 있어요 \(JPG, PNG\)/,
  );
  assert.doesNotMatch(editFormSource, /지원 형식:/);
  assert.doesNotMatch(editFormSource, /최대 10MB/);
  assert.match(editFormSource, /isUploading \? "업로드 중"/);
  assert.match(editFormSource, /pickAndUploadDocuments\(undefined, isMutualAid\)/);
  assert.match(
    editFormSource,
    /<Text style=\{styles\.evidenceFileButtonText\}>\{isUploading \? "업로드 중" : "※ 청첩장, 부고장 이미지를 첨부할 수 있어요 \(JPG, PNG\)"\}<\/Text>/,
  );

  const evidenceFileButtonStyle = editFormSource.match(
    /evidenceFileButton:\s*{([\s\S]*?)\r?\n  },\r?\n  evidenceFileButtonText:/,
  )?.[1] ?? "";
  // Figma 첨부버튼: 36h(padding 10/0), 테두리 없음 — 안내 문구 행이다.
  assert.match(evidenceFileButtonStyle, /minHeight:\s*36/);
  assert.match(evidenceFileButtonStyle, /paddingVertical:\s*10/);
  assert.doesNotMatch(evidenceFileButtonStyle, /paddingHorizontal:/);
  assert.doesNotMatch(evidenceFileButtonStyle, /borderWidth:/);

  const evidenceFileButtonTextStyle = editFormSource.match(
    /evidenceFileButtonText:\s*{([\s\S]*?)\r?\n  },\r?\n  evidenceLinkField:/,
  )?.[1] ?? "";
  assert.match(evidenceFileButtonTextStyle, /flex:\s*1/);
  assert.match(evidenceFileButtonTextStyle, /flexShrink:\s*1/);
  assert.match(evidenceFileButtonTextStyle, /minWidth:\s*0/);
  assert.match(evidenceFileButtonTextStyle, /flexWrap:\s*"wrap"/);
  assert.match(evidenceFileButtonTextStyle, /lineHeight:\s*16/); // Figma 13/16

  const evidenceLinkFieldStyle = editFormSource.match(
    /evidenceLinkField:\s*{([\s\S]*?)\r?\n  },\r?\n  evidenceLinkInput:/,
  )?.[1] ?? "";
  // Figma 링크입력필드: 36h, padding 10/12
  assert.match(evidenceLinkFieldStyle, /height:\s*36/);
  assert.match(evidenceLinkFieldStyle, /paddingHorizontal:\s*12/);
});

test("상조회 링크 입력은 프로젝트 체인 아이콘을 사용한다", () => {
  assert.match(
    editFormSource,
    /<AttachLinkIcon size=\{16\} color=\{COLORS\.muted\} \/>/,
  );
  assert.doesNotMatch(editFormSource, /name="link-2"/);
});
