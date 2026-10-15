import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText as Text } from "./AppTypography";
import MediaImage from "./MediaImage";
import PersonListCard from "./PersonListCard";
import { VoterAvatarIcon } from "./icons";
import NetworkErrorState, { LoadErrorState, useLoadErrorOverlay } from "./NetworkErrorState";
import { pollApi } from "../services/api";
import { useUserStore } from "../stores/userStore";
import type { NoticePoll, NoticePollQuestion } from "../types";
import { pollCacheKey, pollOptionLabel, validPollAnswers } from "../utils/noticePoll";
import { pollQuestionAcceptsVote } from "../utils/noticePollUsability";
import { formatMonthDayTime, parseApiDate } from "../utils/dateFormat";
import { formatCohortName } from "../utils/userLabel";
import { isNetworkError } from "../utils/networkError";
import { BUTTON_TEXT } from "../utils/buttonText";

// 투표를 처음 불러오지 못하면 앱 전체 LoadError로 덮고, 투표 저장 실패는 onSaveError로 화면이 토스트를 띄운다.
export default function NoticePollCard({postId, onSaveError}: {postId: number; poll?: NoticePoll; onSaveError: () => void}) {
  const userId = useUserStore(state => state.userId);
  const client = useQueryClient();
  const query = useQuery({queryKey: pollCacheKey(userId, postId), queryFn: () => pollApi.get(postId),
    enabled: userId !== null, refetchInterval: 30_000});
  useLoadErrorOverlay(query.data ? null : query.error, () => {void query.refetch();});
  if (!query.data) return query.isError ? null : <View style={styles.container}><ActivityIndicator color="#2761FF" /></View>;
  const poll = query.data.data;
  return <View style={styles.cards}>{poll.questions.map(question =>
    <QuestionCard key={`${userId}:${postId}:${JSON.stringify([question.id, question.title, question.kind, question.allow_multiple,
      question.options.map(o => [o.id, o.label, o.media_id]), question.is_closed ?? poll.is_closed])}`}
      poll={poll} question={question} postId={postId} userId={userId} onSaveError={onSaveError}
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

function QuestionCard({postId, userId, poll, question, onSaved, onSaveError, refresh}: {postId: number; userId: number | null; poll: NoticePoll;
  question: NoticePollQuestion; onSaved: (poll: NoticePoll) => Promise<void>; onSaveError: () => void; refresh: () => Promise<void>}) {
  const endsAt = question.ends_at ? parseApiDate(question.ends_at)?.getTime() ?? null : null;
  const [now, setNow] = useState(() => Date.now());
  const serverClosed = question.is_closed ?? poll.is_closed;
  // Close the card the moment its deadline passes; the server rejects late votes either way.
  const isClosed = serverClosed || (endsAt !== null && endsAt <= now);
  const closedAt = question.closed_at ?? poll.closed_at ?? (isClosed ? question.ends_at : null);
  const savedChoice = poll.my_answers.find(a => a.question_id === question.id)?.option_ids ?? [];
  const savedId = savedChoice[0] ?? null;
  const hasVoted = question.has_voted ?? savedChoice.length > 0;
  const count = question.participant_count ?? poll.participant_count;
  const canVote = !isClosed && pollQuestionAcceptsVote(poll, question);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [people, setPeople] = useState(false);
  const sending = useRef(false);
  const mounted = useRef(true);
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useEffect(() => {
    if (serverClosed || endsAt === null || endsAt <= now) return;
    // Timers cap near 24.8 days, so a far deadline re-arms instead of firing early.
    const timer = setTimeout(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) void latestRefresh.current();
    }, Math.min(endsAt - now + 250, 2_000_000_000));
    return () => clearTimeout(timer);
  }, [serverClosed, endsAt, now]);
  const selecting = canVote && (editing || !hasVoted);
  const shownChoice = selecting ? draft === null ? [] : [draft] : savedChoice;
  // An existing voter may submit no choice to withdraw; a first vote needs one.
  const canSubmit = selecting && !saving && (draft !== null || hasVoted);
  const choose = (optionId: number) => {
    if (!selecting || saving) return;
    setDraft(current => current === optionId ? null : optionId);
  };
  const submit = async () => {
    if (sending.current || !canSubmit) return;
    if (draft === savedId) {setEditing(false); return;}
    if (draft !== null && !validPollAnswers(poll, {[question.id]: [draft]})) return;
    sending.current = true; setSaving(true);
    try {
      const response = await pollApi.vote(postId, poll.revision, [{question_id: question.id, option_ids: draft === null ? [] : [draft]}]);
      if (!mounted.current) return;
      await onSaved(response.data);
      if (mounted.current) {setEditing(false); setDraft(null);}
    } catch {
      if (mounted.current) {
        onSaveError();
        await refresh();
      }
    } finally {sending.current = false; if (mounted.current) setSaving(false);}
  };
  return <View style={styles.container}>
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.questionTitle}>{question.title}</Text>
        {isClosed ? <View style={styles.closedBadge}><Text style={styles.closedBadgeText}>마감</Text></View> : null}
      </View>
      {isClosed ? <Text style={styles.subtitle}>{closedAt ? `${formatMonthDayTime(closedAt)} 마감됨` : "마감됨"}</Text>
        : question.ends_at ? <Text style={styles.subtitle}>{formatMonthDayTime(question.ends_at)} 마감</Text> : null}
    </View>
    {question.options.map(option => {
      const selected = shownChoice.includes(option.id);
      const percentage = count > 0 ? Math.min(100, Math.max(0, option.vote_count / count * 100)) : 0;
      const disabled = !selecting || saving;
      return <Pressable key={option.id} accessibilityLabel={`${question.title} · ${option.label}`}
        accessibilityRole="radio" accessibilityState={{checked: selected, disabled, busy: saving}}
        aria-checked={selected} aria-disabled={disabled} disabled={disabled}
        {...(Platform.OS === "web" ? {onKeyDown: (event: {key: string; preventDefault: () => void; stopPropagation: () => void}) => {
          // RN Web does not activate radio roles on Space or Enter.
          if (!disabled && [" ", "Spacebar", "Enter"].includes(event.key)) {
            event.preventDefault(); event.stopPropagation(); choose(option.id);
          }
        }} : {})}
        onPress={() => choose(option.id)} style={[styles.option, selected && styles.selectedOption]}>
        <View pointerEvents="none" style={[styles.bar, {width: `${percentage}%`}]} />
        <View pointerEvents="none" style={styles.optionContent}>
          <View style={styles.optionLeft}>
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected ? <Text style={styles.radioCheck}>✓</Text> : null}
            </View>
            {option.media_id ? <MediaImage media={{id: option.media_id}} style={styles.legacyImage} resizeMode="cover" /> : null}
            <Text style={styles.optionLabel}>{pollOptionLabel(option.label, question.kind)}</Text>
          </View>
          <Text style={styles.count}>{option.vote_count}명</Text>
        </View>
      </Pressable>;
    })}
    {selecting ? <Pressable accessibilityRole="button" accessibilityLabel={`${question.title} 투표하기`} accessibilityState={{disabled: !canSubmit, busy: saving}}
      disabled={!canSubmit} onPress={submit} style={[styles.voteButton, canSubmit ? styles.voteButtonActive : styles.voteButtonDisabled]}>
      <Text style={[styles.voteLabel, canSubmit && styles.voteLabelActive]}>투표하기</Text>
    </Pressable> : canVote ? <Pressable accessibilityRole="button" accessibilityLabel={`${question.title} 다시 투표하기`}
      onPress={() => {setEditing(true); setDraft(savedId);}} style={[styles.voteButton, styles.revoteButton]}>
      <Text style={styles.revoteLabel}>다시 투표하기</Text>
    </Pressable> : null}
    <View style={styles.footer}>
      <Text style={styles.participants}>{count}명 참여</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`참여자 보기 · ${count}명 참여`}
        onPress={() => setPeople(true)} style={styles.peopleButton}>
        <Text style={styles.peopleLabel}>참여자 보기 ›</Text>
      </Pressable>
    </View>
    {people ? <Participants key={`${userId}:${postId}:${question.id}`} postId={postId} userId={userId}
      question={question} onClose={() => setPeople(false)} /> : null}
  </View>;
}

function Participants({postId, userId, question, onClose}: {postId: number; userId: number | null;
  question: NoticePollQuestion; onClose: () => void}) {
  const [optionId, setOptionId] = useState(question.options[0]?.id);
  const {height, width} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Draw under Android's system bars so the sheet reaches the screen edge like the design.
  return <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <Pressable accessibilityRole="button" accessibilityLabel="참여자 창 닫기" onPress={onClose} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.sheet, {maxWidth: Platform.OS === "web" && width > 430 ? 405 : 420,
        maxHeight: Math.min(height * .85, height - insets.top - 12), paddingBottom: Math.max(insets.bottom - LIST_BOTTOM_PADDING, 0)}]}
        accessibilityViewIsModal>
        <Pressable accessibilityRole="button" accessibilityLabel="참여자 닫기" onPress={onClose} style={styles.handleButton}>
          <View style={styles.handle} />
        </Pressable>
        <Text style={styles.sheetTitle}>참여자</Text>
        <View accessibilityRole="tablist" style={styles.tabs}>{question.options.map(option =>
          <Pressable key={option.id} accessibilityRole="tab" accessibilityLabel={`${pollOptionLabel(option.label, question.kind)} ${option.vote_count}명`}
            accessibilityState={{selected: optionId === option.id}} aria-selected={optionId === option.id}
            onPress={() => setOptionId(option.id)} style={styles.tab}>
            <Text style={[styles.tabLabel, optionId === option.id && styles.activeTabLabel]}>
              {pollOptionLabel(option.label, question.kind)} {option.vote_count}
            </Text>
            <View style={[styles.tabLine, optionId === option.id && styles.activeTabLine]} />
          </Pressable>)}</View>
        <PeopleList key={optionId} postId={postId} userId={userId} question={question} optionId={optionId} />
      </View>
    </View>
  </Modal>;
}

function PeopleList({postId, userId, question, optionId}: {postId: number; userId: number | null;
  question: NoticePollQuestion; optionId?: number}) {
  const loadingMore = useRef(false);
  const query = useInfiniteQuery({queryKey: ["notice-poll-participants", userId, postId, question.id, optionId, "voted"],
    queryFn: ({pageParam}) => pollApi.participants(postId, pageParam, optionId, question.id),
    initialPageParam: 1, getNextPageParam: last => last.pagination && last.pagination.page < last.pagination.total_pages
      ? last.pagination.page + 1 : undefined,
    enabled: userId !== null && optionId !== undefined, refetchInterval: 10_000});
  const members = [...new Map(query.data?.pages.flatMap(page => page.data).map(member => [member.user_id, member])).values()];
  const loadMore = async () => {
    if (!query.hasNextPage || query.isFetching || loadingMore.current) return;
    loadingMore.current = true;
    try {await query.fetchNextPage();} finally {loadingMore.current = false;}
  };
  // 시트를 하나의 화면으로 본다: 처음이든 더 불러오기든 실패하면 목록 전체를 실패 화면으로 바꾼다
  // (2026-10-16 사용자 결정). 다시 시도는 실패한 요청만 다시 한다.
  if (query.isError) {
    const retry = () => {if (query.isFetchNextPageError) void query.fetchNextPage(); else void query.refetch();};
    return <View style={styles.peopleScroll}>
      {isNetworkError(query.error) ? <NetworkErrorState onRetry={retry} retrying={query.isFetching} />
        : <LoadErrorState onRetry={retry} retrying={query.isFetching} />}
    </View>;
  }
  return <ScrollView style={styles.peopleScroll} contentContainerStyle={styles.peopleContent} showsVerticalScrollIndicator={false}
    scrollEventThrottle={100} onScroll={event => {
      const {layoutMeasurement, contentOffset, contentSize} = event.nativeEvent;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 120) return loadMore();
    }}>
    {members.map(member => <PersonListCard key={member.user_id} variant="poll" badge=""
      avatar={<VoterAvatarIcon />}
      name={formatCohortName(member.cohort, member.nickname)} caption={member.major || undefined} />)}
    {!query.data || query.isFetchingNextPage ? <ActivityIndicator color="#2761FF" style={styles.loadState} />
        : !members.length ? <Text style={styles.emptyPeople}>아직 투표한 사람이 없어요</Text> : null}
  </ScrollView>;
}

const LIST_BOTTOM_PADDING = 20;
const styles = StyleSheet.create({
  cards: {gap: 16, marginTop: 22},
  container: {padding: 16, gap: 12, borderWidth: 1, borderColor: "#E7E9EE", borderRadius: 12, backgroundColor: "#FFF"},
  header: {gap: 4},
  titleRow: {flexDirection: "row", alignItems: "center", gap: 6},
  questionTitle: {flexShrink: 1, fontSize: 15, lineHeight: 20, fontWeight: "600", color: "#15171C"},
  closedBadge: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: "#F4F5F7"},
  closedBadgeText: {fontSize: 11, lineHeight: 14, fontWeight: "500", color: "#6B7280"},
  subtitle: {fontSize: 12, lineHeight: 16, color: "#6B7280"},
  muted: {fontSize: 11, color: "#7B8291", lineHeight: 18},
  option: {minHeight: 46, borderRadius: 8, borderWidth: 1.5, borderColor: "transparent", backgroundColor: "#F4F5F7", overflow: "hidden", justifyContent: "center", outlineColor: "#2761FF"},
  selectedOption: {borderColor: "#2761FF"},
  bar: {position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#D5E0FE", borderRadius: 8},
  optionContent: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingLeft: 12, paddingRight: 14, paddingVertical: 10},
  optionLeft: {flex: 1, flexDirection: "row", alignItems: "center", gap: 10},
  radio: {width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: "#C4C8D0", backgroundColor: "#FFF", alignItems: "center", justifyContent: "center"},
  radioSelected: {borderColor: "#2761FF", backgroundColor: "#2761FF"},
  radioCheck: {fontSize: 11, lineHeight: 13, fontWeight: "700", color: "#FFF"},
  optionLabel: {flexShrink: 1, color: "#15171C", fontSize: 14, lineHeight: 20, fontWeight: "600"},
  legacyImage: {width: 32, height: 32, borderRadius: 4},
  count: {fontSize: 13, lineHeight: 18, fontWeight: "500", color: "#6B7280"},
  // Every state keeps the same 1px border so all buttons are 41px and switching never moves the card.
  voteButton: {paddingVertical: 11, borderRadius: 8, borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center"},
  voteButtonDisabled: {backgroundColor: "#F4F5F7"},
  voteButtonActive: {backgroundColor: "#2761FF"},
  revoteButton: {backgroundColor: "#FFF", borderColor: "#E7E9EE"},
  voteLabel: { ...BUTTON_TEXT, fontWeight: "500", color: "#A6ACB7" },
  voteLabelActive: {fontWeight: "600", color: "#FFF"},
  revoteLabel: { ...BUTTON_TEXT, fontWeight: "500", color: "#000" },
  footer: {flexDirection: "row", justifyContent: "space-between", alignItems: "center"},
  participants: {fontSize: 13, lineHeight: 18, color: "#6B7280"},
  peopleButton: {minHeight: 32, justifyContent: "center", paddingLeft: 12},
  peopleLabel: {fontSize: 13, lineHeight: 18, fontWeight: "500", color: "#2761FF"},
  backdrop: {flex: 1, justifyContent: "flex-end", alignItems: "center", backgroundColor: "rgba(0,0,0,.12)"},
  sheet: {width: "100%", backgroundColor: "#FFF", borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: "hidden", paddingHorizontal: 20},
  handleButton: {minHeight: 24, paddingVertical: 10, alignItems: "center", justifyContent: "center"},
  handle: {width: 36, height: 4, borderRadius: 2, backgroundColor: "#D1D6DB"},
  sheetTitle: {fontSize: 16, lineHeight: 19, fontWeight: "600", color: "#15171C", paddingTop: 4, paddingBottom: 12},
  tabs: {flexDirection: "row", alignItems: "flex-start"},
  tab: {flex: 1, minHeight: 44, gap: 8},
  tabLine: {height: 1, backgroundColor: "#E7E9EE"}, activeTabLine: {height: 2, backgroundColor: "#2761FF"},
  tabLabel: {paddingVertical: 10, textAlign: "center", fontSize: 14, lineHeight: 17, fontWeight: "500", color: "#A6ACB7"},
  activeTabLabel: {fontWeight: "600", color: "#15171C"},
  peopleScroll: {flexGrow: 0, flexShrink: 1},
  // The design's bottom padding doubles as the home-indicator area, so it is not added twice.
  peopleContent: {paddingTop: 16, paddingBottom: LIST_BOTTOM_PADDING, gap: 8},
  loadState: {paddingVertical: 16},
  emptyPeople: {paddingTop: 40, paddingBottom: 48, textAlign: "center", fontSize: 13, lineHeight: 18, color: "#A6ACB7"},
});
