import { View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../AppTypography";
import MediaImage from "../MediaImage";
import type { MediaAsset } from "../../types";
import { noticeBodyBlocks, noticeBodyDraft, removeNoticeBodyImage, type NoticeBodyImage, type NoticeBodySelection } from "../../utils/noticeBody";
import { ActionButton, COLORS, RADIUS } from "./AdminControls";

export default function AdminNoticeBodyEditor({content, images, attachments, disabled, onChange, onSelectionChange}: {
  content: string; images: NoticeBodyImage[]; attachments: MediaAsset[]; disabled: boolean;
  onChange: (draft: {content: string; images: NoticeBodyImage[]}) => void;
  onSelectionChange: (selection: NoticeBodySelection | null) => void;
}) {
  const blocks = noticeBodyBlocks(content, {version: 1, images}, attachments);
  return <View style={{gap: 10}}>
    <Text style={{fontSize: 13, fontWeight: "600", color: COLORS.text}}>본문</Text>
    <Text style={{fontSize: 12, color: COLORS.muted}}>글을 넣을 위치를 선택한 뒤, 첨부 이미지의 ‘본문에 넣기’를 눌러주세요.</Text>
    {blocks.map((block, index) => block.type === "text" ? <TextInput key={`text-${index}`}
      multiline editable={!disabled} value={block.text} placeholder={index === 0 ? "공지 내용" : "이미지 아래 내용"}
      accessibilityLabel={index === 0 ? "공지 내용" : `공지 내용 ${Math.floor(index / 2) + 1}`}
      placeholderTextColor="#8b97a9"
      onFocus={() => onSelectionChange({index, offset: block.text.length})}
      onSelectionChange={event => onSelectionChange({index, offset: event.nativeEvent.selection.start})}
      onChangeText={text => {
        if (!disabled) onChange(noticeBodyDraft(blocks.map((item, i) => i === index ? {type: "text", text} : item)));
      }}
      style={{minHeight: blocks.length === 1 ? 160 : 88, borderRadius: RADIUS.button, borderWidth: 1,
        borderColor: COLORS.border, backgroundColor: disabled ? COLORS.surfaceAlt : COLORS.surface,
        color: COLORS.text, fontSize: 13, padding: 12, textAlignVertical: "top"}}
    /> : <View key={`image-${block.media_id}`} style={{borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.button, padding: 12, gap: 10, backgroundColor: COLORS.surface}}>
      <MediaImage media={attachments.find(a => a.id === block.media_id)} resizeMode="contain" style={{width: "100%", height: 180, backgroundColor: COLORS.surfaceAlt, borderRadius: 6}} />
      <View style={{flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10}}>
        <Text numberOfLines={1} style={{flex: 1, fontSize: 12, color: COLORS.muted}}>{attachments.find(a => a.id === block.media_id)?.original_filename}</Text>
        <ActionButton label="본문에서 빼기" tone="outline" disabled={disabled} onPress={() => {
          if (!disabled) {
            onSelectionChange(null);
            onChange(noticeBodyDraft(removeNoticeBodyImage(blocks, block.media_id)));
          }
        }} />
      </View>
    </View>)}
  </View>;
}
