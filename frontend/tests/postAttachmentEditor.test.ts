import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

type Item = { id: number; content_type: string; original_filename: string; file_size: number; url: string; status: string };
const photo: Item = { id: 1, content_type: "image/png", original_filename: "photo.png", file_size: 1024, url: "/uploads/photo.png", status: "ready" };
const document: Item = { ...photo, id: 2, content_type: "application/pdf", original_filename: "notes.pdf" };
const replacement: Item = { ...photo, id: 3, original_filename: "replacement.png" };
const replacementDocument: Item = { ...document, id: 3, original_filename: "replacement.pdf" };

function editorHarness(isPrivate = false) {
  const path = "components/PostAttachmentEditor.tsx";
  assert.ok(existsSync(path), "The shared attachment editor is implemented");
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  let items = [photo, document];
  let result: Item[] = [];
  let failure = false;
  let cursor = 0;
  const state: any[] = [];
  const busy: boolean[] = [];
  const pickerCalls: unknown[][] = [];
  const opened: unknown[][] = [];
  const picker = async (...args: unknown[]) => { pickerCalls.push(args); if (failure) throw new Error("upload failed"); return result; };
  const jsx = (type: unknown, props: any) => ({ type, props });
  const module = { exports: {} as any };
  runInNewContext(code, {
    exports: module.exports, module,
    window: { location: { assign: (...args: unknown[]) => opened.push(args) } },
    require: (id: string) => {
      if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (id === "react") return {
        useState: (initial: unknown) => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], (value: unknown) => { state[i] = value; }]; },
        useRef: (initial: unknown) => { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i]; },
      };
      if (id === "react-native") return { View: "View", Text: "Text", Pressable: "Pressable", Platform: { OS: "web" }, Keyboard: { dismiss: () => {} }, StyleSheet: { create: (x: unknown) => x } };
      if (id === "@expo/vector-icons") return { Ionicons: "Icon" };
      if (id === "./icons") return { AttachFileIcon: "AttachFileIcon", CloseIcon: "CloseIcon" };
      if (id.includes("mediaPicker")) return { pickAndUploadImages: picker, pickAndUploadDocuments: picker };
      if (id.includes("useMediaAccessUrl")) return { resolveMediaAccessUrl: async () => "/signed-file" };
      if (id.includes("mediaOpener")) return { openMediaUrl: async (url: string, options: any) => options.assignWebLocation(url) };
      if (id.includes("MediaImage")) return { __esModule: true, default: "MediaImage" };
      if (id.includes("ImageViewerModal")) return { __esModule: true, default: "ImageViewerModal" };
      throw new Error(`Unexpected dependency: ${id}`);
    },
  });
  const render = () => {
    cursor = 0;
    return module.exports.default({ attachments: items, isPrivate, title: isPrivate ? "증빙파일" : undefined, onUploadingChange: (value: boolean) => busy.push(value), onChange: (next: any) => { items = typeof next === "function" ? next(items) : next; } });
  };
  function nodes(node: any): any[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    return [node, ...nodes(node.props?.children)];
  }
  function texts(node: any): string[] {
    if (typeof node === "string") return [node];
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(texts);
    return texts(node.props?.children);
  }
  const press = async (label: string) => {
    const button = nodes(render()).find((node) => node.props?.accessibilityLabel === label);
    assert.ok(button, `Missing action: ${label}`);
    await button.props.onPress();
  };
  return { press, render, nodes, texts, busy, pickerCalls, opened, items: () => items, select: (value: Item[]) => { result = value; }, fail: () => { failure = true; } };
}

test("community attachment editor matches the approved single-button attachment design", () => {
  const h = editorHarness();
  const rendered = h.render();
  const texts = h.texts(rendered);
  const renderedNodes = h.nodes(rendered);
  const labels = renderedNodes.flatMap((node) => node.props?.accessibilityLabel ?? []);
  const addButton = renderedNodes.find((node) => node.props?.accessibilityLabel === "파일 첨부");
  const removeButton = renderedNodes.find((node) => node.props?.accessibilityLabel === "photo.png 삭제");
  const openDocumentButton = renderedNodes.find((node) => node.props?.accessibilityLabel === "notes.pdf 열기");

  assert.equal(texts.filter((value) => value === "파일 첨부").length, 1);
  assert.ok(!texts.includes("이미지 첨부"));
  assert.ok(texts.includes("※ JPG, PNG, PDF, DOCX 첨부 가능"));
  assert.ok(!texts.some((value) => value.startsWith("첨부파일 ·")));
  assert.ok(labels.includes("photo.png 열기"));
  assert.ok(!labels.includes("photo.png 변경"));
  assert.ok(labels.includes("photo.png 삭제"));
  assert.equal(addButton.props.style[0].minHeight, 44);
  assert.equal(removeButton.props.style[0].width, 44);
  assert.equal(removeButton.props.style[0].height, 44);
  assert.equal(openDocumentButton.props.style.minHeight, 44);
});

test("removing an existing photo preserves the existing document", async () => {
  const h = editorHarness();
  await h.press("photo.png 삭제");
  assert.deepEqual(Array.from(h.items(), (item) => item.id), [2]);
});

test("the single file button appends selected images and documents", async () => {
  const h = editorHarness();
  h.select([replacement]);
  await h.press("파일 첨부");
  assert.deepEqual(Array.from(h.items(), (item) => item.id), [1, 2, 3]);
});

test("document replacement preserves order and cancellation or failure preserves the old attachment", async () => {
  const h = editorHarness();
  await h.press("notes.pdf 변경");
  assert.deepEqual(Array.from(h.items(), (item) => item.id), [1, 2]);
  h.select([replacementDocument]);
  await h.press("notes.pdf 변경");
  assert.deepEqual(Array.from(h.items(), (item) => item.id), [1, 3]);
  h.fail();
  await h.press("replacement.pdf 변경");
  assert.deepEqual(Array.from(h.items(), (item) => item.id), [1, 3]);
  assert.equal(h.busy.at(-1), false);
  assert.equal((h.pickerCalls.at(-1)?.[2] as { multiple: boolean }).multiple, false);
});

test("new private evidence uses a private document upload and retains existing evidence", async () => {
  const h = editorHarness(true);
  const rendered = h.render();
  const labels = h.nodes(rendered).flatMap((node) => node.props?.accessibilityLabel ?? []);

  assert.ok(h.nodes(rendered).some((node) => Array.isArray(node.props?.children) && node.props.children.join("") === "증빙파일 · 2"));
  assert.ok(labels.includes("photo.png 열기"));
  assert.ok(labels.includes("photo.png 변경"));
  const privateAddButton = h.nodes(rendered).find((node) => node.props?.accessibilityLabel === "파일 추가");
  assert.equal(privateAddButton.props.style[0].flex, 1);
  h.select([replacement]);
  await h.press("파일 추가");
  assert.deepEqual(Array.from(h.items(), (item) => item.id), [1, 2, 3]);
  assert.equal(h.pickerCalls[0][1], true);
});

test("opening a document uses the signed download endpoint without popup windows", async () => {
  const h = editorHarness();
  await h.press("photo.png 삭제");
  await h.press("notes.pdf 열기");
  assert.deepEqual(h.opened, [["/signed-file"]]);
  assert.deepEqual(Array.from(h.items(), (item) => item.id), [2]);
});
