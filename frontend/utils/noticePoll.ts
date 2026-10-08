import type { NoticePoll, NoticePollDraft, NoticePollPayload } from "../types";

export const blankPollQuestion = (): NoticePollDraft["questions"][number] => ({
  title: "", kind: "text", allow_multiple: false, options: [{label: "YES"}, {label: "NO"}],
});
export const blankPoll = (): NoticePollDraft => ({ends_at: "", questions: [blankPollQuestion()]});
export const pollCacheKey = (userId: number | null, postId: number) => ["notice-poll", userId, postId] as const;
export function noticePollDraft(poll?: NoticePoll | null): NoticePollDraft | null {
  if (!poll) return null;
  return {revision: poll.revision, ends_at: "",
    locked: poll.locked, is_closed: poll.is_closed, participant_count: poll.participant_count,
    questions: poll.questions.map(q => ({id: q.id, title: q.title, saved_title: q.title, kind: q.kind, allow_multiple: q.allow_multiple,
      locked: q.locked ?? poll.locked, is_closed: q.is_closed ?? poll.is_closed, participant_count: q.participant_count ?? poll.participant_count,
      legacy: q.legacy ?? (q.kind !== "text" || q.allow_multiple || q.options.length !== 2 || q.options.some(o => o.media_id)),
      options: q.options.map(o => ({id: o.id, label: o.label, media_id: o.media_id}))}))};
}
export function noticePollPayload(draft: NoticePollDraft | null): NoticePollPayload | null {
  if (!draft) return null;
  if (draft.ends_at) throw new Error("투표는 관리자가 직접 종료합니다.");
  if (draft.questions.length < 1 || draft.questions.length > 20) throw new Error("투표는 1~20개 등록해 주세요.");
  const questions = draft.questions.map(q => {
    if (!q.title.trim() || q.title.trim().length > 100) throw new Error("투표 질문을 100자 이내로 입력해 주세요.");
    if (!(q.id && q.legacy) && (q.kind !== "text" || q.allow_multiple || q.options.length !== 2 || q.options.some(o => o.media_id)))
      throw new Error("참석 투표는 두 개의 텍스트 항목 중 하나만 선택합니다.");
    const labels = q.options.map(o => o.label.trim());
    if (labels.some(label => !label || label.length > 100)) throw new Error("모든 선택항목을 100자 이내로 입력해 주세요.");
    if (new Set(labels).size !== labels.length) throw new Error("선택항목은 중복할 수 없습니다.");
    return {id: q.id, title: q.title.trim(), kind: q.kind, allow_multiple: q.allow_multiple,
      options: q.options.map(o => ({id: o.id, label: o.label.trim(), media_id: o.media_id ?? null}))};
  });
  return {revision: draft.revision, ends_at: null, questions};
}
export const togglePollChoice = (values: number[], id: number, multiple: boolean) =>
  multiple ? values.includes(id) ? values.filter(v => v !== id) : [...values, id] : [id];
export function validPollAnswers(poll: NoticePoll, values: Record<number, number[]>): boolean {
  const entries = Object.entries(values);
  return entries.length > 0 && entries.every(([qid, ids]) => {
    const q = poll.questions.find(item => item.id === Number(qid));
    return !!q && !q.is_closed && !q.legacy && q.kind === "text" && !q.allow_multiple && q.options.length === 2
      && ids.length === 1 && q.options.some(o => o.id === ids[0]);
  });
}
export function pollOptionLabel(label: string, kind: "text" | "date") {
  if (kind === "text") return label;
  const date = new Date(`${label}T00:00:00+09:00`);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("ko-KR", {timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "short"}) : label;
}
