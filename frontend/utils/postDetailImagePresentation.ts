export type PostDetailImagePresentation = "natural" | "fixed-contain" | "fixed-cover";

type PostDetailImagePresentationInput = {
  placement: "hero" | "attachment";
  boardType?: string | null;
  boardSlug?: string | null;
  isCouncilActivityEntry?: boolean;
};

// Figma Detail-ImageVertical-4x5(공지·참여활동): 세로형 이미지 틀은 320x452다.
// 프레임 이름은 4x5로 남아 있지만 2026-10-13에 크기가 320x400에서 바뀌었다.
export const VERTICAL_IMAGE_FRAME_ASPECT_RATIO = 320 / 452;

export function noticeAttachmentFrameAspectRatio(sourceAspectRatio?: number | null): number {
  return typeof sourceAspectRatio === "number"
    && Number.isFinite(sourceAspectRatio)
    && sourceAspectRatio > 0
    && sourceAspectRatio < 1
    ? VERTICAL_IMAGE_FRAME_ASPECT_RATIO
    : 4 / 3;
}

export function shouldOpenPostAttachment({
  contentType,
}: {
  isNotice: boolean;
  contentType: string;
}): boolean {
  return !contentType.startsWith("image/");
}

export function postDetailImagePresentation({
  placement,
  boardType,
  boardSlug,
  isCouncilActivityEntry = false,
}: PostDetailImagePresentationInput): PostDetailImagePresentation {
  if (placement === "attachment") return boardType === "notice" ? "fixed-contain" : "natural";
  if (boardType === "album") return "fixed-contain";
  if (boardType === "activity_certification") return "natural";
  if (
    boardSlug === "club-promo"
    || boardSlug === "networking-programs"
    || isCouncilActivityEntry
  ) {
    return "natural";
  }
  return "fixed-cover";
}
