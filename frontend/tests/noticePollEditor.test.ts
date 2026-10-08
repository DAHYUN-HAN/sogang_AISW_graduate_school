import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";
import { blankPoll } from "../utils/noticePoll";

function editorHarness(value = blankPoll()) {
  const path = join(process.cwd(), "components/admin/AdminNoticePollEditor.tsx");
  const nativeRequire = createRequire(path), react = nativeRequire("react");
  const states: any[] = [], changes: unknown[] = [];
  let hook = 0;
  let finishClose!: (value: unknown) => void;
  const pending = new Promise(resolve => {finishClose = resolve;});
  let confirm = () => {};
  let dialog: {title: string; message: string} | undefined;
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  }}).outputText;
  const module = {exports: {} as {default: (props: unknown) => unknown}};
  const loader = (id: string): any => {
    if (id === "react") return {...react, useEffect: () => {}, useRef: (value: unknown) => {
      const i = hook++; return states[i] ?? (states[i] = {current: value});
    }, useState: (value: unknown) => {const i = hook++; if (!(i in states)) states[i] = value;
      return [states[i], (next: unknown) => {states[i] = next;}];}};
    if (id === "react-native") return {View: "View", Pressable: "Pressable", Platform: {OS: "web"}, StyleSheet: {create: (v: unknown) => v}};
    if (id === "@tanstack/react-query") return {useQueryClient: () => ({invalidateQueries: async () => {}})};
    if (id.endsWith("/AppTypography")) return {AppText: "Text", AppTextInput: "Input"};
    if (id.endsWith("/MediaImage") || id === "./AdminBannerSchedule") return {__esModule: true, default: "Stub"};
    if (id.endsWith("/services/api")) return {pollApi: {close: () => pending}};
    if (id.endsWith("/adminAlert")) return {useAdminAlert: () => ({alert: (title: string, message: string, buttons: any[]) => {dialog = {title, message}; confirm = buttons[1].onPress;}})};
    return nativeRequire(id);
  };
  new Function("module", "exports", "require", compiled)(module, module.exports, loader);
  const render = (postId: number) => {
    hook = 0;
    const nodes: any[] = [];
    const walk = (node: any) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!react.isValidElement(node)) return;
      if (typeof node.type === "function") return walk(node.type(node.props));
      nodes.push(node); walk(node.props.children);
    };
    walk(module.exports.default({postId, value, onChange: (value: unknown) => changes.push(value)}));
    return nodes;
  };
  return {render, changes, finishClose, confirm: () => confirm(), dialog: () => dialog};
}

test("a close finishing after a notice switch cannot overwrite the new draft", async () => {
  const {render, changes, finishClose, confirm} = editorHarness({...blankPoll(), revision: 1, questions: [{...blankPoll().questions[0], id: 10}]});
  const button = render(50).find(n => n.props.accessibilityLabel === "투표 종료");
  assert.ok(button);
  button.props.onPress();
  confirm();
  render(60);
  finishClose({data: {revision: 1, questions: [], my_answers: []}});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(changes.length, 0);
});

test("only a persisted poll exposes the immediate close action", () => {
  const hasClose = (nodes: any[]) => nodes.some(n => n.type === "Pressable" && n.props.children.props.children === "투표 종료");
  assert.equal(hasClose(editorHarness().render(50)), false);
  assert.equal(hasClose(editorHarness({...blankPoll(), revision: 1}).render(50)), false);
  assert.equal(hasClose(editorHarness({...blankPoll(), revision: 1, questions: [{...blankPoll().questions[0], id: 10}]}).render(50)), true);
});

test("locked or closed cards do not prevent adding another binary poll", () => {
  const view = editorHarness({...blankPoll(), locked: true, is_closed: true, questions: [{...blankPoll().questions[0], id: 10, locked: true, is_closed: true}]});
  const nodes = view.render(50);
  const add = nodes.find(n => n.props.accessibilityLabel === "투표 추가");
  assert.equal(add.props.disabled, false); add.props.onPress();
  assert.equal((view.changes[0] as any).questions.length, 2);
  assert.equal(nodes.some(n => n.props.accessibilityLabel === "복수선택 허용"), false);
});

test("closing restores that persisted card and keeps another unsaved card", async () => {
  const first = {...blankPoll().questions[0], id: 10, title: "미저장 제목"};
  const second = {...blankPoll().questions[0], title: "추가하는 투표"};
  const view = editorHarness({...blankPoll(), revision: 1, questions: [first, second]});
  view.render(50).find(n => n.props.accessibilityLabel === "투표 종료").props.onPress(); view.confirm();
  view.finishClose({data: {revision: 1, is_closed: true, locked: false, questions: [{...first, title: "저장된 제목", is_closed: true}]}});
  await new Promise(resolve => setImmediate(resolve));
  const updated = view.changes[0] as any;
  assert.equal(updated.questions[0].title, "저장된 제목");
  assert.equal(updated.questions[0].is_closed, true);
  assert.deepEqual(updated.questions[1], second);
});

test("copying a voted closed card retains labels but never votes, IDs or closure", () => {
  const question = {...blankPoll().questions[0], id: 10, title: "참석", locked: true, is_closed: true, participant_count: 8,
    options: [{id: 20, label: "참석"}, {id: 21, label: "불참"}]};
  const view = editorHarness({...blankPoll(), revision: 2, questions: [question]});
  const copy = view.render(50).find(n => n.props.accessibilityLabel === "투표 복제");
  assert.ok(copy); copy.props.onPress();
  const next = (view.changes[0] as any).questions[1];
  assert.deepEqual(next, {title: "참석", kind: "text", allow_multiple: false, options: [{label: "참석"}, {label: "불참"}]});
});

test("closing identifies the saved target even when its draft title was edited", () => {
  const question = {...blankPoll().questions[0], id: 10, title: "수정 중인 제목", saved_title: "뒤풀이 참석", participant_count: 7};
  const view = editorHarness({...blankPoll(), revision: 2, questions: [question]});
  view.render(50).find(n => n.props.accessibilityLabel === "투표 종료").props.onPress();
  assert.match(view.dialog()!.message, /뒤풀이 참석/);
  assert.match(view.dialog()!.message, /7명/);
  assert.doesNotMatch(view.dialog()!.message, /수정 중인 제목/);
  assert.equal(view.changes.length, 0);
});
