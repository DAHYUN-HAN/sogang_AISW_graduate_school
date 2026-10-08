import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "../AppTypography";
import MediaImage from "../MediaImage";
import type { MediaAsset } from "../../types";
import { noticeBodyBlocks } from "../../utils/noticeBody";
import { pollOptionLabel } from "../../utils/noticePoll";
import { ActionButton, type NoticeForm } from "./AdminControls";

// Draft-only presentation: opening this view never loads, saves or votes on a poll.
export default function AdminNoticePreview({notice, attachments, disabled}: {notice: NoticeForm; attachments: MediaAsset[]; disabled?: boolean}) {
  const [visible, setVisible] = useState(false);
  const blocks = noticeBodyBlocks(notice.content, {version: 1, images: notice.inline_images ?? []}, attachments);
  const inline = new Set(blocks.filter(block => block.type === "image").map(block => block.media_id));
  return <>
    <ActionButton label="회원 화면 미리보기" tone="outline" disabled={disabled} onPress={() => setVisible(true)} />
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.backdrop}>
        <View style={styles.modal} accessibilityViewIsModal>
          <View style={styles.header}><Text style={styles.headerText}>회원 화면 미리보기</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="미리보기 닫기" onPress={() => setVisible(false)} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.hint}>현재 작성 내용의 미리보기입니다. 등록·저장되지 않으며, 여기에서는 투표할 수 없습니다.</Text>
            <Text style={styles.category}>{notice.category === "academic" ? "학사공지" : notice.category === "event" ? "행사공지" : "기타공지"}</Text>
            <Text style={styles.title}>{notice.title.trim() || "공지 제목을 입력해 주세요"}</Text>
            {notice.deadline_at ? <Text style={styles.hint}>신청·접수 마감 {notice.deadline_at.replace("T", " ")} (한국 시간)</Text> : null}
            {blocks.map((block, index) => block.type === "text"
              ? <Text key={index} style={styles.body}>{block.text || (blocks.length === 1 ? "공지 내용을 입력해 주세요" : "")}</Text>
              : <MediaImage key={index} media={{id: block.media_id}} style={styles.image} resizeMode="contain" />)}
            {attachments.filter(image => !inline.has(image.id)).map(image => <MediaImage key={image.id} media={image} style={styles.image} resizeMode="contain" />)}
            {notice.poll?.questions.map((question, index) => <View key={question.id ?? index} style={styles.poll}>
              <View style={styles.pollHeader}><Text style={styles.hint}>투표 {index + 1}</Text><Text style={styles.category}>{!question.id ? "등록 후 시작" : question.is_closed ? "종료" : "진행 중"}</Text></View>
              <Text style={styles.question}>{question.title.trim() || "투표 질문을 입력해 주세요"}</Text>
              <Text style={styles.hint}>기명 투표 · {question.legacy ? "기존 투표 결과" : "하나만 선택"}</Text>
              {question.options.map((option, oi) => <View key={option.id ?? oi} style={styles.option}>
                <View style={styles.radio} /><Text style={styles.optionText}>{pollOptionLabel(option.label, question.kind) || "선택항목을 입력해 주세요"}</Text>
                {option.media_id ? <MediaImage media={{id: option.media_id}} style={styles.optionImage} resizeMode="cover" /> : null}
              </View>)}
              <Text style={styles.hint}>항목 구성 미리보기 · 실제 응답 현황은 저장된 공지에서 확인하세요.</Text>
            </View>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: "rgba(17,24,39,.35)", padding: 12, justifyContent: "center", alignItems: "center"},
  modal: {width: "100%", maxWidth: 420, height: "90%", backgroundColor: "#FFF", borderRadius: 8, overflow: "hidden"},
  header: {flexDirection: "row", alignItems: "center", paddingLeft: 16, borderBottomWidth: 1, borderColor: "#E8EAED"},
  headerText: {flex: 1, fontSize: 16, fontWeight: "600", color: "#15171C"}, close: {width: 48, minHeight: 48, alignItems: "center", justifyContent: "center"},
  closeText: {fontSize: 26, color: "#15171C"}, content: {padding: 20, gap: 12, paddingBottom: 32},
  hint: {fontSize: 12, lineHeight: 19, color: "#6B7280"}, category: {fontSize: 12, color: "#2761FF"},
  title: {fontSize: 20, lineHeight: 29, color: "#15171C", fontWeight: "600"}, body: {fontSize: 14, lineHeight: 23, color: "#15171C"},
  image: {width: "100%", height: 220, borderRadius: 4}, poll: {padding: 16, borderWidth: 1, borderColor: "#E8EAED", borderRadius: 4, gap: 8},
  pollHeader: {flexDirection: "row", justifyContent: "space-between", gap: 8}, question: {fontSize: 16, lineHeight: 24, fontWeight: "600", color: "#15171C"},
  option: {flexDirection: "row", minHeight: 44, alignItems: "center", gap: 8}, radio: {width: 18, height: 18, borderWidth: 1, borderColor: "#D3D6DB", borderRadius: 9},
  optionText: {flex: 1, minWidth: 0, fontSize: 14, lineHeight: 21, color: "#15171C"}, optionImage: {width: 40, height: 40},
});
