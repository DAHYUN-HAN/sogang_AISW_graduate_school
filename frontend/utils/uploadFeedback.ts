import { isAxiosError } from "axios";

import type { NoticeModalContent } from "../components/NoticeModal";
import { TOAST_MESSAGES } from "./toast";

// 업로드 실패는 원인에 따라 사용자가 할 수 있는 일이 다르다. 하나로 뭉쳐
// "다시 시도하세요"라고만 하면 횟수 제한이나 형식 문제일 때 계속 실패한다.
export type UploadFeedback =
  | { kind: "toast"; message: string }
  | { kind: "modal"; notice: NoticeModalContent };

/** Figma Screen/Common/UploadFailModal */
export const UPLOAD_FAIL_NOTICE: NoticeModalContent = {
  title: "업로드에 실패했어요",
  body: "일시적인 문제로 업로드하지 못했어요\n잠시 후 다시 시도해주세요",
};

/** Figma Screen/Common/RateLimitModal */
export const RATE_LIMIT_NOTICE: NoticeModalContent = {
  title: "잠시 후 다시 시도해주세요",
  body: "짧은 시간에 요청이 많아 잠시 제한됐어요\n잠시 후 다시 시도해주세요",
};

export const UPLOAD_TOAST_MESSAGES = {
  /** Figma Component/Toast-ImageFormatError */
  imageFormat: "JPG 또는 PNG 이미지만 첨부할 수 있어요",
  /** Figma Component/Toast-FileFormatError */
  fileFormat: "JPG, PNG, PDF, DOCX만 첨부할 수 있어요",
  /** Figma Component/Toast-ImageSizeError */
  size: "10MB 이하 파일만 첨부할 수 있어요",
} as const;

function statusOf(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

function codeOf(error: unknown): string | undefined {
  if (!isAxiosError<{ code?: string }>(error)) return undefined;
  const code = error.response?.data?.code;
  return typeof code === "string" ? code : undefined;
}

/**
 * 올리기 전에 앱이 직접 막은 경우. 서버 응답이 없으므로 코드를 메시지에서 읽는다.
 * 파일명을 붙여 던지므로 앞부분만 본다.
 */
function localCodeOf(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  return error.message.split(":")[0];
}

/**
 * 업로드 중 발생한 오류를 화면 표시로 옮긴다.
 * `imagesOnly`는 사진만 받는 자리인지로, 형식 안내 문구가 달라진다.
 */
export function uploadFailureFeedback(error: unknown, imagesOnly = false): UploadFeedback {
  const status = statusOf(error);
  const localCode = localCodeOf(error);
  if (status === 429 || codeOf(error) === "RATE_LIMITED") {
    return { kind: "modal", notice: RATE_LIMIT_NOTICE };
  }
  if (status === 413 || codeOf(error) === "FILE_TOO_LARGE" || localCode === "FILE_TOO_LARGE") {
    return { kind: "toast", message: UPLOAD_TOAST_MESSAGES.size };
  }
  if (status === 415 || localCode === "UNSUPPORTED_DOCUMENT_TYPE") {
    return {
      kind: "toast",
      message: imagesOnly ? UPLOAD_TOAST_MESSAGES.imageFormat : UPLOAD_TOAST_MESSAGES.fileFormat,
    };
  }
  // 갤러리 권한 거부와 네트워크·서버 오류는 사용자가 원인을 구분할 수 없어
  // 같은 "일시적인 문제" 안내로 묶는다.
  return { kind: "modal", notice: UPLOAD_FAIL_NOTICE };
}

/** 등록·수정 실패처럼 원인을 특정할 수 없는 경우 */
export function submitFailureToast(): string {
  return TOAST_MESSAGES.error;
}
