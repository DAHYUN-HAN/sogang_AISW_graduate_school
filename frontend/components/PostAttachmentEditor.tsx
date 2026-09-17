import { Ionicons } from "@expo/vector-icons";
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { resolveMediaAccessUrl } from "../hooks/useMediaAccessUrl";
import type { MediaAsset } from "../types";
import { openMediaUrl } from "../utils/mediaOpener";
import { pickAndUploadDocuments, pickAndUploadImages } from "../utils/mediaPicker";
import ImageViewerModal from "./ImageViewerModal";
import MediaImage from "./MediaImage";

type Props = {
  attachments: MediaAsset[];
  onChange: Dispatch<SetStateAction<MediaAsset[]>>;
  onUploadingChange: (uploading: boolean) => void;
  isPrivate?: boolean;
  disabled?: boolean;
  title?: string;
};

export default function PostAttachmentEditor({ attachments, onChange, onUploadingChange, isPrivate = false, disabled = false, title = "첨부파일" }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const busy = useRef(false);
  const unavailable = disabled || uploading;

  const upload = async (kind: "image" | "document", previous?: MediaAsset) => {
    if (disabled || busy.current) return;
    busy.current = true;
    setUploading(true);
    onUploadingChange(true);
    setError("");
    try {
      const selected = kind === "image" && !isPrivate
        ? await pickAndUploadImages(undefined, previous ? { maxSelection: 1 } : undefined)
        : await pickAndUploadDocuments(undefined, isPrivate, { multiple: !previous });
      if (selected.length) {
        onChange((current) => previous
          ? current.map((item) => item.id === previous.id ? selected[0] : item)
          : [...current, ...selected]);
      }
    } catch {
      setError("파일을 업로드하지 못했어요. 다시 시도해주세요.");
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
    } catch {
      setError("파일을 열지 못했어요. 다시 시도해주세요.");
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title} · {attachments.length}</Text>
      {attachments.map((item) => {
        const isImage = item.content_type.startsWith("image/");
        return (
          <View key={item.id} style={styles.row}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${item.original_filename} 열기`} onPress={() => open(item)} style={styles.file}>
              {isImage ? <MediaImage media={item} style={styles.thumbnail} resizeMode="cover" /> : (
                <View style={styles.document}><Ionicons name="document-text-outline" size={25} color="#526078" /></View>
              )}
              <View style={styles.description}>
                <Text numberOfLines={2} style={styles.filename}>{item.original_filename}</Text>
                <Text style={styles.size}>{item.file_size < 1024 * 1024 ? `${Math.max(1, Math.round(item.file_size / 1024))} KB` : `${(item.file_size / (1024 * 1024)).toFixed(1)} MB`}</Text>
              </View>
            </Pressable>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${item.original_filename} 변경`} disabled={unavailable} onPress={() => upload(isImage ? "image" : "document", item)} style={[styles.action, unavailable && styles.disabled]}>
                <Text style={styles.change}>변경</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`${item.original_filename} 삭제`} disabled={unavailable} onPress={() => onChange((current) => current.filter((value) => value.id !== item.id))} style={[styles.action, unavailable && styles.disabled]}>
                <Text style={styles.remove}>삭제</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      <View style={styles.addActions}>
        {!isPrivate ? <Pressable accessibilityRole="button" accessibilityLabel="사진 추가" disabled={unavailable} onPress={() => upload("image")} style={[styles.add, unavailable && styles.disabled]}>
          <Ionicons name="image-outline" size={19} color="#46556C" /><Text style={styles.addText}>사진 추가</Text>
        </Pressable> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="파일 추가" disabled={unavailable} onPress={() => upload("document")} style={[styles.add, unavailable && styles.disabled]}>
          <Ionicons name="attach" size={20} color="#46556C" /><Text style={styles.addText}>파일 추가</Text>
        </Pressable>
      </View>
      {uploading ? <Text accessibilityLiveRegion="polite" style={styles.size}>파일을 업로드하고 있어요.</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {preview ? <ImageViewerModal images={[preview]} initialIndex={0} onClose={() => setPreview(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  title: { fontSize: 14, fontWeight: "600", color: "#344054" },
  row: { flexDirection: "row", alignItems: "center", gap: 4, padding: 10, borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 12, backgroundColor: "#FFFFFF" },
  file: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  thumbnail: { width: 48, height: 48, borderRadius: 8, backgroundColor: "#F2F4F7" },
  document: { width: 48, height: 48, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#F2F4F7" },
  description: { flex: 1, minWidth: 0, gap: 4 },
  filename: { fontSize: 13, lineHeight: 18, color: "#344054" },
  size: { fontSize: 12, color: "#667085" },
  actions: { flexDirection: "row" },
  action: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  change: { fontSize: 13, fontWeight: "600", color: "#475467" },
  remove: { fontSize: 13, fontWeight: "600", color: "#B42318" },
  addActions: { flexDirection: "row", gap: 8 },
  add: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, flex: 1, minHeight: 44, borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 10, backgroundColor: "#FFFFFF" },
  addText: { fontSize: 13, fontWeight: "600", color: "#46556C" },
  error: { fontSize: 12, lineHeight: 18, color: "#B42318" },
  disabled: { opacity: 0.45 },
});
