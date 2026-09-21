import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  assertAllowedDocumentContentTypes,
  assertUploadSize,
} from "../utils/documentFiles";
import { UPLOAD_TOAST_MESSAGES, uploadFailureFeedback } from "../utils/uploadFeedback";

const pickerSource = readFileSync("utils/mediaPicker.ts", "utf8");
const editorSource = readFileSync("components/PostAttachmentEditor.tsx", "utf8");

test("한도는 서버 media_upload_max_bytes와 같은 10MB다", () => {
  assert.equal(MAX_UPLOAD_BYTES, 10 * 1024 * 1024);
});

test("한도를 넘는 파일은 올리기 전에 막는다", () => {
  assert.throws(
    () => assertUploadSize({ name: "big.pdf", size: MAX_UPLOAD_BYTES + 1 }),
    /^Error: FILE_TOO_LARGE:big\.pdf$/,
  );
});

test("한도와 같거나 작으면 통과한다", () => {
  assert.doesNotThrow(() => assertUploadSize({ name: "fit.pdf", size: MAX_UPLOAD_BYTES }));
  assert.doesNotThrow(() => assertUploadSize({ name: "small.png", size: 1 }));
});

test("크기를 모르는 파일은 막지 않고 서버 판단에 맡긴다", () => {
  assert.doesNotThrow(() => assertUploadSize({ name: "unknown.pdf" }));
  assert.doesNotThrow(() => assertUploadSize({ name: "unknown.pdf", size: null }));
});

test("사진과 문서가 모두 지나가는 한 곳에서 크기를 본다", () => {
  // 경로마다 따로 검사하면 새 업로드 경로가 생길 때 빠진다.
  assert.match(pickerSource, /async function uploadPickedFile\([\s\S]*?assertUploadSize\(file\);/);
  // 선택기가 알려주는 크기를 실제로 실어 보낸다.
  assert.match(pickerSource, /size: asset\.size,/);
  assert.match(pickerSource, /size: asset\.fileSize,/);
});

test("앱이 직접 막은 용량 초과도 서버 413과 같은 토스트를 띄운다", () => {
  const local = uploadFailureFeedback(new Error("FILE_TOO_LARGE:big.pdf"));
  assert.deepEqual(local, { kind: "toast", message: UPLOAD_TOAST_MESSAGES.size });
  assert.equal(UPLOAD_TOAST_MESSAGES.size, "10MB 이하 파일만 첨부할 수 있어요");
});

test("앱이 직접 막은 형식 오류도 형식 토스트를 띄운다", () => {
  const asFile = uploadFailureFeedback(new Error("UNSUPPORTED_DOCUMENT_TYPE:memo.hwp"));
  assert.deepEqual(asFile, { kind: "toast", message: UPLOAD_TOAST_MESSAGES.fileFormat });
  const asImage = uploadFailureFeedback(new Error("UNSUPPORTED_DOCUMENT_TYPE:memo.hwp"), true);
  assert.deepEqual(asImage, { kind: "toast", message: UPLOAD_TOAST_MESSAGES.imageFormat });
});

test("첨부 에디터는 업로드·열기 실패를 화면으로 넘겨 토스트·모달로 띄우게 한다", () => {
  // 토스트와 모달은 화면 기준으로 떠야 해서 스크롤 안의 에디터가 직접 띄울 수 없다.
  assert.match(editorSource, /onError\?\.\(uploadError\)/);
  assert.match(editorSource, /onError\?\.\(openError\)/);
  // 디자인에 없던 인라인 빨간 문구는 남기지 않는다.
  assert.doesNotMatch(editorSource, /파일을 업로드하지 못했어요/);
  assert.doesNotMatch(editorSource, /파일을 열지 못했어요/);
});

test("첨부는 안내 문구와 같은 4가지만 받는다", () => {
  assert.deepEqual([...ATTACHMENT_CONTENT_TYPES], [
    "image/jpeg",
    "image/png",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);
  // 화면 안내와 같은 목록이어야 한다.
  assert.match(editorSource, /※ JPG, PNG, PDF, DOCX 첨부 가능/);
  for (const extension of [".jpg", ".jpeg", ".png", ".pdf", ".docx"]) {
    assert.ok(ATTACHMENT_ACCEPT.includes(extension), `${extension} 누락`);
  }
});

test("4가지 밖의 파일은 고른 즉시 막고 서버로 보내지 않는다", () => {
  for (const name of ["exam.hwp", "materials.zip", "notes.txt", "legacy.doc", "sheet.xlsx", "photo.heic"]) {
    assert.throws(
      () => assertAllowedDocumentContentTypes([{ name }], ATTACHMENT_CONTENT_TYPES),
      new RegExp(`UNSUPPORTED_DOCUMENT_TYPE:${name.replace(".", "\.")}`),
      `${name}는 막혀야 한다`,
    );
  }
});

test("4가지 안의 파일은 통과한다", () => {
  assert.doesNotThrow(() => assertAllowedDocumentContentTypes(
    [{ name: "a.jpg" }, { name: "b.JPEG" }, { name: "c.png" }, { name: "d.pdf" }, { name: "e.docx" }],
    ATTACHMENT_CONTENT_TYPES,
  ));
});

test("문서 선택기는 형식을 안 넘기면 4가지로 열리고, 증빙처럼 더 좁은 자리는 그대로 둔다", () => {
  assert.match(pickerSource, /const allowedTypes = options\?\.types \?\? ATTACHMENT_CONTENT_TYPES/);
  assert.match(pickerSource, /const accept = options\?\.accept \?\? ATTACHMENT_ACCEPT/);
  // 네이티브 선택기가 아무 파일이나 열던 경로를 남기지 않는다.
  assert.doesNotMatch(pickerSource, /"\*\/\*"/);
});
