import assert from "node:assert/strict";
import test from "node:test";
import type { PostListItem } from "../types";
import * as activityCertification from "../utils/activityCertification";

import {
  ACTIVITY_PARTICIPANT_GUIDANCE,
  activityParticipantSearchKey,
  activityParticipantTextColor,
  activityBankAccountFieldState,
  activityCertificationBadgeLabel,
  activityCertificationPreview,
  activityParticipantSelectionError,
  activityParticipantsFromMetadata,
  activitySourcePostFilters,
  activityCertificationCardTitle,
  loadAllPublishedActivitySourcePosts,
  loadPublishedActivitySourcePosts,
  shouldShowActivityCertificationBadge,
  activitySourcePostIdFromMetadata,
  buildActivityCertificationMetadata,
  formatActivityParticipant,
} from "../utils/activityCertification";

type DetailParticipant = {
  id: number | null;
  label: string;
  is_paid_for_board: boolean | null;
};

const detailParticipants = (
  activityCertification as typeof activityCertification & {
    activityDetailParticipants?: (
      participants: DetailParticipant[] | null | undefined,
      metadata?: Record<string, unknown> | null,
    ) => DetailParticipant[];
  }
).activityDetailParticipants;

test("현재 게시판 납부 효력은 검정과 회색 두 색으로만 표시한다", () => {
  assert.equal(activityParticipantTextColor({ is_paid_for_board: true }), "#212429");
  assert.equal(activityParticipantTextColor({ is_paid_for_board: false }), "#8A919C");
  // Figma Screen/Activity/Verify(110:39) 문구. 색이 뜻하는 것은 납부 여부가 아니라 지원금 지급 여부다.
  assert.match(ACTIVITY_PARTICIPANT_GUIDANCE, /검정은 지급 가능, 회색은 지급 불가/);
  assert.match(ACTIVITY_PARTICIPANT_GUIDANCE, /본인도 검색해서 추가해주세요/);
  assert.doesNotMatch(ACTIVITY_PARTICIPANT_GUIDANCE, /주황|5만원|1회 납부/);
});

test("활동인증 상세는 현재 게시판 납부 상태와 이름 순서를 함께 표시한다", () => {
  assert.ok(detailParticipants, "상세 참가자 표시 변환기가 필요하다");
  const participants: DetailParticipant[] = [
    { id: 1, label: "99기 검증미납", is_paid_for_board: false },
    { id: 2, label: "99기 검증다른행사", is_paid_for_board: false },
    { id: 3, label: "99기 검증전체", is_paid_for_board: true },
  ];

  assert.deepEqual(detailParticipants(participants, { participants: "잘못된 폴백" }), participants);
  assert.equal(activityParticipantTextColor(participants[0]), "#8A919C");
  assert.equal(activityParticipantTextColor(participants[1]), "#8A919C");
  assert.equal(activityParticipantTextColor(participants[2]), "#212429");
});

test("납부 상태를 판별할 수 없는 과거 참가자는 기존 검정색을 유지한다", () => {
  assert.ok(detailParticipants, "상세 참가자 표시 변환기가 필요하다");
  const participants = detailParticipants(undefined, {
    participants: "72기 기존 참가자, 73기 과거 참가자",
  });

  assert.deepEqual(participants, [
    { id: null, label: "72기 기존 참가자", is_paid_for_board: null },
    { id: null, label: "73기 과거 참가자", is_paid_for_board: null },
  ]);
  assert.equal(activityParticipantTextColor(participants[0]), "#212429");
});

test("참가자 검색 캐시는 활동 게시판별로 분리한다", () => {
  assert.notDeepEqual(
    activityParticipantSearchKey(12, "검증"),
    activityParticipantSearchKey(13, "검증"),
  );
});

test("스터디 활동 인증 목록은 카드 배지를 숨긴다", () => {
  assert.equal(shouldShowActivityCertificationBadge("study-activity"), false);
});

test("동아리와 네트워킹 활동 인증 목록은 카드 배지를 유지한다", () => {
  assert.equal(shouldShowActivityCertificationBadge("club-activity"), true);
  assert.equal(shouldShowActivityCertificationBadge("networking-activity"), true);
});

test("스터디 활동 인증 카드만 게시글 제목을 표시한다", () => {
  const post = { title: "[마감][딥러닝기초] 학점방어 스터디원 모집합니다! 📚🔥" };

  assert.equal(
    activityCertificationCardTitle(post, "study-activity"),
    "[마감][딥러닝기초] 학점방어 스터디원 모집합니다! 📚🔥",
  );
  assert.equal(activityCertificationCardTitle(post, "club-activity"), null);
  assert.equal(activityCertificationCardTitle(post, "networking-activity"), null);
});

test("스터디 활동 인증 카드의 빈 제목은 표시하지 않는다", () => {
  assert.equal(activityCertificationCardTitle({ title: "   " }, "study-activity"), null);
});

test("동아리 활동 인증 목록은 태그 아래에 첫 동아리명 입력 줄을 표시한다", () => {
  assert.equal(
    activityCertificationPreview(
      { title: "기존 제목", content_preview: "[동아리명] : 알바트로스냅\n즐겁게 촬영했습니다." },
      "club-activity",
    ),
    "[동아리명] : 알바트로스냅",
  );
  assert.equal(
    activityCertificationPreview(
      { title: "기존 제목", content_preview: "[동아리 명] : 서뽈링\n정기 활동을 진행했습니다." },
      "club-activity",
    ),
    "[동아리 명] : 서뽈링",
  );
  assert.equal(
    activityCertificationPreview(
      {
        title: "[동아리명] : 서강의 봄",
        content_preview: "[동아리명] : 서강의 봄\n봄꽃 촬영을 진행했습니다.",
      },
      "club-activity",
    ),
    "[동아리명] : 서강의 봄",
  );
});

test("네트워킹 활동 인증 목록의 기존 첫 줄 표시를 유지한다", () => {
  assert.equal(
    activityCertificationPreview(
      { title: "기존 제목", content_preview: "[동아리명] : 알바트로스냅\n즐겁게 촬영했습니다." },
      "networking-activity",
    ),
    "[동아리명] : 알바트로스냅",
  );
});

test("다른 활동 인증 목록의 기존 전체 미리보기 폴백을 유지한다", () => {
  assert.equal(
    activityCertificationPreview(
      { title: "기존 제목", content_preview: "기존 제목\n기존 제목" },
      "study-activity",
    ),
    "기존 제목\n기존 제목",
  );
});


test("활동 인증 작성 계좌는 필수이고 수정은 계좌 재입력 없이 저장할 수 있다", () => {
  assert.equal(activityBankAccountFieldState(null).required, true);
  assert.equal(activityBankAccountFieldState(503).required, false);
});

test("수정에서 입력한 새 계좌만 metadata에 포함한다", () => {
  const metadata = buildActivityCertificationMetadata({
    existingMetadata: { participants: "72기 한다현" },
    activityDate: "2026.06.06",
    participants: "72기 한다현",
    bankAccount: "서강은행 999-000",
    selectedParticipants: [{ id: -1, name: "72기 한다현", legacy: true, persisted: true }],
    activitySourcePostId: null,
  });

  assert.equal(metadata.bank_account, "서강은행 999-000");
});

test("납부자 칩은 학번 앞 두 자리를 기수로 읽어 '기수 이름'으로 표시한다", () => {
  assert.equal(
    formatActivityParticipant({ id: 4, name: "김서강", major: "AI", student_number: "A74001" }),
    "74기 김서강",
  );
});

test("기수 규칙에 맞지 않는 학번은 학번을 숨기고 이름 전공 표기로 대체한다", () => {
  assert.equal(
    formatActivityParticipant({ id: 5, name: "김서강", major: "AI", student_number: "B74001" }),
    "김서강 AI",
  );
});

test("현재 활동인증 metadata의 납부자 ID와 이름을 수정 칩으로 복원한다", () => {
  assert.deepEqual(activityParticipantsFromMetadata({
    participants: "김서강, 이서강",
    participant_dues_payer_ids: [4, 7],
  }), [
    { id: 4, name: "김서강", persisted: true },
    { id: 7, name: "이서강", persisted: true },
  ]);
});

test("기존 회원 기반 참가자는 납부자 ID로 오인하지 않고 레거시 칩으로 복원한다", () => {
  assert.deepEqual(activityParticipantsFromMetadata({
    participants: "72기 김서강, 73기 이서강",
    participant_user_ids: "4,7",
  }), [
    { id: -1, name: "72기 김서강", legacy: true, persisted: true },
    { id: -2, name: "73기 이서강", legacy: true, persisted: true },
  ]);
});

test("현재 명부에서 선택한 참가자만 납부자 ID 배열로 저장한다", () => {
  const metadata = buildActivityCertificationMetadata({
    existingMetadata: {
      participants: "기존 참가자",
      participant_user_ids: "2",
      bank_account: "서강은행 123",
      custom_key: "keep",
    },
    activityDate: "2026.08.15",
    participants: "김서강 AI A74001, 이서강 보안 A74002",
    bankAccount: "",
    selectedParticipants: [
      { id: 4, name: "김서강", major: "AI", student_number: "A74001" },
      { id: 7, name: "이서강", major: "보안", student_number: "A74002" },
    ],
    activitySourcePostId: 10,
  });

  assert.deepEqual(metadata, {
    activity_date: "2026.08.15",
    participants: "김서강 AI A74001, 이서강 보안 A74002",
    participant_dues_payer_ids: [4, 7],
    activity_source_post_id: "10",
    bank_account: "서강은행 123",
    custom_key: "keep",
  });
});

test("선택을 바꾸지 않은 기존 참가자는 레거시 스냅샷을 그대로 보존한다", () => {
  const existingMetadata = {
    participants: "72기 김서강, 73기 이서강",
    participant_user_ids: "4,7",
  };
  const selectedParticipants = activityParticipantsFromMetadata(existingMetadata);

  assert.equal(activityParticipantSelectionError(selectedParticipants, existingMetadata), null);
  assert.deepEqual(buildActivityCertificationMetadata({
    existingMetadata,
    activityDate: "2026.08.15",
    participants: "72기 김서강, 73기 이서강",
    bankAccount: "",
    selectedParticipants,
    activitySourcePostId: null,
  }), {
    activity_date: "2026.08.15",
    participants: "72기 김서강, 73기 이서강",
    participant_user_ids: "4,7",
  });
});

test("기존 회원 기반 참가자 구성을 바꾸면 명부에서 전원 재선택하도록 막는다", () => {
  const existingMetadata = { participants: "기존 참가자", participant_user_ids: "2" };
  const mixed = [
    ...activityParticipantsFromMetadata(existingMetadata),
    { id: 7, name: "김서강", major: "AI", student_number: "A74001" },
  ];

  assert.match(activityParticipantSelectionError(mixed, existingMetadata) ?? "", /전원을 다시 선택/);
  assert.equal(activityParticipantSelectionError([
    { id: 7, name: "김서강", major: "AI", student_number: "A74001" },
  ], existingMetadata), null);
});

test("잘못된 활동 소스 ID는 수정 초기값으로 사용하지 않는다", () => {
  assert.equal(activitySourcePostIdFromMetadata({ activity_source_post_id: "0" }), null);
  assert.equal(activitySourcePostIdFromMetadata({ activity_source_post_id: "not-a-number" }), null);
  assert.equal(activitySourcePostIdFromMetadata(undefined), null);
});

test("동아리 활동 인증 태그는 운영진이 수정한 현재 동아리명을 우선한다", () => {
  assert.equal(
    activityCertificationBadgeLabel(
      { activity_source_title: "서강의 봄", category: "예전 동아리명" },
      "club-activity",
    ),
    "서강의 봄",
  );
});

test("동아리 활동 인증 태그는 연결이 없으면 구체적인 기존 이름으로 대체한다", () => {
  assert.equal(
    activityCertificationBadgeLabel(
      { category: "동아리 활동 인증", metadata: { legacy_activity_name: "서뽈링" } },
      "club-activity",
    ),
    "서뽈링",
  );
  assert.equal(
    activityCertificationBadgeLabel({ category: "활동 인증" }, "club-activity"),
    "동아리 활동 인증",
  );
});

test("스터디와 네트워킹 활동 인증 태그의 기존 분류는 유지한다", () => {
  assert.equal(
    activityCertificationBadgeLabel({ category: "스터디 활동 인증" }, "study-activity"),
    "스터디 활동 인증",
  );
  assert.equal(
    activityCertificationBadgeLabel({ category: "멘토링" }, "networking-activity"),
    "멘토링",
  );
});

test("활동 인증의 원본 선택 목록은 공개된 운영진 게시글만 요청한다", () => {
  assert.deepEqual(activitySourcePostFilters(), { sort: "latest", status: "published" });
});

test("동아리 원본 글은 실제 pagination 계약을 따라 공개 글의 모든 페이지를 읽는다", async () => {
  const calls: { boardId: number; page: number; size: number; filters?: object }[] = [];
  const pages = new Map([
    [1, {
      status: "success" as const,
      data: [{ id: 51, title: "SG_LLM (이전)", created_at: "2026-01-01T00:00:00Z" }],
      pagination: { page: 1, size: 2, total: 5, total_pages: 3 },
    }],
    [2, {
      status: "success" as const,
      data: [{ id: 52, title: "SG_LLM (현재)", created_at: "2026-08-01T00:00:00Z" }],
      pagination: { page: 2, size: 2, total: 5, total_pages: 3 },
    }],
    [3, {
      status: "success" as const,
      data: [{ id: 53, title: "과거 동아리", created_at: "2026-08-02T00:00:00Z" }],
      pagination: { page: 3, size: 2, total: 5, total_pages: 3 },
    }],
  ]);

  const posts = await loadAllPublishedActivitySourcePosts(
    9,
    async (boardId, page, size, filters) => {
      calls.push({ boardId, page, size, filters });
      const response = pages.get(page);
      assert.ok(response);
      return response;
    },
    2,
  );

  assert.deepEqual(posts.map((post) => post.id), [51, 52, 53]);
  assert.deepEqual(calls, [
    { boardId: 9, page: 1, size: 2, filters: { sort: "latest", status: "published" } },
    { boardId: 9, page: 2, size: 2, filters: { sort: "latest", status: "published" } },
    { boardId: 9, page: 3, size: 2, filters: { sort: "latest", status: "published" } },
  ]);
});

test("페이지 응답이 진행하지 않으면 동아리 원본 조회를 안전하게 중단한다", async () => {
  let callCount = 0;
  const posts = await loadAllPublishedActivitySourcePosts(
    9,
    async () => {
      callCount += 1;
      return {
        status: "success" as const,
        data: [{ id: callCount, title: "SG_LLM", created_at: "2026-01-01T00:00:00Z" }],
        pagination: { page: 1, size: 1, total: 3, total_pages: 3 },
      };
    },
    1,
  );

  assert.equal(callCount, 2);
  assert.deepEqual(posts.map((post) => post.id), [1, 2]);
});

test("비어 있는 페이지를 받으면 잘못된 다음 페이지 수와 무관하게 조회를 중단한다", async () => {
  let callCount = 0;
  const posts = await loadAllPublishedActivitySourcePosts(
    9,
    async () => {
      callCount += 1;
      if (callCount > 1) throw new Error("empty page must stop pagination");
      return {
        status: "success" as const,
        data: [],
        pagination: { page: 1, size: 50, total: 5, total_pages: 3 },
      };
    },
  );

  assert.equal(callCount, 1);
  assert.deepEqual(posts, []);
});

test("스터디·네트워킹 원본 선택은 기존처럼 첫 페이지만 조회한다", async () => {
  const calls: number[] = [];
  const posts = await loadPublishedActivitySourcePosts(
    11,
    "study-recruit",
    async (_boardId, page) => {
      calls.push(page);
      return {
        status: "success" as const,
        data: [{ id: 91, title: "스터디 모집", created_at: "2026-08-01T00:00:00Z" }],
        pagination: { page: 1, size: 50, total: 70, total_pages: 2 },
      };
    },
  );

  assert.deepEqual(calls, [1]);
  assert.deepEqual(posts.map((post) => post.id), [91]);
});

test("운영 종료만 제외하고 모집 마감·기존 동아리는 모든 페이지에서 선택할 수 있다", async () => {
  const posts = await loadPublishedActivitySourcePosts<Pick<PostListItem, "id" | "title" | "created_at" | "category" | "metadata">>(9, "club-promo", async (_id, page) => ({
    status: "success",
    data: page === 1
      ? [{ id: 1, title: "운영이 종료된 동아리", created_at: "2026-09-17", category: "모집중", metadata: { club_operation_status: "ended" } }]
      : [
          { id: 2, title: "모집 마감 후 활동 중", created_at: "2026-09-16", category: "마감", metadata: { club_operation_status: "active", recruitment_status: "closed" } },
          { id: 3, title: "설정 전부터 운영 중인 동아리", created_at: "2026-09-15", category: "상시", metadata: {} },
        ],
    pagination: { page, size: 2, total: 3, total_pages: 2 },
  }));
  assert.deepEqual(posts.map((post) => post.id), [2, 3]);
});

test("고른 참가자의 납부 여부가 유지되어 칩도 검색 목록과 같은 색이 된다", () => {
  const unpaid = { id: 7, name: "한다현", is_paid_for_board: false };
  const paid = { id: 8, name: "김민석", is_paid_for_board: true };
  assert.equal(activityParticipantTextColor(unpaid), activityCertification.ACTIVITY_PARTICIPANT_UNPAID_COLOR);
  assert.equal(activityParticipantTextColor(paid), activityCertification.ACTIVITY_PARTICIPANT_PAID_COLOR);
});

test("납부 여부를 모르면 납부자 색으로 둔다", () => {
  // 메타데이터만 있는 예전 글은 납부 여부가 없다. 회색으로 잘못 칠하면 안 된다.
  assert.equal(activityParticipantTextColor({}), activityCertification.ACTIVITY_PARTICIPANT_PAID_COLOR);
  assert.equal(
    activityParticipantTextColor({ is_paid_for_board: null }),
    activityCertification.ACTIVITY_PARTICIPANT_PAID_COLOR,
  );
});

test("저장된 참가자에 글 상세의 납부 여부를 id로 채운다", () => {
  const stored: activityCertification.ActivityParticipant[] = [
    { id: 7, name: "한다현", persisted: true },
    { id: 8, name: "김민석", persisted: true },
  ];
  const filled = activityCertification.withParticipantDuesState(stored, [
    { id: 7, is_paid_for_board: false },
    { id: 8, is_paid_for_board: true },
  ]);
  assert.equal(filled[0].is_paid_for_board, false);
  assert.equal(filled[1].is_paid_for_board, true);
  // 원본을 건드리지 않는다.
  assert.equal(stored[0].is_paid_for_board, undefined);
});

test("상세에 없는 참가자와 id 없는 항목은 그대로 둔다", () => {
  const stored = [{ id: -1, name: "옛날 참가자", legacy: true }];
  assert.deepEqual(activityCertification.withParticipantDuesState(stored, [{ id: null, is_paid_for_board: false }]), stored);
  assert.deepEqual(activityCertification.withParticipantDuesState(stored, []), stored);
  assert.deepEqual(activityCertification.withParticipantDuesState(stored, null), stored);
});
