import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

// Figma: Screen/Common/UploadFailModal (1136:57), Screen/Common/RateLimitModal (1142:45)
// 두 화면이 제목·본문만 다르고 구조가 같아 하나로 만들었다.
// 값은 DiscardWriteModal과 같은 디자인 시스템을 따른다.
const COLORS = {
  surface: "#FFFFFF",
  text: "#15171C",
  body: "#4B5160",
  border: "#E1E4E9",
};

export type NoticeModalContent = { title: string; body: string };

type Props = {
  notice: NoticeModalContent | null;
  onClose: () => void;
  confirmLabel?: string;
};

/**
 * 확인 버튼 하나짜리 알림창. 사용자가 읽고 넘어가야 하는 안내에만 쓴다.
 * 입력 오류처럼 곧바로 고칠 수 있는 것은 토스트를 쓴다.
 */
export default function NoticeModal({ notice, onClose, confirmLabel = "확인" }: Props) {
  return (
    <Modal animationType="fade" transparent visible={Boolean(notice)} onRequestClose={onClose}>
      <Pressable accessibilityViewIsModal accessibilityLabel={confirmLabel} onPress={onClose} style={styles.backdrop}>
        <Pressable onPress={() => undefined} style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>{notice?.title}</Text>
          <Text style={styles.body}>{notice?.body}</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.confirmButton}>
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    maxWidth: 280,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 20,
    gap: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 26,
    textAlign: "center",
  },
  body: {
    color: COLORS.body,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 22,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
  },
  confirmButton: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
  },
  confirmText: {
    color: COLORS.body,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
  },
});
