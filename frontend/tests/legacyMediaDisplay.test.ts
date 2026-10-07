import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const postDetailSource = readFileSync("app/(tabs)/(home,notices,community,participation,council)/board/post/[postId].tsx", "utf8");
const faqSource = readFileSync("app/(tabs)/(home,notices,community,participation,council)/faq.tsx", "utf8");

test("사진첩은 이미지가 한 장일 때 같은 썸네일을 다시 표시하지 않는다", () => {
  assert.match(
    postDetailSource,
    /board\?\.board_type === "album" && imageAttachments\.length > 1/,
  );
});

test("FAQ 이관 이미지는 보호된 미디어 컴포넌트로 답변 아래에 표시된다", () => {
  assert.match(faqSource, /item\.attachments/);
  assert.match(faqSource, /<NaturalAspectMediaImage/);
});
