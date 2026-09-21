import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// 아래에서 올라오는 선택 시트. 글쓰기의 게시판·동아리·경조사 선택과 글 수정의
// 게시판 이동이 같은 모양을 쓰도록 한곳에 둔다.
const COLORS = {
  primary: "#2761FF",
  text: "#15171C",
  muted: "#6B7280",
  bg: "#FFFFFF",
};

export type SelectionOption = { key: string; label: string };

export default function SelectionSheet({
  visible,
  title,
  options,
  emptyText,
  selectedKey,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: SelectionOption[];
  emptyText: string;
  selectedKey?: string;
  onClose: () => void;
  onSelect: (option: SelectionOption) => void;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.sheetBackdrop}>
        <Pressable onPress={() => undefined} style={styles.sheetCard}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {options.length === 0 ? <Text style={styles.sheetEmpty}>{emptyText}</Text> : null}
            {options.map((option) => {
              const active = option.key === selectedKey;
              return (
                <Pressable key={option.key} onPress={() => onSelect(option)} style={styles.sheetOption}>
                  <Text style={[styles.sheetOptionText, active ? styles.sheetOptionTextActive : null]}>{option.label}</Text>
                  {active ? <Ionicons name="checkmark" size={16} color={COLORS.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "rgba(17, 24, 39, 0.42)",
  },
  sheetCard: {
    width: "100%",
    maxWidth: 405,
    maxHeight: "70%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: "#C7CCD4",
    marginBottom: 16,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "500",
    marginBottom: 8,
  },
  sheetOption: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EAECEF",
  },
  sheetOptionText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "400",
  },
  sheetOptionTextActive: {
    color: COLORS.primary,
    fontWeight: "500",
  },
  sheetEmpty: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: 24,
  },
});
