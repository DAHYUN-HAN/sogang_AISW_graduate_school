import assert from "node:assert/strict";
import test from "node:test";

import { assertAllowedDocumentContentTypes, inferDocumentContentType } from "../utils/documentFiles";

test("문서 선택기가 누락하거나 잘못 보고한 MIME을 허용된 확장자로 보정한다", () => {
  assert.equal(inferDocumentContentType("photo.JPG", "application/octet-stream"), "image/jpeg");
  assert.equal(inferDocumentContentType("photo.heic", "application/octet-stream"), "image/heic");
  assert.equal(inferDocumentContentType("handout.pdf", "application/octet-stream"), "application/pdf");
  assert.equal(inferDocumentContentType("legacy.doc", "application/octet-stream"), "application/msword");
  assert.equal(inferDocumentContentType("legacy.xls", "application/octet-stream"), "application/vnd.ms-excel");
  assert.equal(inferDocumentContentType("legacy.ppt", "application/octet-stream"), "application/vnd.ms-powerpoint");
  assert.equal(
    inferDocumentContentType("document.docx", "application/octet-stream"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  assert.equal(
    inferDocumentContentType("workbook.xlsx", "application/octet-stream"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  assert.equal(inferDocumentContentType("exam.zip", "text/plain"), "application/zip");
  assert.equal(inferDocumentContentType("notes.txt", "application/octet-stream"), "text/plain");
  assert.equal(inferDocumentContentType("analysis.ipynb", ""), "application/x-ipynb+json");
  assert.equal(inferDocumentContentType("exam.hwp", "application/octet-stream"), "application/x-hwp");
  assert.equal(
    inferDocumentContentType("slides.pptx", "application/octet-stream"),
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  );
});

test("알 수 없는 확장자는 선택기가 제공한 MIME 또는 안전한 기본값을 유지한다", () => {
  assert.equal(inferDocumentContentType("archive.unknown", "application/custom"), "application/custom");
  assert.equal(inferDocumentContentType("archive.unknown", ""), "application/octet-stream");
});

test("제한된 문서 업로드는 확장자로 보정한 MIME을 업로드 전에 검증한다", () => {
  const allowedImages = ["image/jpeg", "image/png"];

  assert.doesNotThrow(() => assertAllowedDocumentContentTypes([
    { name: "invitation.JPG", type: "application/octet-stream" },
    { name: "notice.png", type: "" },
  ], allowedImages));
  assert.throws(
    () => assertAllowedDocumentContentTypes([{ name: "notice.pdf", type: "application/pdf" }], allowedImages),
    /UNSUPPORTED_DOCUMENT_TYPE/,
  );
});
