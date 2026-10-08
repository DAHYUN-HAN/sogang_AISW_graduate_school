import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";
import type { NoticePoll } from "../types";

const fixture: NoticePoll = {id: 1, post_id: 50, revision: 2, ends_at: null, closed_at: null,
  is_closed: false, locked: false, participant_count: 0, has_voted: false,
  my_answers: [{question_id: 10, option_ids: []}],
  questions: [{id: 10, title: "장소", kind: "text", allow_multiple: false,
    options: [{id: 20, label: "학교", media_id: null, vote_count: 0}, {id: 21, label: "식당", media_id: null, vote_count: 0}]}]};

function harness(initialPoll: NoticePoll, failures = 0) {
  let poll = initialPoll;
  const path = join(process.cwd(), "components/NoticePollCard.tsx");
  const nativeRequire = createRequire(path), react = nativeRequire("react");
  const states: unknown[] = [];
  let index = 0;
  const submissions: unknown[][] = [];
  const queryKeys: unknown[] = [];
  const cacheActions: {action: string; key?: unknown}[] = [];
  let cardKeys: (string | null)[] = [];
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  }}).outputText;
  const fakeApi = {get: async () => ({data: poll}), vote: async (...args: unknown[]) => {
    submissions.push(args);
    if (failures-- > 0) throw {response: {data: {message: "연결을 확인한 뒤 다시 시도해 주세요."}}};
    return {data: {...poll, has_voted: true}};
  },
    participants: async () => ({data: [{user_id: 7, nickname: "홍길동", cohort: "72", answers: [{question_id: 10, question_title: "장소", option_id: 20, label: "학교"}]}], pagination: {page: 1, total_pages: 1, total: 1}})};
  const module = {exports: {} as {default: (props: unknown) => unknown}};
  const loader = (id: string) => {
    if (id === "react") return {...react, useEffect: () => {},
      useRef: (initial: unknown) => {const i = index++; if (!(i in states)) states[i] = {current: initial}; return states[i];},
      useState: (initial: unknown) => {const i = index++; if (!(i in states)) states[i] = typeof initial === "function" ? (initial as () => unknown)() : initial;
        return [states[i], (value: unknown) => {states[i] = typeof value === "function" ? (value as (v: unknown) => unknown)(states[i]) : value;}];}};
    if (id === "react-native") return {Platform: {OS: "web"}, useWindowDimensions: () => ({width: 390, height: 844}), View: "View", Pressable: "Pressable", Modal: "Modal", ScrollView: "ScrollView", ActivityIndicator: "Loading", StyleSheet: {create: (value: unknown) => value}};
    if (id === "react-native-safe-area-context") return {useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0})};
    if (id === "@tanstack/react-query") return {useQueryClient: () => ({
      cancelQueries: async (options: any) => {cacheActions.push({action: "cancel", key: options.queryKey});},
      setQueryData: (key: unknown) => {cacheActions.push({action: "write", key});},
      invalidateQueries: async (options: any) => {cacheActions.push({action: "refetch", key: options.queryKey});}}),
      useQuery: (options: {queryKey: unknown[]}) => {queryKeys.push(options.queryKey); return {data: options.queryKey[0] === "notice-poll" ? {data: poll} : {data: [{user_id: 7, nickname: "홍길동", cohort: "72", answers: [{question_id: 10, question_title: "장소", option_id: 20, label: "학교"}]}], pagination: {page: 1, total_pages: 1, total: 1}}, refetch: async () => {}, isError: false, isFetching: false};}};
    if (id.endsWith("/services/api")) return {pollApi: fakeApi};
    if (id.endsWith("/stores/userStore")) return {useUserStore: (selector: (v: unknown) => unknown) => selector({userId: 1})};
    if (id.endsWith("/AppTypography")) return {AppText: "Text"};
    if (id.endsWith("/MediaImage")) return {__esModule: true, default: "MediaImage"};
    if (id.endsWith("/PersonListCard")) return {__esModule: true, default: "PersonListCard"};
    return nativeRequire(id);
  };
  new Function("module", "exports", "require", compiled)(module, module.exports, loader);
  const render = () => {
    index = 0;
    cardKeys = [];
    const nodes: {type: unknown; props: Record<string, any>}[] = [];
    const walk = (node: any) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!react.isValidElement(node)) return;
      if (typeof node.type === "function") {
        if (node.type.name === "QuestionCard") cardKeys.push(node.key);
        return walk(node.type(node.props));
      }
      nodes.push(node); walk(node.props.children);
    };
    walk(module.exports.default({postId: 50, poll}));
    return nodes;
  };
  return {render, submissions, queryKeys, cacheActions, keys: () => cardKeys, update: (next: NoticePoll) => {poll = next;}};
}

test("member selects an option then submits actual question IDs once", async () => {
  const view = harness(fixture);
  let nodes = view.render();
  const submit = () => nodes.find(n => n.props.accessibilityLabel === "투표하기")!;
  assert.equal(submit().props.disabled, true);
  nodes.find(n => n.props.accessibilityLabel === "장소 · 학교")!.props.onPress();
  nodes = view.render();
  assert.equal(submit().props.disabled, false);
  await submit().props.onPress();
  assert.deepEqual(view.submissions[0], [50, 2, [{question_id: 10, option_ids: [20]}]]);
  assert.deepEqual(view.cacheActions.slice(0, 3), [
    {action: "cancel", key: ["notice-poll", 1, 50]},
    {action: "write", key: ["notice-poll", 1, 50]},
    {action: "refetch", key: ["notice-poll", 1, 50]},
  ]);
});

test("results can reopen existing selection for a revote", () => {
  const view = harness({...fixture, has_voted: true, locked: true, my_answers: [{question_id: 10, option_ids: [21]}]});
  let nodes = view.render();
  nodes.find(n => n.props.accessibilityLabel === "다시 투표하기")!.props.onPress();
  nodes = view.render();
  const selected = nodes.find(n => n.props.accessibilityLabel === "장소 · 식당")!;
  assert.equal(selected.props.accessibilityState.checked, true);
});

test("response receipt and progress use saved answers while a revote is still pending", () => {
  const second = {...fixture.questions[0], id: 11, title: "뒤풀이", options: [
    {id: 30, label: "YES", media_id: null, vote_count: 0}, {id: 31, label: "NO", media_id: null, vote_count: 0}]};
  const view = harness({...fixture, has_voted: true, my_answers: [{question_id: 10, option_ids: [21]}], questions: [...fixture.questions, second]});
  const words = (value: any): string => Array.isArray(value) ? value.map(words).join("") : typeof value === "string" || typeof value === "number" ? String(value) : "";
  const texts = (nodes: any[]) => nodes.filter(node => node.type === "Text").map(node => words(node.props.children));
  let nodes = view.render();
  assert.ok(texts(nodes).includes("진행 중인 투표 2개 중 1개 응답 완료"));
  assert.ok(texts(nodes).includes("응답 완료 · 식당"));
  nodes.find(n => n.props.accessibilityLabel === "다시 투표하기")!.props.onPress();
  nodes = view.render();
  nodes.find(n => n.props.accessibilityLabel === "장소 · 학교")!.props.onPress();
  nodes = view.render();
  assert.ok(texts(nodes).includes("현재 저장된 응답 · 식당"));
  assert.ok(texts(nodes).includes("진행 중인 투표 2개 중 1개 응답 완료"));
  assert.equal(view.submissions.length, 0);
});

test("results show only submitted choices after cancelling a new selection", () => {
  const view = harness({...fixture, has_voted: true, my_answers: [{question_id: 10, option_ids: [21]}]});
  let nodes = view.render();
  nodes.find(n => n.props.accessibilityLabel === "다시 투표하기")!.props.onPress();
  nodes = view.render();
  nodes.find(n => n.props.accessibilityLabel === "장소 · 학교")!.props.onPress();
  nodes = view.render();
  nodes.find(n => n.props.accessibilityLabel === "결과 보기")!.props.onPress();
  nodes = view.render();
  assert.equal(nodes.find(n => n.props.accessibilityLabel === "장소 · 학교")!.props.accessibilityState.checked, false);
  assert.equal(nodes.find(n => n.props.accessibilityLabel === "장소 · 식당")!.props.accessibilityState.checked, true);
});

test("closed results expose participants but never a submission action", () => {
  const view = harness({...fixture, is_closed: true});
  const nodes = view.render();
  assert.equal(nodes.some(n => ["투표하기", "다시 투표하기"].includes(n.props.accessibilityLabel)), false);
  assert.ok(nodes.some(n => n.props.accessibilityLabel === "참여자 보기 · 0명 참여"));
});

test("clicking result option opens filtered participants using person cards", () => {
  const view = harness({...fixture, has_voted: true, my_answers: [{question_id: 10, option_ids: [21]}]});
  let nodes = view.render();
  nodes.find(n => n.props.accessibilityLabel === "장소 · 학교")!.props.onPress();
  nodes = view.render();
  assert.ok(nodes.some(n => n.type === "PersonListCard" && n.props.name === "홍길동"));
  assert.ok(view.queryKeys.some((key: any) => key[0] === "notice-poll-participants" && key.includes(20)));
});

test("each attendance card submits only its own answer", async () => {
  const view = harness({...fixture, questions: [...fixture.questions, {...fixture.questions[0], id: 11, title: "뒤풀이", options: [
    {id: 30, label: "YES", media_id: null, vote_count: 0}, {id: 31, label: "NO", media_id: null, vote_count: 0}]}]});
  let nodes = view.render();
  nodes.find(n => n.props.accessibilityLabel === "장소 · 학교")!.props.onPress(); nodes = view.render();
  const buttons = nodes.filter(n => n.props.accessibilityLabel === "투표하기");
  assert.equal(buttons.length, 2); assert.equal(buttons[0].props.disabled, false); assert.equal(buttons[1].props.disabled, true);
  await buttons[0].props.onPress();
  assert.deepEqual(view.submissions[0], [50, 2, [{question_id: 10, option_ids: [20]}]]);
});

test("option participant count is reachable while selecting without changing the vote", () => {
  const view = harness(fixture);
  let nodes = view.render();
  const count = nodes.find(n => n.props.accessibilityLabel === "장소 · 학교 참여자 0명");
  assert.ok(count); count.props.onPress(); nodes = view.render();
  assert.ok(nodes.some(n => n.type === "PersonListCard"));
  assert.equal(nodes.find(n => n.props.accessibilityLabel === "장소 · 학교")!.props.accessibilityState.checked, false);
});

test("overall status offers option, member and nonparticipant views", () => {
  const view = harness({...fixture, has_voted: true, my_answers: [{question_id: 10, option_ids: [21]}]});
  view.render().find(n => n.props.accessibilityLabel?.startsWith("참여자 보기"))!.props.onPress();
  let nodes = view.render();
  assert.ok(nodes.some(n => n.props.accessibilityRole === "tab" && n.props.accessibilityLabel === "항목별"));
  assert.equal(nodes.find(n => n.props.accessibilityLabel === "항목별")!.props["aria-selected"], true);
  nodes.find(n => n.props.accessibilityRole === "tab" && n.props.accessibilityLabel === "회원별")!.props.onPress();
  nodes = view.render(); assert.ok(nodes.some(n => n.type === "PersonListCard"));
  assert.equal(nodes.find(n => n.props.accessibilityLabel === "회원별")!.props["aria-selected"], true);
  nodes.find(n => n.props.accessibilityRole === "tab" && n.props.accessibilityLabel === "미참여")!.props.onPress();
  nodes = view.render();
  assert.ok(view.queryKeys.some((key: any) => key.includes("not_voted")));
});

test("closed results distinguish winning options from zero-vote or tied results", () => {
  const result = {...fixture, is_closed: true, participant_count: 3, questions: [{...fixture.questions[0], participant_count: 3,
    options: fixture.questions[0].options.map((o, i) => ({...o, vote_count: i === 0 ? 2 : 1}))}]};
  const nodes = harness(result).render();
  assert.ok(nodes.some(n => n.type === "Text" && n.props.children === "1위"));
  assert.ok(!harness({...fixture, is_closed: true}).render().some(n => n.type === "Text" && n.props.children === "1위"));
  const tied = harness({...result, participant_count: 4, questions: [{...result.questions[0], participant_count: 4,
    options: result.questions[0].options.map(o => ({...o, vote_count: 2}))}]}).render();
  assert.equal(tied.filter(n => n.type === "Text" && n.props.children === "공동 1위").length, 2);
});

test("adding a different poll must not reset an in-progress card selection", () => {
  const view = harness(fixture); view.render();
  const original = view.keys()[0];
  view.update({...fixture, revision: 3, questions: [...fixture.questions, {...fixture.questions[0], id: 11}]}); view.render();
  assert.equal(view.keys()[0], original);
});

test("repeated taps while a vote is pending cannot send duplicate requests", async () => {
  const view = harness(fixture);
  view.render().find(n => n.props.accessibilityLabel === "장소 · 학교")!.props.onPress();
  const submit = view.render().find(n => n.props.accessibilityLabel === "투표하기")!;
  await Promise.all([submit.props.onPress(), submit.props.onPress()]);
  assert.equal(view.submissions.length, 1);
});

test("web radio choices accept Space without scrolling the page", () => {
  const view = harness(fixture);
  const choice = view.render().find(n => n.props.accessibilityLabel === "장소 · 학교")!;
  let prevented = false;
  choice.props.onKeyDown({key: " ", preventDefault: () => {prevented = true;}, stopPropagation: () => {}});
  const nodes = view.render();
  assert.equal(prevented, true);
  assert.equal(nodes.find(n => n.props.accessibilityLabel === "장소 · 학교")!.props["aria-checked"], true);
  assert.equal(nodes.find(n => n.props.accessibilityLabel === "투표하기")!.props.disabled, false);
});

test("a failed vote retains the chosen option and can be retried", async () => {
  const view = harness(fixture, 1);
  view.render().find(n => n.props.accessibilityLabel === "장소 · 학교")!.props.onPress();
  await view.render().find(n => n.props.accessibilityLabel === "투표하기")!.props.onPress();
  let nodes = view.render();
  assert.ok(nodes.some(n => n.props.accessibilityRole === "alert" && n.props.children === "연결을 확인한 뒤 다시 시도해 주세요."));
  assert.equal(nodes.find(n => n.props.accessibilityLabel === "장소 · 학교")!.props["aria-checked"], true);
  assert.equal(nodes.find(n => n.props.accessibilityLabel === "투표하기")!.props.disabled, false);
  await nodes.find(n => n.props.accessibilityLabel === "투표하기")!.props.onPress();
  nodes = view.render();
  assert.equal(view.submissions.length, 2);
  assert.deepEqual(view.submissions[0], view.submissions[1]);
  assert.equal(nodes.some(n => n.props.accessibilityRole === "alert"), false);
});
