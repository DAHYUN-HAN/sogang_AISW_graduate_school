import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText as Text } from "./AppTypography";
import MediaImage from "./MediaImage";
import PersonListCard from "./PersonListCard";
import { pollApi } from "../services/api";
import { useUserStore } from "../stores/userStore";
import type { NoticePoll, NoticePollQuestion } from "../types";
import { pollCacheKey, pollOptionLabel, validPollAnswers } from "../utils/noticePoll";
import { pollQuestionAcceptsVote, pollResponseProgress } from "../utils/noticePollUsability";

function Button({label, onPress, disabled = false, primary = false, flex = false}: {label: string; onPress: () => void | Promise<void>; disabled?: boolean; primary?: boolean; flex?: boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} aria-disabled={disabled} disabled={disabled}
    onPress={onPress} style={[styles.button, primary && styles.primaryButton, flex && {flex: 1}, disabled && {opacity: .45}]}>
    <Text style={[styles.buttonText, primary && {color: "#2761FF"}]}>{label}</Text>
  </Pressable>;
}

export default function NoticePollCard({postId}: {postId: number; poll?: NoticePoll}) {
  const userId = useUserStore(state => state.userId);
  const client = useQueryClient();
  const query = useQuery({queryKey: pollCacheKey(userId, postId), queryFn: () => pollApi.get(postId),
    enabled: userId !== null, refetchInterval: 30_000});
  if (!query.data) return <View style={styles.container}>{query.isError ? <>
    <Text style={styles.error}>투표를 불러오지 못했습니다.</Text><Button label="투표 다시 불러오기" onPress={() => {void query.refetch();}} />
  </> : <ActivityIndicator color="#2761FF" />}</View>;
  const poll = query.data.data;
  const progress = pollResponseProgress(poll);
  return <View style={{gap: 16, marginTop: 22}}>
    {poll.questions.length > 1 ? <View style={styles.progress}>
      <Text style={styles.progressText} accessibilityLiveRegion="polite">{progress.available
        ? `진행 중인 투표 ${progress.available}개 중 ${progress.answered}개 응답 완료`
        : "현재 참여할 수 있는 투표가 없습니다."}</Text>
      <Text style={styles.muted}>{progress.available ? "각 투표에서 선택한 뒤 ‘투표하기’를 눌러 저장해 주세요." : "투표 결과와 참여 현황은 아래에서 확인할 수 있습니다."}</Text>
    </View> : null}
    {poll.questions.map(question =>
    <QuestionCard key={`${userId}:${postId}:${JSON.stringify([question.id, question.title, question.kind, question.allow_multiple,
      question.options.map(o => [o.id, o.label, o.media_id]), question.is_closed ?? poll.is_closed])}`}
      poll={poll} question={question} postId={postId} userId={userId}
      refresh={async () => {await query.refetch();}} onSaved={async next => {
        await client.cancelQueries({queryKey: pollCacheKey(userId, postId), exact: true});
        client.setQueryData(pollCacheKey(userId, postId), {status: "success", data: next});
        await Promise.all([
          client.invalidateQueries({queryKey: pollCacheKey(userId, postId), exact: true}),
          client.invalidateQueries({queryKey: ["notice-poll-participants", userId, postId]}),
          client.invalidateQueries({queryKey: ["post", postId]}),
        ]);
      }} />)}</View>;
}

function QuestionCard({postId, userId, poll, question, onSaved, refresh}: {postId: number; userId: number | null; poll: NoticePoll;
  question: NoticePollQuestion; onSaved: (poll: NoticePoll) => Promise<void>; refresh: () => Promise<void>}) {
  const isClosed = question.is_closed ?? poll.is_closed;
  const legacy = question.legacy ?? (question.kind !== "text" || question.allow_multiple || question.options.length !== 2 || question.options.some(o => o.media_id));
  const savedChoice = poll.my_answers.find(a => a.question_id === question.id)?.option_ids ?? [];
  const hasVoted = question.has_voted ?? savedChoice.length > 0;
  const count = question.participant_count ?? poll.participant_count;
  const canVote = pollQuestionAcceptsVote(poll, question);
  const savedLabels = question.options.filter(option => savedChoice.includes(option.id)).map(option => pollOptionLabel(option.label, question.kind)).join(", ");
  const [editing, setEditing] = useState(!hasVoted && canVote);
  const [choices, setChoices] = useState<number[]>(savedChoice);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [people, setPeople] = useState<{id?: number; label: string} | null>(null);
  const sending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  const valid = canVote && validPollAnswers(poll, {[question.id]: choices});
  const selecting = editing && canVote;
  const maximum = Math.max(0, ...question.options.map(o => o.vote_count));
  const leaders = isClosed && maximum > 0 ? question.options.filter(o => o.vote_count === maximum).map(o => o.id) : [];
  const submit = async () => {
    if (sending.current || !valid) return;
    sending.current = true; setSaving(true); setError("");
    try {
      const response = await pollApi.vote(postId, poll.revision, [{question_id: question.id, option_ids: choices}]);
      await onSaved(response.data);
      if (mounted.current) setEditing(false);
    } catch (issue) {
      if (mounted.current) setError((issue as {response?: {data?: {message?: string}}}).response?.data?.message ?? "투표를 저장하지 못했습니다. 다시 시도해 주세요.");
      await refresh();
    } finally {sending.current = false; if (mounted.current) setSaving(false);}
  };
  return <View style={styles.container}>
    <View style={styles.header}><Text style={styles.heading}>투표</Text>
      <View style={styles.titleRow}><Pressable accessibilityRole="button" accessibilityLabel="투표 새로고침" disabled={saving}
        onPress={() => {void refresh();}} style={styles.refresh}><Text style={styles.muted}>↻</Text></Pressable>
        <Text style={[styles.state, isClosed && styles.closed]}>{isClosed ? "종료" : legacy ? "결과" : "진행 중"}</Text></View></View>
    <Text style={styles.questionTitle}>{question.title}</Text>
    <Text style={styles.muted}>기명 투표{legacy ? " · 기존 투표 결과" : " · 하나만 선택"}</Text>
    <View style={styles.options}>{question.options.map(option => {
      const selected = (selecting ? choices : savedChoice).includes(option.id);
      const percentage = count ? Math.round(option.vote_count / count * 100) : 0;
      return <View key={option.id} style={styles.option}>
        <View style={styles.optionRow}>
          <Pressable accessibilityLabel={`${question.title} · ${option.label}`} style={styles.choice}
            accessibilityRole={selecting ? "radio" : "button"} accessibilityState={{checked: selected, disabled: saving}}
            aria-checked={selecting ? selected : undefined} aria-disabled={saving}
            {...(Platform.OS === "web" ? {onKeyDown: (event: {key: string; preventDefault: () => void; stopPropagation: () => void}) => {
              // RN Web activates Space for buttons, but not radio roles.
              if (selecting && !saving && (event.key === " " || event.key === "Spacebar")) {
                event.preventDefault(); event.stopPropagation(); setChoices([option.id]);
              }
            }} : {})}
            disabled={saving} onPress={() => {
              if (selecting) setChoices([option.id]);
              else setPeople({id: option.id, label: pollOptionLabel(option.label, question.kind)});
            }}>
          {selecting ? <View style={[styles.radio, selected && styles.checked]}>
            {selected ? <Text style={styles.check}>✓</Text> : null}</View> : selected ? <Text style={styles.myVote}>✓</Text> : null}
          {option.media_id ? <MediaImage media={{id: option.media_id}} style={styles.image} resizeMode="cover" /> : null}
          <Text style={styles.optionLabel}>{pollOptionLabel(option.label, question.kind)}</Text>
          {leaders.includes(option.id) ? <Text style={styles.winner}>{leaders.length > 1 ? "공동 1위" : "1위"}</Text> : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${question.title} · ${option.label} 참여자 ${option.vote_count}명`}
            disabled={saving} onPress={() => setPeople({id: option.id, label: pollOptionLabel(option.label, question.kind)})}
            style={styles.countButton}><Text style={styles.count}>{option.vote_count}명 ›</Text></Pressable>
        </View>
        <View style={styles.track}><View style={[styles.bar, {width: `${percentage}%`}]} /></View>
      </View>;
    })}</View>
    {hasVoted && savedLabels ? <Text style={styles.receipt} accessibilityLiveRegion="polite">{selecting
      ? `현재 저장된 응답 · ${savedLabels}` : `응답 완료 · ${savedLabels}`}</Text> : null}
    {selecting && hasVoted ? <Text style={styles.muted}>선택 변경 후 ‘투표하기’를 눌러야 새 응답이 저장됩니다.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {canVote ? <View style={styles.actions}>{selecting ? <>
      <Button label={saving ? "투표 저장 중…" : "투표하기"} onPress={submit} primary flex disabled={saving || !valid} />
      <Button label="결과 보기" flex disabled={saving} onPress={() => setEditing(false)} />
    </> : <Button label={hasVoted ? "다시 투표하기" : "투표 참여"} flex disabled={saving} onPress={() => {setChoices(savedChoice); setEditing(true); setError("");}} />}</View> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={`참여자 보기 · ${count}명 참여`} disabled={saving}
      onPress={() => setPeople({label: "투표 현황"})} style={styles.peopleButton}>
      <Text style={styles.peopleLabel}>투표 현황 · {count}명 참여 ›</Text>
    </Pressable>
    {people ? <Participants key={`${userId}:${postId}:${question.id}:${people.id ?? "all"}`} postId={postId} userId={userId} filter={people}
      question={question} onClose={() => setPeople(null)} /> : null}
  </View>;
}

function Participants({postId, userId, filter, question, onClose}: {postId: number; userId: number | null;
  filter: {id?: number; label: string}; question: NoticePollQuestion; onClose: () => void}) {
  const [view, setView] = useState<"options" | "members" | "missing">("options");
  const client = useQueryClient();
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fullScreen = width < 600;
  return <Modal visible transparent={!fullScreen} animationType="fade" onRequestClose={onClose}>
    <View style={[styles.backdrop, fullScreen && styles.fullScreenBackdrop]}>
      <View style={[styles.modal, fullScreen && styles.fullScreenModal,
        fullScreen && {paddingTop: insets.top, paddingBottom: insets.bottom}]} accessibilityViewIsModal>
      <View style={styles.modalHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="참여자 닫기" onPress={onClose} style={styles.iconButton}>
          <Text style={styles.closeIcon}>×</Text>
        </Pressable>
        <Text style={styles.modalTitle} numberOfLines={1}>{filter.label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="현황 새로고침" style={styles.iconButton}
          onPress={() => {void client.invalidateQueries({queryKey: ["notice-poll-participants", userId, postId, question.id]});}}>
          <Text style={styles.refreshIcon}>↻</Text>
        </Pressable>
      </View>
      <Text style={styles.modalQuestion}>{question.title}</Text>
      {filter.id === undefined ? <View accessibilityRole="tablist" style={styles.tabs}>
        {([{id: "options", label: "항목별"}, {id: "members", label: "회원별"}, {id: "missing", label: "미참여"}] as const).map(tab =>
          <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{selected: view === tab.id}}
            aria-selected={view === tab.id}
            onPress={() => setView(tab.id)} style={[styles.tab, view === tab.id && styles.activeTab]}>
            <Text style={[styles.tabLabel, view === tab.id && {color: "#2761FF"}]}>{tab.label}</Text>
          </Pressable>)}
      </View> : null}
      {view === "missing" && filter.id === undefined ? <Text style={styles.audienceHint}>현재 이 공지를 볼 수 있는 활성 회원 중 아직 이 투표에 참여하지 않은 회원입니다.</Text> : null}
      <ScrollView style={styles.peopleScroll} contentContainerStyle={styles.peopleContent}>
        {filter.id !== undefined ? <PeopleList key={`option-${filter.id}`} postId={postId} userId={userId} question={question} optionId={filter.id} />
          : view === "options" ? <View style={{gap: 24}}>{question.options.map(option =>
            <View key={option.id} style={{gap: 4}}><Text style={styles.groupTitle}>{pollOptionLabel(option.label, question.kind)}</Text>
              <PeopleList postId={postId} userId={userId} question={question} optionId={option.id} />
            </View>)}</View>
          : <PeopleList key={view} postId={postId} userId={userId} question={question} participation={view === "missing" ? "not_voted" : "voted"} />}
      </ScrollView>
    </View></View>
  </Modal>;
}

function PeopleList({postId, userId, question, optionId, participation = "voted"}: {postId: number; userId: number | null;
  question: NoticePollQuestion; optionId?: number; participation?: "voted" | "not_voted"}) {
  const [page, setPage] = useState(1);
  const query = useQuery({queryKey: ["notice-poll-participants", userId, postId, question.id, optionId, participation, page],
    queryFn: () => pollApi.participants(postId, page, optionId, question.id, participation), enabled: userId !== null,
    refetchInterval: 10_000});
  const pagination = query.data?.pagination;
  useEffect(() => {
    if (pagination && page > Math.max(1, pagination.total_pages)) setPage(Math.max(1, pagination.total_pages));
  }, [page, pagination]);
  return <View style={{gap: 4}}>
    <Text style={styles.muted}>{pagination?.total ?? 0}명</Text>
    {query.isError ? <View style={{gap: 12}}><Text style={styles.error}>현황을 불러오지 못했습니다.</Text>
      <Button label="참여자 다시 불러오기" onPress={() => {void query.refetch();}} /></View>
      : !query.data ? <ActivityIndicator color="#2761FF" /> : !query.data.data.length
        ? <Text style={styles.muted}>{participation === "not_voted" ? "미참여 회원이 없습니다." : "아직 참여자가 없습니다."}</Text>
        : query.data.data.map(member => <PersonListCard key={member.user_id} variant="plain" badge={member.cohort ? `${member.cohort.replace(/기$/, "")}기` : "—"} name={member.nickname}>
          {participation === "not_voted" ? <Text style={styles.personChoice}>미참여</Text>
            : member.answers.filter(a => a.question_id === question.id).map(answer => <Text key={answer.option_id} style={styles.personChoice}>
              {pollOptionLabel(answer.label, question.kind)}
            </Text>)}
        </PersonListCard>)}
    {(pagination?.total_pages ?? 0) > 1 ? <View style={styles.header}>
      <Button label="이전 참여자" disabled={page <= 1 || query.isFetching} onPress={() => setPage(v => v - 1)} />
      <Text style={styles.muted}>{page} / {pagination?.total_pages}</Text>
      <Button label="다음 참여자" disabled={page >= (pagination?.total_pages ?? 1) || query.isFetching} onPress={() => setPage(v => v + 1)} />
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  progress: {padding: 14, backgroundColor: "#F4F6FA", borderRadius: 4, gap: 4},
  progressText: {fontSize: 13, lineHeight: 21, color: "#374151", fontWeight: "500"},
  receipt: {fontSize: 13, lineHeight: 21, color: "#2761FF", marginTop: 12},
  container: {padding: 16, borderWidth: 1, borderColor: "#E8EAED", borderRadius: 4, backgroundColor: "#FFF"},
  header: {flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8}, titleRow: {flexDirection: "row", gap: 8, alignItems: "center"},
  heading: {fontSize: 11, color: "#6B7280"}, state: {fontSize: 11, color: "#2761FF"},
  closed: {color: "#6B7280"}, muted: {fontSize: 11, color: "#6B7280", lineHeight: 18}, options: {marginTop: 14},
  questionTitle: {fontSize: 16, lineHeight: 24, fontWeight: "600", color: "#15171C", marginTop: 6, marginBottom: 4},
  option: {paddingVertical: 6}, optionRow: {flexDirection: "row", alignItems: "center", gap: 8},
  choice: {flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44},
  countButton: {minWidth: 44, minHeight: 44, alignItems: "flex-end", justifyContent: "center"}, refresh: {paddingHorizontal: 6, minHeight: 32, justifyContent: "center"},
  winner: {fontSize: 10, color: "#2761FF", backgroundColor: "#EEF3FF", borderRadius: 3, paddingVertical: 2, paddingHorizontal: 4},
  optionLabel: {flex: 1, color: "#15171C", fontSize: 14, lineHeight: 21}, count: {fontSize: 11, color: "#6B7280"},
  radio: {width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: "#D3D6DB", alignItems: "center", justifyContent: "center"},
  checked: {backgroundColor: "#2761FF", borderColor: "#2761FF"}, check: {color: "#FFF", fontSize: 11}, myVote: {color: "#2761FF", fontSize: 12},
  image: {width: 40, height: 40, borderRadius: 3}, track: {height: 2, backgroundColor: "#F0F1F3", overflow: "hidden"},
  bar: {height: 2, backgroundColor: "#2761FF"}, actions: {flexDirection: "row", gap: 8, marginTop: 16},
  button: {paddingVertical: 12, paddingHorizontal: 10, minHeight: 44, borderRadius: 4, backgroundColor: "#F3F4F5", alignItems: "center", justifyContent: "center"},
  primaryButton: {backgroundColor: "#EEF3FF"}, buttonText: {fontSize: 12, color: "#4B515B"},
  peopleButton: {minHeight: 44, paddingTop: 10, alignItems: "flex-end", justifyContent: "center"}, peopleLabel: {fontSize: 11, color: "#6B7280"},
  error: {fontSize: 13, color: "#B91C1C", lineHeight: 20, marginTop: 12}, personChoice: {color: "#6B7280", fontSize: 11, lineHeight: 17},
  backdrop: {flex: 1, backgroundColor: "rgba(0,0,0,.35)", justifyContent: "center", alignItems: "center", padding: 20},
  modal: {width: "100%", maxWidth: 420, height: "85%", maxHeight: 680, backgroundColor: "#FFF", borderRadius: 6, overflow: "hidden"},
  fullScreenBackdrop: {padding: 0, backgroundColor: "#FFF"}, fullScreenModal: {maxWidth: "100%", height: "100%", maxHeight: "100%", borderRadius: 0},
  modalHeader: {flexDirection: "row", alignItems: "center", minHeight: 56, paddingHorizontal: 8},
  iconButton: {width: 44, minHeight: 44, alignItems: "center", justifyContent: "center"},
  closeIcon: {fontSize: 26, color: "#15171C"}, refreshIcon: {fontSize: 20, color: "#6B7280"},
  modalTitle: {flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: "#15171C"},
  modalQuestion: {fontSize: 14, lineHeight: 21, color: "#15171C", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16},
  peopleScroll: {flex: 1}, peopleContent: {padding: 20, paddingBottom: 28},
  audienceHint: {fontSize: 11, color: "#6B7280", lineHeight: 18, paddingHorizontal: 20, paddingTop: 12},
  tabs: {flexDirection: "row", borderBottomWidth: 1, borderColor: "#EBEDF0", marginHorizontal: 20}, tab: {flex: 1, minHeight: 44, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderColor: "transparent"},
  activeTab: {borderColor: "#2761FF"}, tabLabel: {fontSize: 12, color: "#6B7280"}, groupTitle: {fontSize: 13, fontWeight: "500", color: "#15171C"},
});

