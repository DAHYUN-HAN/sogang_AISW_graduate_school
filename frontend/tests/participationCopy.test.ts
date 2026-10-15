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

// 2026-10-12 사용자 결정: 옮겨 온 활동 인증 글은 수정하지 않으니 참가자 재선택 토스트는 두지 않는다.
test("활동 인증 저장에 기존 회원 기반 참가자 토스트가 없다", () => {
  assert.doesNotMatch(create, /기존 회원 기반 참가자를 변경하려면/);
});

// 2026-10-12 사용자 요청: 피그마 Council/SuggestionEdit와 같게 건의사항 수정 화면을 맞춘다.
// 글 수정은 글쓰기 화면(create.tsx)의 수정 모드에서 한다. 피그마 수정 화면 버튼은 모두 "완료"다.
test("건의사항 수정은 익명 안내·한 줄 제목·완료 버튼을 쓴다", () => {
  assert.match(create, /isSuggestion \? "건의사항 수정" : isStudyRecruit \? "스터디 모집" : "글 수정"/);
  assert.match(create, /해당 건의사항은 익명으로 등록되며, 작성자는 노출되지 않아요/);
  // 2026-10-15: 제목 칸은 모든 게시판에서 작성 화면처럼 한 줄이다.
  assert.match(create, /<FormTextInput\s*\n\s*onChangeText=\{clearOnChange\("title", field\.onChange\)\}/);
  const titleInput = create.slice(create.indexOf('onChangeText={clearOnChange("title"'), create.indexOf("</FormField>", create.indexOf('onChangeText={clearOnChange("title"')));
  assert.doesNotMatch(titleInput, /multiline/);
  assert.match(create, /const submitLabel = postId\s*\? "완료"/);
});

// 2026-10-12 사용자 요청: 피그마 MyPage/ProfilePhotoSelect처럼 마지막 항목 아래 구분선이 없다.
test("프로필 사진 시트의 마지막 항목은 구분선이 없다", () => {
  const profile = readFileSync("app/(tabs)/(home,notices,community,participation,council)/settings/profile.tsx", "utf8");
  assert.match(profile, /style=\{\[styles\.modalOption, styles\.modalOptionLast\]\}\s*>\s*<Text style=\{styles\.modalOptionText\}>기본 이미지 적용<\/Text>/);
});

// 2026-10-12 사용자 결정: 다른 안내와 같은 "~어요" 말투로 맞춘다.
test("활동 선택 시트가 비면 '선택할 수 있는 활동이 없어요'를 보인다", () => {
  assert.match(create, /emptyText="선택할 수 있는 활동이 없어요"/);
});

// 2026-10-12 사용자 결정: 활동 선택 시트는 "활동 대상을 불러오는 중입니다." 대신 피그마 공통 로딩을 쓴다.
test("활동 선택 시트는 목록을 받는 동안 공통 로딩을 보인다", () => {
  const sheet = readFileSync("components/SelectionSheet.tsx", "utf8");
  assert.match(create, /loading=\{activitySourceQuery\.isLoading\}/);
  assert.doesNotMatch(create, /활동 대상을 불러오는 중입니다/);
  assert.match(sheet, /options\.length === 0 && loading \? <LoadingState compact \/>/);
});

// 2026-10-12 사용자 결정: 게시판 선택 시트도 활동 선택 시트와 같은 방식으로 맞춘다.
test("게시판 선택 시트는 받는 동안 공통 로딩, 비면 '선택할 수 있는 게시판이 없어요'를 보인다", () => {
  assert.match(create, /emptyText="선택할 수 있는 게시판이 없어요"\r?\n\s+loading=\{isBoardsLoading\}/);
  assert.doesNotMatch(create, /게시판을 불러오는 중입니다/);
});
