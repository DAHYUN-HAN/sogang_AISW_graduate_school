import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, usePreventRemove, type NavigationAction } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../AppTypography";
import MediaImage from "../MediaImage";
import { API_ORIGIN, mediaApi, postApi } from "../../services/api";
import type { AdminMainRequest, MutualAidStatus } from "../../types";
import { formatBoardDateTime } from "../../utils/dateFormat";
import { toAbsoluteMediaUrl } from "../../utils/mediaAccess";
import { canInitializeRequestDraft } from "../../utils/adminMain";

const buttonStyle = { minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: "#E1E4E9", paddingHorizontal: 16, alignItems: "center", justifyContent: "center" } as const;
export default function AdminRequestPanel({ item, onClose }: { item: AdminMainRequest; onClose: () => void }) {
  const client = useQueryClient();
  const detail = useQuery({ queryKey: ["admin-request", item.id], queryFn: () => postApi.getPostDetail(item.id), retry: 1 });
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState<MutualAidStatus>("processing");
  const [reason, setReason] = useState("");
  const [baseline, setBaseline] = useState({ reply: "", status: "processing" as MutualAidStatus, reason: "" });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [discard, setDiscard] = useState(false);
  const [ready, setReady] = useState(false);
  const [leaveConfirmed, setLeaveConfirmed] = useState(false);
  const navigation = useNavigation();
  const pendingNavigation = useRef<NavigationAction | null>(null);
  const initialized = useRef(false);
  const data = detail.data?.data;
  useEffect(() => {
    if (!data || !canInitializeRequestDraft(Boolean(data), detail.isFetching) || initialized.current) return;
    initialized.current = true;
    const values = { reply: data.suggestion?.admin_reply ?? "", status: data.mutual_aid?.status ?? "processing", reason: data.mutual_aid?.rejection_reason ?? "" };
    setReply(values.reply); setStatus(values.status); setReason(values.reason); setBaseline(values);
    setReady(true);
  }, [data, detail.isFetching]);
  const dirty = reply !== baseline.reply || status !== baseline.status || reason !== baseline.reason;
  usePreventRemove(!leaveConfirmed && (dirty || saving), ({ data: event }) => {
    if (saving) return;
    pendingNavigation.current = event.action;
    setDiscard(true);
  });
  useEffect(() => {
    if (leaveConfirmed && pendingNavigation.current) navigation.dispatch(pendingNavigation.current);
  }, [leaveConfirmed, navigation]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty || saving) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, saving]);
  const close = useCallback(() => { if (saving) return; if (dirty) setDiscard(true); else onClose(); }, [dirty, onClose, saving]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close(); } };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [close]);
  const save = async () => {
    if (saving || !ready || !data) return;
    if (item.kind === "suggestion" && !reply.trim()) { setNotice("공식 답변을 입력해 주세요."); return; }
    if (item.kind === "mutual_aid" && status === "rejected" && !reason.trim()) { setNotice("반려 사유를 입력해 주세요."); return; }
    setSaving(true); setNotice("");
    try {
      if (item.kind === "suggestion") await postApi.updateSuggestion(item.id, { status: "answered", admin_reply: reply.trim() });
      else await postApi.updateMutualAid(item.id, { status, rejection_reason: reason.trim() || undefined });
      const values = { reply: reply.trim(), status, reason: reason.trim() };
      setReply(values.reply); setReason(values.reason); setBaseline(values); setNotice("저장했습니다.");
      await Promise.all(["admin-main", "admin-audit-logs", "admin-mutual-aid", "admin-suggestions", "admin-request", "posts", "admin-stats"].map((key) => client.invalidateQueries({ queryKey: [key] })));
    } catch { setNotice("저장하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요."); }
    finally { setSaving(false); }
  };
  const openEvidence = async (mediaId?: number, path?: string) => {
    try {
      if (path && /^https?:\/\//i.test(path) && !path.includes("/uploads/")) { await Linking.openURL(path); return; }
      const response = mediaId ? await mediaApi.getAccessUrl(mediaId) : await mediaApi.getAccessUrlForPath(path!);
      await Linking.openURL(toAbsoluteMediaUrl(response.data.url, API_ORIGIN) ?? response.data.url);
    } catch { setNotice("증빙서류를 열지 못했습니다. 다시 시도해 주세요."); }
  };
  const proof = typeof data?.metadata?.proof_url === "string" ? data.metadata.proof_url : null;
  return <Modal visible transparent animationType="none" onRequestClose={close}>
    <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end", backgroundColor: "rgba(21,23,28,0.18)" }}>
      <Pressable accessibilityLabel="상세 닫기" onPress={close} style={{ flex: 1 }} />
      <View accessibilityViewIsModal style={{ width: 480, maxWidth: "100%", backgroundColor: "#FFFFFF", borderLeftWidth: 1, borderColor: "#E1E4E9" }}>
        <View style={{ padding: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: "#E1E4E9" }}><Text style={{ color: "#15171C", fontWeight: "600", fontSize: 18 }}>{item.kind === "mutual_aid" ? "상조회 신청 확인" : "건의사항 답변"}</Text><Pressable accessibilityRole="button" accessibilityLabel="상세 닫기" disabled={saving} onPress={close} style={{ padding: 8 }}><Text style={{ color: "#15171C", fontSize: 18 }}>✕</Text></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 20 }}>
          {!ready && !detail.isError && <ActivityIndicator color="#2761FF" />}
          {detail.isError && <View><Text>신청 내용을 불러오지 못했습니다.</Text><Pressable onPress={() => void detail.refetch()} style={buttonStyle}><Text>다시 시도</Text></Pressable></View>}
          {data && ready && <>
            <Text style={{ color: "#15171C", fontSize: 20, fontWeight: "600" }}>{data.title}</Text>
            <Text style={{ color: "#6B7280", fontSize: 12 }}>{item.kind === "suggestion" ? "익명" : item.author_label} · 접수 {formatBoardDateTime(data.created_at)}</Text>
            <Text style={{ color: "#15171C", lineHeight: 24 }}>{data.content}</Text>
            {data.mutual_aid && <Text style={{ color: "#6B7280", lineHeight: 22 }}>구분 {data.mutual_aid.event_type} · 관계 {data.mutual_aid.relation}{"\n"}행사일 {data.mutual_aid.event_date}</Text>}
            {item.kind === "mutual_aid" && <View style={{ gap: 12 }}>
              <Text style={styles.label}>증빙서류</Text>
              {data.attachments.map((file) => <View key={file.id} style={{ gap: 8 }}>
                {file.content_type.startsWith("image/") && <MediaImage media={file} style={{ width: "100%", height: 220 }} resizeMode="contain" />}
                <Pressable accessibilityRole="button" onPress={() => void openEvidence(file.id)} style={buttonStyle}><Text style={{ color: "#2761FF" }}>{file.original_filename} 열기</Text></Pressable>
              </View>)}
              {proof && <Pressable onPress={() => void openEvidence(undefined, proof)} style={buttonStyle}><Text style={{ color: "#2761FF" }}>증빙서류 확인</Text></Pressable>}
              {!data.attachments.length && !proof && <Text style={{ color: "#6B7280" }}>등록된 증빙서류가 없습니다.</Text>}
              <Text style={styles.label}>처리 상태</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{([ ["processing", "처리중"], ["completed", "완료"], ["rejected", "반려"] ] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: status === value, disabled: saving }} disabled={saving} onPress={() => { setStatus(value); setNotice(""); }} style={[buttonStyle, status === value && { backgroundColor: "#15171C", borderColor: "#15171C" }]}><Text style={{ color: status === value ? "#FFFFFF" : "#15171C" }}>{label}</Text></Pressable>)}</View>
              {status === "rejected" && <TextInput accessibilityLabel="반려 사유" placeholder="반려 사유" multiline value={reason} onChangeText={setReason} editable={!saving} style={styles.input} />}
            </View>}
            {item.kind === "suggestion" && <View style={{ gap: 12 }}><Text style={styles.label}>원우회 공식 답변</Text><TextInput accessibilityLabel="공식 답변" placeholder="공식 답변을 입력해 주세요" multiline value={reply} onChangeText={setReply} editable={!saving} style={styles.input} /></View>}
            {notice !== "" && <Text accessibilityLiveRegion="polite" style={{ color: notice === "저장했습니다." ? "#168A72" : "#D92D52", lineHeight: 22 }}>{notice}</Text>}
            {discard && <View style={{ gap: 12 }}><Text>저장하지 않은 변경사항이 있습니다.</Text><Pressable accessibilityRole="button" onPress={() => { pendingNavigation.current = null; setDiscard(false); }} style={buttonStyle}><Text>계속 편집</Text></Pressable><Pressable accessibilityRole="button" onPress={() => pendingNavigation.current ? setLeaveConfirmed(true) : onClose()} style={buttonStyle}><Text style={{ color: "#D92D52" }}>변경사항 버리고 닫기</Text></Pressable></View>}
          </>}
        </ScrollView>
        {data && ready && <View style={{ padding: 24, borderTopWidth: 1, borderColor: "#E1E4E9" }}><Pressable accessibilityRole="button" accessibilityLabel="저장" disabled={saving || !dirty} accessibilityState={{ disabled: saving || !dirty }} onPress={() => void save()} style={[buttonStyle, { backgroundColor: "#2761FF", borderWidth: 0, opacity: saving || !dirty ? 0.5 : 1 }]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>저장</Text>}</Pressable></View>}
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({ label: { color: "#15171C", fontSize: 14, fontWeight: "600" }, input: { minHeight: 140, borderRadius: 8, borderWidth: 1, borderColor: "#E1E4E9", padding: 12, color: "#15171C", fontSize: 14, textAlignVertical: "top" } });
