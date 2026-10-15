import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "./AppTypography";
import { BackIcon, CloseIcon } from "./icons";

// 글쓰기·글 수정 화면이 같이 쓰는 상단 바. 두 화면이 어긋나지 않게 한 곳에 둔다.
// 2026-10-15 피그마: 커뮤니티·스터디 모집·건의사항 글쓰기/수정도 제목 아래 구분선을 없앴다.
// 이제 모든 모양이 구분선 없이 그린다.
// - default: 닫기 X (일반 게시판 글쓰기·글 수정)
// - activity: 뒤로가기 < (Figma Verify-PhotoPreview)
// - mutualAid: Figma 상조회 신청 TopBar. padding 18/16/14, 닫기 20×20, 제목 18/21, 우측 spacer 20.
type Variant = "default" | "activity" | "mutualAid";

const COLORS = {
  text: "#15171C",
  bg: "#FFFFFF",
};

export default function PostFormAppBar({ title, onClose, variant = "default" }: { title: string; onClose: () => void; variant?: Variant }) {
  const insets = useSafeAreaInsets();
  const isMutualAid = variant === "mutualAid";
  return (
    <View style={[styles.appBar, isMutualAid ? styles.appBarMutualAid : null, { paddingTop: Math.max(insets.top, 10) + (isMutualAid ? 18 : 0) }]}>
      <Pressable
        accessibilityLabel="닫기"
        hitSlop={isMutualAid ? 11 : undefined}
        onPress={onClose}
        style={isMutualAid ? styles.appBarIconMutualAid : styles.iconButton}
      >
        {isMutualAid ? (
          <CloseIcon size={20} color={COLORS.text} />
        ) : variant === "activity" ? (
          <BackIcon size={24} color={COLORS.text} />
        ) : (
          <Ionicons name="close" size={24} color={COLORS.text} />
        )}
      </Pressable>
      <Text style={[styles.appBarTitle, isMutualAid ? styles.appBarTitleMutualAid : null]}>{title}</Text>
      <View style={isMutualAid ? styles.appBarIconMutualAid : styles.iconButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  appBar: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  appBarMutualAid: {
    minHeight: 0,
    paddingBottom: 14, // Figma TopBar padding 18/16/14
  },
  appBarIconMutualAid: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  appBarTitleMutualAid: {
    lineHeight: 21, // Figma 18/21
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
  },
  appBarTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 22, // Figma: 글쓰기 18/22 Medium
  },
});
