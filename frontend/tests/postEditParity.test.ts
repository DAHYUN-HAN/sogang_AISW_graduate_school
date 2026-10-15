import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RESOURCE_RATING_FIELDS,
  resourcePostFields,
  withResourcePostMetadata,
} from "../utils/resourcePostFields";

// 글 수정은 따로 있던 수정 화면을 없애고 글쓰기 화면(create.tsx)의 수정 모드(postId 있음)로 합쳤다.
// 같은 코드가 작성·수정을 모두 그리므로, 여기서는 수정 모드에만 있는 갈래가 살아 있는지 본다.
const createSource = readFileSync("app/(tabs)/(home,notices,community,participation,council)/board/post/create.tsx", "utf8");

test("등급 입력 정의는 작성·수정이 같은 것을 쓴다", () => {
  // 각자 선언하면 라벨이나 순서가 조용히 갈라진다.
  assert.deepEqual(RESOURCE_RATING_FIELDS.map((field) => field.name), ["difficulty", "satisfaction"]);
  assert.match(createSource, /RESOURCE_RATING_FIELDS/);
  assert.doesNotMatch(createSource, /const RESOURCE_RATING_FIELDS = \[/);
});

test("수정 화면도 강의후기 과목정보를 보여주고 되돌려놓는다", () => {
  assert.match(createSource, /name="professor"/);
  assert.match(createSource, /RESOURCE_RATING_FIELDS\.filter\(\(rating\) => resourceFields\?\.\[rating\.name\]\)/);
  // 저장 전에 기존 값을 폼에 채워놓지 않으면 수정할 때 유실된다.
  assert.match(createSource, /\.\.\.resourcePostFieldValues\(resourceFields, metadata\)/);
  // 게시판이 정해진 뒤에 채워야 게시판별 추가 입력이 빈 값으로 덮이지 않는다.
  assert.match(createSource, /if \(!postId \|\| !existingPost \|\| !board \|\| hydratedPostId\.current === postId\) return;/);
  // 옮겨갈 게시판 기준으로 받을 항목을 정한다(board는 고른 게시판이 있으면 그쪽이다).
  assert.match(createSource, /const boardId = selectedBoardId \|\| existingPost\?\.board_id \|\| 0;/);
  assert.match(createSource, /const resourceFields = resourcePostFields\(board\?\.slug\);/);
});

test("수정 저장은 과목정보를 저장된 metadata 위에 담는다", () => {
  // 서버가 metadata를 통째로 바꾸므로 저장된 값 위에 덮어써야 화면에 없는 값이 남는다.
  assert.match(createSource, /withResourcePostMetadata\(existingPost\?\.metadata, resourceFields, values\)/);
  assert.match(createSource, /return existingPost \|\| Object\.keys\(metadata\)\.length > 0 \? metadata : undefined;/);
});

test("수정 저장은 게시판을 옮겼을 때만 board_id를 보내고 익명 여부는 그대로 둔다", () => {
  assert.match(createSource, /board_id: existingPost && boardId !== existingPost\.board_id \? boardId : undefined,/);
  assert.match(createSource, /is_anonymous: existingPost\?\.is_anonymous \?\? isSuggestion,/);
});

test("새 글의 기본 분류는 수정할 때 저장된 값을 덮지 않는다", () => {
  // 마감된 스터디 모집글을 수정하러 들어오면 진행중으로 바뀌던 문제를 막는다.
  assert.match(createSource, /useEffect\(\(\) => \{\s*if \(postId\) return;\s*if \(isStudyRecruit/);
});

test("수정 화면 제목과 완료 버튼은 피그마 수정 화면을 따른다", () => {
  assert.match(createSource, /screenTitle: postId \? \(isMutualAid \? "상조회 신청 수정" : isActivity \? "활동 인증 수정" : isSuggestion \? "건의사항 수정" : isStudyRecruit \? "스터디 모집" : "글 수정"\)/);
  assert.match(createSource, /const submitLabel = postId\s*\? "완료"/);
});

test("수정 저장에 실패하면 수정 실패 토스트를 띄운다", () => {
  assert.match(createSource, /showToast\(postId \? TOAST_ERROR_MESSAGES\.postEdit : TOAST_MESSAGES\.error\);/);
});

test("게시판을 옮기면 새 게시판이 쓰지 않는 과목정보는 남지 않는다", () => {
  const lecture = { professor_name: "김서강", lecture_difficulty: "상", lecture_satisfaction: "중", contact: "010" };
  // 강의후기 -> 시험족보: 교수명만 유지되고 난이도·만족도는 사라진다.
  const moved = withResourcePostMetadata(lecture, resourcePostFields("exam-archive"), {
    professor: "김서강", difficulty: "상", satisfaction: "중",
  });
  assert.deepEqual(moved, { professor_name: "김서강", contact: "010" });
});

test("과목정보와 무관한 metadata는 건드리지 않는다", () => {
  const kept = withResourcePostMetadata({ application_url: "https://a.b", contact: "010" }, null, {});
  assert.deepEqual(kept, { application_url: "https://a.b", contact: "010" });
});

test("수정 화면도 비어 있는 필수 칸을 한 번에 모아 테두리와 토스트로 알린다", () => {
  assert.match(createSource, /const missing: \(keyof FormValues\)\[\] = \[\]/);
  assert.match(createSource, /for \(const name of missing\) setError\(name, \{ message: "" \}\)/);
  assert.match(createSource, /TOAST_MESSAGES\.requiredFieldError/);
  // 칸 아래 빨간 문구는 띄우지 않는다. message를 비워 테두리만 남긴다.
  assert.match(createSource, /setError\(name, \{ message: "" \}\)/);
  // 값을 고치면 바로 풀린다.
  assert.match(createSource, /const clearOnChange = \(name: keyof FormValues/);
  for (const name of ["title", "content", "professor", "contact"]) {
    assert.ok(createSource.includes(`clearOnChange("${name}"`), `${name} 해제 누락`);
  }
});

test("수정 화면 오류 테두리는 작성 화면과 같은 규칙이다", () => {
  // 입력 칸 공통 원칙(FieldBorder): 오류 1px #D64545, 분홍 배경 없음.
  assert.match(createSource, /<FormTextInput\s*\n\s*onChangeText=\{clearOnChange\("title", field\.onChange\)\}[\s\S]{0,200}hasError=\{Boolean\(fieldState\.error\)\}/);
  assert.match(createSource, /borderOnlyError: \{\s*\.\.\.FIELD_BORDER\.error,/);
  assert.doesNotMatch(createSource, /backgroundColor: COLORS\.danger50/);
});

test("내용 안내 문구는 작성·수정이 같다", () => {
  for (const text of ["원우회에 건의하고 싶은 내용을 자유롭게 작성해 주세요", "스터디 내용, 진행 요일/시간 등을 입력하세요"]) {
    assert.ok(createSource.includes(`"${text}"`), text);
  }
});

test("내용 칸을 누르면 첨부 버튼까지 드러나게 스크롤한다", () => {
  assert.match(createSource, /onFocus=\{\(\) => \{ revealTarget\.current = "attach"; revealFocusedBlock\(\); \}\}/);
  assert.match(createSource, /onLayout=\{\(event\) => \{ attachSectionTop\.current = event\.nativeEvent\.layout\.y; \}\}/);
  assert.match(createSource, /formScrollHeight\.current = event\.nativeEvent\.layout\.height;\s*revealFocusedBlock\(\);/);
});

test("스터디 모집 연락수단은 작성·수정 모두 필수가 아니다", () => {
  assert.doesNotMatch(createSource, /requireField\("contact"/);
});

test("수정 중 나가면 확인창을 띄우고, 저장 후에는 묻지 않는다", () => {
  assert.match(createSource, /<DiscardWriteModal\s+visible=\{discardPromptOpen\}\s+mode=\{postId \? "edit" : "create"\}/);
  assert.match(createSource, /if \(hasUnsavedChanges\) \{\s*setDiscardPromptOpen\(true\);/);
  // 저장 성공은 확인창을 거치지 않는다. 저장해도 폼은 기준선과 달라
  // hasUnsavedChanges가 참으로 남으므로, submitted로 잠금을 먼저 푼 뒤
  // 다음 렌더에서 옮긴다. 같은 틱에 옮기면 usePreventRemove가 이전 값을 들고 있다.
  assert.match(createSource, /usePreventRemove\(hasUnsavedChanges && !submitted && !removeConfirmed/);
  assert.match(createSource, /updateMutation\.mutate\(payload, \{\s*onSuccess: \(\) => \{[\s\S]*?setSubmitted\(true\);/);
  assert.match(createSource, /pendingSubmitNavigation\.current = \(\) => navigateAfterPostEdit\(decision,/);
  assert.match(createSource, /if \(!submitted\) return;[\s\S]*?go\?\.\(\);/);
  // 첨부와 게시판 이동도 변경으로 센다. 기준선은 불러온 글의 값이다.
  assert.match(createSource, /unsavedBaseline\.current\.attachmentIds/);
  assert.match(createSource, /attachmentIds: existingPost\.attachments\.map\(\(attachment\) => attachment\.id\)\.join\(","\),/);
  assert.match(createSource, /Boolean\(existingPost && boardId !== existingPost\.board_id\);/);
});
