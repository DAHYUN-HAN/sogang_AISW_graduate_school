import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const board = readFileSync("app/(tabs)/(home,notices,community,participation,council)/board/[boardId].tsx", "utf8");
const create = readFileSync("app/(tabs)/(home,notices,community,participation,council)/board/post/create.tsx", "utf8");

// 2026-10-12 사용자 요청: 피그마 Activity/List-*VerifyEmpty 문구를 동아리·스터디·네트워킹 활동 인증에 같이 쓴다.
test("활동 인증 목록이 비면 피그마 문구를 보인다", () => {
  assert.match(board, /isActivityCards \? "등록된 활동인증이 없어요"/);
  assert.match(board, /isActivityCards \? "첫 활동을 인증해보세요"/);
});

// 2026-10-12 사용자 요청: 피그마 Activity/Verify-Network 선택 칸 문구.
test("네트워킹 활동 인증 선택 칸은 네트워킹명을 묻는다", () => {
  assert.match(create, /return "네트워킹명을 선택하세요";/);
});

// 2026-10-12 사용자 결정: 달력이 오늘 이후 날짜를 막으니 저장 때 다시 확인하는 토스트는 두지 않는다.
test("활동 인증은 달력으로만 미래 날짜를 막는다", () => {
  assert.match(create, /maximumDate=\{maximumActivityCertificationDate\(\)\}/);
  assert.doesNotMatch(create, /오늘 이후 날짜는 선택할 수 없어요/);
});

// 2026-10-12 사용자 요청: 피그마 Council/SuggestionEdit와 같게 건의사항 수정 화면을 맞춘다.
test("건의사항 수정은 익명 안내·한 줄 제목·수정 완료 버튼을 쓴다", () => {
  const edit = readFileSync("app/(tabs)/(home,notices,community,participation,council)/board/post/edit/[postId].tsx", "utf8");
  assert.match(edit, /isSuggestion \? "건의사항 수정" : "글 수정"/);
  assert.match(edit, /해당 건의사항은 익명으로 등록되며, 작성자는 노출되지 않아요/);
  assert.match(edit, /multiline=\{!isStudyRecruit && !isSuggestion\}/);
  assert.match(edit, /isSuggestion \? "수정 완료" : "완료"/);
});

// 2026-10-12 사용자 요청: 피그마 MyPage/ProfilePhotoSelect처럼 마지막 항목 아래 구분선이 없다.
test("프로필 사진 시트의 마지막 항목은 구분선이 없다", () => {
  const profile = readFileSync("app/(tabs)/(home,notices,community,participation,council)/settings/profile.tsx", "utf8");
  assert.match(profile, /style=\{\[styles\.modalOption, styles\.modalOptionLast\]\}\s*>\s*<Text style=\{styles\.modalOptionText\}>기본 이미지 적용<\/Text>/);
});
