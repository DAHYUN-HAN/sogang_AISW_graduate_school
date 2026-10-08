import assert from "node:assert/strict";
import test from "node:test";
import { noticeBodyBlocks, noticeBodyDraft, insertNoticeBodyImage, removeNoticeBodyImage, replaceNoticeBodyImage } from "../utils/noticeBody";

const attachments = [{id: 10, content_type: "image/png"}, {id: 20, content_type: "image/jpeg"}, {id: 30, content_type: "application/pdf"}];

test("legacy plain notices keep their complete text and no inline images", () => {
  assert.deepEqual(noticeBodyBlocks("안내\n내용", undefined, attachments), [{type: "text", text: "안내\n내용"}]);
});

test("insert at the chosen body cursor preserves text, supports Korean and emoji, and round-trips", () => {
  const blocks = insertNoticeBodyImage([{type: "text", text: "안내😀\n후속 내용"}], 10, {index: 0, offset: 5});
  assert.deepEqual(blocks, [{type: "text", text: "안내😀\n"}, {type: "image", media_id: 10}, {type: "text", text: "후속 내용"}]);
  const draft = noticeBodyDraft(blocks);
  assert.equal(draft.content, "안내😀\n후속 내용");
  assert.deepEqual(draft.images, [{media_id: 10, offset: 5}]);
  assert.deepEqual(noticeBodyBlocks(draft.content, {version: 1, images: draft.images}, attachments), blocks);
});

test("editing text before multiple images recalculates their positions without duplicating text", () => {
  const draft = noticeBodyDraft([{type: "text", text: "길어진 안내"}, {type: "image", media_id: 10}, {type: "text", text: "중간"}, {type: "image", media_id: 20}, {type: "text", text: "끝"}]);
  assert.deepEqual(draft.images, [{media_id: 10, offset: 6}, {media_id: 20, offset: 8}]);
  assert.equal(draft.content, "길어진 안내중간끝");
});

test("removal and replacement preserve body text and other image positions", () => {
  const blocks = noticeBodyBlocks("앞뒤", {version: 1, images: [{media_id: 10, offset: 1}, {media_id: 20, offset: 2}]}, attachments);
  const removed = noticeBodyDraft(removeNoticeBodyImage(blocks, 10));
  assert.equal(removed.content, "앞뒤");
  assert.deepEqual(removed.images, [{media_id: 20, offset: 2}]);
  assert.deepEqual(noticeBodyDraft(replaceNoticeBodyImage(blocks, 10, 40)).images, [{media_id: 40, offset: 1}, {media_id: 20, offset: 2}]);
});

test("saving trimmed content adjusts image offsets including images at either edge", () => {
  const draft = noticeBodyDraft([{type: "image", media_id: 10}, {type: "text", text: "  본문  "}, {type: "image", media_id: 20}], true);
  assert.equal(draft.content, "본문");
  assert.deepEqual(draft.images, [{media_id: 10, offset: 0}, {media_id: 20, offset: 2}]);
});

test("only valid attached images render; malformed, detached, duplicate and non-image IDs are ignored", () => {
  const invalid = {version: 1, images: [{media_id: 99, offset: 0}, {media_id: 30, offset: 1}, {media_id: 10, offset: -1}, {media_id: 20, offset: 100}, {media_id: 10, offset: 1}, {media_id: 10, offset: 2}, null]};
  assert.deepEqual(noticeBodyBlocks("앞뒤", invalid, attachments), [{type: "text", text: "앞"}, {type: "image", media_id: 10}, {type: "text", text: "뒤"}]);
  assert.deepEqual(noticeBodyBlocks("앞뒤", {version: 2, images: [{media_id: 10, offset: 1}]}, attachments), [{type: "text", text: "앞뒤"}]);
});
