import assert from "node:assert/strict";
import test from "node:test";
import { blankPoll, noticePollDraft, noticePollPayload, togglePollChoice, validPollAnswers, pollCacheKey } from "../utils/noticePoll";
import type { NoticePoll } from "../types";

const poll: NoticePoll = {
  id: 1, post_id: 8, revision: 3, ends_at: "2026-10-15T09:00:00Z", closed_at: null,
  is_closed: false, locked: true, participant_count: 2, has_voted: true,
  my_answers: [{question_id: 10, option_ids: [21]}],
  questions: [{id: 10, title: "장소", kind: "text", allow_multiple: false,
    options: [{id: 20, label: "학교", media_id: 4, vote_count: 1}, {id: 21, label: "식당", media_id: null, vote_count: 1}]}],
};

test("editor hydration preserves legacy IDs and images but removes automatic deadline", () => {
  const draft = noticePollDraft(poll)!;
  assert.equal(draft.ends_at, "");
  assert.deepEqual(noticePollPayload(draft), {
    revision: 3, ends_at: null,
    questions: [{id: 10, title: "장소", kind: "text", allow_multiple: false,
      options: [{id: 20, label: "학교", media_id: 4}, {id: 21, label: "식당", media_id: null}]}],
  });
});

test("new polls have two editable options and no implicit deadline", () => {
  const value = blankPoll();
  assert.equal(value.questions.length, 1);
  assert.equal(value.questions[0].options.length, 2);
  assert.deepEqual(value.questions[0].options.map(o => o.label), ["YES", "NO"]);
  value.questions[0].title = "날짜";
  value.questions[0].options = [{label: "A"}, {label: "B"}];
  assert.equal(noticePollPayload(value)!.ends_at, null);
  assert.equal(noticePollPayload(null), null);
});

test("single choice replaces selection; multiple choice toggles", () => {
  assert.deepEqual(togglePollChoice([20], 21, false), [21]);
  assert.deepEqual(togglePollChoice([20], 20, false), [20]);
  assert.deepEqual(togglePollChoice([20], 21, true), [20, 21]);
  assert.deepEqual(togglePollChoice([20, 21], 20, true), [21]);
});

test("submission accepts one independent poll and rejects foreign or repeated choices", () => {
  assert.equal(validPollAnswers(poll, {10: [21]}), true);
  const invalid: Record<number, number[]>[] = [{}, {10: []}, {10: [99]}, {10: [20, 21]}, {10: [20, 20]}, {10: [20], 99: [20]}];
  for (const values of invalid)
    assert.equal(validPollAnswers(poll, values), false);
});

test("another poll need not be answered to submit the first", () => {
  const two = {...poll, questions: [...poll.questions, {...poll.questions[0], id: 11, options: [{id: 30, label: "YES", media_id: null, vote_count: 0}, {id: 31, label: "NO", media_id: null, vote_count: 0}]}]};
  assert.equal(validPollAnswers(two, {11: [30]}), true);
});

test("new attendance cards enforce exactly two text labels, single choice, and manual closure", () => {
  for (const patch of [{allow_multiple: true}, {kind: "date" as const}, {options: [{label: "A"}, {label: "B"}, {label: "C"}]}]) {
    const draft = blankPoll(); draft.questions[0] = {...draft.questions[0], title: "참석", ...patch};
    assert.throws(() => noticePollPayload(draft));
  }
  const draft = blankPoll(); draft.questions[0].title = "참석"; draft.ends_at = "2026-10-15T18:00";
  assert.throws(() => noticePollPayload(draft));
  draft.ends_at = ""; draft.questions = Array.from({length: 4}, () => ({...blankPoll().questions[0], title: "참석"}));
  assert.equal(noticePollPayload(draft)?.questions.length, 4);
});

test("vote caches vary by both account and notice", () => {
  assert.notDeepEqual(pollCacheKey(1, 8), pollCacheKey(2, 8));
  assert.notDeepEqual(pollCacheKey(1, 8), pollCacheKey(1, 9));
});
