const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".xls": "application/vnd.ms-excel",
  ".ppt": "application/vnd.ms-powerpoint",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".hwp": "application/x-hwp",
  ".zip": "application/zip",
  ".txt": "text/plain",
  ".ipynb": "application/x-ipynb+json",
};

/**
 * 첨부로 받는 형식. 화면 안내(`※ JPG, PNG, PDF, DOCX 첨부 가능`)와 같은 목록이다.
 * 서버는 HWP·ZIP 등 더 넓게 받지만, 앱에서는 안내한 4가지만 올린다.
 */
export const ATTACHMENT_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

/** 웹 파일 선택 대화상자가 처음부터 4가지만 보여주도록 하는 값. */
export const ATTACHMENT_ACCEPT = ".jpg,.jpeg,.png,.pdf,.docx,image/jpeg,image/png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function inferDocumentContentType(filename: string, declaredType?: string | null): string {
  const normalizedName = filename.trim().toLowerCase();
  const dotIndex = normalizedName.lastIndexOf(".");
  const extension = dotIndex >= 0 ? normalizedName.slice(dotIndex) : "";
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? (declaredType?.trim() || "application/octet-stream");
}

export function assertAllowedDocumentContentTypes(
  files: readonly { name: string; type?: string | null }[],
  allowedTypes?: string | readonly string[],
) {
  if (!allowedTypes) return;
  const allowed = typeof allowedTypes === "string" ? [allowedTypes] : allowedTypes;
  if (allowed.includes("*/*")) return;

  const unsupported = files.find((file) => !allowed.includes(inferDocumentContentType(file.name, file.type)));
  if (unsupported) {
    throw new Error(`UNSUPPORTED_DOCUMENT_TYPE:${unsupported.name}`);
  }
}

/**
 * 서버 `media_upload_max_bytes`와 같은 값. 서버 설정이 이 값을 상한으로 고정하고
 * 있어서 환경에 따라 달라지지 않는다.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * 크기를 알 수 있으면 올리기 전에 막는다. 서버도 같은 한도로 다시 막지만,
 * 거기까지 가면 10MB를 다 올린 뒤에야 413을 받는다.
 * 크기를 모르는 파일(size 없음)은 서버 판단에 맡긴다.
 */
export function assertUploadSize(file: { name?: string; size?: number | null }) {
  if (typeof file.size !== "number" || file.size <= MAX_UPLOAD_BYTES) return;
  throw new Error(`FILE_TOO_LARGE:${file.name ?? ""}`);
}
