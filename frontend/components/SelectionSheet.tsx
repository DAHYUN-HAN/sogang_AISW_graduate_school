import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText as Text } from "./AppTypography";
import { SheetCheckIcon } from "./icons";
import LoadingState from "./LoadingState";

// 아래에서 올라오는 선택 시트. 글쓰기의 게시판·동아리·경조사 선택과 글 수정의
// 게시판 이동이 같은 모양을 쓰도록 한곳에 둔다.
const COLORS = {
  primary: "#2761FF",
  text: "#15171C",
  muted: "#6B7280",
  bg: "#FFFFFF",
};

const SHEET_BOTTOM_PADDING = 24;

export type SelectionOption = { key: string; label: string };

export default function SelectionSheet({
  visible,
  title,
  options,
  emptyText,
  loading = false,
  selectedKey,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: SelectionOption[];
  emptyText: string;
  // 목록을 받는 중이면 빈 문구 대신 피그마 공통 로딩을 보인다.
  loading?: boolean;
  selectedKey?: string;
  onClose: () => void;
  onSelect: (option: SelectionOption) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    // 안드로이드 시스템 바 아래까지 그려 디자인처럼 시트가 화면 끝에 붙게 한다.
    <Modal animationType="slide" transparent statusBarTranslucent navigationBarTranslucent visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.sheetBackdrop}>
        {/* 디자인의 하단 여백 24 안에 홈 막대 영역을 포개고, 그보다 높을 때만 늘린다. */}
        <Pressable onPress={() => undefined} style={[styles.sheetCard, { paddingBottom: Math.max(insets.bottom, SHEET_BOTTOM_PADDING) }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {options.length === 0 && loading ? <LoadingState compact /> : null}
            {options.length === 0 && !loading ? <Text style={styles.sheetEmpty}>{emptyText}</Text> : null}
            {options.map((option, index) => {
              const active = option.key === selectedKey;
              // 디자인처럼 구분선은 항목 사이에만 두고 마지막 항목 아래에는 긋지 않는다.
              const last = index === options.length - 1;
              return (
                <Pressable key={option.key} onPress={() => onSelect(option)} style={[styles.sheetOption, last ? styles.sheetOptionLast : null]}>
                  <Text style={[styles.sheetOptionText, active ? styles.sheetOptionTextActive : null]}>{option.label}</Text>
                  {active ? <SheetCheckIcon color={COLORS.primary} /> : null}
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: "#C7CCD4",
    // 디자인의 손잡이 영역은 27 높이(막대 4 + 아래 23)라 제목이 그만큼 내려온다.
    marginBottom: 23,
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
  sheetOptionLast: {
    borderBottomWidth: 0,
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
