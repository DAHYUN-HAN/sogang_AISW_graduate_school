import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../../components/AppTypography";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMeQuery } from "../../../hooks/useApi";

import { BackIcon } from "../../../components/icons";
const COLORS = {
  text: "#15171C",
  label: "#6B7280",
  subtle: "#A6ACB7",
  cardBg: "#F7F8FA",
  green: "#2E9E5B",
  bg: "#FFFFFF",
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const base = `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  return `${base}(${WEEKDAYS[date.getDay()]})`;
}

export default function EmailVerificationScreen() {
  const insets = useSafeAreaInsets();
  const { data } = useMeQuery();
  const me = data?.data;
  const verifiedDate = formatDate(me?.created_at);

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable
          accessibilityLabel="뒤로"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/settings/account");
          }}
          style={styles.iconButton}
        >
          <BackIcon size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.appBarTitle}>학교 이메일 인증 정보</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView style={styles.scroller} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.verifiedRow}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.green} />
            <Text style={styles.verifiedText}>인증된 학교 이메일이에요</Text>
          </View>
          <Text style={styles.email}>{me?.email ?? "-"}</Text>
          {verifiedDate ? <Text style={styles.verifiedDate}>인증일 {verifiedDate}</Text> : null}
        </View>
        <Text style={styles.notice}>이메일이 변경되었거나 인증에 문제가 있다면 학과 행정실로 문의해주세요.</Text>
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
  appBarTitle: { color: COLORS.text, fontSize: 17, fontWeight: "500" },
  scroller: { flex: 1 },
  content: { paddingTop: 12, paddingHorizontal: 16, gap: 16 },
  card: {
    gap: 8,
    borderRadius: 12,
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  verifiedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  verifiedText: { color: COLORS.green, fontSize: 14, fontWeight: "500", lineHeight: 17 },
  email: { color: COLORS.text, fontSize: 17, fontWeight: "500", lineHeight: 21 },
  verifiedDate: { color: COLORS.subtle, fontSize: 12, fontWeight: "400", lineHeight: 15 },
  notice: { color: COLORS.label, fontSize: 13, fontWeight: "400", lineHeight: 16 },
});
