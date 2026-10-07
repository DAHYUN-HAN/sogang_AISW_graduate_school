import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../../../components/AppTypography";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackIcon } from "../../../../components/icons";
import { useReturnToMyPageDrawer } from "../../../../hooks/useReturnToMyPageDrawer";
const COLORS = {
  text: "#15171C",
  subtle: "#A6ACB7",
  border: "#E1E4E9",
  bg: "#FFFFFF",
  danger: "#E24B4A",
};

export default function AccountSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { returnToMyPageDrawer, onLayout } = useReturnToMyPageDrawer("/settings/account");

  return (
    <View style={styles.screen} onLayout={onLayout}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable
          accessibilityLabel="뒤로"
          accessibilityRole="button"
          onPress={returnToMyPageDrawer}
          style={styles.iconButton}
        >
          <BackIcon size={24} color={COLORS.text} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.appBarTitle}>
          계정 설정
        </Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView style={styles.scroller} contentContainerStyle={styles.content}>
        <View style={styles.menuList}>
          <Pressable onPress={() => router.push("/settings/password")} style={styles.menuRow}>
            <Text style={styles.menuText}>비밀번호 변경</Text>
            <Ionicons name="chevron-forward" size={15} color={COLORS.subtle} />
          </Pressable>
          <Pressable onPress={() => router.push("/settings/email-verification")} style={styles.menuRow}>
            <Text style={styles.menuText}>학교 이메일 인증 정보</Text>
            <Ionicons name="chevron-forward" size={15} color={COLORS.subtle} />
          </Pressable>
          <Pressable onPress={() => router.push("/legal/privacy")} style={styles.menuRow}>
            <Text style={styles.menuText}>개인정보 수집 및 이용 동의</Text>
            <Ionicons name="chevron-forward" size={15} color={COLORS.subtle} />
          </Pressable>
        </View>
        <View style={styles.deactivateWrap}>
          <Pressable
            accessibilityHint="비밀번호 확인 후 계정과 개인정보를 삭제하는 화면을 엽니다."
            accessibilityRole="link"
            onPress={() => router.push("/settings/account-deletion")}
            style={styles.deactivateRow}
          >
            <Text style={styles.dangerText}>회원 탈퇴</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  appBar: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  appBarTitle: { color: COLORS.text, fontSize: 18, fontWeight: "500" },
  scroller: { flex: 1 },
  content: { paddingBottom: 36 },
  menuList: { paddingTop: 4, paddingHorizontal: 16 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingVertical: 13,
  },
  menuText: { color: COLORS.text, fontSize: 14, fontWeight: "400" },
  deactivateWrap: { paddingTop: 8, paddingHorizontal: 16 },
  deactivateRow: { paddingVertical: 13 },
  dangerText: { color: COLORS.danger, fontSize: 14, fontWeight: "400" },
});
