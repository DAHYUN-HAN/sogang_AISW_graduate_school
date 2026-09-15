import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Render the actual form field to check its layout/prop contract. Native gesture
// ownership and caret visibility are verified separately in the Android APK.
const source = ts.createSourceFile("create.tsx", readFileSync("app/(tabs)/board/post/create.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = source.statements.filter((node) =>
  (ts.isFunctionDeclaration(node) && node.name?.text === "FormTextInput") ||
  (ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => ["COLORS", "styles"].includes(declaration.name.getText(source)))),
);
const code = ts.transpileModule(`${declarations.map((node) => node.getText(source)).join("\n")}\nrender = FormTextInput;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, jsxFactory: "element" },
}).outputText;
type Props = Record<string, any>;
type Element = { type: string; props: Props; children: Element[] };
const flatten = (style: any): Props => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

function harness(platform: string, multiline = true, minHeight = 100) {
  const state: unknown[] = [];
  let hook = 0;
  const changes: string[] = [];
  const props = {
    multiline, value: "long draft\n".repeat(60), onChangeText: (value: string) => changes.push(value),
    placeholder: "내용", style: { width: "100%", minHeight, borderWidth: 0.5, borderRadius: 8, borderColor: "red", paddingVertical: 12, fontSize: 14 },
  };
  const context = {
    Platform: { OS: platform }, TextInput: "TextInput", ScrollView: "ScrollView",
    StyleSheet: { create: (styles: unknown) => styles, flatten },
    element: (type: string, attributes: Props, ...children: Element[]): Element => ({ type, props: attributes, children }),
    useState(initial: unknown) {
      const slot = hook++;
      if (!(slot in state)) state[slot] = initial;
      return [state[slot], (next: unknown) => { state[slot] = next; }];
    },
    render: undefined as unknown as (props: Props) => Element,
  };
  runInNewContext(code, context);
  return { render: () => { hook = 0; return context.render(props); }, props, changes };
}

for (const platform of ["android"]) {
  test(`${platform}: long text has a bounded independent scroll viewport`, () => {
    const { render } = harness(platform);
    const viewport = render();
    assert.equal(viewport.type, "ScrollView", "The body needs its own scroll viewport instead of growing the entire form");
    const style = flatten(viewport.props.style);
    assert.equal(style.minHeight, 100);
    assert.ok(style.maxHeight >= 180 && style.maxHeight <= 280);
    assert.equal(viewport.props.nestedScrollEnabled, true);
    assert.equal(viewport.props.keyboardShouldPersistTaps, "handled");
    assert.equal(viewport.children[0].type, "TextInput");
    assert.equal(viewport.children[0].props.scrollEnabled, false, "The surrounding native ScrollView owns scrolling");
    assert.equal(flatten(viewport.children[0].props.style).maxHeight, undefined);
  });
}

test("iOS keeps its native scrolling text editor within a bounded height", () => {
  const input = harness("ios").render();
  assert.equal(input.type, "TextInput", "UITextView owns scrolling and caret reveal on iOS");
  const style = flatten(input.props.style);
  assert.equal(style.minHeight, 100);
  assert.ok(style.maxHeight >= 180 && style.maxHeight <= 280);
  assert.equal(input.props.scrollEnabled, true);
});

test("field minima and border remain visible around the scroll viewport", () => {
  for (const minHeight of [60, 70, 100, 111, 180]) {
    const h = harness("android", true, minHeight);
    const viewport = h.render();
    assert.equal(viewport.type, "ScrollView");
    const frame = flatten(viewport.props.style);
    const input = flatten(viewport.children[0].props.style);
    assert.equal(frame.minHeight, minHeight);
    assert.equal(frame.borderColor, "red");
    assert.equal(frame.borderRadius, 8);
    assert.equal(input.borderWidth, 0);
    assert.equal(input.minHeight + 2 * frame.borderWidth, minHeight);
  }
});

test("focus and editing preserve controlled input props without remounting", () => {
  const h = harness("android");
  assert.equal(h.render().type, "ScrollView");
  h.render().children[0].props.onFocus({});
  let viewport = h.render();
  assert.equal(flatten(viewport.props.style).borderWidth, 1.5);
  const input = viewport.children[0];
  assert.equal(input.props.onChangeText, h.props.onChangeText);
  assert.equal(input.props.value, h.props.value);
  input.props.onChangeText("edited\nbody");
  assert.deepEqual(h.changes, ["edited\nbody"]);
  input.props.onBlur({});
  viewport = h.render();
  assert.equal(viewport.type, "ScrollView");
  assert.equal(flatten(viewport.props.style).borderWidth, 0.5);
});

test("web and single-line inputs retain the existing input layout", () => {
  for (const [platform, multiline] of [["web", true], ["android", false], ["ios", false]] as const) {
    const h = harness(platform, multiline);
    const input = h.render();
    assert.equal(input.type, "TextInput");
    assert.equal(flatten(input.props.style).maxHeight, undefined);
    assert.equal(input.props.onChangeText, h.props.onChangeText);
  }
});
