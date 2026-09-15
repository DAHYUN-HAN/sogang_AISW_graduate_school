import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const notification = readFileSync("components/NotificationBootstrap.tsx", "utf8");
const board = readFileSync("app/(tabs)/board/[boardId].tsx", "utf8");
const create = readFileSync("app/(tabs)/board/post/create.tsx", "utf8");

test("모든 알림은 PR 원본 토스트 디자인과 고정 위치를 사용한다", () => {
  assert.doesNotMatch(notification, /notificationToastKind\(visibleNotification\.notification_type\)/);
  assert.match(notification, /position: "absolute",\s*top: 8,/);
  assert.doesNotMatch(notification, /useSafeAreaInsets|notificationToastTop/);
  assert.match(notification, /<NoticeToastIcon size=\{32\}/);
  assert.match(notification, /<Pressable\s+accessibilityRole="button"\s+onPress=\{openVisibleNotification\}/);
  assert.doesNotMatch(notification, /accessibilityLabel="알림 닫기"|stopPropagation\(\)/);
  assert.match(notification, /onPress=\{openVisibleNotification\}/);
});

test("모든 알림 토스트는 PR의 2px 텍스트 간격과 muted 한 줄 메시지를 사용한다", () => {
  assert.match(notification, /<View style=\{\{ flex: 1, gap: 2 \}\}>/);
  assert.match(notification, /<Text style=\{\{ color: "#15171C", fontSize: 13, lineHeight: 16, fontWeight: "500" \}\}>/);
  assert.match(notification, /<Text numberOfLines=\{1\} style=\{\{ color: "#6B7280", fontSize: 13, lineHeight: 16, fontWeight: "400" \}\}>/);
  assert.doesNotMatch(notification, /const isNotice =/);
});

test("참여활동 카드는 PR 원본처럼 마지막 구분선을 숨긴다", () => {
  assert.match(board, /function ActivityTile[\s\S]*?<Pressable onPress=\{\(\) => onPress\(post\.id\)\} style=\{\[styles\.activityCard, isLast \? styles\.activityCardLast : null\]\}>/);
  assert.match(board, /<ActivityTile post=\{item\} boardSlug=\{itemBoard\?\.slug \?\? board\?\.slug\} index=\{index\} isLast=\{index === posts\.length - 1\} onPress=/);
  assert.match(board, /activityCardLast:[\s\S]*borderBottomWidth: 0/);
});

test("활동 인증 폼은 PR 원본 문구를 표시한다", () => {
  assert.match(create, /isActivity \? styles\.appBarNoDivider : null/);
  assert.match(create, /appBarNoDivider:[\s\S]*borderBottomWidth: 0/);
  assert.match(create, /appBarTitle:[\s\S]*fontSize: 18,[\s\S]*fontWeight: "500",[\s\S]*lineHeight: 22/);
  assert.match(create, /placeholder="이름으로 검색"/);
  assert.doesNotMatch(create, /이름 또는 학번으로 검색/);
  assert.match(create, /attachExtensionHint:[\s\S]*fontSize: 12[\s\S]*lineHeight: 15/);
  assert.match(create, /<Text style=\{styles\.activityPhotoText\}>\s*\{isUploading \? "업로드 중" : "활동 사진을 추가해주세요"\}\s*<\/Text>/);
  assert.match(create, /activityPhotoText:[\s\S]*color: "#A6ACB7",[\s\S]*fontSize: 13,[\s\S]*fontWeight: "400",[\s\S]*lineHeight: 16/);
  assert.match(create, /!isAdminParticipationPost \? \(\s*<>\s*<View style=\{styles\.compactAttachActions\}>[\s\S]*?<\/View>\s*<Text style=\{styles\.attachExtensionHint\}>이미지: JPG, PNG \| 파일: PDF, DOCX<\/Text>/);
  assert.match(create, /input:[\s\S]*fontSize: 14[\s\S]*lineHeight: 17/);
});

const detail = readFileSync("app/(tabs)/board/post/[postId].tsx", "utf8");

const fonts = readFileSync("utils/fonts.ts", "utf8");
const notices = readFileSync("app/(tabs)/notices.tsx", "utf8");

test("웹 폰트는 PR smoothing과 faux-bold 방지를 사용한다", () => {
  assert.match(fonts, /font-smoothing-patch/);
  assert.match(fonts, /-webkit-font-smoothing:antialiased/);
  assert.match(fonts, /fontFamily, fontWeight: "normal"/);
});

test("공지 목록 정리 후에도 검색과 네 필터 새로고침이 남는다", () => {
  assert.match(notices, /router\.push\("\/search\?scope=notices"/);
  assert.match(notices, /NOTICE_FILTERS\.map/);
  assert.match(notices, /selectNoticeFilterAndRefresh/);
});

test("참여활동 상세는 PR 순서를 유지하고 활동 인증 이미지는 관리자 규칙을 사용한다", () => {
  assert.match(detail, /const visualHeroSection =/);
  assert.match(detail, /\{!isAdminParticipationGuide \? visualHeroSection : null\}/);
  // 동아리/네트워킹은 관리자 등록 이미지를 제목과 본문 사이에 세로로 모두 나열한다.
  assert.match(detail, /\{isAdminParticipationGuide \? participationImagesSection : null\}/);
  assert.match(detail, /const participationImagesSection =/);
  assert.match(detail, /function ParticipationHeroImage/);
  assert.match(detail, /aspectRatio: aspect !== null && aspect < 1 \? 4 \/ 5 : 4 \/ 3/);
  assert.match(detail, /activityImageLayoutFromMetadata\(board\?\.metadata\?\.activity_image_layout\)/);
  assert.match(detail, /<ActivityCertificationMediaImage[\s\S]*?layout=\{activityImageLayout\}/);
  assert.match(detail, /isPhotoAlbum \? styles\.visualHeroAlbum : null/);
  assert.doesNotMatch(detail, /const hasExpandableHero = isActivityCertification/);
});

test("공지 이미지는 가로 4:3·세로 4:5 프레임만 사용하고 PR 첨부 타이포를 유지한다", () => {
  assert.match(detail, /function NoticeAttachmentImage/);
  assert.match(detail, /noticeAttachmentFrameAspectRatio\(sourceAspectRatio\)/);
  assert.doesNotMatch(detail, /사진 전체보기/);
  assert.match(detail, /attachmentsList:[\s\S]*gap: 12/);
  assert.match(detail, /fileName:[\s\S]*fontSize: 13[\s\S]*lineHeight: 16/);
});

test("공식 답변은 PR 전용 이미지, 빈 대표 이미지는 벡터 아이콘을 사용한다", () => {
  assert.match(detail, /<ImagePlaceholderIcon size=\{36\}/);
  assert.match(detail, /<Image source=\{require\("\.\.\/\.\.\/\.\.\/\.\.\/assets\/images\/council-reply\.png"\)\}/);
  assert.doesNotMatch(detail, /<CouncilReplyIcon/);
});
