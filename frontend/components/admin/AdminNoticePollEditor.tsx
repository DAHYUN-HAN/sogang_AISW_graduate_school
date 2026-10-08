import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { AppText as Text, AppTextInput as TextInput } from "../AppTypography";
import MediaImage from "../MediaImage";
import type { NoticePollDraft } from "../../types";
import { blankPoll, blankPollQuestion, noticePollDraft } from "../../utils/noticePoll";
import { pollApi } from "../../services/api";
import { useAdminAlert } from "../../utils/adminAlert";

type Props = {value: NoticePollDraft | null; onChange: (value: NoticePollDraft | null) => void;
  disabled?: boolean; postId?: number | null; sessionKey?: string; onBusy?: (busy: boolean) => void};

function Button({label, onPress, disabled = false, primary = false}: {label: string; onPress: () => void; disabled?: boolean; primary?: boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    style={[styles.button, primary && styles.primary, disabled && {opacity: .45}]}>
    <Text style={[styles.buttonText, primary && {color: "#2761FF"}]}>{label}</Text>
  </Pressable>;
}

export default function AdminNoticePollEditor({value, onChange, disabled, postId, sessionKey, onBusy}: Props) {
  const Alert = useAdminAlert();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const operation = useRef(false);
  const scope = `${sessionKey ?? ""}:${postId ?? "new"}`;
  const currentScope = useRef(scope);
  const currentDraft = useRef(value);
  currentScope.current = scope; currentDraft.current = value;
  useEffect(() => { alive.current = true; return () => {alive.current = false; onBusy?.(false);}; }, [onBusy]);
  const blocked = Boolean(disabled || busy);
  const updateQuestion = (index: number, patch: Partial<NoticePollDraft["questions"][number]>) => {
    if (value) onChange({...value, questions: value.questions.map((q, i) => i === index ? {...q, ...patch} : q)});
  };
  const close = (questionId: number) => {
    const origin = scope;
    const index = value?.questions.findIndex(q => q.id === questionId) ?? -1;
    const question = value?.questions[index];
    if (!question) return;
    Alert.alert("투표 종료", `투표 ${index + 1} ‘${question.saved_title ?? question.title}’\n${question.participant_count ?? 0}명 참여 · 참여 수는 현재 불러온 기준입니다.\n\n공지 저장과 별도로 즉시 종료됩니다. 저장된 내용으로 종료하며, 이 투표의 저장하지 않은 수정은 취소됩니다. 종료 후에는 다시 열거나 참여·선택 변경을 할 수 없습니다. 종료할까요?`, [
      {text: "취소", style: "cancel"}, {text: "종료", onPress: () => {void (async () => {
        if (!postId || blocked || operation.current || currentScope.current !== origin) return;
        operation.current = true; setBusy(true); onBusy?.(true); setError("");
        try {
          const response = await pollApi.close(postId, questionId);
          const latest = currentDraft.current;
          const saved = noticePollDraft(response.data);
          if (alive.current && currentScope.current === origin && latest && saved) {
            const closedQuestion = saved.questions.find(q => q.id === questionId);
            // Keep other unsaved cards and the original revision for conflict detection.
            if (closedQuestion) onChange({...latest, is_closed: saved.is_closed, locked: saved.locked,
              participant_count: saved.participant_count, questions: latest.questions.map(q => q.id === questionId
                ? closedQuestion : q)});
          }
          await Promise.all([queryClient.invalidateQueries({queryKey: ["post", postId]}),
            queryClient.invalidateQueries({queryKey: ["notice-poll"]}),
            queryClient.invalidateQueries({queryKey: ["notice-poll-participants"]}),
            queryClient.invalidateQueries({queryKey: ["admin-posts"]}),
            queryClient.invalidateQueries({queryKey: ["admin-audit-logs"]}),
            queryClient.invalidateQueries({queryKey: ["admin-main"]})]);
        } catch (issue) { if (alive.current && currentScope.current === origin) setError(
          (issue as {response?: {data?: {message?: string}}}).response?.data?.message ?? "투표를 종료하지 못했습니다. 다시 시도해 주세요."); }
        finally {operation.current = false; if (alive.current) {setBusy(false); onBusy?.(false);} }
      })();}},
    ]);
  };
  if (!value) return <View style={styles.container}>
    <View style={styles.header}><Text style={styles.heading}>참석 투표</Text><Button label="투표 추가" disabled={blocked} onPress={() => onChange(blankPoll())} /></View>
    <Text style={styles.muted}>공지에 참석 여부를 물어보는 투표를 추가할 수 있습니다.</Text>
  </View>;
  const canRemove = !value.questions.some(q => q.locked || q.is_closed);
  return <View style={styles.container}>
    <View style={styles.header}><View style={{gap: 5}}><Text style={styles.heading}>참석 투표</Text>
      <Text style={styles.muted}>투표 {value.questions.length}/20개 · 항목 2개 · 하나만 선택 · 관리자 직접 종료</Text></View>
      {canRemove ? <Button label="투표 모두 삭제" disabled={blocked} onPress={() => onChange(null)} /> : null}
    </View>
    <Text style={styles.guidance}>첫 응답이 등록되면 해당 투표의 제목·항목을 수정하거나 삭제할 수 없습니다. 등록 전에 질문과 항목을 확인해 주세요.</Text>
    {value.questions.map((question, qi) => {
      const locked = blocked || Boolean(question.locked || question.is_closed || question.legacy);
      return <View key={question.id ?? `new-${qi}`} style={styles.question}>
        <View style={styles.header}><View style={styles.row}><Text style={styles.label}>투표 {qi + 1}</Text>
          <Text style={[styles.status, question.is_closed && styles.closed]}>{!question.id ? "작성 중" : question.is_closed ? "종료" : "진행 중"}</Text>
          {question.id ? <Text style={styles.muted}>{question.participant_count ?? 0}명 참여</Text> : <Text style={styles.muted}>공지 저장 후 시작</Text>}
        </View><View style={styles.row}>
          {!question.legacy ? <Button label="투표 복제" disabled={blocked || value.questions.length >= 20}
            onPress={() => onChange({...value, questions: [...value.questions, {
              title: question.title, kind: "text", allow_multiple: false, options: question.options.map(o => ({label: o.label})),
            }]})} /> : null}
          {postId && value.revision && question.id && !question.is_closed
            ? <Button label="투표 종료" disabled={blocked} onPress={() => close(question.id!)} /> : null}
          {!question.locked && !question.is_closed ? <Button label={`투표 ${qi + 1} 삭제`} disabled={blocked}
            onPress={() => onChange(value.questions.length === 1 ? null : {...value, questions: value.questions.filter((_, i) => i !== qi)})} /> : null}
        </View></View>
        <TextInput accessibilityLabel={`투표 질문 ${qi + 1}`} placeholder="예: AISW인의 밤에 참석하시나요?" maxLength={100}
          value={question.title} editable={!locked} onChangeText={title => updateQuestion(qi, {title})} style={[styles.input, locked && styles.readonly]} />
        {question.options.map((option, oi) => <View key={option.id ?? `new-${oi}`} style={styles.option}>
          <View style={styles.number}><Text style={styles.muted}>{oi + 1}</Text></View>
          <TextInput accessibilityLabel={`질문 ${qi + 1} 항목 ${oi + 1}`} maxLength={100}
            placeholder={oi === 0 ? "YES" : "NO"} value={option.label} editable={!locked}
            onChangeText={label => updateQuestion(qi, {options: question.options.map((o, i) => i === oi ? {...o, label} : o)})}
            style={[styles.input, {flex: 1}, locked && styles.readonly]} />
          {option.media_id ? <MediaImage media={{id: option.media_id}} style={styles.image} resizeMode="cover" /> : null}
        </View>)}
        {question.legacy ? <Text style={styles.muted}>기존 형식의 투표는 결과와 참여 기록을 유지합니다. 새 참석 투표를 추가해 주세요.</Text>
          : question.is_closed ? <Text style={styles.muted}>종료한 투표의 결과와 참여 기록은 계속 확인할 수 있습니다.</Text>
          : question.locked ? <Text style={styles.muted}>참여 기록이 있어 제목과 항목을 유지합니다. 다른 투표는 계속 추가할 수 있습니다.</Text>
          : <Text style={styles.muted}>YES / NO의 이름을 변경할 수 있습니다. 참여자는 종료 전까지 선택을 바꿀 수 있습니다.</Text>}
      </View>;
    })}
    <Button label="투표 추가" primary disabled={blocked || value.questions.length >= 20}
      onPress={() => onChange({...value, questions: [...value.questions, blankPollQuestion()]})} />
    <Text style={styles.muted}>투표 추가·수정·삭제는 아래 ‘공지 등록/저장’을 눌러 적용합니다. ‘투표 종료’는 확인 후 즉시 적용됩니다.</Text>
    {busy ? <Text style={styles.muted}>처리 중…</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: {borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 10, backgroundColor: "#FFF", padding: 18, gap: 16},
  header: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12},
  row: {flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8}, heading: {fontSize: 16, fontWeight: "600", color: "#15171C"},
  question: {gap: 12, borderWidth: 1, borderColor: "#EEF0F3", borderRadius: 10, padding: 16},
  option: {flexDirection: "row", alignItems: "center", gap: 10},
  number: {width: 28, height: 28, borderRadius: 14, backgroundColor: "#F4F5F7", justifyContent: "center", alignItems: "center"},
  label: {fontSize: 13, fontWeight: "600", color: "#15171C"}, muted: {fontSize: 12, color: "#6B7280", lineHeight: 19},
  status: {fontSize: 11, color: "#2761FF", backgroundColor: "#EAF0FF", paddingVertical: 4, paddingHorizontal: 7, borderRadius: 4},
  closed: {color: "#6B7280", backgroundColor: "#F4F5F7"},
  input: {borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 8, minHeight: 42, padding: 10, fontSize: 13, color: "#15171C", backgroundColor: "#FFF"},
  readonly: {backgroundColor: "#F8F9FB"}, image: {width: 42, height: 42, borderRadius: 6},
  button: {borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 7, paddingVertical: 9, paddingHorizontal: 12},
  buttonText: {fontSize: 12, color: "#15171C"}, primary: {backgroundColor: "#EAF0FF", borderColor: "#2761FF"},
  error: {fontSize: 13, color: "#B91C1C"},
  guidance: {fontSize: 13, color: "#374151", lineHeight: 21, backgroundColor: "#F4F6FA", padding: 12, borderRadius: 6},
});

