import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

function editor(disabled = false) {
  const file = join(process.cwd(), "components/admin/AdminNoticeBodyEditor.tsx");
  const nativeRequire = createRequire(file), react = nativeRequire("react");
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  const module = {exports: {} as {default: (props: unknown) => unknown}};
  const loader = (id: string): any => {
    if (id === "react-native") return {View: "View"};
    if (id.endsWith("/AppTypography")) return {AppText: "Text", AppTextInput: "Input"};
    if (id.endsWith("/MediaImage")) return {__esModule: true, default: "Image"};
    if (id === "./AdminControls") return {ActionButton: "Button", COLORS: {}, RADIUS: {}};
    return nativeRequire(id);
  };
  new Function("module", "exports", "require", compiled)(module, module.exports, loader);
  const selections: unknown[] = [], changes: any[] = [], nodes: any[] = [];
  const walk = (node: any) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!react.isValidElement(node)) return;
    nodes.push(node); walk(node.props.children);
  };
  walk(module.exports.default({content: "앞뒤", images: [{media_id: 10, offset: 1}], attachments: [{id: 10, content_type: "image/png", original_filename: "이미지.png"}], disabled,
    onChange: (value: unknown) => changes.push(value), onSelectionChange: (value: unknown) => selections.push(value)}));
  return {nodes, changes, selections};
}

test("removing an inline image merges text and clears the obsolete cursor target", () => {
  const run = editor();
  run.nodes.find(n => n.type === "Button").props.onPress();
  assert.deepEqual(run.changes, [{content: "앞뒤", images: []}]);
  assert.deepEqual(run.selections, [null]);
});

test("editing after an image retains its position and locked editors reject text/removal", () => {
  const run = editor();
  run.nodes.filter(n => n.type === "Input")[1].props.onChangeText("후속 내용");
  assert.deepEqual(run.changes, [{content: "앞후속 내용", images: [{media_id: 10, offset: 1}]}]);
  const locked = editor(true);
  const input = locked.nodes.find(n => n.type === "Input");
  assert.equal(input.props.editable, false);
  input.props.onChangeText("바꾼 내용");
  locked.nodes.find(n => n.type === "Button").props.onPress();
  assert.deepEqual(locked.changes, []);
});
