import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

import { constrainTransform, imagePageAfterSwipe, zoomAroundPoint } from "../utils/imageViewer";
import { shouldOpenPostAttachment } from "../utils/postDetailImagePresentation";

const detail = ts.createSourceFile("detail.tsx", readFileSync("app/(tabs)/board/post/[postId].tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const viewer = ts.createSourceFile("viewer.tsx", readFileSync("components/ImageViewerModal.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function expression(source: ts.SourceFile, name: string) {
  let found: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = node.initializer;
    if (name === "attachmentRenderer" && ts.isCallExpression(node) && node.expression.getText(source) === "visibleAttachments.map") found = node.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(found, `Missing production expression: ${name}`);
  return ts.transpileModule(`(${found.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: "element" },
  }).outputText;
}

test("actual attachment tap opens the selected image in the modal without requesting an external URL", async () => {
  const selected: number[] = [];
  const renderer = runInNewContext(expression(detail, "attachmentRenderer"), {
    isNotice: false, shouldOpenPostAttachment, viewerImages: [{ id: 12 }, { id: 34 }],
    setViewerIndex: (index: number) => selected.push(index),
    element: (type: string, props: object) => ({ type, props }),
    Pressable: "Pressable", NaturalAspectMediaImage: "Image", NoticeAttachmentImage: "NoticeImage", styles: {},
    resolveMediaAccessUrl: () => { throw new Error("Images must never use external opening"); },
  });
  const rendered = renderer({ id: 34, content_type: "image/jpeg" });
  await rendered.props.onPress();
  assert.deepEqual(selected, [1]);
});

test("notice image taps open the modal like community images", async () => {
  const selected: number[] = [];
  const renderer = runInNewContext(expression(detail, "attachmentRenderer"), {
    isNotice: true, shouldOpenPostAttachment, viewerImages: [{ id: 12 }, { id: 34 }],
    setViewerIndex: (index: number) => selected.push(index),
    element: (type: string, props: object) => ({ type, props }),
    Pressable: "Pressable", NaturalAspectMediaImage: "Image", NoticeAttachmentImage: "NoticeImage", styles: {},
    resolveMediaAccessUrl: () => { throw new Error("Images must never use external opening"); },
  });
  const rendered = renderer({ id: 12, content_type: "image/png" });
  await rendered.props.onPress();
  assert.deepEqual(selected, [0]);
});

test("the actual viewer image list excludes guide thumbnails but keeps notice images", () => {
  const code = expression(detail, "viewerImages");
  const imageAttachments = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const participationDetailImages = [{ id: 2 }, { id: 3 }];
  const bindings = { imageAttachments, participationDetailImages, isAdminParticipationGuide: true, isNotice: false };
  assert.deepEqual(runInNewContext(code, bindings), participationDetailImages);
  assert.deepEqual(
    runInNewContext(code, { ...bindings, isAdminParticipationGuide: false, isNotice: true, isCouncilActivityEntry: true }),
    imageAttachments,
  );
});

function gestureHarness(name: "pan" | "pinch") {
  const callbacks: Record<string, (...args: any[]) => void> = {};
  const chain: object = new Proxy({}, { get: (_, key: string) => (arg: unknown) => {
    if (key.startsWith("on")) callbacks[key] = arg as (...args: any[]) => void;
    return chain;
  } });
  const pages: number[] = [];
  const bindings = {
    Gesture: { Pan: () => chain, Pinch: () => chain }, loaded: true, failed: false,
    scale: { value: 1 }, offsetX: { value: 0 }, offsetY: { value: 0 },
    startScale: { value: 1 }, startX: { value: 0 }, startY: { value: 0 },
    focalX: { value: 0 }, focalY: { value: 0 }, wasPinching: { value: false }, pinchTracking: { value: false },
    viewport: { width: 400 }, imageHeight: 600, fitted: { width: 400, height: 600 }, index: 1, count: 3,
    constrainTransform, imagePageAfterSwipe, zoomAroundPoint,
    runOnJS: (fn: (...args: any[]) => void) => fn, onPage: (index: number) => pages.push(index),
  };
  runInNewContext(expression(viewer, name), bindings);
  return { callbacks, bindings, pages };
}

test("a pan cancelled by the second finger never advances the photo", () => {
  const h = gestureHarness("pan");
  h.callbacks.onBegin(); h.callbacks.onStart();
  h.callbacks.onEnd({ translationX: -100, translationY: 0 }, false);
  assert.deepEqual(h.pages, []);
  h.callbacks.onEnd({ translationX: -100, translationY: 0 }, true);
  assert.deepEqual(h.pages, [2]);
});

test("lifting a pinch finger freezes the final transform before Android's focal-point update", () => {
  const h = gestureHarness("pinch");
  h.callbacks.onStart({ focalX: 250, focalY: 300 });
  h.callbacks.onUpdate({ focalX: 250, focalY: 300, scale: 2 });
  assert.equal(h.bindings.offsetX.value, -50);
  h.callbacks.onTouchesUp();
  h.callbacks.onUpdate({ focalX: 350, focalY: 300, scale: 2 });
  assert.equal(h.bindings.offsetX.value, -50);
  assert.equal(h.bindings.scale.value, 2);
});
