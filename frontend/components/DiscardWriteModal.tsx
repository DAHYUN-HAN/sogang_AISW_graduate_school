import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

// Figma: Screen/Common/DiscardWriteModal (node 1344:45)
// 값은 게시물 삭제 확인창과 같은 디자인 시스템을 따른다.
const COLORS = {
  surface: "#FFFFFF",
  text: "#15171C",
  body: "#4B5160",
  border: "#E1E4E9",
  danger: "#D64545",
};

export type DiscardWriteMode = "create" | "edit";

const COPY: Record<DiscardWriteMode, { title: string; body: string; keep: string; discard: string }> = {
  create: {
    title: "작성을 취소하시겠어요?",
    body: "작성 중인 내용은 저장되지 않아요.",
    keep: "계속 작성",
    discard: "작성 취소",
  },
  edit: {
    title: "수정을 취소하시겠어요?",
    body: "수정 중인 내용은 저장되지 않아요.",
    keep: "계속 수정",
    discard: "수정 취소",
  },
};

type Props = {
  visible: boolean;
  mode: DiscardWriteMode;
  onKeep: () => void;
  onDiscard: () => void;
};

export default function DiscardWriteModal({ visible, mode, onKeep, onDiscard }: Props) {
  const copy = COPY[mode];

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onKeep}>
      <Pressable accessibilityViewIsModal accessibilityLabel={copy.keep} onPress={onKeep} style={styles.backdrop}>
        <Pressable onPress={() => undefined} style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onKeep} style={styles.keepButton}>
              <Text style={styles.keepText}>{copy.keep}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onDiscard} style={styles.discardButton}>
              <Text style={styles.discardText}>{copy.discard}</Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.4)", // Figma 딤드배경
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
    gap: 8,
  },
  keepButton: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
  },
  keepText: {
    color: COLORS.body,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
  },
  discardButton: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 14,
  },
  discardText: {
    color: COLORS.surface,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
  },
});
