import { Ionicons } from "@expo/vector-icons";
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Keyboard, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { resolveMediaAccessUrl } from "../hooks/useMediaAccessUrl";
import type { MediaAsset } from "../types";
import { openMediaUrl } from "../utils/mediaOpener";
import { pickAndUploadDocuments } from "../utils/mediaPicker";
import ImageViewerModal from "./ImageViewerModal";
import { AttachFileIcon, CloseIcon } from "./icons";
import MediaImage from "./MediaImage";

type Props = {
  attachments: MediaAsset[];
  onChange: Dispatch<SetStateAction<MediaAsset[]>>;
  onUploadingChange: (uploading: boolean) => void;
  isPrivate?: boolean;
  disabled?: boolean;
  title?: string;
  /**
   * 업로드·열기 실패를 그대로 넘긴다. 토스트와 모달은 화면 전체를 기준으로
   * 떠야 해서 스크롤 안에 있는 이 컴포넌트가 직접 띄울 수 없다. 원인별 표시는
   * uploadFailureFeedback을 쓰는 화면이 정한다.
   */
  onError?: (error: unknown) => void;
};

export default function PostAttachmentEditor({ attachments, onChange, onUploadingChange, isPrivate = false, disabled = false, title = "첨부파일", onError }: Props) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const busy = useRef(false);
  const unavailable = disabled || uploading;
  const imageAttachments = attachments.filter((item) => item.content_type.startsWith("image/"));
  const fileAttachments = attachments.filter((item) => !item.content_type.startsWith("image/"));

  const upload = async (previous?: MediaAsset) => {
    if (disabled || busy.current) return;
    Keyboard.dismiss();
    busy.current = true;
    setUploading(true);
    onUploadingChange(true);
    try {
      const selected = await pickAndUploadDocuments(undefined, isPrivate, { multiple: !previous });
      if (selected.length) {
        onChange((current) => previous
          ? current.map((item) => item.id === previous.id ? selected[0] : item)
          : [...current, ...selected]);
      }
    } catch (uploadError) {
      onError?.(uploadError);
    } finally {
      busy.current = false;
      setUploading(false);
      onUploadingChange(false);
    }
  };

  const open = async (item: MediaAsset) => {
    if (item.content_type.startsWith("image/")) {
      setPreview(item);
      return;
    }
    try {
      const url = await resolveMediaAccessUrl(item);
      if (!url) throw new Error("MISSING_MEDIA_URL");
      await openMediaUrl(url, {
        platform: Platform.OS,
        // The signed document endpoint responds with Content-Disposition:
        // attachment, keeping this form mounted while the browser downloads.
        assignWebLocation: (uri) => window.location.assign(uri),
        openExternalUrl: (uri) => Linking.openURL(uri),
      });
    } catch (openError) {
      // 원인을 특정할 수 없어 업로드 실패와 같은 Screen/Common/UploadFailModal로 알린다.
      onError?.(openError);
    }
  };

  if (isPrivate) {
    return (
      <View style={styles.section}>
        <Text style={styles.privateTitle}>{title} · {attachments.length}</Text>
        {attachments.map((item) => {
          const isImage = item.content_type.startsWith("image/");
          return (
            <View key={item.id} style={styles.privateRow}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${item.original_filename} 열기`} onPress={() => open(item)} style={styles.privateFile}>
                {isImage ? <MediaImage media={item} style={styles.privateThumbnail} resizeMode="cover" /> : (
                  <View style={styles.privateDocument}><Ionicons name="document-text-outline" size={25} color="#526078" /></View>
                )}
                <View style={styles.privateDescription}>
                  <Text numberOfLines={2} style={styles.privateFilename}>{item.original_filename}</Text>
                  <Text style={styles.privateSize}>{item.file_size < 1024 * 1024 ? `${Math.max(1, Math.round(item.file_size / 1024))} KB` : `${(item.file_size / (1024 * 1024)).toFixed(1)} MB`}</Text>
                </View>
              </Pressable>
              <View style={styles.privateActions}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.original_filename} 변경`} disabled={unavailable} onPress={() => upload(item)} style={[styles.privateAction, unavailable && styles.disabled]}>
                  <Text style={styles.privateChange}>변경</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.original_filename} 삭제`} disabled={unavailable} onPress={() => onChange((current) => current.filter((value) => value.id !== item.id))} style={[styles.privateAction, unavailable && styles.disabled]}>
                  <Text style={styles.privateRemove}>삭제</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        <View style={styles.addActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="파일 추가" disabled={unavailable} onPress={() => upload()} style={[styles.privateAdd, unavailable && styles.disabled]}>
            <Ionicons name="attach" size={20} color="#46556C" />
            <Text style={styles.privateAddText}>{uploading ? "업로드 중" : "파일 추가"}</Text>
          </Pressable>
        </View>
        {uploading ? <Text accessibilityLiveRegion="polite" style={styles.status}>파일을 업로드하고 있어요.</Text> : null}
        {preview ? <ImageViewerModal images={[preview]} initialIndex={0} onClose={() => setPreview(null)} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.addActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="파일 첨부" disabled={unavailable} onPress={() => upload()} style={[styles.add, unavailable && styles.disabled]}>
          <View style={styles.addVisual}>
            <AttachFileIcon size={16} color="#6B7280" />
            <Text style={styles.addText}>{uploading ? "업로드 중" : "파일 첨부"}</Text>
          </View>
        </Pressable>
      </View>
      <Text style={styles.extensionHint}>※ JPG, PNG, PDF, DOCX 첨부 가능</Text>

      {imageAttachments.length > 0 ? (
        <View style={styles.imageGrid}>
          {imageAttachments.map((item) => (
            <View key={item.id} style={styles.imageItem}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${item.original_filename} 열기`} onPress={() => open(item)}>
                <MediaImage media={item} style={styles.imageThumb} resizeMode="cover" />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`${item.original_filename} 삭제`} disabled={unavailable} onPress={() => onChange((current) => current.filter((value) => value.id !== item.id))} style={[styles.imageRemove, unavailable && styles.disabled]}>
                <View style={styles.imageRemoveVisual}>
                  <CloseIcon size={12} color="#FFFFFF" />
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {fileAttachments.length > 0 ? (
        <View style={styles.fileList}>
          {fileAttachments.map((item) => (
            <View key={item.id} style={styles.fileRow}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${item.original_filename} 열기`} onPress={() => open(item)} style={styles.fileOpen}>
                <Ionicons name="document-outline" size={16} color="#2F65F5" />
                <Text numberOfLines={1} style={styles.filename}>{item.original_filename}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`${item.original_filename} 변경`} disabled={unavailable} onPress={() => upload(item)} style={[styles.fileChange, unavailable && styles.disabled]}>
                <Text style={styles.change}>변경</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`${item.original_filename} 삭제`} disabled={unavailable} onPress={() => onChange((current) => current.filter((value) => value.id !== item.id))} style={[styles.fileRemove, unavailable && styles.disabled]}>
                <CloseIcon size={18} color="#6B7280" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {uploading ? <Text accessibilityLiveRegion="polite" style={styles.status}>파일을 업로드하고 있어요.</Text> : null}
      {preview ? <ImageViewerModal images={[preview]} initialIndex={0} onClose={() => setPreview(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { alignItems: "flex-start", gap: 8 },
  addActions: { width: "100%", flexDirection: "row", gap: 8 },
  add: { minHeight: 44, justifyContent: "center" },
  addVisual: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 0.5, borderColor: "#E1E4E9", borderRadius: 8, backgroundColor: "#FFFFFF", paddingHorizontal: 12, paddingVertical: 8 },
  addText: { color: "#6B7280", fontSize: 13, fontWeight: "400", lineHeight: 16 },
  extensionHint: { color: "#A6ACB7", fontSize: 12, fontWeight: "400", lineHeight: 15 },
  privateTitle: { fontSize: 14, fontWeight: "600", color: "#344054" },
  privateRow: { width: "100%", flexDirection: "row", alignItems: "center", gap: 4, padding: 10, borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 12, backgroundColor: "#FFFFFF" },
  privateFile: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  privateThumbnail: { width: 48, height: 48, borderRadius: 8, backgroundColor: "#F2F4F7" },
  privateDocument: { width: 48, height: 48, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#F2F4F7" },
  privateDescription: { flex: 1, minWidth: 0, gap: 4 },
  privateFilename: { fontSize: 13, lineHeight: 18, color: "#344054" },
  privateSize: { fontSize: 12, color: "#667085" },
  privateActions: { flexDirection: "row" },
  privateAction: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  privateChange: { fontSize: 13, fontWeight: "600", color: "#475467" },
  privateRemove: { fontSize: 13, fontWeight: "600", color: "#B42318" },
  privateAdd: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 10, backgroundColor: "#FFFFFF", paddingHorizontal: 16 },
  privateAddText: { fontSize: 13, fontWeight: "600", color: "#46556C" },
  imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  imageItem: { width: 72, height: 72, borderRadius: 8, overflow: "hidden", backgroundColor: "#E1E4E9" },
  imageThumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: "#E1E4E9" },
  imageRemove: { position: "absolute", top: 0, right: 0, width: 44, height: 44, alignItems: "flex-end", paddingTop: 4, paddingRight: 4 },
  imageRemoveVisual: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "rgba(17,24,39,0.68)" },
  fileList: { width: "100%", gap: 8 },
  fileRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 0.5, borderColor: "#E1E4E9", borderRadius: 8, backgroundColor: "#FFFFFF", paddingLeft: 14, paddingVertical: 0 },
  fileOpen: { minHeight: 44, flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  filename: { flex: 1, color: "#15171C", fontSize: 13, fontWeight: "400", lineHeight: 16 },
  fileChange: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  fileRemove: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  change: { color: "#6B7280", fontSize: 12, fontWeight: "600" },
  status: { color: "#667085", fontSize: 12 },
  disabled: { opacity: 0.45 },
});
