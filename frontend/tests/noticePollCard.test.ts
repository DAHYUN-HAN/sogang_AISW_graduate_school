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

function harness(initialPoll: NoticePoll, failures = 0, holdVote = false) {
  let poll = initialPoll;
  const path = join(process.cwd(), "components/NoticePollCard.tsx");
  const nativeRequire = createRequire(path), react = nativeRequire("react");
  const states: unknown[] = [];
  let index = 0;
  const submissions: unknown[][] = [];
  const queryKeys: unknown[] = [];
  const infiniteOptions: any[] = [];
  const participantCalls: unknown[][] = [];
  let release!: () => void;
  const pending = holdVote ? new Promise<void>(resolve => {release = resolve;}) : Promise.resolve();
  const member = {user_id: 7, nickname: "홍길동", cohort: "72", major: "데이터사이언스·인공지능", answers: [{question_id: 10, question_title: "장소", option_id: 20, label: "학교"}]};
  const pages = [{status: "success", data: [member], pagination: {page: 1, size: 20, total_pages: 2, total: 21}}];
  const cacheActions: {action: string; key?: unknown}[] = [];
  let cardKeys: (string | null)[] = [];
  let saveErrors = 0;
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  }}).outputText;
  const fakeApi = {get: async () => ({data: poll}), vote: async (...args: unknown[]) => {
    submissions.push(args);
    if (failures-- > 0) throw {response: {data: {message: "연결을 확인한 뒤 다시 시도해 주세요."}}};
    await pending;
    const answers = args[2] as NoticePoll["my_answers"];
    const my_answers = [...poll.my_answers.filter(a => !answers.some(next => next.question_id === a.question_id)), ...answers];
    const next = {...poll, has_voted: my_answers.some(a => a.option_ids.length > 0), my_answers,
      questions: poll.questions.map(q => {const answer = answers.find(a => a.question_id === q.id);
        return answer ? {...q, has_voted: answer.option_ids.length > 0} : q;})};
    return {data: next};
  },
    participants: async (...args: unknown[]) => {participantCalls.push(args); return {status: "success", data: [member], pagination: {page: args[1], size: 20, total_pages: 2, total: 21}};}};
  const module = {exports: {} as {default: (props: unknown) => unknown}};
  const loader = (id: string) => {
    if (id === "@expo/vector-icons") return {Ionicons: "Icon"};
    if (id === "react") return {...react, useEffect: () => {},
      useRef: (initial: unknown) => {const i = index++; if (!(i in states)) states[i] = {current: initial}; return states[i];},
      useState: (initial: unknown) => {const i = index++; if (!(i in states)) states[i] = typeof initial === "function" ? (initial as () => unknown)() : initial;
        return [states[i], (value: unknown) => {states[i] = typeof value === "function" ? (value as (v: unknown) => unknown)(states[i]) : value;}];}};
    if (id === "react-native") return {Platform: {OS: "web"}, useWindowDimensions: () => ({width: 390, height: 844}), View: "View", Pressable: "Pressable", Modal: "Modal", ScrollView: "ScrollView", ActivityIndicator: "Loading", StyleSheet: {create: (value: unknown) => value}};
    if (id === "react-native-safe-area-context") return {useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0})};
    if (id === "@tanstack/react-query") return {useQueryClient: () => ({
      cancelQueries: async (options: any) => {cacheActions.push({action: "cancel", key: options.queryKey});},
      setQueryData: (key: unknown, next: {data: NoticePoll}) => {cacheActions.push({action: "write", key}); poll = next.data;},
      invalidateQueries: async (options: any) => {cacheActions.push({action: "refetch", key: options.queryKey});}}),
      useInfiniteQuery: (options: any) => {queryKeys.push(options.queryKey); infiniteOptions.push(options); return {
        data: {pages}, isError: false, isFetching: false, isFetchingNextPage: false, hasNextPage: true,
        refetch: async () => {}, fetchNextPage: async () => {const next = await options.queryFn({pageParam: 2}); pages.push(next);},
      };},
      useQuery: (options: {queryKey: unknown[]}) => {queryKeys.push(options.queryKey); return {data: options.queryKey[0] === "notice-poll" ? {data: poll} : {data: [{user_id: 7, nickname: "홍길동", cohort: "72", answers: [{question_id: 10, question_title: "장소", option_id: 20, label: "학교"}]}], pagination: {page: 1, total_pages: 1, total: 1}}, refetch: async () => {}, isError: false, isFetching: false};}};
    if (id.endsWith("/services/api")) return {pollApi: fakeApi};
    if (id.endsWith("/stores/userStore")) return {useUserStore: (selector: (v: unknown) => unknown) => selector({userId: 1})};
    if (id.endsWith("/AppTypography")) return {AppText: "Text"};
    if (id.endsWith("/MediaImage")) return {__esModule: true, default: "MediaImage"};
    if (id.endsWith("/PersonListCard")) return {__esModule: true, default: "PersonListCard"};
    if (id.endsWith("/icons")) return {VoterAvatarIcon: "VoterAvatarIcon"};
    if (id.endsWith("/NetworkErrorState")) return {__esModule: true, default: "NetworkErrorState", LoadErrorState: "LoadErrorState", useLoadErrorOverlay: () => {}};
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
    walk(module.exports.default({postId: 50, poll, onSaveError: () => {saveErrors++;}}));
    return nodes;
  };
  return {render, saveErrors: () => saveErrors, submissions, queryKeys, cacheActions, infiniteOptions, participantCalls, release: () => release(), pages, keys: () => cardKeys, update: (next: NoticePoll) => {poll = next;}};
}


const label = (nodes: any[], value: string) => nodes.find(node => node.props.accessibilityLabel === value);
const voted = (): NoticePoll => ({...fixture, has_voted: true, locked: true, my_answers: [{question_id: 10, option_ids: [21]}]});
const words = (value: any): string => Array.isArray(value) ? value.map(words).join("") : typeof value === "string" || typeof value === "number" ? String(value) : "";
const texts = (nodes: any[]) => nodes.filter(node => node.type === "Text").map(node => words(node.props.children));

test("an option is only chosen until the card's vote button saves it", async () => {
  const view = harness(fixture);
  let nodes = view.render();
  assert.equal(label(nodes, "장소 투표하기").props.disabled, true);
  label(nodes, "장소 · 학교").props.onPress();
  nodes = view.render();
  assert.equal(view.submissions.length, 0);
  assert.equal(label(nodes, "장소 · 학교").props.accessibilityState.checked, true);
  assert.equal(label(nodes, "장소 투표하기").props.disabled, false);
  await label(nodes, "장소 투표하기").props.onPress();
  assert.deepEqual(view.submissions, [[50, 2, [{question_id: 10, option_ids: [20]}]]]);
  nodes = view.render();
  assert.equal(label(nodes, "장소 · 학교").props.accessibilityState.checked, true);
  assert.equal(label(nodes, "장소 · 학교").props.disabled, true);
  assert.ok(label(nodes, "장소 다시 투표하기"));
  assert.deepEqual(view.cacheActions.slice(0, 3), [
    {action: "cancel", key: ["notice-poll", 1, 50]},
    {action: "write", key: ["notice-poll", 1, 50]},
    {action: "refetch", key: ["notice-poll", 1, 50]},
  ]);
});

test("tapping the chosen option again clears it and disables a first vote", () => {
  const view = harness(fixture);
  label(view.render(), "장소 · 학교").props.onPress();
  label(view.render(), "장소 · 학교").props.onPress();
  const nodes = view.render();
  assert.equal(label(nodes, "장소 · 학교").props.accessibilityState.checked, false);
  assert.equal(label(nodes, "장소 투표하기").props.disabled, true);
});

test("an open unvoted card shows only options, a vote button and participants", () => {
  const view = harness({...fixture, questions: [...fixture.questions, {...fixture.questions[0], id: 11, title: "뒤풀이"}]});
  const nodes = view.render();
  assert.equal(nodes.filter(node => node.props.accessibilityRole === "radio").length, 4);
  assert.deepEqual(nodes.filter(node => node.props.accessibilityRole === "button").map(node => node.props.accessibilityLabel),
    ["장소 투표하기", "참여자 보기 · 0명 참여", "뒤풀이 투표하기", "참여자 보기 · 0명 참여"]);
  assert.ok(!texts(nodes).some(text => /응답 완료|기명 투표|진행 중|하나만 선택|마감/.test(text)));
});

test("revoting starts from the saved choice and only the vote button saves a change", async () => {
  const view = harness(voted());
  let nodes = view.render();
  assert.equal(label(nodes, "장소 · 학교").props.disabled, true);
  label(nodes, "장소 · 학교").props.onPress();
  assert.ok(!label(view.render(), "장소 투표하기"));
  label(nodes, "장소 다시 투표하기").props.onPress();
  nodes = view.render();
  assert.equal(label(nodes, "장소 · 식당").props.accessibilityState.checked, true);
  assert.equal(label(nodes, "장소 투표하기").props.disabled, false);
  label(nodes, "장소 · 학교").props.onPress();
  nodes = view.render();
  assert.equal(view.submissions.length, 0);
  assert.equal(label(nodes, "장소 · 학교").props.accessibilityState.checked, true);
  assert.equal(label(nodes, "장소 · 식당").props.accessibilityState.checked, false);
  await label(nodes, "장소 투표하기").props.onPress();
  assert.deepEqual(view.submissions, [[50, 2, [{question_id: 10, option_ids: [20]}]]]);
  assert.ok(label(view.render(), "장소 다시 투표하기"));
});

test("resubmitting the saved choice closes revoting without a request", async () => {
  const view = harness(voted());
  label(view.render(), "장소 다시 투표하기").props.onPress();
  await label(view.render(), "장소 투표하기").props.onPress();
  assert.equal(view.submissions.length, 0);
  assert.ok(label(view.render(), "장소 다시 투표하기"));
});

test("clearing the saved choice and voting withdraws it back to a fresh card", async () => {
  const view = harness(voted());
  label(view.render(), "장소 다시 투표하기").props.onPress();
  label(view.render(), "장소 · 식당").props.onPress();
  let nodes = view.render();
  assert.equal(label(nodes, "장소 · 식당").props.accessibilityState.checked, false);
  assert.equal(label(nodes, "장소 투표하기").props.disabled, false);
  await label(nodes, "장소 투표하기").props.onPress();
  assert.deepEqual(view.submissions, [[50, 2, [{question_id: 10, option_ids: []}]]]);
  nodes = view.render();
  assert.equal(label(nodes, "장소 투표하기").props.disabled, true);
  assert.equal(label(nodes, "장소 · 식당").props.accessibilityState.checked, false);
  assert.equal(label(nodes, "장소 · 식당").props.disabled, false);
});

test("a pending vote keeps the choice and prevents repeated requests", async () => {
  const view = harness(voted(), 0, true);
  label(view.render(), "장소 다시 투표하기").props.onPress();
  label(view.render(), "장소 · 학교").props.onPress();
  const button = label(view.render(), "장소 투표하기");
  const work = button.props.onPress();
  await button.props.onPress();
  const nodes = view.render();
  assert.equal(view.submissions.length, 1);
  assert.equal(label(nodes, "장소 · 학교").props.accessibilityState.checked, true);
  assert.equal(label(nodes, "장소 · 학교").props.disabled, true);
  assert.equal(label(nodes, "장소 투표하기").props.disabled, true);
  view.release(); await work;
  assert.equal(label(view.render(), "장소 · 학교").props.accessibilityState.checked, true);
  assert.ok(label(view.render(), "장소 다시 투표하기"));
});

test("failed votes ask the screen for a toast and keep the choice for another try", async () => {
  const view = harness(fixture, 1);
  label(view.render(), "장소 · 학교").props.onPress();
  await label(view.render(), "장소 투표하기").props.onPress();
  let nodes = view.render();
  assert.equal(view.saveErrors(), 1);
  assert.equal(nodes.some(node => node.props.accessibilityRole === "alert"), false);
  assert.equal(label(nodes, "장소 · 학교").props.accessibilityState.checked, true);
  assert.equal(label(nodes, "장소 투표하기").props.disabled, false);
  await label(nodes, "장소 투표하기").props.onPress();
  nodes = view.render();
  assert.equal(view.submissions.length, 2);
  assert.equal(nodes.some(node => node.props.accessibilityRole === "alert"), false);
  assert.ok(label(nodes, "장소 다시 투표하기"));
});

test("closed and legacy cards show results and participants without any voting action", async () => {
  for (const poll of [{...fixture, is_closed: true}, {...fixture, questions: [{...fixture.questions[0], legacy: true}]}]) {
    const view = harness(poll);
    const nodes = view.render();
    assert.ok(label(nodes, "참여자 보기 · 0명 참여"));
    assert.ok(!label(nodes, "장소 다시 투표하기"));
    assert.ok(!label(nodes, "장소 투표하기"));
    assert.equal(label(nodes, "장소 · 학교").props.disabled, true);
    await label(nodes, "장소 · 학교").props.onPress();
    assert.equal(view.submissions.length, 0);
  }
  const textsClosed = texts(harness({...fixture, is_closed: true}).render());
  assert.ok(textsClosed.includes("마감"));
  assert.ok(textsClosed.includes("마감됨"));
  const closedAt = texts(harness({...fixture, is_closed: true, questions: [{...fixture.questions[0], is_closed: true, closed_at: "2026-10-30T09:00:00"}]}).render());
  assert.ok(closedAt.includes("10월 30일(금) 18:00 마감됨"));
  assert.ok(!textsClosed.some(text => /1위|종료/.test(text)));
});

test("an open card shows its deadline and a passed deadline closes it without waiting for the server", () => {
  const open = texts(harness({...fixture, questions: [{...fixture.questions[0], ends_at: "2099-10-30T09:00:00"}]}).render());
  assert.ok(open.includes("10월 30일(금) 18:00 마감"));
  const view = harness({...fixture, questions: [{...fixture.questions[0], ends_at: "2020-10-30T09:00:00"}]});
  const nodes = view.render();
  assert.ok(texts(nodes).includes("10월 30일(금) 18:00 마감됨"));
  assert.ok(texts(nodes).includes("마감"));
  assert.ok(!label(nodes, "장소 투표하기"));
  assert.equal(label(nodes, "장소 · 학교").props.disabled, true);
});

test("each card's vote button sends only its own question", async () => {
  const view = harness({...fixture, questions: [...fixture.questions, {...fixture.questions[0], id: 11, title: "뒤풀이", options: [
    {id: 30, label: "YES", media_id: null, vote_count: 0}, {id: 31, label: "NO", media_id: null, vote_count: 0}]}]});
  label(view.render(), "장소 · 학교").props.onPress();
  label(view.render(), "뒤풀이 · NO").props.onPress();
  await label(view.render(), "뒤풀이 투표하기").props.onPress();
  assert.deepEqual(view.submissions, [[50, 2, [{question_id: 11, option_ids: [31]}]]]);
});

test("legacy photo results keep their identifying image without enabling voting", () => {
  const view = harness({...fixture, questions: [{...fixture.questions[0], legacy: true,
    options: [{...fixture.questions[0].options[0], media_id: 44}, fixture.questions[0].options[1]]}]});
  const nodes = view.render();
  assert.ok(nodes.some(node => node.type === "MediaImage" && node.props.media.id === 44));
  assert.equal(label(nodes, "장소 · 학교").props.disabled, true);
  assert.ok(!label(nodes, "장소 다시 투표하기"));
});

test("participants open a dismissible bottom sheet with only option tabs and profile summaries", () => {
  const view = harness(voted());
  label(view.render(), "참여자 보기 · 0명 참여").props.onPress();
  let nodes = view.render();
  const modal = nodes.find(node => node.type === "Modal")!;
  assert.equal(modal.props.transparent, true);
  assert.deepEqual(nodes.filter(node => node.props.accessibilityRole === "tab").map(node => node.props.accessibilityLabel), ["학교 0명", "식당 0명"]);
  assert.ok(nodes.some(node => node.type === "PersonListCard" && node.props.name === "72기 홍길동" && node.props.caption === "데이터사이언스·인공지능"));
  assert.ok(!nodes.some(node => ["현황 새로고침", "항목별", "회원별", "미참여", "이전 참여자", "다음 참여자"].includes(node.props.accessibilityLabel)));
  label(nodes, "식당 0명").props.onPress();
  nodes = view.render();
  assert.equal(label(nodes, "식당 0명").props["aria-selected"], true);
  assert.deepEqual(view.queryKeys.at(-1), ["notice-poll-participants", 1, 50, 10, 21, "voted"]);
  label(nodes, "참여자 닫기").props.onPress();
  assert.ok(!view.render().some(node => node.type === "Modal"));
});

test("participant scrolling loads the next question-option page and deduplicates users", async () => {
  const view = harness(voted());
  label(view.render(), "참여자 보기 · 0명 참여").props.onPress();
  const nodes = view.render();
  const config = view.infiniteOptions.at(-1);
  assert.equal(config.initialPageParam, 1);
  assert.equal(config.getNextPageParam({pagination: {page: 1, total_pages: 2}}), 2);
  assert.equal(config.getNextPageParam({pagination: {page: 2, total_pages: 2}}), undefined);
  await nodes.find(node => node.type === "ScrollView")!.props.onScroll({nativeEvent: {layoutMeasurement: {height: 300}, contentOffset: {y: 950}, contentSize: {height: 1250}}});
  assert.deepEqual(view.participantCalls, [[50, 2, 20, 10]]);
  assert.equal(view.render().filter(node => node.type === "PersonListCard").length, 1);
});

test("web radio Space activation chooses without saving or scrolling the page", async () => {
  const view = harness(fixture);
  const option = label(view.render(), "장소 · 학교");
  let prevented = false;
  option.props.onKeyDown({key: " ", preventDefault: () => {prevented = true;}, stopPropagation: () => {}});
  assert.equal(prevented, true);
  assert.equal(view.submissions.length, 0);
  assert.equal(label(view.render(), "장소 · 학교").props.accessibilityState.checked, true);
});

test("adding another card preserves the existing card identity", () => {
  const view = harness(fixture); view.render();
  const original = view.keys()[0];
  view.update({...fixture, revision: 3, questions: [...fixture.questions, {...fixture.questions[0], id: 11}]}); view.render();
  assert.equal(view.keys()[0], original);
});
