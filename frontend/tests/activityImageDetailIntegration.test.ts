import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detail = readFileSync("app/(tabs)/(home,notices,community,participation,council)/board/post/[postId].tsx", "utf8");
const renderer = readFileSync("components/ActivityCertificationMediaImage.tsx", "utf8");

test("활동 인증 상세는 게시판 metadata의 이미지 규칙을 전용 렌더러에 전달한다", () => {
  assert.match(detail, /activityImageLayoutFromMetadata\(board\?\.metadata\?\.activity_image_layout\)/);
  assert.match(detail, /<ActivityCertificationMediaImage[\s\S]*?layout=\{activityImageLayout\}/);
  assert.doesNotMatch(detail, /isPhotoAlbum \|\| isActivityCertification \? styles\.visualHeroAlbum : null/);
});

test("전용 렌더러는 원본 방향과 frame fit을 실제 MediaImage에 적용한다", () => {
  assert.match(renderer, /activityImageOrientation\(dimensions\.width, dimensions\.height\)/);
  assert.match(renderer, /activityImageFrame\(/);
  assert.match(renderer, /resizeMode=\{frame\?\.fit/);
});
