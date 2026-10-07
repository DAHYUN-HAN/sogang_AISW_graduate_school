import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const postCardSource = readFileSync("components/PostCard.tsx", "utf8");
const postDetailSource = readFileSync("app/(tabs)/(home,notices,community,participation,council)/board/post/[postId].tsx", "utf8");
const postCreateSource = readFileSync("app/(tabs)/(home,notices,community,participation,council)/board/post/create.tsx", "utf8");
const boardDetailSource = readFileSync("app/(tabs)/(home,notices,community,participation,council)/board/[boardId].tsx", "utf8");
const homeSource = readFileSync("app/(tabs)/(home,notices,community,participation,council)/home.tsx", "utf8");
const communitySource = readFileSync("app/(tabs)/(home,notices,community,participation,council)/community.tsx", "utf8");
const loginSource = readFileSync("app/auth/login.tsx", "utf8");

test("#14·15 행사 사진첩 더보기는 커뮤니티를 행사 사진첩 기본 상태로 다시 연다", () => {
  assert.match(
    homeSource,
    /<SectionHeader\s+title="행사 사진첩"[\s\S]*?requestTabRootReset\("community"\)[\s\S]*?navigateToTabRoot\("community"\)[\s\S]*?\/>/,
  );
  assert.doesNotMatch(
    homeSource,
    /title="행사 사진첩"[\s\S]*?onPress=\{\(\) => router\.push\(COMMUNITY_TAB_ROUTE as never\)\}/,
  );
  assert.match(communitySource, /<BoardPostsScreen initialBoardId=\{initialBoard\.id\} isTabRoot \/>/);
});

test("#16 전공 커뮤니티 상세는 목록으로 복귀하고 전체 보드 탭을 사용하지 않는다", () => {
  assert.doesNotMatch(boardDetailSource, /\/\(tabs\)\/boards/);
  assert.doesNotMatch(homeSource, /\/\(tabs\)\/boards/);
  assert.match(boardDetailSource, /postDetailRoute\(postId, boardId, detailReturnRoute\)/);
  // 돌아갈 목록이 탭 첫 화면이면 그 탭 스택으로 옮기는 공통 이동기를 쓴다.
  assert.match(postDetailSource, /navigate: navigateToRoute/);
  assert.match(postDetailSource, /onPress=\{handlePostBack\}/);
  assert.match(postDetailSource, /BackHandler\.addEventListener\("hardwareBackPress"/);
  assert.match(boardDetailSource, /BackHandler\.addEventListener\("hardwareBackPress"/);
});

test("#19 진행중 태그는 초록색 표현을 사용한다", () => {
  assert.match(postCardSource, /label\.includes\("진행"\).*#EAF3DE.*#3B6D11/);
});

test("#22 활동인증 날짜는 공통 YY.MM.DD 형식기를 사용한다", () => {
  assert.match(postCreateSource, /field\.value \? formatBoardDate\(field\.value\) : "활동일을 선택하세요"/);
  assert.match(postDetailSource, /formatBoardDate\(metadata\.activity_date\)/);
});

test("#27 상조회 목록은 처리중·완료·반려 상태를 표시한다", () => {
  assert.match(postCardSource, /processing: "처리중"/);
  assert.match(postCardSource, /completed: "완료"/);
  assert.match(postCardSource, /rejected: "반려"/);
});

test("#52 로그인 비밀번호 입력창은 Enter로 로그인을 실행한다", () => {
  assert.match(loginSource, /onSubmitEditing=\{\(\) => void handleLogin\(\)\}/);
  assert.match(loginSource, /returnKeyType="go"/);
  assert.match(loginSource, /submitBehavior="submit"/);
});

test("#53 댓글 입력창은 Enter로 댓글을 등록한다", () => {
  assert.match(postDetailSource, /onKeyPress=\{handleCommentKeyPress\}/);
  assert.match(postDetailSource, /onSubmitEditing=\{Platform\.OS === "web" \? undefined : handleCreateComment\}/);
  assert.match(postDetailSource, /returnKeyType="send"/);
  assert.match(postDetailSource, /submitBehavior=\{Platform\.OS === "web" \? "newline" : "submit"\}/);
  assert.match(postDetailSource, /commentSubmitLockRef\.current/);
});

test("#32 회원 화면은 반려 사유를 분홍색 박스로 표시한다", () => {
  assert.match(postDetailSource, /post\.mutual_aid\?\.rejection_reason && !isAdmin/);
  assert.match(postDetailSource, /mutualAidRejectionBox:[\s\S]*backgroundColor: COLORS\.pink50/);
});

test("#177 시험족보 목록은 작성자를 표시하고 기존 익명 게시판 정책은 유지한다", () => {
  assert.doesNotMatch(postCardSource, /isExamArchive/);
  assert.match(postCardSource, /const showAuthor = !isLectureReview && !isSuggestion;/);
});

test("#204 공통 글쓰기 화면은 라우트의 게시판·글·카테고리가 바뀌면 폼 전체를 새로 마운트한다", () => {
  assert.match(postCreateSource, /<PostCreateForm key=\{postCreateFormInstanceKey\(params\)\} params=\{params\} \/>/);
  assert.doesNotMatch(postCreateSource, /key=\{postCreateFormInstanceKey\(\{[\s\S]*selectedBoardId/);
});
