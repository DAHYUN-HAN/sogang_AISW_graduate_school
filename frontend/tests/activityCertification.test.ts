import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVITY_PARTICIPANT_GUIDANCE,
  CURRENT_CLUB_NAMES,
  activityBankAccountFieldState,
  activityCertificationBadgeLabel,
  activityCertificationPreview,
  activityParticipantSelectionError,
  activityParticipantsFromMetadata,
  activitySourcePostFilters,
  activityCertificationCardTitle,
  currentClubActivitySourcePosts,
  loadAllPublishedActivitySourcePosts,
  loadPublishedActivitySourcePosts,
  shouldShowActivityCertificationBadge,
  activitySourcePostIdFromMetadata,
  buildActivityCertificationMetadata,
  formatActivityParticipant,
} from "../utils/activityCertification";

test("참가자 안내는 이름 색상 구분과 본인 추가를 설명한다", () => {
  assert.match(ACTIVITY_PARTICIPANT_GUIDANCE, /검정 납부 · 회색 미납 · 주황 1회 납부\(5만원\)/);
  assert.match(ACTIVITY_PARTICIPANT_GUIDANCE, /본인도 검색해서 추가해주세요/);
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


test("활동 인증 작성 계좌는 필수이고 수정 계좌는 새 값만 선택 입력한다", () => {
  assert.deepEqual(activityBankAccountFieldState(null), {
    required: true,
    placeholder: "은행 / 계좌번호를 입력하세요",
    guidance: "계좌는 본인 명의로만 등록 가능해요",
  });
  assert.deepEqual(activityBankAccountFieldState(503), {
    required: false,
    placeholder: "새 계좌번호를 입력하면 변경돼요",
    guidance: "기존 계좌는 표시되지 않아요. 변경할 경우 새 계좌를 입력해주세요.",
  });
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

test("동아리 활동 인증 선택창은 현재 7개 동아리만 공식 순서로 반환한다", () => {
  const posts = [
    { id: 90, title: "예전 볼링 동아리" },
    { id: 17, title: "FC리턴윈 (풋살)" },
    { id: 16, title: "인간지능투자 (주식/코인)" },
    { id: 15, title: "서강와인 (와인/위스키)" },
    { id: 14, title: "서뽈링 (볼링)" },
    { id: 13, title: "서강의 봄(등산)" },
    { id: 12, title: "알바트로스냅(사진)" },
    { id: 11, title: "SG_LLM (LLM구축)" },
  ];

  assert.deepEqual(CURRENT_CLUB_NAMES, [
    "SG_LLM", "알바트로스냅", "서강의 봄", "서뽈링", "서강와인", "인간지능투자", "FC리턴윈",
  ]);
  assert.deepEqual(currentClubActivitySourcePosts(posts).map((post) => post.id), [11, 12, 13, 14, 15, 16, 17]);
});

test("현재 동아리 이름의 경계를 확인하고 최신 글 하나만 선택한다", () => {
  const posts = [
    { id: 31, title: "서뽈링 (현재)" },
    { id: 30, title: "서뽈링 (이전 중복)" },
    { id: 29, title: "서뽈링연합" },
    { id: 28, title: "[종료] 서뽈링" },
  ];

  assert.deepEqual(currentClubActivitySourcePosts(posts), [{ id: 31, title: "서뽈링 (현재)" }]);
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

test("고정된 예전 글보다 created_at이 최신인 중복 글을 선택하고 같은 시각에는 큰 ID를 사용한다", () => {
  const posts = [
    { id: 70, title: "서뽈링 (고정된 예전 글)", created_at: "2025-03-01T00:00:00Z", is_pinned: true },
    { id: 71, title: "서뽈링 (새 안내)", created_at: "2026-08-01T00:00:00Z", is_pinned: false },
    { id: 80, title: "FC리턴윈 (낮은 ID)", created_at: "2026-08-02T00:00:00Z", is_pinned: true },
    { id: 81, title: "FC리턴윈 (높은 ID)", created_at: "2026-08-02T00:00:00Z", is_pinned: false },
  ];

  assert.deepEqual(currentClubActivitySourcePosts(posts).map((post) => post.id), [71, 81]);
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
