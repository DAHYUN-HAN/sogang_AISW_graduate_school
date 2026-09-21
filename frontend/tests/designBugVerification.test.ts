import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

const styleBlock = (fileSource: string, styleName: string) => {
  const match = fileSource.match(new RegExp(`${styleName}: \\{([\\s\\S]*?)\\n  \\},`));
  assert.ok(match, `${styleName} 스타일을 찾을 수 없습니다.`);
  return match[1];
};

const tabLayoutSource = source("app/(tabs)/_layout.tsx");
const homeSource = source("app/(tabs)/home.tsx");
const noticeListSource = source("app/(tabs)/notices.tsx");
const boardSource = source("app/(tabs)/board/[boardId].tsx");
const postDetailSource = source("app/(tabs)/board/post/[postId].tsx");
const postCreateSource = source("app/(tabs)/board/post/create.tsx");
const postEditSource = source("app/(tabs)/board/post/edit/[postId].tsx");
const mutualAidCompleteSource = source("app/(tabs)/council/mutual-aid-complete.tsx");
const searchSource = source("app/(tabs)/search.tsx");
const loginSource = source("app/auth/login.tsx");
const councilSource = source("app/(tabs)/council.tsx");
const schoolEmailSource = source("components/SchoolEmailInput.tsx");
const legalDocumentSource = source("components/LegalDocumentScreen.tsx");
const postCardSource = source("components/PostCard.tsx");
const fontSource = source("utils/fonts.ts");
const qaComposeSource = source("../docker-compose.qa.yml");

test("global font patch flattens styles before they reach React DOM", () => {
  assert.match(fontSource, /style: \{ \.\.\.hostStyle, fontFamily, fontWeight: "normal" \}/);
  assert.doesNotMatch(fontSource, /style: StyleSheet\.flatten\(\[\{ fontFamily \}, style\]\)/);
  assert.doesNotMatch(fontSource, /style: \[\{ fontFamily \}, style\]/);
});

test("QA frontend restart clears Metro before serving updated web styles", () => {
  assert.match(qaComposeSource, /npm run web -- --host lan --clear/);
});

test("QA 인증코드 재전송 제한은 운영과 같은 5분을 유지한다", () => {
  assert.match(qaComposeSource, /EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS: "300"/);
  assert.match(qaComposeSource, /PASSWORD_RESET_RESEND_COOLDOWN_SECONDS: "300"/);
});

test("#2 메인 배너는 설정된 목적지로 직접 이동한다", () => {
  assert.match(homeSource, /const linkHref = banner\.cta_href\?\.trim\(\)/);
  assert.match(homeSource, /router\.push\(linkHref as never\)/);
  assert.doesNotMatch(homeSource, /banner\/preview|banner\/detail/);
});

test("#66·67·68 홈과 하단 탭은 디자인 기준 아이콘과 정렬을 사용한다", () => {
  assert.match(tabLayoutSource, /<HomeTabIcon color=\{color\} size=\{22\} \/>/);
  assert.match(tabLayoutSource, /<NoticeTabIcon color=\{color\} size=\{22\} \/>/);
  assert.match(homeSource, /name="chatbubble-outline"/);
  assert.match(homeSource, /name="heart-outline"/);
  assert.match(homeSource, /dayText:[\s\S]*lineHeight: 16/);
  assert.match(homeSource, /dayText:[\s\S]*textAlign: "center"/);
  assert.match(homeSource, /name="chatbubble-outline" size=\{11\}/);
});

test("#5·6·7·11·18 공지와 스터디의 태그 문구 및 상태를 실제 메타데이터에서 만든다", () => {
  assert.match(searchSource, /label: "행사공지"/);
  assert.match(searchSource, /label: "기타공지"/);
  assert.match(postCardSource, /resourceCategoryLabel/);
  assert.match(postDetailSource, /label\.includes\("기타"\).*#F0EEF9.*#5A4C8B/);
  assert.match(postCardSource, /post\.metadata\?\.recruitment_status/);
  assert.match(postDetailSource, /metadata\.recruitment_status/);
});

test("#41·45 공지 상세 이미지는 가로 4:3·세로 4:5 고정 프레임이며 전체보기를 열지 않는다", () => {
  assert.match(postDetailSource, /const isNotice = board\?\.board_type === "notice" \|\| post\?\.is_notice === true/);
  assert.match(postDetailSource, /function NoticeAttachmentImage/);
  assert.match(postDetailSource, /noticeAttachmentFrameAspectRatio\(sourceAspectRatio\)/);
  assert.match(postDetailSource, /<MediaImage[\s\S]*resizeMode="contain"[\s\S]*style=\{styles\.noticeAttachmentImage\}/);
  assert.match(postDetailSource, /shouldOpenPostAttachment\(\{[\s\S]*isNotice,[\s\S]*contentType: attachment\.content_type/);
  assert.match(postDetailSource, /!canOpenAttachment \? \([\s\S]*<NoticeAttachmentImage key=\{attachment\.id\} media=\{attachment\} \/>/);
  assert.doesNotMatch(postDetailSource, /NOTICE_IMAGE_COLLAPSE_ASPECT|collapseNoticeImage|사진 전체보기/);
  assert.match(postDetailSource, /noticeAttachmentImage:[\s\S]*width: "100%"[\s\S]*height: "100%"/);
});

test("#29·31 상조회 입력 안내는 일반 굵기이고 상세 비고는 증빙서류 바로 앞에 표시된다", () => {
  const noteIndex = postDetailSource.indexOf(">비고</Text>");
  const evidenceIndex = postDetailSource.indexOf(">증빙서류</Text>");
  assert.ok(noteIndex >= 0, "상조회 상세의 비고 부제를 찾을 수 없습니다.");
  assert.ok(evidenceIndex >= 0, "상조회 상세의 증빙서류 부제를 찾을 수 없습니다.");
  assert.ok(noteIndex < evidenceIndex, "비고는 증빙서류보다 먼저 표시되어야 합니다.");
  assert.match(postDetailSource, /!isMutualAidRequest && post\.content\.trim\(\)/);
  assert.match(postCreateSource, /placeholderTextColor="#A6ACB7"/);
  assert.match(postCreateSource, /input:[\s\S]*fontWeight: "400"/);
});

test("#48 완료 화면은 공통 CompletionState를 공유한다", () => {
  assert.match(postCreateSource, /<CompletionState/);
  assert.match(mutualAidCompleteSource, /<CompletionState/);
});

test("#38·39 기본 프로필과 개인정보 동의 상태는 임의 값을 만들지 않는다", () => {
  assert.match(legalDocumentSource, /Boolean\(consentLabel\)/);
  assert.doesNotMatch(legalDocumentSource, /consentLabel \|\|/);
});

test("#59·60·61 로그인 입력은 웹 네이티브 이메일 검증과 기본 포커스 외곽선을 피한다", () => {
  assert.match(schoolEmailSource, /inputMode=\{Platform\.OS === "web" \? "text" : "email"\}/);
  assert.match(schoolEmailSource, /keyboardType=\{Platform\.OS === "web" \? "default" : "email-address"\}/);
  assert.match(schoolEmailSource, /outlineStyle: "none"/);
  assert.match(loginSource, /outlineStyle: "none"/);
});

test("#62·63 공지 목록은 공통 로딩과 중앙 빈 상태 레이아웃을 사용한다", () => {
  assert.match(noticeListSource, /<LoadingState compact \/>/);
  assert.match(councilSource, /return <LoadingState \/>/);
  assert.match(noticeListSource, /listContentEmpty:[\s\S]*flexGrow: 1/);
  assert.match(noticeListSource, /emptyState:[\s\S]*justifyContent: "center"/);
});

test("활동 인증 목록 이미지는 이전의 가로형 고정 비율을 사용한다", () => {
  assert.match(boardSource, /activityThumb:[\s\S]*aspectRatio: 2\.05/);
});

test("활동 인증 상세 이미지는 게시판별 관리자 규칙을 사용하고 사진첩만 240px 프레임을 유지한다", () => {
  assert.match(postDetailSource, /activityImageLayoutFromMetadata\(board\?\.metadata\?\.activity_image_layout\)/);
  assert.match(postDetailSource, /<ActivityCertificationMediaImage[\s\S]*?layout=\{activityImageLayout\}/);
  assert.match(postDetailSource, /isPhotoAlbum \? styles\.visualHeroAlbum : null/);
  assert.doesNotMatch(postDetailSource, /isPhotoAlbum \|\| isActivityCertification \? styles\.visualHeroAlbum : null/);
  assert.match(postDetailSource, /visualHeroAlbum:[\s\S]*height: 240/);
});

test("#64·65 상세 더보기와 북마크는 디자인 아이콘과 하단 시트를 사용한다", () => {
  assert.match(postDetailSource, /<BookmarkIcon filled=\{isBookmarked\}/);
  assert.match(postDetailSource, /<MoreIcon color=\{COLORS\.text\} \/>/);
  assert.match(postDetailSource, /style=\{styles\.menuSheet\}/);
  assert.match(postDetailSource, /<FlagIcon size=\{20\}/);
  // 작성자 차단 항목은 디자인(Report/MoreMenu)에 없어 제거됐다
  assert.doesNotMatch(postDetailSource, /작성자 차단/);
});

test("#71 게시글 수정 화면은 제목과 내용 입력을 게시판 종류와 관계없이 노출한다", () => {
  assert.match(postEditSource, /accessibilityLabel="제목"/);
  assert.match(postEditSource, /accessibilityLabel="내용"/);
  assert.doesNotMatch(postEditSource, /isStudyRecruit \? <Text style=\{styles\.fieldLabel\}>(?:제목|내용)<\/Text>/);

  for (const label of ["모집 상태", "스터디장 연락수단"]) {
    assert.match(postEditSource, new RegExp(`>${label}<`));
  }
});

test("#73 운영진 화면은 임의 기본 프로필 없이 실제 데이터만 사용한다", () => {
  assert.doesNotMatch(boardSource, /DEFAULT_EXECUTIVES/);
  assert.doesNotMatch(boardSource, /윤OO/);
});

test("#187 홈 동문회 주소록은 클립보드 아이콘과 제목을 한 줄 텍스트로 표시한다", () => {
  assert.match(
    homeSource,
    /<Image source=\{HOME_ICON_ALUMNI\} style=\{styles\.alumniDirectoryIcon\}[\s\S]*?\/>/,
  );
  assert.match(homeSource, /<Text style=\{styles\.alumniDirectoryTitle\}>동문회 주소록<\/Text>/);
  assert.doesNotMatch(homeSource, /📋 동문회 주소록/);
});

test("#187 홈 동문회 주소록은 디자인 기준의 조밀한 세로 간격을 유지한다", () => {
  assert.match(styleBlock(homeSource, "content"), /paddingBottom: 16/);
  assert.match(styleBlock(homeSource, "alumniDirectoryRow"), /marginTop: 24/);
  assert.match(styleBlock(homeSource, "alumniDirectoryRow"), /paddingVertical: 12/);
  assert.match(styleBlock(homeSource, "alumniDirectoryTitle"), /lineHeight: 18/);
  assert.match(styleBlock(homeSource, "alumniDirectoryDescription"), /lineHeight: 16/);
  assert.match(styleBlock(homeSource, "alumniDirectoryDescription"), /marginTop: 4/);
  assert.match(styleBlock(homeSource, "alumniDirectoryDescription"), /marginLeft: 4/);
});

test("스터디 모집 카드 메타는 작성자·날짜 뒤에 댓글 수를 붙이고 추천 수는 감춘다", () => {
  assert.match(postCardSource, /const showCommentCount = !isLectureReview && !isWorkflowRequest;/);
  assert.match(postCardSource, /const showLikeCount = !isWorkflowRequest && !isStudyRecruit;/);
  assert.match(postCardSource, /showCommentCount \? `댓글 \$\{post\.comment_count\}` : null/);
});

test("댓글과 대댓글은 Figma 타이포그래피(작성자 13/16, 본문 13, 날짜 11/13)를 공유한다", () => {
  const commentItem = source("components/CommentItem.tsx");
  assert.match(commentItem, /color: "#15171C", fontSize: 13, fontWeight: "500", lineHeight: 16/);
  assert.match(commentItem, /fontSize: 13, lineHeight: depth > 0 \? 16 : 20/);
  assert.match(commentItem, /fontSize: 11,\s*\n\s*lineHeight: 13,/);
});

test("댓글 액션행과 저장·취소행은 padding 8/0, gap 16, 라벨 13/16으로 같은 크기다", () => {
  const commentItem = source("components/CommentItem.tsx");
  assert.match(commentItem, /flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 4, paddingVertical: 8/);
  assert.equal((commentItem.match(/fontSize: 13, fontWeight: "500", lineHeight: 16/g) ?? []).length, 6);
  assert.doesNotMatch(commentItem, /fontSize: depth > 0 \? 13 : 12/);
});

test("댓글 수정 입력은 1.3px 파란 테두리에 13\/16 본문과 10\/12 여백을 쓴다", () => {
  const commentItem = source("components/CommentItem.tsx");
  assert.match(commentItem, /borderWidth: 1\.3,\s*\n\s*borderColor: "#2761FF"/);
  assert.match(commentItem, /fontSize: 13,\s*\n\s*lineHeight: 16,\s*\n\s*paddingHorizontal: 12,\s*\n\s*paddingVertical: 10,/);
});
