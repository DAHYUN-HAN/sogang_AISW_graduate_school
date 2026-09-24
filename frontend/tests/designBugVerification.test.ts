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

test("#41·45 공지 상세 이미지는 가로 4:3·세로 4:5 고정 프레임이며 누르면 공용 사진 보기를 연다", () => {
  assert.match(postDetailSource, /const isNotice = board\?\.board_type === "notice" \|\| post\?\.is_notice === true/);
  assert.match(postDetailSource, /function NoticeAttachmentImage/);
  assert.match(postDetailSource, /noticeAttachmentFrameAspectRatio\(sourceAspectRatio\)/);
  assert.match(postDetailSource, /<MediaImage[\s\S]*resizeMode="contain"[\s\S]*style=\{styles\.noticeAttachmentImage\}/);
  assert.match(postDetailSource, /shouldOpenPostAttachment\(\{[\s\S]*isNotice,[\s\S]*contentType: attachment\.content_type/);
  assert.match(postDetailSource, /!canOpenAttachment \? \([\s\S]*onPress=\{\(\) => setViewerIndex\([\s\S]*<NoticeAttachmentImage media=\{attachment\} \/>/);
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

test("활동 인증 목록 이미지는 Figma 인증피드카드의 328x219 비율을 쓴다", () => {
  // 카드 폭은 좌우 16 여백을 뺀 328이라 Figma와 같다. 높이만 맞추면 된다.
  assert.match(boardSource, /activityThumb:[\s\S]*aspectRatio: 328 \/ 219/);
  assert.match(boardSource, /cardContent:[\s\S]*paddingHorizontal: 16/);
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
  // 강의후기도 댓글을 쓸 수 있으므로 댓글 수는 상조회·건의만 감춘다.
  assert.match(postCardSource, /const showCommentCount = !isWorkflowRequest;/);
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

test("댓글 수정 입력은 1.3px 파란 테두리에 13\/16 본문과 8\/10 여백을 쓴다", () => {
  const commentItem = source("components/CommentItem.tsx");
  assert.match(commentItem, /borderWidth: 1\.3,\s*\n\s*borderColor: "#2761FF"/);
  // Figma 답글수정입력: padding 8px 10px.
  assert.match(commentItem, /fontSize: 13,\s*\n\s*lineHeight: 16,[\s\S]{0,120}paddingHorizontal: 10,\s*\n\s*paddingVertical: 8,/);
});

test("대댓글은 들여쓰기 없이 320px 폭을 채우고 배경·라운드로만 구분된다", () => {
  const commentItem = source("components/CommentItem.tsx");
  // Figma 댓글스레드: 댓글도 대댓글도 align-self stretch — 좌측 들여쓰기가 없다.
  assert.doesNotMatch(commentItem, /marginLeft: depth \* \d+/);
  assert.match(commentItem, /borderRadius: depth > 0 \? 10 : 0/);
  assert.match(commentItem, /backgroundColor: depth > 0 \? "#F7F7F5" : undefined/);
  assert.match(commentItem, /alignItems: depth > 0 \? "flex-start" : "center"/);
});

test("스레드 하단 여백은 대댓글 유무에 따라 28\/16으로 갈린다", () => {
  const commentItem = source("components/CommentItem.tsx");
  // 댓글 여백 12 + 스레드 하단 16 = 28. 대댓글이 있으면 12는 첫 대댓글까지의 20에 이미 포함된다.
  assert.match(commentItem, /const hasReplies = comment\.children\.length > 0;/);
  assert.match(commentItem, /paddingBottom: depth === 0 \? \(flat \? 12 : hasReplies \? 16 : 28\) : 10/);
  assert.match(commentItem, /marginTop: depth > 0 \? \(isFirstReply \? 20 : 8\) : 0/);
});

test("본문 반응행의 댓글 수를 누르면 하단 댓글 입력창에 커서가 간다", () => {
  const detail = source("app/(tabs)/board/post/[postId].tsx");
  assert.match(detail, /accessibilityLabel="댓글 쓰기"[\s\S]{0,260}commentInputRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(detail, /<View style=\{styles\.iconAction\}>\s*\n\s*<Ionicons name="chatbubble-outline"/);
});

test("활동 인증 날짜 필드는 '활동한 날짜' 소제목과 41h 날짜선택을 갖는다", () => {
  // Figma 날짜래퍼: 소제목 13/16 500 + gap 6 + 0.5px 테두리 41h 필드, 캘린더 아이콘 15px #A6ACB7.
  assert.match(postCreateSource, /<Text style=\{styles\.activityFieldTitle\}>활동한 날짜<\/Text>[\s\S]{0,400}name="activityDate"/);
  assert.match(postCreateSource, /<CalendarSmallIcon size=\{15\} color="#A6ACB7" \/>/);
  // 달력 아이콘은 디자인 원본 15x15 — 몸통 라운드 사각형 + 상단 걸이 2개 + 6.25 구분선, stroke 1.22.
  const icons = source("components/icons.tsx");
  assert.match(icons, /export function CalendarSmallIcon[\s\S]{0,200}viewBox="0 0 15 15"/);
  assert.match(icons, /d="M10 1\.875V4\.375M5 1\.875V4\.375M1\.875 6\.25H13\.125"/);
  assert.match(icons, /export function CalendarSmallIcon[\s\S]{0,700}strokeWidth=\{1\.22\}/);
  assert.match(postCreateSource, /activityFieldGroup:\s*\{\s*\n\s*gap: 6,/);
  assert.match(postCreateSource, /activityInputWithIcon:\s*\{\s*\n\s*minHeight: 41,/);
});

test("스터디 모집 댓글은 구분선 없이 12px 간격으로만 이어진다", () => {
  // Figma 스터디 모집 본문: 댓글 = padding 0 0 12, gap 4, height 80 (27 + 4 + 20 + 4 + 13 + 12).
  // 일반 게시판의 댓글스레드(padding 16/0 + 구분선)와 달리 스레드 래퍼가 없다.
  assert.match(postDetailSource, /index > 0 && !isStudyRecruit \? <View style=\{styles\.commentThreadDivider\} \/> : null/);
  assert.match(postDetailSource, /flat=\{isStudyRecruit\}/);
  const commentItem = source("components/CommentItem.tsx");
  assert.match(commentItem, /paddingTop: depth > 0 \? 10 : flat \? 0 : 16/);
  assert.match(commentItem, /paddingBottom: depth === 0 \? \(flat \? 12 : hasReplies \? 16 : 28\) : 10/);
});

test("스터디 모집 댓글에는 답글을 제공하지 않는다", () => {
  // 운영 정책: 스터디 모집만 대댓글을 막는다. onReply가 없으면 CommentItem이 답글 버튼을 숨긴다.
  assert.match(postDetailSource, /onReply=\{\s*\n\s*isStudyRecruit\s*\n\s*\? undefined/);
  assert.match(postDetailSource, /: \(comment\) => \{[\s\S]{0,240}createReplyTarget\(comment\)/);
  assert.match(source("components/CommentItem.tsx"), /actionState\.showReply && onReply \?/);
});
