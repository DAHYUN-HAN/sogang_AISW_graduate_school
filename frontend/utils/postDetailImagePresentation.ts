export type PostDetailImagePresentation = "natural" | "fixed-contain" | "fixed-cover";

type PostDetailImagePresentationInput = {
  placement: "hero" | "attachment";
  boardType?: string | null;
  boardSlug?: string | null;
  isCouncilActivityEntry?: boolean;
};

export function noticeAttachmentFrameAspectRatio(sourceAspectRatio?: number | null): number {
  return typeof sourceAspectRatio === "number"
    && Number.isFinite(sourceAspectRatio)
    && sourceAspectRatio > 0
    && sourceAspectRatio < 1
    ? 4 / 5
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
