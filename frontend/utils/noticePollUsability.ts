import type { NoticePoll, NoticePollQuestion } from "../types";

export function pollQuestionAcceptsVote(poll: NoticePoll, question: NoticePollQuestion) {
  return !(question.is_closed ?? poll.is_closed) && !question.legacy && question.kind === "text"
    && !question.allow_multiple && question.options.length === 2 && !question.options.some(option => option.media_id);
}

export function pollResponseProgress(poll: NoticePoll) {
  const available = poll.questions.filter(question => pollQuestionAcceptsVote(poll, question));
  return {available: available.length, answered: available.filter(question =>
    poll.my_answers.some(answer => answer.question_id === question.id
      && answer.option_ids.some(id => question.options.some(option => option.id === id)))).length};
}

export function noticeSaveIssue(error: unknown) {
  const data = (error as {response?: {data?: {code?: string; message?: string}}})?.response?.data;
  const reloadPoll = ["POLL_CHANGED", "POLL_HAS_VOTES", "POLL_CLOSED"].includes(data?.code ?? "");
  const reason = data?.message || "저장하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.";
  return {reloadPoll, message: `${reason}\n작성 내용은 유지됩니다.${reloadPoll ? " 최신 투표를 불러와 상태를 확인한 뒤 다시 저장해 주세요." : ""}`};
}
