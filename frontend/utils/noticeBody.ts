export type NoticeBodyImage = { media_id: number; offset: number };
export type NoticeBodyBlock = { type: "text"; text: string } | { type: "image"; media_id: number };
export type NoticeBodySelection = { index: number; offset: number };
type AttachedImage = { id: number; content_type: string };

// Offsets use JavaScript UTF-16 indices. Persist media IDs, never expiring URLs.
export function noticeBodyBlocks(content: string, body: unknown, attachments: readonly AttachedImage[]): NoticeBodyBlock[] {
  const record = body && typeof body === "object" ? body as Record<string, unknown> : null;
  const candidates = record?.version === 1 && Array.isArray(record.images) ? record.images : [];
  const attachedIds = new Set(attachments.filter(a => a.content_type.startsWith("image/")).map(a => a.id));
  const seen = new Set<number>();
  const images: NoticeBodyImage[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const {media_id, offset} = candidate as NoticeBodyImage;
    if (!Number.isInteger(media_id) || !attachedIds.has(media_id) || seen.has(media_id)
      || !Number.isInteger(offset) || offset < 0 || offset > content.length) continue;
    seen.add(media_id);
    images.push({media_id, offset: safeOffset(content, offset)});
  }
  images.sort((a, b) => a.offset - b.offset);
  const blocks: NoticeBodyBlock[] = [];
  let cursor = 0;
  for (const image of images) {
    blocks.push({type: "text", text: content.slice(cursor, image.offset)}, {type: "image", media_id: image.media_id});
    cursor = image.offset;
  }
  blocks.push({type: "text", text: content.slice(cursor)});
  return blocks;
}

function safeOffset(text: string, offset: number) {
  const clamped = Math.min(Math.max(0, offset), text.length);
  const char = text.charCodeAt(clamped);
  return char >= 0xDC00 && char <= 0xDFFF ? clamped + 1 : clamped;
}

export function noticeBodyDraft(blocks: readonly NoticeBodyBlock[], trim = false) {
  let content = "";
  const images: NoticeBodyImage[] = [];
  for (const block of blocks) {
    if (block.type === "text") content += block.text;
    else images.push({media_id: block.media_id, offset: content.length});
  }
  if (trim) {
    const leading = content.length - content.trimStart().length;
    content = content.trim();
    images.forEach(image => {image.offset = Math.min(content.length, Math.max(0, image.offset - leading));});
  }
  return {content, images};
}

export function insertNoticeBodyImage(blocks: readonly NoticeBodyBlock[], mediaId: number, selection?: NoticeBodySelection | null): NoticeBodyBlock[] {
  if (blocks.some(block => block.type === "image" && block.media_id === mediaId)) return [...blocks];
  let index = selection?.index ?? blocks.length - 1;
  if (blocks[index]?.type !== "text") {
    index = blocks.length - 1;
    while (index >= 0 && blocks[index].type !== "text") index--;
  }
  const block = blocks[index];
  if (!block || block.type !== "text") return [...blocks, {type: "image", media_id: mediaId}, {type: "text", text: ""}];
  const offset = safeOffset(block.text, selection?.index === index ? selection.offset : block.text.length);
  return [...blocks.slice(0, index), {type: "text", text: block.text.slice(0, offset)},
    {type: "image", media_id: mediaId}, {type: "text", text: block.text.slice(offset)}, ...blocks.slice(index + 1)];
}

export function removeNoticeBodyImage(blocks: readonly NoticeBodyBlock[], mediaId: number): NoticeBodyBlock[] {
  const result: NoticeBodyBlock[] = [];
  for (const block of blocks) {
    if (block.type === "image" && block.media_id === mediaId) continue;
    const previous = result[result.length - 1];
    if (block.type === "text" && previous?.type === "text") previous.text += block.text;
    else result.push({...block});
  }
  return result;
}

export function replaceNoticeBodyImage(blocks: readonly NoticeBodyBlock[], mediaId: number, replacementId: number): NoticeBodyBlock[] {
  return blocks.map(block => block.type === "image" && block.media_id === mediaId ? {type: "image", media_id: replacementId} : {...block});
}
