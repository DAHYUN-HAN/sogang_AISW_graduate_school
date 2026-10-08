import assert from "node:assert/strict";
import test from "node:test";
import { noticeSaveIssue, pollResponseProgress } from "../utils/noticePollUsability";
import type { NoticePoll } from "../types";

test("response progress excludes closed and legacy cards and counts saved answers only", () => {
  const question = {id: 1, title: "참석", kind: "text" as const, allow_multiple: false,
    options: [{id: 10, label: "YES", vote_count: 1, media_id: null}, {id: 11, label: "NO", vote_count: 0, media_id: null}]};
  const poll: NoticePoll = {id: 1, post_id: 1, revision: 1, ends_at: null, closed_at: null, is_closed: false,
    locked: true, participant_count: 1, has_voted: true, my_answers: [{question_id: 1, option_ids: [10]}, {question_id: 3, option_ids: [10]}],
    questions: [question, {...question, id: 2}, {...question, id: 3, is_closed: true}, {...question, id: 4, legacy: true}]};
  assert.deepEqual(pollResponseProgress(poll), {available: 2, answered: 1});
  assert.deepEqual(pollResponseProgress({...poll, is_closed: true, questions: [{...question, is_closed: undefined}]}), {available: 0, answered: 0});
});

test("save conflicts preserve the server reason and expose targeted reload recovery", () => {
  for (const code of ["POLL_CHANGED", "POLL_HAS_VOTES", "POLL_CLOSED"]) {
    const issue = noticeSaveIssue({response: {data: {code, message: "서버의 정확한 원인"}}});
    assert.equal(issue.reloadPoll, true);
    assert.match(issue.message, /서버의 정확한 원인/);
  }
  const input = noticeSaveIssue({response: {data: {code: "VALIDATION_ERROR", message: "제목을 확인해 주세요."}}});
  assert.equal(input.reloadPoll, false);
  assert.match(input.message, /제목을 확인/);
  const network = noticeSaveIssue(new Error("Network Error"));
  assert.equal(network.reloadPoll, false);
  assert.match(network.message, /연결/);
});
